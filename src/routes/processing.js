import { Hono } from 'hono';
import { DocumentProcessor } from '../services/processing/processor.js';
import { NotFoundError, errorResponse } from '../utils/errors.js';

const processing = new Hono();

// Trigger processing for a specific document
processing.post('/documents/:docId/process', async (c) => {
  try {
    const { patientId, docId } = c.req.param();
    const providerFromQuery = c.req.query('provider');
    const resyncOnly = c.req.query('resync') === 'true';
    let providerFromBody = null;

    console.log(`📝 Manual processing request:`, {
      patientId,
      docId,
      path: c.req.path,
      method: c.req.method,
      resyncOnly
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

    const processor = new DocumentProcessor(c.env, { provider });
    
    // If resync=true, just re-sync from cached extracted data (no LLM call)
    if (resyncOnly) {
      console.log(`🔄 Resync-only mode - using cached extracted data`);
      const result = await processor.resyncFromCache(docId);
      return c.json({
        success: true,
        message: 'Profile re-synced from cached data (no LLM call)',
        data: result
      });
    }

    console.log(`✅ Document found, starting manual processing:`, {
      filename: doc.filename,
      current_status: doc.processing_status,
      storage_key: doc.storage_key
    });
    
    // Process document (full LLM extraction + sync)
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

// Re-sync profile from cached extracted data (no LLM call)
processing.post('/documents/:docId/resync', async (c) => {
  try {
    const { patientId, docId } = c.req.param();

    console.log(`🔄 Resync request for document ${docId}`);

    // Verify document exists and belongs to patient
    const doc = await c.env.DB.prepare(`
      SELECT id, patient_id, filename, extracted_data FROM documents WHERE id = ? AND patient_id = ?
    `).bind(docId, patientId).first();

    if (!doc) {
      throw new NotFoundError('Document');
    }

    if (!doc.extracted_data) {
      return c.json({
        success: false,
        error: 'No cached extracted data found. Run full processing first.',
        document_id: docId
      }, 400);
    }

    const processor = new DocumentProcessor(c.env);
    const result = await processor.resyncFromCache(docId);

    return c.json({
      success: true,
      message: 'Profile re-synced from cached data',
      data: result
    });

  } catch (error) {
    console.error('Error resyncing document:', error);
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

// Get processing status for a specific document
processing.get('/documents/:docId/status', async (c) => {
  try {
    const { patientId, docId } = c.req.param();

    const doc = await c.env.DB.prepare(`
      SELECT 
        id,
        filename,
        processing_status,
        processing_started_at,
        processing_completed_at,
        processing_error,
        vectorize_status,
        vectorized_at,
        file_search_status,
        file_search_store_name,
        file_search_document_name,
        tokens_used,
        gemini_model,
        created_at,
        updated_at
      FROM documents
      WHERE id = ? AND patient_id = ?
    `).bind(docId, patientId).first();

    if (!doc) {
      throw new NotFoundError('Document');
    }

    return c.json({
      success: true,
      document_id: doc.id,
      filename: doc.filename,
      processing_status: doc.processing_status,
      processing_started_at: doc.processing_started_at,
      processing_completed_at: doc.processing_completed_at,
      processing_error: doc.processing_error,
      vectorize_status: doc.vectorize_status,
      vectorized_at: doc.vectorized_at,
      file_search_status: doc.file_search_status,
      file_search_store_name: doc.file_search_store_name,
      file_search_document_name: doc.file_search_document_name,
      tokens_used: doc.tokens_used,
      model: doc.gemini_model,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    });
  } catch (error) {
    console.error('Error getting document processing status:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
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
