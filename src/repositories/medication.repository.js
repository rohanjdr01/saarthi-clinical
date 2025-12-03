/**
 * Medication Repository (Data Access Layer)
 * Handles all database operations for medications
 */

import { getCurrentTimestamp } from '../utils/helpers.js';

export const MedicationRepository = (db) => ({
  /**
   * Find all medications for a patient, grouped by treatment_context
   */
  findByPatientId: async (patientId) => {
    const result = await db.prepare(`
      SELECT * FROM medications
      WHERE patient_id = ?
      ORDER BY treatment_context, created_at DESC
    `).bind(patientId).all();

    // Group by treatment_context
    const grouped = result.results.reduce((acc, med) => {
      const context = med.treatment_context || 'Other Medications';
      if (!acc[context]) {
        acc[context] = [];
      }
      acc[context].push(med);
      return acc;
    }, {});

    return {
      grouped,
      flat: result.results
    };
  },

  /**
   * Find medication by ID and patient ID
   */
  findById: async (medId, patientId) => {
    const row = await db.prepare(`
      SELECT * FROM medications WHERE id = ? AND patient_id = ?
    `).bind(medId, patientId).first();
    
    return row || null;
  },

  /**
   * Create a new medication
   */
  create: async (patientId, medicationData) => {
    const id = `med_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await db.prepare(`
      INSERT INTO medications (
        id, patient_id, medication_name, generic_name, drug_class,
        dose, dose_unit, frequency, route,
        start_date, end_date,
        medication_status, discontinuation_reason,
        indication, medication_type, treatment_context,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      medicationData.medication_name, medicationData.generic_name || null, medicationData.drug_class || null,
      medicationData.dose || null, medicationData.dose_unit || null, medicationData.frequency || null, medicationData.route || null,
      medicationData.start_date || null, medicationData.end_date || null,
      medicationData.medication_status || 'active', medicationData.discontinuation_reason || null,
      medicationData.indication || null, medicationData.medication_type || null, medicationData.treatment_context || null,
      medicationData.data_sources ? JSON.stringify(medicationData.data_sources) : null,
      now, now
    ).run();

    return { id };
  },

  /**
   * Update medication by ID and patient ID
   */
  update: async (medId, patientId, updates) => {
    const allowed = [
      'medication_name', 'generic_name', 'drug_class',
      'dose', 'dose_unit', 'frequency', 'route',
      'start_date', 'end_date',
      'medication_status', 'discontinuation_reason',
      'indication', 'medication_type', 'treatment_context', 'data_sources'
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
    const mappedValues = [];
    Object.entries(filteredUpdates).forEach(([k, v]) => {
      if (k === 'data_sources' && typeof v !== 'string') {
        mappedValues.push(JSON.stringify(v));
      } else {
        mappedValues.push(v);
      }
    });

    await db.prepare(`
      UPDATE medications
      SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...mappedValues, getCurrentTimestamp(), medId, patientId).run();

    return true;
  },

  /**
   * Delete medication by ID and patient ID
   */
  delete: async (medId, patientId) => {
    await db.prepare(`
      DELETE FROM medications WHERE id = ? AND patient_id = ?
    `).bind(medId, patientId).run();
    
    return true;
  }
});

