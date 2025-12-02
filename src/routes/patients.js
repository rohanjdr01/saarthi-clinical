import { Hono } from 'hono';
import { Patient } from '../models/patient.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';

const patients = new Hono();

// Create patient
patients.post('/', async (c) => {
  try {
    const body = await c.req.json();

    // Validate
    const errors = Patient.validate(body);
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    // Create patient
    const patient = new Patient(body);
    const row = patient.toDBRow();

    // Insert into D1 with all new fields
    const stmt = c.env.DB.prepare(`
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
    `);

    await stmt.bind(
      row.id, row.booking_patient_id, row.external_mrn, row.patient_id_uhid, row.patient_id_ipd,
      row.name, row.age, row.age_unit, row.sex, row.dob, row.date_of_birth, row.gender,
      row.blood_type, row.height_cm, row.weight_kg, row.bsa,
      row.ecog_status, row.current_status, row.current_status_detail,
      row.primary_oncologist, row.primary_center,
      row.language_preference, row.allergy_status,
      row.caregiver_name, row.caregiver_relation, row.caregiver_contact,
      row.status, row.created_at, row.updated_at
    ).run();

    return c.json({
      success: true,
      patient_id: patient.id,
      message: 'Patient created successfully',
      data: patient.toJSON()
    }, 201);

  } catch (error) {
    console.error('Error creating patient:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// List patients with filters
patients.get('/', async (c) => {
  try {
    const {
      limit = 20,
      offset = 0,
      status,
      oncologist,
      current_status
    } = c.req.query();

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

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...bindings).all();

    const patientsList = result.results.map(row => Patient.fromDBRow(row).toJSON());

    return c.json({
      success: true,
      data: patientsList,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: patientsList.length
      }
    });

  } catch (error) {
    console.error('Error listing patients:', error);
    return c.json(errorResponse(error), 500);
  }
});

// Get patient by ID (full patient header)
patients.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    const stmt = c.env.DB.prepare('SELECT * FROM patients WHERE id = ?');
    const result = await stmt.bind(id).first();

    if (!result) {
      throw new NotFoundError('Patient');
    }

    const patient = Patient.fromDBRow(result);

    return c.json({
      success: true,
      data: patient.toJSON()
    });

  } catch (error) {
    console.error('Error getting patient:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Get patient demographics only
patients.get('/:id/demographics', async (c) => {
  try {
    const { id } = c.req.param();

    const stmt = c.env.DB.prepare(`
      SELECT
        id, name, age, age_unit, sex, dob, date_of_birth, gender,
        blood_type, height_cm, weight_kg, bsa,
        language_preference, allergy_status,
        caregiver_name, caregiver_relation, caregiver_contact
      FROM patients WHERE id = ?
    `);
    const result = await stmt.bind(id).first();

    if (!result) {
      throw new NotFoundError('Patient');
    }

    const demographics = {
      id: result.id,
      name: result.name,
      age: result.age,
      age_unit: result.age_unit,
      sex: result.sex,
      dob: result.dob,
      date_of_birth: result.date_of_birth,
      gender: result.gender,
      blood_type: result.blood_type,
      height_cm: result.height_cm,
      weight_kg: result.weight_kg,
      bsa: result.bsa,
      language_preference: result.language_preference,
      allergy_status: result.allergy_status,
      caregiver: result.caregiver_name ? {
        name: result.caregiver_name,
        relation: result.caregiver_relation,
        contact: result.caregiver_contact
      } : null
    };

    return c.json({
      success: true,
      data: demographics
    });

  } catch (error) {
    console.error('Error getting patient demographics:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Update patient
patients.patch('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    // Check if patient exists
    const existing = await c.env.DB.prepare('SELECT * FROM patients WHERE id = ?')
      .bind(id).first();

    if (!existing) {
      throw new NotFoundError('Patient');
    }

    // Update fields
    const updated = {
      ...existing,
      ...body,
      updated_at: getCurrentTimestamp()
    };

    // Validate
    const errors = Patient.validate(updated);
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    const patient = new Patient(updated);
    const row = patient.toDBRow();

    // Update in D1 with all new fields
    const stmt = c.env.DB.prepare(`
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
    `);

    await stmt.bind(
      row.booking_patient_id, row.external_mrn, row.patient_id_uhid, row.patient_id_ipd,
      row.name, row.age, row.age_unit, row.sex, row.dob, row.date_of_birth, row.gender,
      row.blood_type, row.height_cm, row.weight_kg, row.bsa,
      row.ecog_status, row.current_status, row.current_status_detail,
      row.primary_oncologist, row.primary_center,
      row.language_preference, row.allergy_status,
      row.caregiver_name, row.caregiver_relation, row.caregiver_contact,
      row.status, row.updated_at, id
    ).run();

    return c.json({
      success: true,
      message: 'Patient updated successfully',
      data: patient.toJSON()
    });

  } catch (error) {
    console.error('Error updating patient:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Delete patient (soft delete)
patients.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    
    const stmt = c.env.DB.prepare(`
      UPDATE patients SET status = 'archived', updated_at = ? WHERE id = ?
    `);
    
    await stmt.bind(getCurrentTimestamp(), id).run();
    
    return c.json({
      success: true,
      message: 'Patient archived successfully'
    });
    
  } catch (error) {
    console.error('Error deleting patient:', error);
    return c.json(errorResponse(error), 500);
  }
});

export default patients;
