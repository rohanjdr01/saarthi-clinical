/**
 * Patient Repository (Data Access Layer)
 * Handles all database operations for patients
 */

import { Patient } from '../models/patient.js';
import { getCurrentTimestamp } from '../utils/helpers.js';

export const PatientRepository = (db) => ({
  /**
   * Find patient by ID
   */
  findById: async (id) => {
    const row = await db.prepare('SELECT * FROM patients WHERE id = ?')
      .bind(id)
      .first();
    
    if (!row) {
      return null;
    }
    
    return Patient.fromDBRow(row);
  },

  /**
   * Find all patients with optional filters
   */
  findAll: async (filters = {}) => {
    const {
      status,
      oncologist,
      current_status,
      limit = 20,
      offset = 0
    } = filters;

    // Build query with filters
    let query = 'SELECT * FROM patients WHERE 1=1';
    const bindings = [];

    if (status) {
      query += ' AND status = ?';
      bindings.push(status);
    }

    if (oncologist) {
      query += ' AND primary_oncologist = ?';
      bindings.push(oncologist);
    }

    if (current_status) {
      query += ' AND current_status = ?';
      bindings.push(current_status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(parseInt(limit), parseInt(offset));

    const result = await db.prepare(query).bind(...bindings).all();
    
    return result.results.map(row => Patient.fromDBRow(row));
  },

  /**
   * Get patient demographics only
   */
  findDemographicsById: async (id) => {
    const row = await db.prepare(`
      SELECT
        id, name, age, age_unit, sex, dob, date_of_birth, gender,
        blood_type, height_cm, weight_kg, bsa,
        language_preference, allergy_status,
        caregiver_name, caregiver_relation, caregiver_contact
      FROM patients WHERE id = ?
    `).bind(id).first();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      age: row.age,
      age_unit: row.age_unit,
      sex: row.sex || row.gender,
      dob: row.dob || row.date_of_birth,
      blood_type: row.blood_type,
      height_cm: row.height_cm,
      weight_kg: row.weight_kg,
      bsa: row.bsa,
      language_preference: row.language_preference,
      allergy_status: row.allergy_status,
      caregiver: row.caregiver_name ? {
        name: row.caregiver_name,
        relation: row.caregiver_relation,
        contact: row.caregiver_contact
      } : null
    };
  },

  /**
   * Create a new patient
   */
  create: async (patientData) => {
    const patient = new Patient(patientData);
    const row = patient.toDBRow();

    await db.prepare(`
      INSERT INTO patients (
        id, booking_patient_id, external_mrn, patient_id_uhid, patient_id_ipd,
        name, age, age_unit, sex, dob, date_of_birth, gender,
        blood_type, height_cm, weight_kg, bsa,
        ecog_status, current_status, current_status_detail,
        primary_oncologist, primary_center,
        language_preference, allergy_status,
        caregiver_name, caregiver_relation, caregiver_contact,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      row.id, row.booking_patient_id, row.external_mrn, row.patient_id_uhid, row.patient_id_ipd,
      row.name, row.age, row.age_unit, row.sex, row.dob, row.date_of_birth, row.gender,
      row.blood_type, row.height_cm, row.weight_kg, row.bsa,
      row.ecog_status, row.current_status, row.current_status_detail,
      row.primary_oncologist, row.primary_center,
      row.language_preference, row.allergy_status,
      row.caregiver_name, row.caregiver_relation, row.caregiver_contact,
      row.status, row.created_at, row.updated_at
    ).run();

    return patient;
  },

  /**
   * Update patient by ID
   */
  update: async (id, updates) => {
    // Get existing patient
    const existing = await db.prepare('SELECT * FROM patients WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return null;
    }

    // Merge updates
    const updated = {
      ...existing,
      ...updates,
      updated_at: getCurrentTimestamp()
    };

    const patient = new Patient(updated);
    const row = patient.toDBRow();

    await db.prepare(`
      UPDATE patients SET
        booking_patient_id = ?, external_mrn = ?, patient_id_uhid = ?, patient_id_ipd = ?,
        name = ?, age = ?, age_unit = ?, sex = ?, dob = ?, date_of_birth = ?, gender = ?,
        blood_type = ?, height_cm = ?, weight_kg = ?, bsa = ?,
        ecog_status = ?, current_status = ?, current_status_detail = ?,
        primary_oncologist = ?, primary_center = ?,
        language_preference = ?, allergy_status = ?,
        caregiver_name = ?, caregiver_relation = ?, caregiver_contact = ?,
        status = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      row.booking_patient_id, row.external_mrn, row.patient_id_uhid, row.patient_id_ipd,
      row.name, row.age, row.age_unit, row.sex, row.dob, row.date_of_birth, row.gender,
      row.blood_type, row.height_cm, row.weight_kg, row.bsa,
      row.ecog_status, row.current_status, row.current_status_detail,
      row.primary_oncologist, row.primary_center,
      row.language_preference, row.allergy_status,
      row.caregiver_name, row.caregiver_relation, row.caregiver_contact,
      row.status, row.updated_at, id
    ).run();

    return patient;
  },

  /**
   * Soft delete patient (archive)
   */
  archive: async (id) => {
    await db.prepare(`
      UPDATE patients SET status = 'archived', updated_at = ? WHERE id = ?
    `).bind(getCurrentTimestamp(), id).run();
    
    return true;
  },

  /**
   * Update specific patient fields (for demographics sync)
   */
  updateFields: async (id, fields) => {
    const updates = [];
    const bindings = [];

    for (const [key, value] of Object.entries(fields)) {
      updates.push(`${key} = ?`);
      bindings.push(value);
    }

    if (updates.length === 0) {
      return false;
    }

    updates.push('updated_at = ?');
    bindings.push(getCurrentTimestamp());
    bindings.push(id);

    await db.prepare(`
      UPDATE patients 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...bindings).run();

    return true;
  }
});

