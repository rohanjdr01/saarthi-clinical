import { Hono } from 'hono';
import { DocumentProcessor } from '../services/processing/processor.js';
import { NotFoundError, errorResponse } from '../utils/errors.js';

const processing = new Hono();

// Trigger processing for a specific document
processing.post('/documents/:docId/process', async (c) => {
  try {
    const { patientId, docId } = c.req.param();
    
    // Verify document exists
    const doc = await c.env.DB.prepare(`
      SELECT * FROM documents WHERE id = ? AND patient_id = ?
    `).bind(docId, patientId).first();
    
    if (!doc) {
      throw new NotFoundError('Document');
    }
    
    // Process document
    const processor = new DocumentProcessor(c.env);
    const result = await processor.processDocument(docId);
    
    return c.json({
      success: true,
      message: 'Document processed successfully',
      data: result
    });
    
  } catch (error) {
    console.error('Error processing document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Get processing status
processing.get('/status', async (c) => {
  try {
    const { patientId } = c.req.param();
    
    // Get document counts by status
    const result = await c.env.DB.prepare(`
      SELECT processing_status, COUNT(*) as count
      FROM documents
      WHERE patient_id = ?
      GROUP BY processing_status
    `).bind(patientId).all();
    
    const statusCounts = {};
    result.results.forEach(row => {
      statusCounts[row.processing_status] = row.count;
    });
    
    return c.json({
      success: true,
      patient_id: patientId,
      status: statusCounts,
      pending: statusCounts.pending || 0,
      processing: statusCounts.processing || 0,
      completed: statusCounts.completed || 0,
      failed: statusCounts.failed || 0
    });
    
  } catch (error) {
    console.error('Error getting processing status:', error);
    return c.json(errorResponse(error), 500);
  }
});

// Get processing log
processing.get('/log', async (c) => {
  try {
    const { patientId } = c.req.param();
    
    const result = await c.env.DB.prepare(`
      SELECT * FROM processing_log
      WHERE patient_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(patientId).all();
    
    return c.json({
      success: true,
      data: result.results
    });
    
  } catch (error) {
    console.error('Error getting processing log:', error);
    return c.json(errorResponse(error), 500);
  }
});

export default processing;
