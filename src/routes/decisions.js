import { Hono } from 'hono';
import { DecisionRepository } from '../repositories/decision.repository.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
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
    const decisionRepo = DecisionRepository(c.env.DB);
    const decisions = await decisionRepo.findByPatientId(patientId);
    return c.json({ success: true, data: decisions });
  } catch (error) {
    console.error('Error listing decisions:', error);
    return c.json(errorResponse(error), 500);
  }
});

decisions.post('/', requireAdmin(), async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();

    const errors = validate(body);
    if (errors.length) throw new ValidationError(errors.join(', '));

    const decisionRepo = DecisionRepository(c.env.DB);
    const { id } = await decisionRepo.create(patientId, body);

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

    const decisionRepo = DecisionRepository(c.env.DB);
    const existing = await decisionRepo.findById(decisionId, patientId);
    if (!existing) throw new NotFoundError('Decision');

    const updated = await decisionRepo.update(decisionId, patientId, body);
    if (!updated) throw new ValidationError('No valid fields to update');

    return c.json({ success: true, message: 'Decision updated' });
  } catch (error) {
    console.error('Error updating decision:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

decisions.delete('/:decisionId', requireAdmin(), async (c) => {
  try {
    const { patientId, decisionId } = c.req.param();
    const decisionRepo = DecisionRepository(c.env.DB);
    await decisionRepo.delete(decisionId, patientId);
    return c.json({ success: true, message: 'Decision deleted' });
  } catch (error) {
    console.error('Error deleting decision:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default decisions;
