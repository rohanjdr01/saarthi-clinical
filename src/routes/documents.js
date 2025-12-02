/**
 * Documents Routes (Refactored with merged case-pack functionality)
 *
 * Category/subcategory are inferred during AI processing, but users can optionally provide them
 */

import { Hono } from 'hono';
import { Document } from '../models/document.js';
import { DocumentProcessor } from '../services/processing/processor.js';
import { vectorizeDocument, searchDocuments } from '../services/vectorize/indexer.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';

const documents = new Hono();

// ============================================================================
// UPLOAD DOCUMENTS
// ============================================================================

documents.post('/', async (c) => {
  try {
    const { patientId } = c.req.param();

    // Check if patient exists
    const patient = await c.env.DB.prepare('SELECT id FROM patients WHERE id = ?')
      .bind(patientId).first();

    if (!patient) {
      throw new NotFoundError('Patient');
    }

    // Get form data
    const formData = await c.req.formData();
    const files = formData.getAll('files');
    const category = formData.get('category'); // Optional - will be inferred if not provided
    const subcategory = formData.get('subcategory'); // Optional
    const documentDate = formData.get('document_date');
    const processImmediately = formData.get('process_immediately') === 'true';
    const provider = formData.get('provider') || c.req.query('provider'); // Get provider from form or query

    if (!files || files.length === 0) {
      throw new ValidationError('At least one file is required');
    }

    // Process each file
    const uploadedDocuments = [];
    const processingTasks = [];

    for (const file of files) {
      // Create document metadata
      const documentData = {
        patient_id: patientId,
        filename: file.name,
        file_type: file.name.split('.').pop().toLowerCase(),
        category: category || null, // Optional - will be inferred during processing
        subcategory: subcategory || null,
        document_date: documentDate,
        file_size: file.size,
        mime_type: file.type,
        vectorize_status: 'pending', // Will be vectorized after processing
        reviewed_status: 'pending'
      };

      // Validate
      const errors = Document.validate(documentData);
      if (errors.length > 0) {
        throw new ValidationError(`File ${file.name}: ${errors.join(', ')}`);
      }

      const document = new Document(documentData);

      // Upload to R2
      const fileBuffer = await file.arrayBuffer();
      await c.env.DOCUMENTS.put(document.storage_key, fileBuffer, {
        httpMetadata: {
          contentType: file.type
        },
        customMetadata: {
          patient_id: patientId,
          category: category || 'unknown',
          uploaded_at: new Date().toISOString()
        }
      });

      // Save metadata to D1 with new fields
      await c.env.DB.prepare(`
        INSERT INTO documents (
          id, patient_id, filename, file_type, mime_type, file_size, storage_key,
          document_type, document_subtype, category, subcategory, title, document_date,
          case_pack_order, processing_status, vectorize_status, reviewed_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        document.id, document.patient_id, document.filename, document.file_type,
        document.mime_type, document.file_size, document.storage_key,
        document.document_type || 'other', document.document_subtype,
        document.category, document.subcategory, document.title, document.document_date,
        document.case_pack_order, document.processing_status,
        document.vectorize_status, document.reviewed_status,
        document.created_at, document.updated_at
      ).run();

      uploadedDocuments.push(document.toJSON());

      // Queue processing if requested
      if (processImmediately) {
        processingTasks.push(document.id);
      }
    }

    // Trigger processing in background if requested
    // AI will infer category/subcategory during processing
    if (processImmediately && processingTasks.length > 0) {
      for (const docId of processingTasks) {
        c.executionCtx.waitUntil(
          (async () => {
            try {
              const processor = new DocumentProcessor(c.env, { provider });
              await processor.processDocument(docId, { mode: 'incremental', provider });
            } catch (error) {
              console.error(`Error processing document ${docId}:`, error);
              // Update document status to failed
              await c.env.DB.prepare(`
                UPDATE documents
                SET processing_status = ?, processing_error = ?
                WHERE id = ?
              `).bind('failed', error.message, docId).run();
            }
          })()
        );
      }
    }

    return c.json({
      success: true,
      documents_uploaded: uploadedDocuments.length,
      processing_status: processImmediately ? 'processing' : 'pending',
      message: `${uploadedDocuments.length} document(s) uploaded successfully.${processImmediately ? ' Processing started.' : ''}`,
      data: uploadedDocuments
    }, 202);

  } catch (error) {
    console.error('Error uploading documents:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// LIST DOCUMENTS WITH FILTERS
// ============================================================================

documents.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    const {
      category,
      start_date,
      end_date,
      reviewed_status,
      sort = 'created_at',
      order = 'desc'
    } = c.req.query();

    // Build query with filters
    let query = 'SELECT * FROM documents WHERE patient_id = ?';
    const bindings = [patientId];

    if (category) {
      query += ' AND category = ?';
      bindings.push(category);
    }

    if (start_date) {
      query += ' AND document_date >= ?';
      bindings.push(start_date);
    }

    if (end_date) {
      query += ' AND document_date <= ?';
      bindings.push(end_date);
    }

    if (reviewed_status) {
      query += ' AND reviewed_status = ?';
      bindings.push(reviewed_status);
    }

    // Sort
    const validSortFields = ['created_at', 'document_date', 'case_pack_order', 'category'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortField} ${sortOrder}`;

    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...bindings).all();
    const documentList = result.results.map(row => Document.fromDBRow(row).toJSON());

    return c.json({
      success: true,
      data: documentList,
      total: documentList.length,
      filters: {
        category,
        start_date,
        end_date,
        reviewed_status,
        sort: sortField,
        order: sortOrder
      }
    });

  } catch (error) {
    console.error('Error listing documents:', error);
    return c.json(errorResponse(error), 500);
  }
});

// ============================================================================
// GET DOCUMENT METADATA
// ============================================================================

documents.get('/:docId', async (c) => {
  try {
    const { patientId, docId } = c.req.param();

    const stmt = c.env.DB.prepare(`
      SELECT * FROM documents
      WHERE id = ? AND patient_id = ?
    `);

    const result = await stmt.bind(docId, patientId).first();

    if (!result) {
      throw new NotFoundError('Document');
    }

    const document = Document.fromDBRow(result);

    return c.json({
      success: true,
      data: document.toJSON()
    });

  } catch (error) {
    console.error('Error getting document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// UPDATE DOCUMENT METADATA
// ============================================================================

documents.patch('/:docId', async (c) => {
  try {
    const { patientId, docId } = c.req.param();
    const body = await c.req.json();

    // Get existing document
    const existing = await c.env.DB.prepare(`
      SELECT * FROM documents WHERE id = ? AND patient_id = ?
    `).bind(docId, patientId).first();

    if (!existing) {
      throw new NotFoundError('Document');
    }

    // Allowed fields for update
    const allowedUpdates = {
      title: body.title,
      category: body.category,
      subcategory: body.subcategory,
      reviewed_status: body.reviewed_status,
      reviewed_by: body.reviewed_by,
      case_pack_order: body.case_pack_order,
      document_date: body.document_date
    };

    // Filter out undefined values
    const updates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    // Build UPDATE query
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), getCurrentTimestamp(), docId, patientId];

    await c.env.DB.prepare(`
      UPDATE documents SET ${setClause}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...values).run();

    // Get updated document
    const updated = await c.env.DB.prepare(`
      SELECT * FROM documents WHERE id = ?
    `).bind(docId).first();

    return c.json({
      success: true,
      message: 'Document metadata updated successfully',
      data: Document.fromDBRow(updated).toJSON()
    });

  } catch (error) {
    console.error('Error updating document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// DOWNLOAD DOCUMENT
// ============================================================================

documents.get('/:docId/download', async (c) => {
  try {
    const { patientId, docId } = c.req.param();

    // Get document metadata
    const stmt = c.env.DB.prepare(`
      SELECT * FROM documents
      WHERE id = ? AND patient_id = ?
    `);

    const result = await stmt.bind(docId, patientId).first();

    if (!result) {
      throw new NotFoundError('Document');
    }

    const document = Document.fromDBRow(result);

    // Get file from R2
    const object = await c.env.DOCUMENTS.get(document.storage_key);

    if (!object) {
      throw new NotFoundError('Document file in storage');
    }

    // Return file
    return new Response(object.body, {
      headers: {
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${document.filename}"`,
        'Content-Length': document.file_size.toString()
      }
    });

  } catch (error) {
    console.error('Error downloading document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// DELETE DOCUMENT
// ============================================================================

documents.delete('/:docId', async (c) => {
  try {
    const { patientId, docId } = c.req.param();

    // Get document metadata
    const stmt = c.env.DB.prepare(`
      SELECT * FROM documents
      WHERE id = ? AND patient_id = ?
    `);

    const result = await stmt.bind(docId, patientId).first();

    if (!result) {
      throw new NotFoundError('Document');
    }

    const document = Document.fromDBRow(result);

    // Delete from R2
    await c.env.DOCUMENTS.delete(document.storage_key);

    // Delete associated vectors (if any)
    await c.env.DB.prepare('DELETE FROM document_vectors WHERE document_id = ?')
      .bind(docId).run();

    // Delete from D1
    await c.env.DB.prepare('DELETE FROM documents WHERE id = ?')
      .bind(docId).run();

    return c.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// REORDER CASE-PACK DOCUMENTS
// ============================================================================

documents.post('/reorder', async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();

    // Expecting: { document_orders: [{ document_id: 'doc_123', order: 1 }, ...] }
    const { document_orders } = body;

    if (!document_orders || !Array.isArray(document_orders)) {
      throw new ValidationError('document_orders array is required');
    }

    // Update each document's case_pack_order
    for (const { document_id, order } of document_orders) {
      await c.env.DB.prepare(`
        UPDATE documents
        SET case_pack_order = ?, updated_at = ?
        WHERE id = ? AND patient_id = ?
      `).bind(order, getCurrentTimestamp(), document_id, patientId).run();
    }

    return c.json({
      success: true,
      message: 'Case-pack order updated successfully',
      documents_reordered: document_orders.length
    });

  } catch (error) {
    console.error('Error reordering documents:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// SEMANTIC SEARCH (RAG)
// ============================================================================

documents.post('/search', async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    const { query, top_k = 5 } = body || {};

    if (!query) {
      throw new ValidationError('Query is required');
    }

    const result = await searchDocuments(c.env, {
      patientId,
      query,
      topK: top_k
    });

    if (result.status === 'skipped') {
      return c.json({
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'Vectorize binding not configured'
        }
      }, 501);
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Vectorize search failed');
    }

    return c.json({
      success: true,
      data: result.results
    });

  } catch (error) {
    console.error('Error searching documents:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// MANUAL VECTORIZATION TRIGGER
// ============================================================================

documents.post('/:docId/vectorize', async (c) => {
  try {
    const { patientId, docId } = c.req.param();

    const doc = await c.env.DB.prepare(`
      SELECT * FROM documents WHERE id = ? AND patient_id = ?
    `).bind(docId, patientId).first();

    if (!doc) {
      throw new NotFoundError('Document');
    }

    const vectorizeResult = await vectorizeDocument(c.env, {
      documentId: docId,
      patientId,
      text: doc.extracted_text || doc.extracted_data || doc.summary || '',
      metadata: {
        document_type: doc.document_type,
        category: doc.category,
        subcategory: doc.subcategory
      }
    });

    await c.env.DB.prepare(`
      UPDATE documents
      SET vectorize_status = ?, vectorized_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      vectorizeResult.status,
      getCurrentTimestamp(),
      getCurrentTimestamp(),
      docId
    ).run();

    return c.json({
      success: true,
      message: 'Vectorization executed',
      data: vectorizeResult
    });
  } catch (error) {
    console.error('Error vectorizing document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// REPROCESS DOCUMENT
// ============================================================================

documents.post('/:docId/reprocess', async (c) => {
  try {
    const { patientId, docId } = c.req.param();
    const provider = c.req.query('provider');

    // Get document
    const existing = await c.env.DB.prepare(`
      SELECT * FROM documents WHERE id = ? AND patient_id = ?
    `).bind(docId, patientId).first();

    if (!existing) {
      throw new NotFoundError('Document');
    }

    // Reset processing status
    await c.env.DB.prepare(`
      UPDATE documents
      SET processing_status = 'pending',
          processing_error = NULL,
          processing_started_at = NULL,
          processing_completed_at = NULL,
          updated_at = ?
      WHERE id = ?
    `).bind(getCurrentTimestamp(), docId).run();

    // Trigger reprocessing in background
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const processor = new DocumentProcessor(c.env, { provider });
          await processor.processDocument(docId, { mode: 'full', provider });
        } catch (error) {
          console.error(`Error reprocessing document ${docId}:`, error);
          await c.env.DB.prepare(`
            UPDATE documents
            SET processing_status = ?, processing_error = ?
            WHERE id = ?
          `).bind('failed', error.message, docId).run();
        }
      })()
    );

    return c.json({
      success: true,
      message: 'Document reprocessing started',
      document_id: docId
    }, 202);

  } catch (error) {
    console.error('Error reprocessing document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default documents;
