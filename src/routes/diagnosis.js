/**
 * Diagnosis & Staging Routes
 *
 * Endpoints for managing diagnosis and staging information with source tracking
 */

import { Hono } from 'hono';
import { Diagnosis } from '../models/diagnosis.js';
import { Staging } from '../models/staging.js';
import { DataVersion } from '../models/data-version.js';
import { StagingSnapshotRepository } from '../repositories/staging-snapshot.repository.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { trackMultipleFieldSources } from '../utils/data-source.js';
import { getCurrentTimestamp } from '../utils/helpers.js';

const diagnosis = new Hono();

// ============================================================================
// DIAGNOSIS ENDPOINTS
// ============================================================================

// Get diagnosis for a patient
diagnosis.get('/:id/diagnosis', async (c) => {
  try {
    const { id: patientId } = c.req.param();

    const diagnosisRecord = await Diagnosis.getByPatientId(c.env, patientId);

    if (!diagnosisRecord) {
      return c.json({
        success: true,
        data: null,
        message: 'No diagnosis found for this patient'
      });
    }

    const diagnosisData = diagnosisRecord.toJSON();
    const dataSources = diagnosisData.data_sources || {};

    // Get document IDs from data_sources
    const documentIds = new Set();
    Object.values(dataSources).forEach(source => {
      if (Array.isArray(source)) {
        source.forEach(docId => documentIds.add(docId));
      } else if (typeof source === 'string') {
        documentIds.add(source);
      } else if (source && source.source) {
        documentIds.add(source.source);
      }
    });

    // Fetch document filenames and dates
    const documentMap = {};
    if (documentIds.size > 0) {
      const placeholders = Array.from(documentIds).map(() => '?').join(',');
      const docs = await c.env.DB.prepare(`
        SELECT id, filename, document_date FROM documents WHERE id IN (${placeholders})
      `).bind(...Array.from(documentIds)).all();
      
      docs.results.forEach(doc => {
        documentMap[doc.id] = {
          filename: doc.filename,
          document_date: doc.document_date
        };
      });
    }

    // Build standardized field-level source mapping
    const sources = {};
    Object.entries(dataSources).forEach(([field, source]) => {
      const docIds = Array.isArray(source) ? source : (typeof source === 'string' ? [source] : (source?.source ? [source.source] : []));
      sources[field] = docIds.map(docId => {
        const doc = documentMap[docId];
        return {
          document_id: docId,
          filename: doc?.filename || null,
          document_date: doc?.document_date || null
        };
      });
    });

    // Remove data_sources from response, add standardized sources
    const { data_sources, ...restDiagnosisData } = diagnosisData;

    return c.json({
      success: true,
      data: {
        ...restDiagnosisData,
        sources
      }
    });

  } catch (error) {
    console.error('Error getting diagnosis:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Update diagnosis (admin only, creates version)
diagnosis.put('/:id/diagnosis', async (c) => {
  try {
    const { id: patientId } = c.req.param();
    const body = await c.req.json();

    // Get user from context (assumes auth middleware)
    const userId = c.get('userId') || 'system';
    const userRole = c.get('userRole') || 'user';

    // Check if admin (this should be enforced by middleware)
    if (userRole !== 'admin') {
      return c.json({
        success: false,
        error: 'Unauthorized: Admin access required'
      }, 403);
    }

    // Get existing diagnosis or create new
    let existing = await Diagnosis.getByPatientId(c.env, patientId);
    let diagnosisId = existing?.id;

    if (!existing) {
      // Create new diagnosis
      body.patient_id = patientId;
      const errors = Diagnosis.validate(body);
      if (errors.length > 0) {
        throw new ValidationError(errors.join(', '));
      }

      const newDiagnosis = await Diagnosis.create(c.env, body);

      return c.json({
        success: true,
        message: 'Diagnosis created successfully',
        data: newDiagnosis.toJSON()
      }, 201);
    }

    // Update existing - track changes for version history
    const fieldsToTrack = [
      'primary_cancer_type', 'primary_cancer_subtype', 'icd_code', 'diagnosis_date',
      'tumor_location', 'tumor_laterality', 'tumor_size_cm', 'tumor_grade', 'histology'
    ];

    const versionFields = [];
    for (const field of fieldsToTrack) {
      if (body[field] !== undefined && body[field] !== existing[field]) {
        versionFields.push({
          fieldName: field,
          oldValue: existing[field],
          newValue: body[field],
          originalSource: existing.data_sources?.[field]?.source || null
        });
      }
    }

    // Create version history for changed fields
    if (versionFields.length > 0) {
      await DataVersion.createMultipleVersions(c.env, {
        recordType: 'diagnosis',
        recordId: diagnosisId,
        patientId,
        editedBy: userId,
        editReason: body.edit_reason || 'Manual update'
      }, versionFields);
    }

    // Update data_sources to mark manual override
    const dataSources = existing.data_sources || {};
    const updatedSources = trackMultipleFieldSources(dataSources,
      Object.fromEntries(
        versionFields.map(f => [
          f.fieldName,
          { value: f.newValue, source: 'manual_override' }
        ])
      )
    );

    body.data_sources = updatedSources;

    // Validate and update
    const errors = Diagnosis.validate({ ...existing, ...body });
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    const updated = await Diagnosis.update(c.env, diagnosisId, body);

    return c.json({
      success: true,
      message: 'Diagnosis updated successfully',
      data: updated.toJSON(),
      versions_created: versionFields.length
    });

  } catch (error) {
    console.error('Error updating diagnosis:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// STAGING ENDPOINTS
// ============================================================================

// Get staging for a patient (returns current + timeline)
diagnosis.get('/:id/staging', async (c) => {
  try {
    const { id: patientId } = c.req.param();

    const stagingRepo = StagingSnapshotRepository(c.env.DB);
    const snapshots = await stagingRepo.findByPatientId(patientId);
    const latest = snapshots.length > 0 ? snapshots[0] : null;

    // Also get legacy staging record for backward compatibility
    const stagingRecord = await Staging.getByPatientId(c.env, patientId);

    // Build timeline from snapshots
    const timeline = snapshots.map(snapshot => ({
      id: snapshot.id,
      staging_type: snapshot.staging_type,
      staging_date: snapshot.staging_date,
      staging_system: snapshot.staging_system,
      clinical_tnm: snapshot.clinical_tnm,
      pathological_tnm: snapshot.pathological_tnm,
      overall_stage: snapshot.overall_stage,
      source_document: snapshot.document_id,
      created_at: snapshot.created_at
    }));

    // Get document filenames and dates for sources
    const documentIds = [...new Set(snapshots.map(s => s.document_id).filter(Boolean))];
    const documentSources = {};
    if (documentIds.length > 0) {
      const placeholders = documentIds.map(() => '?').join(',');
      const docs = await c.env.DB.prepare(`
        SELECT id, filename, document_date FROM documents WHERE id IN (${placeholders})
      `).bind(...documentIds).all();
      docs.results.forEach(doc => {
        documentSources[doc.id] = {
          filename: doc.filename,
          document_date: doc.document_date
        };
      });
    }

    // Add filenames and dates to timeline
    timeline.forEach(item => {
      if (item.source_document && documentSources[item.source_document]) {
        item.source_document_filename = documentSources[item.source_document].filename;
        item.source_document_date = documentSources[item.source_document].document_date;
      }
    });

    return c.json({
      success: true,
      data: {
        current: latest ? {
          id: latest.id,
          staging_type: latest.staging_type,
          staging_date: latest.staging_date,
          staging_system: latest.staging_system,
          clinical_tnm: latest.clinical_tnm,
          pathological_tnm: latest.pathological_tnm,
          overall_stage: latest.overall_stage,
          source_document: latest.document_id,
          source_document_filename: latest.document_id ? documentSources[latest.document_id]?.filename : null,
          source_document_date: latest.document_id ? documentSources[latest.document_id]?.document_date : null
        } : (stagingRecord ? {
          // Fallback to legacy staging if no snapshots
          id: stagingRecord.id,
          staging_type: 'initial',
          staging_date: stagingRecord.staging_date,
          staging_system: stagingRecord.staging_system,
          clinical_tnm: stagingRecord.clinical_t ? 
            `${stagingRecord.clinical_t}${stagingRecord.clinical_n || ''}${stagingRecord.clinical_m || ''}` : null,
          pathological_tnm: stagingRecord.pathological_t ?
            `${stagingRecord.pathological_t}${stagingRecord.pathological_n || ''}${stagingRecord.pathological_m || ''}` : null,
          overall_stage: stagingRecord.clinical_stage || stagingRecord.pathological_stage,
          source_document: null
        } : null),
        timeline,
        document_sources: Object.entries(documentSources).map(([id, filename]) => ({
          document_id: id,
          filename
        }))
      }
    });

  } catch (error) {
    console.error('Error getting staging:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Update staging (admin only, creates version)
diagnosis.put('/:id/staging', async (c) => {
  try {
    const { id: patientId } = c.req.param();
    const body = await c.req.json();

    // Get user from context (assumes auth middleware)
    const userId = c.get('userId') || 'system';
    const userRole = c.get('userRole') || 'user';

    // Check if admin (this should be enforced by middleware)
    if (userRole !== 'admin') {
      return c.json({
        success: false,
        error: 'Unauthorized: Admin access required'
      }, 403);
    }

    // Get existing staging or create new
    let existing = await Staging.getByPatientId(c.env, patientId);
    let stagingId = existing?.id;

    if (!existing) {
      // Create new staging
      body.patient_id = patientId;
      const errors = Staging.validate(body);
      if (errors.length > 0) {
        throw new ValidationError(errors.join(', '));
      }

      const newStaging = await Staging.create(c.env, body);

      return c.json({
        success: true,
        message: 'Staging created successfully',
        data: newStaging.toJSON()
      }, 201);
    }

    // Update existing - track changes for version history
    const fieldsToTrack = [
      'clinical_t', 'clinical_n', 'clinical_m',
      'pathological_t', 'pathological_n', 'pathological_m',
      'clinical_stage', 'pathological_stage',
      'staging_system', 'staging_date'
    ];

    const versionFields = [];
    for (const field of fieldsToTrack) {
      if (body[field] !== undefined && body[field] !== existing[field]) {
        versionFields.push({
          fieldName: field,
          oldValue: existing[field],
          newValue: body[field],
          originalSource: existing.data_sources?.[field]?.source || null
        });
      }
    }

    // Create version history for changed fields
    if (versionFields.length > 0) {
      await DataVersion.createMultipleVersions(c.env, {
        recordType: 'staging',
        recordId: stagingId,
        patientId,
        editedBy: userId,
        editReason: body.edit_reason || 'Manual update'
      }, versionFields);
    }

    // Update data_sources to mark manual override
    const dataSources = existing.data_sources || {};
    const updatedSources = trackMultipleFieldSources(dataSources,
      Object.fromEntries(
        versionFields.map(f => [
          f.fieldName,
          { value: f.newValue, source: 'manual_override' }
        ])
      )
    );

    body.data_sources = updatedSources;

    // Validate and update
    const errors = Staging.validate({ ...existing, ...body });
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    const updated = await Staging.update(c.env, stagingId, body);

    return c.json({
      success: true,
      message: 'Staging updated successfully',
      data: updated.toJSON(),
      versions_created: versionFields.length
    });

  } catch (error) {
    console.error('Error updating staging:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// STAGING SNAPSHOTS ENDPOINTS
// ============================================================================

// Get all staging snapshots (timeline)
diagnosis.get('/:id/staging/snapshots', async (c) => {
  try {
    const { id: patientId } = c.req.param();

    const stagingRepo = StagingSnapshotRepository(c.env.DB);
    const snapshots = await stagingRepo.findByPatientId(patientId);

    // Get document filenames and dates for sources
    const documentIds = [...new Set(snapshots.map(s => s.document_id).filter(Boolean))];
    const documentSources = {};
    if (documentIds.length > 0) {
      const placeholders = documentIds.map(() => '?').join(',');
      const docs = await c.env.DB.prepare(`
        SELECT id, filename, document_date FROM documents WHERE id IN (${placeholders})
      `).bind(...documentIds).all();
      docs.results.forEach(doc => {
        documentSources[doc.id] = {
          filename: doc.filename,
          document_date: doc.document_date
        };
      });
    }

    return c.json({
      success: true,
      data: {
        snapshots: snapshots.map(s => ({
          id: s.id,
          staging_type: s.staging_type,
          staging_date: s.staging_date,
          staging_system: s.staging_system,
          clinical_tnm: s.clinical_tnm,
          pathological_tnm: s.pathological_tnm,
          overall_stage: s.overall_stage,
          notes: s.notes,
          document_id: s.document_id,
          source_document_filename: s.document_id ? documentSources[s.document_id]?.filename : null,
          source_document_date: s.document_id ? documentSources[s.document_id]?.document_date : null,
          created_at: s.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error getting staging snapshots:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Create staging snapshot manually (admin)
diagnosis.post('/:id/staging/snapshots', async (c) => {
  try {
    const { id: patientId } = c.req.param();
    const body = await c.req.json();

    // Get user from context (assumes auth middleware)
    const user = c.get('user');
    const userRole = user?.role || 'user';

    // Check if admin
    if (userRole !== 'admin') {
      return c.json({
        success: false,
        error: 'Unauthorized: Admin access required'
      }, 403);
    }

    // Validate required fields
    if (!body.staging_type || !body.staging_date) {
      throw new ValidationError('staging_type and staging_date are required');
    }

    const stagingRepo = StagingSnapshotRepository(c.env.DB);

    // Generate ID
    const snapshotId = `stg_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;

    const snapshot = {
      id: snapshotId,
      patient_id: patientId,
      document_id: body.document_id || null,
      staging_type: body.staging_type,
      staging_date: body.staging_date,
      staging_system: body.staging_system || 'AJCC 8th Edition',
      clinical_tnm: body.clinical_tnm || null,
      pathological_tnm: body.pathological_tnm || null,
      overall_stage: body.overall_stage || null,
      notes: body.notes || null,
      created_at: getCurrentTimestamp()
    };

    await stagingRepo.create(snapshot);

    return c.json({
      success: true,
      message: 'Staging snapshot created successfully',
      data: snapshot
    }, 201);
  } catch (error) {
    console.error('Error creating staging snapshot:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default diagnosis;
