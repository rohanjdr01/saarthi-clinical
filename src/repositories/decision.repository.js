/**
 * Clinical Decision Repository (Data Access Layer)
 * Handles all database operations for clinical decisions
 */

import { getCurrentTimestamp } from '../utils/helpers.js';

export const DecisionRepository = (db) => ({
  /**
   * Find all clinical decisions for a patient
   */
  findByPatientId: async (patientId) => {
    const result = await db.prepare(`
      SELECT * FROM clinical_decisions
      WHERE patient_id = ?
      ORDER BY decision_date DESC
    `).bind(patientId).all();
    
    return result.results;
  },

  /**
   * Find decision by ID and patient ID
   */
  findById: async (decisionId, patientId) => {
    const row = await db.prepare(`
      SELECT * FROM clinical_decisions WHERE id = ? AND patient_id = ?
    `).bind(decisionId, patientId).first();
    
    return row || null;
  },

  /**
   * Create a new clinical decision
   */
  create: async (patientId, decisionData) => {
    const id = `cd_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await db.prepare(`
      INSERT INTO clinical_decisions (
        id, patient_id, decision_type, decision_date, clinical_question, background,
        mdt_discussion, mdt_date, participants,
        decision_made, rationale, alternatives_considered,
        implementation_status, implemented_date,
        outcome, outcome_date,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      decisionData.decision_type, decisionData.decision_date || new Date().toISOString().split('T')[0],
      decisionData.clinical_question, decisionData.background || null,
      decisionData.mdt_discussion || false, decisionData.mdt_date || null, 
      decisionData.participants ? JSON.stringify(decisionData.participants) : null,
      decisionData.decision_made, decisionData.rationale || null, decisionData.alternatives_considered || null,
      decisionData.implementation_status || 'pending', decisionData.implemented_date || null,
      decisionData.outcome || null, decisionData.outcome_date || null,
      decisionData.data_sources ? JSON.stringify(decisionData.data_sources) : null,
      now, now
    ).run();

    return { id };
  },

  /**
   * Update decision by ID and patient ID
   */
  update: async (decisionId, patientId, updates) => {
    const allowed = [
      'decision_type', 'decision_date', 'clinical_question', 'background',
      'mdt_discussion', 'mdt_date', 'participants',
      'decision_made', 'rationale', 'alternatives_considered',
      'implementation_status', 'implemented_date',
      'outcome', 'outcome_date', 'data_sources'
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
    const mappedValues = Object.entries(filteredUpdates).map(([k, v]) =>
      k === 'participants' && Array.isArray(v) ? JSON.stringify(v) :
      k === 'data_sources' && typeof v !== 'string' ? JSON.stringify(v) : v
    );

    await db.prepare(`
      UPDATE clinical_decisions SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...mappedValues, getCurrentTimestamp(), decisionId, patientId).run();

    return true;
  },

  /**
   * Delete decision by ID and patient ID
   */
  delete: async (decisionId, patientId) => {
    await db.prepare(`DELETE FROM clinical_decisions WHERE id = ? AND patient_id = ?`)
      .bind(decisionId, patientId).run();
    
    return true;
  }
});

