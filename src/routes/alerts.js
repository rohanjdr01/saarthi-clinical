import { Hono } from 'hono';
import { AlertRepository } from '../repositories/alert.repository.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
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
    const alertRepo = AlertRepository(c.env.DB);
    const alerts = await alertRepo.findByPatientId(patientId);
    return c.json({ success: true, data: alerts });
  } catch (error) {
    console.error('Error listing alerts:', error);
    return c.json(errorResponse(error), 500);
  }
});

alerts.post('/', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();

    const errors = validate(body);
    if (errors.length) throw new ValidationError(errors.join(', '));

    const alertRepo = AlertRepository(c.env.DB);
    const { id } = await alertRepo.create(patientId, body);

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

    const alertRepo = AlertRepository(c.env.DB);
    const existing = await alertRepo.findById(alertId, patientId);
    if (!existing) throw new NotFoundError('Alert');

    const updated = await alertRepo.update(alertId, patientId, body);
    if (!updated) throw new ValidationError('No valid fields to update');

    return c.json({ success: true, message: 'Alert updated' });
  } catch (error) {
    console.error('Error updating alert:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

alerts.delete('/:alertId', requireAdmin(), async (c) => {
  try {
    const { patientId, alertId } = c.req.param();
    const alertRepo = AlertRepository(c.env.DB);
    await alertRepo.delete(alertId, patientId);
    return c.json({ success: true, message: 'Alert deleted' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default alerts;
