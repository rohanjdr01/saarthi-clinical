/**
 * Treatment Cycle Model
 *
 * Handles individual treatment cycle details with field-level source tracking
 */

import { generateId, getCurrentTimestamp } from '../utils/helpers.js';
import { parseDataSources, serializeDataSources } from '../utils/data-source.js';

export class TreatmentCycle {
  constructor(data) {
    this.id = data.id || generateId('cyc');
    this.treatment_id = data.treatment_id;
    this.patient_id = data.patient_id;

    this.cycle_number = data.cycle_number;

    // Schedule
    this.planned_date = data.planned_date || null;
    this.actual_date = data.actual_date || null;

    // Drugs administered
    this.drugs_administered = data.drugs_administered || null; // JSON

    // Vital signs
    this.pre_treatment_vitals = data.pre_treatment_vitals || null; // JSON
    this.post_treatment_vitals = data.post_treatment_vitals || null; // JSON

    // Toxicity
    this.adverse_events = data.adverse_events || null; // JSON
    this.ctcae_grade = data.ctcae_grade || null;

    // Dose modifications
    this.dose_reduced = data.dose_reduced || false;
    this.dose_reduction_reason = data.dose_reduction_reason || null;
    this.dose_percentage = data.dose_percentage || 100.0;

    // Status
    this.cycle_status = data.cycle_status || 'completed';
    this.delay_reason = data.delay_reason || null;

    this.notes = data.notes || null;

    // Field-level source tracking
    this.data_sources = data.data_sources || null; // JSON

    this.created_at = data.created_at || getCurrentTimestamp();
    this.updated_at = data.updated_at || getCurrentTimestamp();
  }

  static validate(data) {
    const errors = [];

    if (!data.treatment_id) {
      errors.push('Treatment ID is required');
    }

    if (!data.patient_id) {
      errors.push('Patient ID is required');
    }

    if (!data.cycle_number || data.cycle_number < 1) {
      errors.push('Cycle number is required and must be positive');
    }

    const validStatus = ['completed', 'skipped', 'delayed', 'modified'];
    if (data.cycle_status && !validStatus.includes(data.cycle_status.toLowerCase())) {
      errors.push('Cycle status must be completed, skipped, delayed, or modified');
    }

    if (data.ctcae_grade !== null && data.ctcae_grade !== undefined) {
      if (data.ctcae_grade < 1 || data.ctcae_grade > 5) {
        errors.push('CTCAE grade must be between 1 and 5');
      }
    }

    if (data.dose_percentage && (data.dose_percentage < 0 || data.dose_percentage > 100)) {
      errors.push('Dose percentage must be between 0 and 100');
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      treatment_id: this.treatment_id,
      patient_id: this.patient_id,

      cycle_number: this.cycle_number,

      // Schedule
      planned_date: this.planned_date,
      actual_date: this.actual_date,

      // Drugs
      drugs_administered: this.drugs_administered
        ? (typeof this.drugs_administered === 'string' ? JSON.parse(this.drugs_administered) : this.drugs_administered)
        : null,

      // Vitals
      pre_treatment_vitals: this.pre_treatment_vitals
        ? (typeof this.pre_treatment_vitals === 'string' ? JSON.parse(this.pre_treatment_vitals) : this.pre_treatment_vitals)
        : null,
      post_treatment_vitals: this.post_treatment_vitals
        ? (typeof this.post_treatment_vitals === 'string' ? JSON.parse(this.post_treatment_vitals) : this.post_treatment_vitals)
        : null,

      // Toxicity
      adverse_events: this.adverse_events
        ? (typeof this.adverse_events === 'string' ? JSON.parse(this.adverse_events) : this.adverse_events)
        : null,
      ctcae_grade: this.ctcae_grade,

      // Dose modifications
      dose_reduced: this.dose_reduced,
      dose_reduction_reason: this.dose_reduction_reason,
      dose_percentage: this.dose_percentage,

      // Status
      cycle_status: this.cycle_status,
      delay_reason: this.delay_reason,

      notes: this.notes,

      // Source tracking
      data_sources: this.data_sources ? parseDataSources(this.data_sources) : null,

      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  toDBRow() {
    return {
      id: this.id,
      treatment_id: this.treatment_id,
      patient_id: this.patient_id,

      cycle_number: this.cycle_number,

      planned_date: this.planned_date,
      actual_date: this.actual_date,

      drugs_administered: typeof this.drugs_administered === 'string'
        ? this.drugs_administered
        : JSON.stringify(this.drugs_administered || null),

      pre_treatment_vitals: typeof this.pre_treatment_vitals === 'string'
        ? this.pre_treatment_vitals
        : JSON.stringify(this.pre_treatment_vitals || null),
      post_treatment_vitals: typeof this.post_treatment_vitals === 'string'
        ? this.post_treatment_vitals
        : JSON.stringify(this.post_treatment_vitals || null),

      adverse_events: typeof this.adverse_events === 'string'
        ? this.adverse_events
        : JSON.stringify(this.adverse_events || null),
      ctcae_grade: this.ctcae_grade,

      dose_reduced: this.dose_reduced ? 1 : 0,
      dose_reduction_reason: this.dose_reduction_reason,
      dose_percentage: this.dose_percentage,

      cycle_status: this.cycle_status,
      delay_reason: this.delay_reason,

      notes: this.notes,

      data_sources: typeof this.data_sources === 'string'
        ? this.data_sources
        : serializeDataSources(this.data_sources || {}),

      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromDBRow(row) {
    return new TreatmentCycle({
      ...row,
      dose_reduced: Boolean(row.dose_reduced)
    });
  }

  /**
   * Create a new treatment cycle record in the database
   */
  static async create(env, data) {
    const cycle = new TreatmentCycle(data);
    const row = cycle.toDBRow();

    const stmt = env.DB.prepare(`
      INSERT INTO treatment_cycles (
        id, treatment_id, patient_id, cycle_number,
        planned_date, actual_date,
        drugs_administered,
        pre_treatment_vitals, post_treatment_vitals,
        adverse_events, ctcae_grade,
        dose_reduced, dose_reduction_reason, dose_percentage,
        cycle_status, delay_reason, notes,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      row.id, row.treatment_id, row.patient_id, row.cycle_number,
      row.planned_date, row.actual_date,
      row.drugs_administered,
      row.pre_treatment_vitals, row.post_treatment_vitals,
      row.adverse_events, row.ctcae_grade,
      row.dose_reduced, row.dose_reduction_reason, row.dose_percentage,
      row.cycle_status, row.delay_reason, row.notes,
      row.data_sources, row.created_at, row.updated_at
    );

    await stmt.run();

    return cycle;
  }

  /**
   * Get all cycles for a treatment
   */
  static async getByTreatmentId(env, treatmentId) {
    const stmt = env.DB.prepare(`
      SELECT * FROM treatment_cycles
      WHERE treatment_id = ?
      ORDER BY cycle_number ASC
    `);
    const results = await stmt.bind(treatmentId).all();

    return results.results.map(row => TreatmentCycle.fromDBRow(row));
  }

  /**
   * Get a specific cycle by treatment ID and cycle number
   */
  static async getByCycleNumber(env, treatmentId, cycleNumber) {
    const stmt = env.DB.prepare(`
      SELECT * FROM treatment_cycles
      WHERE treatment_id = ? AND cycle_number = ?
    `);
    const result = await stmt.bind(treatmentId, cycleNumber).first();

    return result ? TreatmentCycle.fromDBRow(result) : null;
  }

  /**
   * Update treatment cycle record
   */
  static async update(env, id, data) {
    const existing = await env.DB.prepare('SELECT * FROM treatment_cycles WHERE id = ?')
      .bind(id).first();

    if (!existing) {
      return null;
    }

    const updated = new TreatmentCycle({ ...existing, ...data, updated_at: getCurrentTimestamp() });
    const row = updated.toDBRow();

    const stmt = env.DB.prepare(`
      UPDATE treatment_cycles SET
        planned_date = ?, actual_date = ?,
        drugs_administered = ?,
        pre_treatment_vitals = ?, post_treatment_vitals = ?,
        adverse_events = ?, ctcae_grade = ?,
        dose_reduced = ?, dose_reduction_reason = ?, dose_percentage = ?,
        cycle_status = ?, delay_reason = ?, notes = ?,
        data_sources = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      row.planned_date, row.actual_date,
      row.drugs_administered,
      row.pre_treatment_vitals, row.post_treatment_vitals,
      row.adverse_events, row.ctcae_grade,
      row.dose_reduced, row.dose_reduction_reason, row.dose_percentage,
      row.cycle_status, row.delay_reason, row.notes,
      row.data_sources, row.updated_at, id
    );

    await stmt.run();

    return updated;
  }

  /**
   * Delete treatment cycle record
   */
  static async delete(env, id) {
    const stmt = env.DB.prepare('DELETE FROM treatment_cycles WHERE id = ?');
    await stmt.bind(id).run();
  }
}
