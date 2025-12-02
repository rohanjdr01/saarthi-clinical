/**
 * Diagnosis & Staging Routes
 *
 * Endpoints for managing diagnosis and staging information with source tracking
 */

import { Hono } from 'hono';
import { Diagnosis } from '../models/diagnosis.js';
import { Staging } from '../models/staging.js';
import { DataVersion } from '../models/data-version.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { trackMultipleFieldSources } from '../utils/data-source.js';

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

    return c.json({
      success: true,
      data: diagnosisRecord.toJSON()
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

// Get staging for a patient
diagnosis.get('/:id/staging', async (c) => {
  try {
    const { id: patientId } = c.req.param();

    const stagingRecord = await Staging.getByPatientId(c.env, patientId);

    if (!stagingRecord) {
      return c.json({
        success: true,
        data: null,
        message: 'No staging found for this patient'
      });
    }

    return c.json({
      success: true,
      data: stagingRecord.toJSON()
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

export default diagnosis;
