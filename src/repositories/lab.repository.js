/**
 * Lab Repository (Data Access Layer)
 * Handles all database operations for lab results
 */

import { getCurrentTimestamp } from '../utils/helpers.js';

export const LabRepository = (db) => ({
  /**
   * Find all lab results for a patient
   */
  findByPatientId: async (patientId) => {
    const result = await db.prepare(`
      SELECT * FROM lab_results
      WHERE patient_id = ?
      ORDER BY test_date DESC
    `).bind(patientId).all();
    
    return result.results;
  },

  /**
   * Find lab result by ID and patient ID
   */
  findById: async (labId, patientId) => {
    const row = await db.prepare(`
      SELECT * FROM lab_results WHERE id = ? AND patient_id = ?
    `).bind(labId, patientId).first();
    
    return row || null;
  },

  /**
   * Create a new lab result
   */
  create: async (patientId, labData) => {
    const id = `lab_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await db.prepare(`
      INSERT INTO lab_results (
        id, patient_id, test_name, test_category, result_value, result_text, result_unit,
        reference_min, reference_max, is_abnormal, abnormality_flag,
        test_date, specimen_type, lab_name, source_document_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      labData.test_name, labData.test_category || null,
      labData.result_value || null, labData.result_text || null, labData.result_unit || null,
      labData.reference_min || null, labData.reference_max || null,
      labData.is_abnormal || false, labData.abnormality_flag || null,
      labData.test_date,
      labData.specimen_type || null, labData.lab_name || null, labData.source_document_id || null,
      now, now
    ).run();

    return { id };
  },

  /**
   * Update lab result by ID and patient ID
   */
  update: async (labId, patientId, updates) => {
    const allowed = [
      'test_name', 'test_category', 'result_value', 'result_text', 'result_unit',
      'reference_min', 'reference_max', 'is_abnormal', 'abnormality_flag',
      'test_date', 'specimen_type', 'lab_name', 'source_document_id'
    ];

    const filteredUpdates = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return false;
    }

    const setClause = Object.keys(filteredUpdates).map(k => `${k} = ?`).join(', ');
    const mappedValues = Object.values(filteredUpdates);

    await db.prepare(`
      UPDATE lab_results SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...mappedValues, getCurrentTimestamp(), labId, patientId).run();

    return true;
  },

  /**
   * Delete lab result by ID and patient ID
   */
  delete: async (labId, patientId) => {
    await db.prepare(`DELETE FROM lab_results WHERE id = ? AND patient_id = ?`)
      .bind(labId, patientId).run();
    
    return true;
  }
});

