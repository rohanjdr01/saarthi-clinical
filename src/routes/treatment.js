/**
 * Treatment Routes
 *
 * Endpoints for managing treatment regimens and cycles with source tracking
 */

import { Hono } from 'hono';
import { Treatment } from '../models/treatment.js';
import { TreatmentCycle } from '../models/treatment-cycle.js';
import { DataVersion } from '../models/data-version.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { trackMultipleFieldSources } from '../utils/data-source.js';

const treatment = new Hono();

// ============================================================================
// TREATMENT ENDPOINTS
// ============================================================================

// Get treatment overview for a patient
treatment.get('/:id/treatment', async (c) => {
  try {
    const { id: patientId } = c.req.param();

    const treatmentRecord = await Treatment.getCurrentByPatientId(c.env, patientId);

    if (!treatmentRecord) {
      return c.json({
        success: true,
        data: null,
        message: 'No active treatment found for this patient'
      });
    }

    const treatmentData = treatmentRecord.toJSON();
    const dataSources = treatmentData.data_sources || {};

    // Get document IDs from data_sources
    const documentIds = new Set();
    Object.values(dataSources).forEach(source => {
      if (source && source.source && source.source !== 'manual_override' && source.source !== 'ai_inferred') {
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
      if (source && source.source && source.source !== 'manual_override' && source.source !== 'ai_inferred') {
        const doc = documentMap[source.source];
        if (!sources[field]) {
          sources[field] = [];
        }
        sources[field].push({
          document_id: source.source,
          filename: doc?.filename || null,
          document_date: doc?.document_date || null
        });
      }
    });

    // Remove data_sources from response, add standardized sources
    const { data_sources, ...restTreatmentData } = treatmentData;

    return c.json({
      success: true,
      data: {
        ...restTreatmentData,
        sources: Object.keys(sources).length > 0 ? sources : undefined
      }
    });

  } catch (error) {
    console.error('Error getting treatment:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Update treatment (admin only, creates version)
treatment.put('/:id/treatment', async (c) => {
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

    // Get existing treatment or create new
    let existing = await Treatment.getCurrentByPatientId(c.env, patientId);
    let treatmentId = existing?.id;

    if (!existing) {
      // Create new treatment
      body.patient_id = patientId;
      const errors = Treatment.validate(body);
      if (errors.length > 0) {
        throw new ValidationError(errors.join(', '));
      }

      const newTreatment = await Treatment.create(c.env, body);

      return c.json({
        success: true,
        message: 'Treatment created successfully',
        data: newTreatment.toJSON()
      }, 201);
    }

    // Update existing - track changes for version history
    const fieldsToTrack = [
      'regimen_name', 'treatment_intent', 'treatment_line',
      'protocol', 'total_planned_cycles', 'treatment_status',
      'best_response', 'response_date'
    ];

    const versionFields = [];
    for (const field of fieldsToTrack) {
      if (body[field] !== undefined && JSON.stringify(body[field]) !== JSON.stringify(existing[field])) {
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
        recordType: 'treatment',
        recordId: treatmentId,
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
    const errors = Treatment.validate({ ...existing, ...body });
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    const updated = await Treatment.update(c.env, treatmentId, body);

    return c.json({
      success: true,
      message: 'Treatment updated successfully',
      data: updated.toJSON(),
      versions_created: versionFields.length
    });

  } catch (error) {
    console.error('Error updating treatment:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// TREATMENT CYCLES ENDPOINTS
// ============================================================================

// Get all cycles for current treatment
treatment.get('/:id/treatment/cycles', async (c) => {
  try {
    const { id: patientId } = c.req.param();

    // Get current treatment
    const treatmentRecord = await Treatment.getCurrentByPatientId(c.env, patientId);

    if (!treatmentRecord) {
      return c.json({
        success: true,
        data: [],
        message: 'No active treatment found for this patient'
      });
    }

    // Get all cycles for this treatment
    const cycles = await TreatmentCycle.getByTreatmentId(c.env, treatmentRecord.id);

    // Get document IDs from cycles for source standardization
    const documentIds = new Set();
    cycles.forEach(cycle => {
      const cycleData = cycle.toJSON();
      const dataSources = cycleData.data_sources;
      if (dataSources && typeof dataSources === 'object' && dataSources.source) {
        documentIds.add(dataSources.source);
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

    // Standardize cycle responses
    const standardizedCycles = cycles.map(cycle => {
      const cycleData = cycle.toJSON();
      const { data_sources, ...restCycleData } = cycleData;
      
      // Transform data_sources to standardized source format
      let source = null;
      if (data_sources && typeof data_sources === 'object' && data_sources.source) {
        const doc = documentMap[data_sources.source];
        source = {
          document_id: data_sources.source,
          filename: doc?.filename || null,
          document_date: doc?.document_date || data_sources.document_date || null
        };
      }
      
      return {
        ...restCycleData,
        source: source || undefined
      };
    });

    return c.json({
      success: true,
      data: standardizedCycles
    });

  } catch (error) {
    console.error('Error getting treatment cycles:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Get single cycle by cycle number
treatment.get('/:id/treatment/cycles/:cycleNumber', async (c) => {
  try {
    const { id: patientId, cycleNumber } = c.req.param();

    // Get current treatment
    const treatmentRecord = await Treatment.getCurrentByPatientId(c.env, patientId);

    if (!treatmentRecord) {
      throw new NotFoundError('Treatment');
    }

    // Get specific cycle
    const cycle = await TreatmentCycle.getByCycleNumber(
      c.env,
      treatmentRecord.id,
      parseInt(cycleNumber)
    );

    if (!cycle) {
      throw new NotFoundError('Treatment cycle');
    }

    return c.json({
      success: true,
      data: cycle.toJSON()
    });

  } catch (error) {
    console.error('Error getting treatment cycle:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Add a new cycle
treatment.post('/:id/treatment/cycles', async (c) => {
  try {
    const { id: patientId } = c.req.param();
    const body = await c.req.json();

    // Get current treatment
    const treatmentRecord = await Treatment.getCurrentByPatientId(c.env, patientId);

    if (!treatmentRecord) {
      throw new NotFoundError('Treatment');
    }

    // Add treatment_id and patient_id
    body.treatment_id = treatmentRecord.id;
    body.patient_id = patientId;

    // Validate
    const errors = TreatmentCycle.validate(body);
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    // Create cycle
    const cycle = await TreatmentCycle.create(c.env, body);

    return c.json({
      success: true,
      message: 'Treatment cycle added successfully',
      data: cycle.toJSON()
    }, 201);

  } catch (error) {
    console.error('Error adding treatment cycle:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Update a cycle
treatment.put('/:id/treatment/cycles/:cycleNumber', async (c) => {
  try {
    const { id: patientId, cycleNumber } = c.req.param();
    const body = await c.req.json();

    // Get user from context
    const userId = c.get('userId') || 'system';
    const userRole = c.get('userRole') || 'user';

    // Get current treatment
    const treatmentRecord = await Treatment.getCurrentByPatientId(c.env, patientId);

    if (!treatmentRecord) {
      throw new NotFoundError('Treatment');
    }

    // Get existing cycle
    const existing = await TreatmentCycle.getByCycleNumber(
      c.env,
      treatmentRecord.id,
      parseInt(cycleNumber)
    );

    if (!existing) {
      throw new NotFoundError('Treatment cycle');
    }

    // Track changes for version history (admin only)
    if (userRole === 'admin') {
      const fieldsToTrack = [
        'actual_date', 'cycle_status', 'ctcae_grade',
        'dose_reduced', 'dose_percentage'
      ];

      const versionFields = [];
      for (const field of fieldsToTrack) {
        if (body[field] !== undefined && JSON.stringify(body[field]) !== JSON.stringify(existing[field])) {
          versionFields.push({
            fieldName: field,
            oldValue: existing[field],
            newValue: body[field],
            originalSource: existing.data_sources?.[field]?.source || null
          });
        }
      }

      // Create version history
      if (versionFields.length > 0) {
        await DataVersion.createMultipleVersions(c.env, {
          recordType: 'treatment_cycles',
          recordId: existing.id,
          patientId,
          editedBy: userId,
          editReason: body.edit_reason || 'Manual update'
        }, versionFields);

        // Update data_sources
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
      }
    }

    // Validate and update
    const errors = TreatmentCycle.validate({ ...existing, ...body });
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    const updated = await TreatmentCycle.update(c.env, existing.id, body);

    return c.json({
      success: true,
      message: 'Treatment cycle updated successfully',
      data: updated.toJSON()
    });

  } catch (error) {
    console.error('Error updating treatment cycle:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default treatment;
