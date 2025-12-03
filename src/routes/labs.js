import { Hono } from 'hono';
import { LabRepository } from '../repositories/lab.repository.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
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
    const labRepo = LabRepository(c.env.DB);
    const labs = await labRepo.findByPatientId(patientId);
    return c.json({ success: true, data: labs });
  } catch (error) {
    console.error('Error listing labs:', error);
    return c.json(errorResponse(error), 500);
  }
});

labs.post('/', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();

    const errors = validate(body);
    if (errors.length) throw new ValidationError(errors.join(', '));

    const labRepo = LabRepository(c.env.DB);
    const { id } = await labRepo.create(patientId, body);

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

    const labRepo = LabRepository(c.env.DB);
    const existing = await labRepo.findById(labId, patientId);
    if (!existing) throw new NotFoundError('Lab result');

    const updated = await labRepo.update(labId, patientId, body);
    if (!updated) throw new ValidationError('No valid fields to update');

    return c.json({ success: true, message: 'Lab result updated' });
  } catch (error) {
    console.error('Error updating lab result:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

labs.delete('/:labId', requireAdmin(), async (c) => {
  try {
    const { patientId, labId } = c.req.param();
    const labRepo = LabRepository(c.env.DB);
    await labRepo.delete(labId, patientId);
    return c.json({ success: true, message: 'Lab result deleted' });
  } catch (error) {
    console.error('Error deleting lab result:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default labs;
