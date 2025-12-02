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

// Family history
history.get('/family', async (c) => {
  try {
    const { patientId } = c.req.param();
    return c.json({ success: true, data: await listTable(c.env.DB, 'family_history', patientId) });
  } catch (error) {
    console.error('Error listing family history:', error);
    return c.json(errorResponse(error), 500);
  }
});

history.post('/family', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    if (!body.relationship || !body.condition) throw new ValidationError('relationship and condition are required');
    const id = `fh_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();
    await c.env.DB.prepare(`
      INSERT INTO family_history (
        id, patient_id, relationship, condition, icd_code, age_at_diagnosis,
        is_alive, age_at_death, cause_of_death, notes, data_sources,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      body.relationship, body.condition, body.icd_code || null, body.age_at_diagnosis || null,
      body.is_alive ?? true, body.age_at_death || null, body.cause_of_death || null, body.notes || null,
      body.data_sources ? JSON.stringify(body.data_sources) : null,
      now, now
    ).run();
    return c.json({ success: true, data: { id }, message: 'Family history added' }, 201);
  } catch (error) {
    console.error('Error adding family history:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Social history
history.get('/social', async (c) => {
  try {
    const { patientId } = c.req.param();
    return c.json({ success: true, data: await listTable(c.env.DB, 'social_history', patientId) });
  } catch (error) {
    console.error('Error listing social history:', error);
    return c.json(errorResponse(error), 500);
  }
});

history.post('/social', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    const id = `soh_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();
    await c.env.DB.prepare(`
      INSERT INTO social_history (
        id, patient_id, tobacco_use, tobacco_type, tobacco_packs_per_day, tobacco_years, tobacco_quit_date,
        alcohol_use, alcohol_drinks_per_week, recreational_drug_use,
        occupation, occupational_exposures, exercise_frequency, diet_description,
        living_situation, support_system, data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      body.tobacco_use || null, body.tobacco_type || null, body.tobacco_packs_per_day || null, body.tobacco_years || null, body.tobacco_quit_date || null,
      body.alcohol_use || null, body.alcohol_drinks_per_week || null, body.recreational_drug_use || null,
      body.occupation || null, body.occupational_exposures || null, body.exercise_frequency || null, body.diet_description || null,
      body.living_situation || null, body.support_system || null,
      body.data_sources ? JSON.stringify(body.data_sources) : null,
      now, now
    ).run();
    return c.json({ success: true, data: { id }, message: 'Social history added' }, 201);
  } catch (error) {
    console.error('Error adding social history:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default history;
