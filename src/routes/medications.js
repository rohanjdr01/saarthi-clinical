import { Hono } from 'hono';
import { MedicationRepository } from '../repositories/medication.repository.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { requireAdmin } from '../middleware/auth.js';

const medications = new Hono();

function validate(body) {
  const errors = [];
  if (!body.medication_name) errors.push('medication_name is required');
  if (!body.patient_id) errors.push('patient_id is required');
  return errors;
}

medications.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    const medRepo = MedicationRepository(c.env.DB);
    const { grouped, flat } = await medRepo.findByPatientId(patientId);

    return c.json({ 
      success: true, 
      data: grouped,
      // Also return flat list for backward compatibility
      flat
    });
  } catch (error) {
    console.error('Error listing medications:', error);
    return c.json(errorResponse(error), 500);
  }
});

medications.post('/', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    body.patient_id = patientId;

    const errors = validate(body);
    if (errors.length) throw new ValidationError(errors.join(', '));

    const id = `med_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await c.env.DB.prepare(`
      INSERT INTO medications (
        id, patient_id, medication_name, generic_name, drug_class,
        dose, dose_unit, frequency, route,
        start_date, end_date,
        medication_status, discontinuation_reason,
        indication, medication_type, treatment_context,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      body.medication_name, body.generic_name || null, body.drug_class || null,
      body.dose || null, body.dose_unit || null, body.frequency || null, body.route || null,
      body.start_date || null, body.end_date || null,
      body.medication_status || 'active', body.discontinuation_reason || null,
      body.indication || null, body.medication_type || null, body.treatment_context || null,
      body.data_sources ? JSON.stringify(body.data_sources) : null,
      now, now
    ).run();

    return c.json({ success: true, data: { id }, message: 'Medication created' }, 201);
  } catch (error) {
    console.error('Error creating medication:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

medications.put('/:medId', requireAdmin(), async (c) => {
  try {
    const { patientId, medId } = c.req.param();
    const body = await c.req.json();

    const medRepo = MedicationRepository(c.env.DB);
    const existing = await medRepo.findById(medId, patientId);

    if (!existing) throw new NotFoundError('Medication');

    const updated = await medRepo.update(medId, patientId, body);
    if (!updated) {
      throw new ValidationError('No valid fields to update');
    }

    return c.json({ success: true, message: 'Medication updated' });
  } catch (error) {
    console.error('Error updating medication:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

medications.delete('/:medId', requireAdmin(), async (c) => {
  try {
    const { patientId, medId } = c.req.param();
    const medRepo = MedicationRepository(c.env.DB);
    await medRepo.delete(medId, patientId);

    return c.json({ success: true, message: 'Medication deleted' });
  } catch (error) {
    console.error('Error deleting medication:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default medications;
