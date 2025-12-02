/**
 * Diagnosis Model
 *
 * Handles cancer diagnosis details with field-level source tracking
 */

import { generateId, getCurrentTimestamp } from '../utils/helpers.js';
import { parseDataSources, serializeDataSources } from '../utils/data-source.js';

export class Diagnosis {
  constructor(data) {
    this.id = data.id || generateId('diag');
    this.patient_id = data.patient_id;

    // Cancer diagnosis
    this.primary_cancer_type = data.primary_cancer_type || null;
    this.primary_cancer_subtype = data.primary_cancer_subtype || null;
    this.icd_code = data.icd_code || null;
    this.diagnosis_date = data.diagnosis_date || null;

    // Tumor characteristics
    this.tumor_location = data.tumor_location || null;
    this.tumor_laterality = data.tumor_laterality || null;
    this.tumor_size_cm = data.tumor_size_cm || null;
    this.tumor_grade = data.tumor_grade || null;
    this.histology = data.histology || null;

    // Molecular markers
    this.biomarkers = data.biomarkers || null; // JSON
    this.genetic_mutations = data.genetic_mutations || null; // JSON

    // Metastasis
    this.metastatic_sites = data.metastatic_sites || null; // JSON

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

    const validLaterality = ['left', 'right', 'bilateral', 'midline'];
    if (data.tumor_laterality && !validLaterality.includes(data.tumor_laterality.toLowerCase())) {
      errors.push('Tumor laterality must be left, right, bilateral, or midline');
    }

    const validGrades = ['G1', 'G2', 'G3', 'G4', 'GX'];
    if (data.tumor_grade && !validGrades.includes(data.tumor_grade.toUpperCase())) {
      errors.push('Tumor grade must be G1, G2, G3, G4, or GX');
    }

    if (data.tumor_size_cm && data.tumor_size_cm < 0) {
      errors.push('Tumor size must be positive');
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      patient_id: this.patient_id,

      // Cancer diagnosis
      primary_cancer_type: this.primary_cancer_type,
      primary_cancer_subtype: this.primary_cancer_subtype,
      icd_code: this.icd_code,
      diagnosis_date: this.diagnosis_date,

      // Tumor characteristics
      tumor_location: this.tumor_location,
      tumor_laterality: this.tumor_laterality,
      tumor_size_cm: this.tumor_size_cm,
      tumor_grade: this.tumor_grade,
      histology: this.histology,

      // Molecular markers
      biomarkers: this.biomarkers ? JSON.parse(this.biomarkers) : null,
      genetic_mutations: this.genetic_mutations ? JSON.parse(this.genetic_mutations) : null,

      // Metastasis
      metastatic_sites: this.metastatic_sites ? JSON.parse(this.metastatic_sites) : null,

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

      primary_cancer_type: this.primary_cancer_type,
      primary_cancer_subtype: this.primary_cancer_subtype,
      icd_code: this.icd_code,
      diagnosis_date: this.diagnosis_date,

      tumor_location: this.tumor_location,
      tumor_laterality: this.tumor_laterality,
      tumor_size_cm: this.tumor_size_cm,
      tumor_grade: this.tumor_grade,
      histology: this.histology,

      biomarkers: typeof this.biomarkers === 'string'
        ? this.biomarkers
        : JSON.stringify(this.biomarkers || null),
      genetic_mutations: typeof this.genetic_mutations === 'string'
        ? this.genetic_mutations
        : JSON.stringify(this.genetic_mutations || null),

      metastatic_sites: typeof this.metastatic_sites === 'string'
        ? this.metastatic_sites
        : JSON.stringify(this.metastatic_sites || null),

      data_sources: typeof this.data_sources === 'string'
        ? this.data_sources
        : serializeDataSources(this.data_sources || {}),

      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromDBRow(row) {
    return new Diagnosis(row);
  }

  /**
   * Create a new diagnosis record in the database
   */
  static async create(env, data) {
    const diagnosis = new Diagnosis(data);
    const row = diagnosis.toDBRow();

    const stmt = env.DB.prepare(`
      INSERT INTO diagnosis (
        id, patient_id,
        primary_cancer_type, primary_cancer_subtype, icd_code, diagnosis_date,
        tumor_location, tumor_laterality, tumor_size_cm, tumor_grade, histology,
        biomarkers, genetic_mutations, metastatic_sites,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      row.id, row.patient_id,
      row.primary_cancer_type, row.primary_cancer_subtype, row.icd_code, row.diagnosis_date,
      row.tumor_location, row.tumor_laterality, row.tumor_size_cm, row.tumor_grade, row.histology,
      row.biomarkers, row.genetic_mutations, row.metastatic_sites,
      row.data_sources, row.created_at, row.updated_at
    );

    await stmt.run();

    return diagnosis;
  }

  /**
   * Get diagnosis by patient ID
   */
  static async getByPatientId(env, patientId) {
    const stmt = env.DB.prepare('SELECT * FROM diagnosis WHERE patient_id = ?');
    const result = await stmt.bind(patientId).first();

    return result ? Diagnosis.fromDBRow(result) : null;
  }

  /**
   * Update diagnosis record
   */
  static async update(env, id, data) {
    const existing = await env.DB.prepare('SELECT * FROM diagnosis WHERE id = ?')
      .bind(id).first();

    if (!existing) {
      return null;
    }

    const updated = new Diagnosis({ ...existing, ...data, updated_at: getCurrentTimestamp() });
    const row = updated.toDBRow();

    const stmt = env.DB.prepare(`
      UPDATE diagnosis SET
        primary_cancer_type = ?, primary_cancer_subtype = ?, icd_code = ?, diagnosis_date = ?,
        tumor_location = ?, tumor_laterality = ?, tumor_size_cm = ?, tumor_grade = ?, histology = ?,
        biomarkers = ?, genetic_mutations = ?, metastatic_sites = ?,
        data_sources = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      row.primary_cancer_type, row.primary_cancer_subtype, row.icd_code, row.diagnosis_date,
      row.tumor_location, row.tumor_laterality, row.tumor_size_cm, row.tumor_grade, row.histology,
      row.biomarkers, row.genetic_mutations, row.metastatic_sites,
      row.data_sources, row.updated_at, id
    );

    await stmt.run();

    return updated;
  }

  /**
   * Delete diagnosis record
   */
  static async delete(env, id) {
    const stmt = env.DB.prepare('DELETE FROM diagnosis WHERE id = ?');
    await stmt.bind(id).run();
  }
}
