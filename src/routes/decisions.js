import { Hono } from 'hono';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';
import { requireAdmin } from '../middleware/auth.js';

const decisions = new Hono();

function validate(body) {
  const errors = [];
  if (!body.decision_type) errors.push('decision_type is required');
  if (!body.clinical_question) errors.push('clinical_question is required');
  if (!body.decision_made) errors.push('decision_made is required');
  return errors;
}

decisions.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    const result = await c.env.DB.prepare(`
      SELECT * FROM clinical_decisions
      WHERE patient_id = ?
      ORDER BY decision_date DESC
    `).bind(patientId).all();
    return c.json({ success: true, data: result.results });
  } catch (error) {
    console.error('Error listing decisions:', error);
    return c.json(errorResponse(error), 500);
  }
});

decisions.post('/', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    body.patient_id = patientId;

    const errors = validate(body);
    if (errors.length) throw new ValidationError(errors.join(', '));

    const id = `cd_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await c.env.DB.prepare(`
      INSERT INTO clinical_decisions (
        id, patient_id, decision_type, decision_date, clinical_question, background,
        mdt_discussion, mdt_date, participants,
        decision_made, rationale, alternatives_considered,
        implementation_status, implemented_date,
        outcome, outcome_date,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      body.decision_type, body.decision_date || new Date().toISOString().split('T')[0],
      body.clinical_question, body.background || null,
      body.mdt_discussion || false, body.mdt_date || null, body.participants ? JSON.stringify(body.participants) : null,
      body.decision_made, body.rationale || null, body.alternatives_considered || null,
      body.implementation_status || 'pending', body.implemented_date || null,
      body.outcome || null, body.outcome_date || null,
      body.data_sources ? JSON.stringify(body.data_sources) : null,
      now, now
    ).run();

    return c.json({ success: true, data: { id }, message: 'Decision recorded' }, 201);
  } catch (error) {
    console.error('Error creating decision:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

decisions.put('/:decisionId', requireAdmin(), async (c) => {
  try {
    const { patientId, decisionId } = c.req.param();
    const body = await c.req.json();

    const existing = await c.env.DB.prepare(`
      SELECT * FROM clinical_decisions WHERE id = ? AND patient_id = ?
    `).bind(decisionId, patientId).first();
    if (!existing) throw new NotFoundError('Decision');

    const allowed = [
      'decision_type', 'decision_date', 'clinical_question', 'background',
      'mdt_discussion', 'mdt_date', 'participants',
      'decision_made', 'rationale', 'alternatives_considered',
      'implementation_status', 'implemented_date',
      'outcome', 'outcome_date', 'data_sources'
    ];
    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) throw new ValidationError('No valid fields to update');

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const mappedValues = Object.entries(updates).map(([k, v]) =>
      k === 'participants' && Array.isArray(v) ? JSON.stringify(v) :
      k === 'data_sources' && typeof v !== 'string' ? JSON.stringify(v) : v
    );

    await c.env.DB.prepare(`
      UPDATE clinical_decisions SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...mappedValues, getCurrentTimestamp(), decisionId, patientId).run();

    return c.json({ success: true, message: 'Decision updated' });
  } catch (error) {
    console.error('Error updating decision:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

decisions.delete('/:decisionId', requireAdmin(), async (c) => {
  try {
    const { patientId, decisionId } = c.req.param();
    await c.env.DB.prepare(`DELETE FROM clinical_decisions WHERE id = ? AND patient_id = ?`).bind(decisionId, patientId).run();
    return c.json({ success: true, message: 'Decision deleted' });
  } catch (error) {
    console.error('Error deleting decision:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default decisions;
