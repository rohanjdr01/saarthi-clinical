import { Hono } from 'hono';
import { Patient } from '../models/patient.js';
import { PatientRepository } from '../repositories/patient.repository.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';

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

    // Create patient using repository
    const patientRepo = PatientRepository(c.env.DB);
    const patient = await patientRepo.create(body);

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

    const patientRepo = PatientRepository(c.env.DB);
    const patientsList = await patientRepo.findAll({
      status,
      oncologist,
      current_status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return c.json({
      success: true,
      data: patientsList.map(p => p.toJSON()),
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

    const patientRepo = PatientRepository(c.env.DB);
    const patient = await patientRepo.findById(id);

    if (!patient) {
      throw new NotFoundError('Patient');
    }

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

    const patientRepo = PatientRepository(c.env.DB);
    const demographics = await patientRepo.findDemographicsById(id);

    if (!demographics) {
      throw new NotFoundError('Patient');
    }

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

    const patientRepo = PatientRepository(c.env.DB);
    
    // Get existing patient to validate merged data
    const existing = await patientRepo.findById(id);
    if (!existing) {
      throw new NotFoundError('Patient');
    }

    // Merge updates
    const updated = {
      ...existing.toDBRow(),
      ...body
    };

    // Validate
    const errors = Patient.validate(updated);
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    // Update using repository
    const patient = await patientRepo.update(id, body);

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
    
    const patientRepo = PatientRepository(c.env.DB);
    await patientRepo.archive(id);
    
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
