import { Hono } from 'hono';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';
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
    const result = await c.env.DB.prepare(`
      SELECT * FROM medications
      WHERE patient_id = ?
      ORDER BY treatment_context, created_at DESC
    `).bind(patientId).all();

    // Group by treatment_context
    const grouped = result.results.reduce((acc, med) => {
      const context = med.treatment_context || 'Other Medications';
      if (!acc[context]) {
        acc[context] = [];
      }
      acc[context].push(med);
      return acc;
    }, {});

    return c.json({ 
      success: true, 
      data: grouped,
      // Also return flat list for backward compatibility
      flat: result.results
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

    const existing = await c.env.DB.prepare(`
      SELECT * FROM medications WHERE id = ? AND patient_id = ?
    `).bind(medId, patientId).first();

    if (!existing) throw new NotFoundError('Medication');

    const allowed = [
      'medication_name', 'generic_name', 'drug_class',
      'dose', 'dose_unit', 'frequency', 'route',
      'start_date', 'end_date',
      'medication_status', 'discontinuation_reason',
      'indication', 'medication_type', 'treatment_context', 'data_sources'
    ];

    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const mappedValues = [];
    Object.entries(updates).forEach(([k, v]) => {
      if (k === 'data_sources' && typeof v !== 'string') {
        mappedValues.push(JSON.stringify(v));
      } else {
        mappedValues.push(v);
      }
    });

    await c.env.DB.prepare(`
      UPDATE medications
      SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...mappedValues, getCurrentTimestamp(), medId, patientId).run();

    return c.json({ success: true, message: 'Medication updated' });
  } catch (error) {
    console.error('Error updating medication:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

medications.delete('/:medId', requireAdmin(), async (c) => {
  try {
    const { patientId, medId } = c.req.param();
    await c.env.DB.prepare(`
      DELETE FROM medications WHERE id = ? AND patient_id = ?
    `).bind(medId, patientId).run();

    return c.json({ success: true, message: 'Medication deleted' });
  } catch (error) {
    console.error('Error deleting medication:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default medications;
