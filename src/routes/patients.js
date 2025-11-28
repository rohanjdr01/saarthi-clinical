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
    
    // Insert into D1
    const stmt = c.env.DB.prepare(`
      INSERT INTO patients (
        id, booking_patient_id, external_mrn,
        name, age, date_of_birth, gender,
        caregiver_name, caregiver_relation, caregiver_contact,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      row.id, row.booking_patient_id, row.external_mrn,
      row.name, row.age, row.date_of_birth, row.gender,
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

// List patients
patients.get('/', async (c) => {
  try {
    const { limit = 20, offset = 0, status = 'active' } = c.req.query();
    
    const stmt = c.env.DB.prepare(`
      SELECT * FROM patients 
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const result = await stmt.bind(status, parseInt(limit), parseInt(offset)).all();
    
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

// Get patient by ID
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
    
    // Update in D1
    const stmt = c.env.DB.prepare(`
      UPDATE patients SET
        name = ?, age = ?, date_of_birth = ?, gender = ?,
        caregiver_name = ?, caregiver_relation = ?, caregiver_contact = ?,
        status = ?, updated_at = ?
      WHERE id = ?
    `);
    
    await stmt.bind(
      row.name, row.age, row.date_of_birth, row.gender,
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
