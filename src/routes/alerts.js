import { Hono } from 'hono';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';
import { requireAdmin } from '../middleware/auth.js';

const alerts = new Hono();

function validate(body) {
  const errors = [];
  if (!body.alert_type) errors.push('alert_type is required');
  if (!body.title) errors.push('title is required');
  return errors;
}

alerts.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    const result = await c.env.DB.prepare(`
      SELECT * FROM alerts
      WHERE patient_id = ?
      ORDER BY created_at DESC
    `).bind(patientId).all();
    return c.json({ success: true, data: result.results });
  } catch (error) {
    console.error('Error listing alerts:', error);
    return c.json(errorResponse(error), 500);
  }
});

alerts.post('/', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    body.patient_id = patientId;

    const errors = validate(body);
    if (errors.length) throw new ValidationError(errors.join(', '));

    const id = `alt_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    const now = getCurrentTimestamp();

    await c.env.DB.prepare(`
      INSERT INTO alerts (
        id, patient_id, alert_type, severity, title, description,
        alert_category, affected_system, actionable, recommended_action,
        alert_status, acknowledged_by, acknowledged_at, resolved_at,
        data_sources, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, patientId,
      body.alert_type, body.severity || null, body.title, body.description || null,
      body.alert_category || null, body.affected_system || null,
      body.actionable || false, body.recommended_action || null,
      body.alert_status || 'active', body.acknowledged_by || null,
      body.acknowledged_at || null, body.resolved_at || null,
      body.data_sources ? JSON.stringify(body.data_sources) : null,
      now, now
    ).run();

    return c.json({ success: true, data: { id }, message: 'Alert created' }, 201);
  } catch (error) {
    console.error('Error creating alert:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

alerts.put('/:alertId', requireAdmin(), async (c) => {
  try {
    const { patientId, alertId } = c.req.param();
    const body = await c.req.json();

    const existing = await c.env.DB.prepare(`
      SELECT * FROM alerts WHERE id = ? AND patient_id = ?
    `).bind(alertId, patientId).first();
    if (!existing) throw new NotFoundError('Alert');

    const allowed = [
      'alert_type', 'severity', 'title', 'description',
      'alert_category', 'affected_system', 'actionable', 'recommended_action',
      'alert_status', 'acknowledged_by', 'acknowledged_at', 'resolved_at',
      'data_sources'
    ];

    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) throw new ValidationError('No valid fields to update');

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
      UPDATE alerts SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...mappedValues, getCurrentTimestamp(), alertId, patientId).run();

    return c.json({ success: true, message: 'Alert updated' });
  } catch (error) {
    console.error('Error updating alert:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

alerts.delete('/:alertId', requireAdmin(), async (c) => {
  try {
    const { patientId, alertId } = c.req.param();
    await c.env.DB.prepare(`DELETE FROM alerts WHERE id = ? AND patient_id = ?`).bind(alertId, patientId).run();
    return c.json({ success: true, message: 'Alert deleted' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default alerts;
