/**
 * Treatment Model
 *
 * Handles treatment regimens and cycles with field-level source tracking
 */

import { generateId, getCurrentTimestamp } from '../utils/helpers.js';
import { parseDataSources, serializeDataSources } from '../utils/data-source.js';

export class Treatment {
  constructor(data) {
    this.id = data.id || generateId('tx');
    this.patient_id = data.patient_id;

    // Current treatment regimen
    this.regimen_name = data.regimen_name || null;
    this.treatment_intent = data.treatment_intent || null;
    this.treatment_line = data.treatment_line || null;

    // Regimen details
    this.protocol = data.protocol || null;
    this.drugs = data.drugs || null; // JSON

    // Schedule
    this.start_date = data.start_date || null;
    this.planned_end_date = data.planned_end_date || null;
    this.actual_end_date = data.actual_end_date || null;
    this.total_planned_cycles = data.total_planned_cycles || null;

    // Status
    this.treatment_status = data.treatment_status || 'active';
    this.discontinuation_reason = data.discontinuation_reason || null;

    // Response
    this.best_response = data.best_response || null;
    this.response_date = data.response_date || null;

    // Field-level source tracking
    this.data_sources = data.data_sources || null; // JSON

    this.created_at = data.created_at || getCurrentTimestamp();
    this.updated_at = data.updated_at || getCurrentTimestamp();
  }

  static validate(data) {
    const errors = [];

    if (!data.patient_id) {
      errors.push('Patient ID is required');
    }

    const validIntents = ['curative', 'palliative', 'adjuvant', 'neoadjuvant'];
    if (data.treatment_intent && !validIntents.includes(data.treatment_intent.toLowerCase())) {
      errors.push('Treatment intent must be curative, palliative, adjuvant, or neoadjuvant');
    }

    const validStatus = ['active', 'completed', 'discontinued', 'on-hold'];
    if (data.treatment_status && !validStatus.includes(data.treatment_status.toLowerCase())) {
      errors.push('Treatment status must be active, completed, discontinued, or on-hold');
    }

    const validResponses = ['CR', 'PR', 'SD', 'PD'];
    if (data.best_response && !validResponses.includes(data.best_response.toUpperCase())) {
      errors.push('Best response must be CR, PR, SD, or PD');
    }

    if (data.total_planned_cycles && data.total_planned_cycles < 0) {
      errors.push('Total planned cycles must be positive');
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      patient_id: this.patient_id,

      // Regimen
      regimen_name: this.regimen_name,
      treatment_intent: this.treatment_intent,
      treatment_line: this.treatment_line,

      // Details
      protocol: this.protocol,
      drugs: this.drugs ? (typeof this.drugs === 'string' ? JSON.parse(this.drugs) : this.drugs) : null,

      // Schedule
      start_date: this.start_date,
      planned_end_date: this.planned_end_date,
      actual_end_date: this.actual_end_date,
      total_planned_cycles: this.total_planned_cycles,

      // Status
      treatment_status: this.treatment_status,
      discontinuation_reason: this.discontinuation_reason,

      // Response
      best_response: this.best_response,
      response_date: this.response_date,

      // Source tracking
      data_sources: this.data_sources ? parseDataSources(this.data_sources) : null,

      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  toDBRow() {
    return {
      id: this.id,
      patient_id: this.patient_id,

      regimen_name: this.regimen_name,
      treatment_intent: this.treatment_intent,
      treatment_line: this.treatment_line,

      protocol: this.protocol,
      drugs: typeof this.drugs === 'string'
        ? this.drugs
        : JSON.stringify(this.drugs || null),

      start_date: this.start_date,
      planned_end_date: this.planned_end_date,
      actual_end_date: this.actual_end_date,
      total_planned_cycles: this.total_planned_cycles,

      treatment_status: this.treatment_status,
      discontinuation_reason: this.discontinuation_reason,

      best_response: this.best_response,
      response_date: this.response_date,

      data_sources: typeof this.data_sources === 'string'
        ? this.data_sources
        : serializeDataSources(this.data_sources || {}),

      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromDBRow(row) {
    return new Treatment(row);
  }

  /**
   * Create a new treatment record in the database
   */
  static async create(env, data) {
    const treatment = new Treatment(data);
    const row = treatment.toDBRow();

    const stmt = env.DB.prepare(`
      INSERT INTO treatment (
        id, patient_id,
        regimen_name, treatment_intent, treatment_line,
        protocol, drugs,
        start_date, planned_end_date, actual_end_date, total_planned_cycles,
        treatment_status, discontinuation_reason,
        best_response, response_date,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      row.id, row.patient_id,
      row.regimen_name, row.treatment_intent, row.treatment_line,
      row.protocol, row.drugs,
      row.start_date, row.planned_end_date, row.actual_end_date, row.total_planned_cycles,
      row.treatment_status, row.discontinuation_reason,
      row.best_response, row.response_date,
      row.data_sources, row.created_at, row.updated_at
    );

    await stmt.run();

    return treatment;
  }

  /**
   * Get current treatment by patient ID
   */
  static async getCurrentByPatientId(env, patientId) {
    const stmt = env.DB.prepare(`
      SELECT * FROM treatment
      WHERE patient_id = ? AND treatment_status = 'active'
      ORDER BY start_date DESC
      LIMIT 1
    `);
    const result = await stmt.bind(patientId).first();

    return result ? Treatment.fromDBRow(result) : null;
  }

  /**
   * Get all treatments for a patient
   */
  static async getAllByPatientId(env, patientId) {
    const stmt = env.DB.prepare(`
      SELECT * FROM treatment
      WHERE patient_id = ?
      ORDER BY start_date DESC
    `);
    const results = await stmt.bind(patientId).all();

    return results.results.map(row => Treatment.fromDBRow(row));
  }

  /**
   * Update treatment record
   */
  static async update(env, id, data) {
    const existing = await env.DB.prepare('SELECT * FROM treatment WHERE id = ?')
      .bind(id).first();

    if (!existing) {
      return null;
    }

    const updated = new Treatment({ ...existing, ...data, updated_at: getCurrentTimestamp() });
    const row = updated.toDBRow();

    const stmt = env.DB.prepare(`
      UPDATE treatment SET
        regimen_name = ?, treatment_intent = ?, treatment_line = ?,
        protocol = ?, drugs = ?,
        start_date = ?, planned_end_date = ?, actual_end_date = ?, total_planned_cycles = ?,
        treatment_status = ?, discontinuation_reason = ?,
        best_response = ?, response_date = ?,
        data_sources = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      row.regimen_name, row.treatment_intent, row.treatment_line,
      row.protocol, row.drugs,
      row.start_date, row.planned_end_date, row.actual_end_date, row.total_planned_cycles,
      row.treatment_status, row.discontinuation_reason,
      row.best_response, row.response_date,
      row.data_sources, row.updated_at, id
    );

    await stmt.run();

    return updated;
  }

  /**
   * Delete treatment record
   */
  static async delete(env, id) {
    const stmt = env.DB.prepare('DELETE FROM treatment WHERE id = ?');
    await stmt.bind(id).run();
  }
}
