import { Hono } from 'hono';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';
import { requireAdmin } from '../middleware/auth.js';

const history = new Hono();

// Generic list helper
async function listTable(db, table, patientId, orderBy = 'created_at DESC') {
  const result = await db.prepare(
    `SELECT * FROM ${table} WHERE patient_id = ? ORDER BY ${orderBy}`
  ).bind(patientId).all();
  return result.results;
}

// Medical history
history.get('/medical', async (c) => {
  try {
    const { patientId } = c.req.param();
    return c.json({ success: true, data: await listTable(c.env.DB, 'medical_history', patientId) });
  } catch (error) {
    console.error('Error listing medical history:', error);
    return c.json(errorResponse(error), 500);
  }
});

history.post('/medical', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    if (!body.condition) throw new ValidationError('condition is required');
    const id = `mh_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();
    await c.env.DB.prepare(`
      INSERT INTO medical_history (
        id, patient_id, condition, icd_code, diagnosis_date, is_current, resolution_date,
        severity, treatment_received, notes, data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      body.condition, body.icd_code || null, body.diagnosis_date || null, body.is_current ?? true,
      body.resolution_date || null, body.severity || null, body.treatment_received || null, body.notes || null,
      body.data_sources ? JSON.stringify(body.data_sources) : null,
      now, now
    ).run();
    return c.json({ success: true, data: { id }, message: 'Medical history added' }, 201);
  } catch (error) {
    console.error('Error adding medical history:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Surgical history
history.get('/surgical', async (c) => {
  try {
    const { patientId } = c.req.param();
    return c.json({ success: true, data: await listTable(c.env.DB, 'surgical_history', patientId) });
  } catch (error) {
    console.error('Error listing surgical history:', error);
    return c.json(errorResponse(error), 500);
  }
});

history.post('/surgical', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    if (!body.procedure_name) throw new ValidationError('procedure_name is required');
    const id = `sh_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();
    await c.env.DB.prepare(`
      INSERT INTO surgical_history (
        id, patient_id, procedure_name, procedure_code, surgery_date,
        surgeon, hospital, indication, complications, outcome, notes, data_sources,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      body.procedure_name, body.procedure_code || null, body.surgery_date || null,
      body.surgeon || null, body.hospital || null, body.indication || null,
      body.complications || null, body.outcome || null, body.notes || null,
      body.data_sources ? JSON.stringify(body.data_sources) : null,
      now, now
    ).run();
    return c.json({ success: true, data: { id }, message: 'Surgical history added' }, 201);
  } catch (error) {
    console.error('Error adding surgical history:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});


export default history;
