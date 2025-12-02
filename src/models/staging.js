/**
 * Staging Model
 *
 * Handles TNM staging information with field-level source tracking
 */

import { generateId, getCurrentTimestamp } from '../utils/helpers.js';
import { parseDataSources, serializeDataSources } from '../utils/data-source.js';

export class Staging {
  constructor(data) {
    this.id = data.id || generateId('stg');
    this.patient_id = data.patient_id;
    this.diagnosis_id = data.diagnosis_id || null;

    // TNM staging
    this.clinical_t = data.clinical_t || null;
    this.clinical_n = data.clinical_n || null;
    this.clinical_m = data.clinical_m || null;
    this.pathological_t = data.pathological_t || null;
    this.pathological_n = data.pathological_n || null;
    this.pathological_m = data.pathological_m || null;

    // Overall stage
    this.clinical_stage = data.clinical_stage || null;
    this.pathological_stage = data.pathological_stage || null;

    // Additional info
    this.staging_system = data.staging_system || null;
    this.staging_date = data.staging_date || null;
    this.restaging_reason = data.restaging_reason || null;

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

    // Validate TNM values
    const validT = ['cT0', 'cT1', 'cT2', 'cT3', 'cT4', 'cTX', 'pT0', 'pT1', 'pT2', 'pT3', 'pT4', 'pTX'];
    const validN = ['cN0', 'cN1', 'cN2', 'cN3', 'cNX', 'pN0', 'pN1', 'pN2', 'pN3', 'pNX'];
    const validM = ['cM0', 'cM1', 'cMX', 'pM0', 'pM1', 'pMX'];

    if (data.clinical_t && !validT.includes(data.clinical_t.toUpperCase())) {
      errors.push('Invalid clinical T stage');
    }

    if (data.clinical_n && !validN.includes(data.clinical_n.toUpperCase())) {
      errors.push('Invalid clinical N stage');
    }

    if (data.clinical_m && !validM.includes(data.clinical_m.toUpperCase())) {
      errors.push('Invalid clinical M stage');
    }

    if (data.pathological_t && !validT.includes(data.pathological_t.toUpperCase())) {
      errors.push('Invalid pathological T stage');
    }

    if (data.pathological_n && !validN.includes(data.pathological_n.toUpperCase())) {
      errors.push('Invalid pathological N stage');
    }

    if (data.pathological_m && !validM.includes(data.pathological_m.toUpperCase())) {
      errors.push('Invalid pathological M stage');
    }

    const validStages = ['I', 'IA', 'IB', 'II', 'IIA', 'IIB', 'III', 'IIIA', 'IIIB', 'IIIC', 'IV', 'IVA', 'IVB', '0'];
    if (data.clinical_stage && !validStages.includes(data.clinical_stage.toUpperCase())) {
      errors.push('Invalid clinical stage');
    }

    if (data.pathological_stage && !validStages.includes(data.pathological_stage.toUpperCase())) {
      errors.push('Invalid pathological stage');
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      patient_id: this.patient_id,
      diagnosis_id: this.diagnosis_id,

      // TNM staging
      clinical_t: this.clinical_t,
      clinical_n: this.clinical_n,
      clinical_m: this.clinical_m,
      pathological_t: this.pathological_t,
      pathological_n: this.pathological_n,
      pathological_m: this.pathological_m,

      // Overall stage
      clinical_stage: this.clinical_stage,
      pathological_stage: this.pathological_stage,

      // Additional info
      staging_system: this.staging_system,
      staging_date: this.staging_date,
      restaging_reason: this.restaging_reason,

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
      diagnosis_id: this.diagnosis_id,

      clinical_t: this.clinical_t,
      clinical_n: this.clinical_n,
      clinical_m: this.clinical_m,
      pathological_t: this.pathological_t,
      pathological_n: this.pathological_n,
      pathological_m: this.pathological_m,

      clinical_stage: this.clinical_stage,
      pathological_stage: this.pathological_stage,

      staging_system: this.staging_system,
      staging_date: this.staging_date,
      restaging_reason: this.restaging_reason,

      data_sources: typeof this.data_sources === 'string'
        ? this.data_sources
        : serializeDataSources(this.data_sources || {}),

      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromDBRow(row) {
    return new Staging(row);
  }

  /**
   * Create a new staging record in the database
   */
  static async create(env, data) {
    const staging = new Staging(data);
    const row = staging.toDBRow();

    const stmt = env.DB.prepare(`
      INSERT INTO staging (
        id, patient_id, diagnosis_id,
        clinical_t, clinical_n, clinical_m,
        pathological_t, pathological_n, pathological_m,
        clinical_stage, pathological_stage,
        staging_system, staging_date, restaging_reason,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      row.id, row.patient_id, row.diagnosis_id,
      row.clinical_t, row.clinical_n, row.clinical_m,
      row.pathological_t, row.pathological_n, row.pathological_m,
      row.clinical_stage, row.pathological_stage,
      row.staging_system, row.staging_date, row.restaging_reason,
      row.data_sources, row.created_at, row.updated_at
    );

    await stmt.run();

    return staging;
  }

  /**
   * Get staging by patient ID
   */
  static async getByPatientId(env, patientId) {
    const stmt = env.DB.prepare('SELECT * FROM staging WHERE patient_id = ? ORDER BY staging_date DESC');
    const result = await stmt.bind(patientId).first();

    return result ? Staging.fromDBRow(result) : null;
  }

  /**
   * Get all staging records for a patient (for restaging history)
   */
  static async getAllByPatientId(env, patientId) {
    const stmt = env.DB.prepare('SELECT * FROM staging WHERE patient_id = ? ORDER BY staging_date DESC');
    const results = await stmt.bind(patientId).all();

    return results.results.map(row => Staging.fromDBRow(row));
  }

  /**
   * Update staging record
   */
  static async update(env, id, data) {
    const existing = await env.DB.prepare('SELECT * FROM staging WHERE id = ?')
      .bind(id).first();

    if (!existing) {
      return null;
    }

    const updated = new Staging({ ...existing, ...data, updated_at: getCurrentTimestamp() });
    const row = updated.toDBRow();

    const stmt = env.DB.prepare(`
      UPDATE staging SET
        diagnosis_id = ?,
        clinical_t = ?, clinical_n = ?, clinical_m = ?,
        pathological_t = ?, pathological_n = ?, pathological_m = ?,
        clinical_stage = ?, pathological_stage = ?,
        staging_system = ?, staging_date = ?, restaging_reason = ?,
        data_sources = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      row.diagnosis_id,
      row.clinical_t, row.clinical_n, row.clinical_m,
      row.pathological_t, row.pathological_n, row.pathological_m,
      row.clinical_stage, row.pathological_stage,
      row.staging_system, row.staging_date, row.restaging_reason,
      row.data_sources, row.updated_at, id
    );

    await stmt.run();

    return updated;
  }

  /**
   * Delete staging record
   */
  static async delete(env, id) {
    const stmt = env.DB.prepare('DELETE FROM staging WHERE id = ?');
    await stmt.bind(id).run();
  }
}
