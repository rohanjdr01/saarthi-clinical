/**
 * Alert Repository (Data Access Layer)
 * Handles all database operations for alerts
 */

import { getCurrentTimestamp } from '../utils/helpers.js';

export const AlertRepository = (db) => ({
  /**
   * Find all alerts for a patient
   */
  findByPatientId: async (patientId) => {
    const result = await db.prepare(`
      SELECT * FROM alerts
      WHERE patient_id = ?
      ORDER BY created_at DESC
    `).bind(patientId).all();
    
    return result.results;
  },

  /**
   * Find alert by ID and patient ID
   */
  findById: async (alertId, patientId) => {
    const row = await db.prepare(`
      SELECT * FROM alerts WHERE id = ? AND patient_id = ?
    `).bind(alertId, patientId).first();
    
    return row || null;
  },

  /**
   * Create a new alert
   */
  create: async (patientId, alertData) => {
    const id = `alt_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await db.prepare(`
      INSERT INTO alerts (
        id, patient_id, alert_type, severity, title, description,
        alert_category, affected_system, actionable, recommended_action,
        alert_status, acknowledged_by, acknowledged_at, resolved_at,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      alertData.alert_type, alertData.severity || null, alertData.title, alertData.description || null,
      alertData.alert_category || null, alertData.affected_system || null,
      alertData.actionable || false, alertData.recommended_action || null,
      alertData.alert_status || 'active', alertData.acknowledged_by || null,
      alertData.acknowledged_at || null, alertData.resolved_at || null,
      alertData.data_sources ? JSON.stringify(alertData.data_sources) : null,
      now, now
    ).run();

    return { id };
  },

  /**
   * Update alert by ID and patient ID
   */
  update: async (alertId, patientId, updates) => {
    const allowed = [
      'alert_type', 'severity', 'title', 'description',
      'alert_category', 'affected_system', 'actionable', 'recommended_action',
      'alert_status', 'acknowledged_by', 'acknowledged_at', 'resolved_at',
      'data_sources'
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
      UPDATE alerts SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...mappedValues, getCurrentTimestamp(), alertId, patientId).run();

    return true;
  },

  /**
   * Delete alert by ID and patient ID
   */
  delete: async (alertId, patientId) => {
    await db.prepare(`DELETE FROM alerts WHERE id = ? AND patient_id = ?`)
      .bind(alertId, patientId).run();
    
    return true;
  }
});

