import { Hono } from 'hono';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';
import { requireAdmin } from '../middleware/auth.js';

const labs = new Hono();

function validate(body) {
  const errors = [];
  if (!body.test_name) errors.push('test_name is required');
  if (!body.test_date) errors.push('test_date is required');
  return errors;
}

labs.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    const result = await c.env.DB.prepare(`
      SELECT * FROM lab_results
      WHERE patient_id = ?
      ORDER BY test_date DESC
    `).bind(patientId).all();
    return c.json({ success: true, data: result.results });
  } catch (error) {
    console.error('Error listing labs:', error);
    return c.json(errorResponse(error), 500);
  }
});

labs.post('/', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    body.patient_id = patientId;

    const errors = validate(body);
    if (errors.length) throw new ValidationError(errors.join(', '));

    const id = `lab_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await c.env.DB.prepare(`
      INSERT INTO lab_results (
        id, patient_id, test_name, test_category, result_value, result_text, result_unit,
        reference_min, reference_max, is_abnormal, abnormality_flag,
        test_date, specimen_type, lab_name, source_document_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      body.test_name, body.test_category || null,
      body.result_value || null, body.result_text || null, body.result_unit || null,
      body.reference_min || null, body.reference_max || null,
      body.is_abnormal || false, body.abnormality_flag || null,
      body.test_date,
      body.specimen_type || null, body.lab_name || null, body.source_document_id || null,
      now, now
    ).run();

    return c.json({ success: true, data: { id }, message: 'Lab result created' }, 201);
  } catch (error) {
    console.error('Error creating lab result:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

labs.put('/:labId', requireAdmin(), async (c) => {
  try {
    const { patientId, labId } = c.req.param();
    const body = await c.req.json();

    const existing = await c.env.DB.prepare(`
      SELECT * FROM lab_results WHERE id = ? AND patient_id = ?
    `).bind(labId, patientId).first();
    if (!existing) throw new NotFoundError('Lab result');

    const allowed = [
      'test_name', 'test_category', 'result_value', 'result_text', 'result_unit',
      'reference_min', 'reference_max', 'is_abnormal', 'abnormality_flag',
      'test_date', 'specimen_type', 'lab_name', 'source_document_id'
    ];
    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) throw new ValidationError('No valid fields to update');

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const mappedValues = Object.values(updates);

    await c.env.DB.prepare(`
      UPDATE lab_results SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...mappedValues, getCurrentTimestamp(), labId, patientId).run();

    return c.json({ success: true, message: 'Lab result updated' });
  } catch (error) {
    console.error('Error updating lab result:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

labs.delete('/:labId', requireAdmin(), async (c) => {
  try {
    const { patientId, labId } = c.req.param();
    await c.env.DB.prepare(`DELETE FROM lab_results WHERE id = ? AND patient_id = ?`).bind(labId, patientId).run();
    return c.json({ success: true, message: 'Lab result deleted' });
  } catch (error) {
    console.error('Error deleting lab result:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default labs;
