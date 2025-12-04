import { Hono } from 'hono';
import { DocumentProcessor } from '../services/processing/processor.js';
import { NotFoundError, errorResponse } from '../utils/errors.js';

const processing = new Hono();

// Trigger processing for a specific document
processing.post('/documents/:docId/process', async (c) => {
  try {
    const { patientId, docId } = c.req.param();
    const providerFromQuery = c.req.query('provider');
    let providerFromBody = null;

    console.log(`📝 Manual processing request:`, {
      patientId,
      docId,
      path: c.req.path,
      method: c.req.method
    });

    try {
      const body = await c.req.json();
      providerFromBody = body?.provider || body?.model_provider;
    } catch (err) {
      // No body sent; keep providerFromBody null
    }

    const provider = providerFromQuery || providerFromBody || undefined;
    
    // Verify document exists
    const doc = await c.env.DB.prepare(`
      SELECT * FROM documents WHERE id = ? AND patient_id = ?
    `).bind(docId, patientId).first();
    
    if (!doc) {
      console.error(`❌ Document not found for manual processing:`, {
        docId,
        patientId,
        query: 'SELECT * FROM documents WHERE id = ? AND patient_id = ?'
      });

      // Check if document exists without patient filter
      const docAnyPatient = await c.env.DB.prepare(`
        SELECT id, patient_id, filename FROM documents WHERE id = ?
      `).bind(docId).first();

      if (docAnyPatient) {
        console.error(`⚠️ Document exists but with different patient_id:`, {
          requested_patient: patientId,
          actual_patient: docAnyPatient.patient_id,
          filename: docAnyPatient.filename
        });
        throw new NotFoundError(`Document belongs to different patient`);
      }

      throw new NotFoundError('Document');
    }

    console.log(`✅ Document found, starting manual processing:`, {
      filename: doc.filename,
      current_status: doc.processing_status,
      storage_key: doc.storage_key
    });
    
    // Process document
    const processor = new DocumentProcessor(c.env, { provider });
    const result = await processor.processDocument(docId, { provider });
    
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

// Debug endpoint - List all documents for a patient
processing.get('/documents', async (c) => {
  try {
    const { patientId } = c.req.param();
    
    const result = await c.env.DB.prepare(`
      SELECT id, filename, processing_status, storage_key, created_at, updated_at
      FROM documents
      WHERE patient_id = ?
      ORDER BY created_at DESC
    `).bind(patientId).all();
    
    return c.json({
      success: true,
      patient_id: patientId,
      count: result.results.length,
      documents: result.results
    });
    
  } catch (error) {
    console.error('Error listing documents for processing:', error);
    return c.json(errorResponse(error), 500);
  }
});

export default processing;
