/**
 * Documents Routes (Refactored with merged case-pack functionality)
 *
 * Category/subcategory are inferred during AI processing, but users can optionally provide them
 */

import { Hono } from 'hono';
import { Document } from '../models/document.js';
import { DocumentProcessor } from '../services/processing/processor.js';
import { searchDocuments } from '../services/vectorize/indexer.js';
import { GeminiService } from '../services/gemini/client.js';
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
    const processMode = formData.get('process_mode') || 'fast'; // 'fast' (default) or 'full'
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

      // Queue processing (always process in fast or full mode)
      processingTasks.push({ id: document.id, mode: processMode });
    }

    // Trigger processing in background
    // Fast mode: highlight + vectorize only (makes searchable immediately)
    // Full mode: complete extraction + patient profile sync
    if (processingTasks.length > 0) {
      for (const { id: docId, mode } of processingTasks) {
        c.executionCtx.waitUntil(
          (async () => {
            try {
              const processor = new DocumentProcessor(c.env, { provider });
              if (mode === 'fast') {
                await processor.processDocumentFast(docId, { provider });
              } else {
                await processor.processDocument(docId, { mode: 'incremental', provider });
              }
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
      processing_mode: processMode,
      processing_status: 'processing',
      message: `${uploadedDocuments.length} document(s) uploaded successfully. Processing in ${processMode} mode.`,
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

    // Delete from File Search if configured
    if (document.file_search_document_name && c.env.GEMINI_API_KEY) {
      try {
        const { FileSearchService } = await import('../services/gemini/file-search.js');
        const fileSearch = new FileSearchService(c.env.GEMINI_API_KEY);
        await fileSearch.deleteDocumentFromFileSearch(document.file_search_document_name);
        console.log(`✅ Deleted document from File Search: ${document.file_search_document_name}`);
      } catch (error) {
        console.error('Error deleting from File Search (non-fatal):', error);
        // Continue with deletion even if File Search delete fails
      }
    }

    // Delete vector chunks (Vectorize fallback)
    await c.env.DB.prepare('DELETE FROM document_vectors WHERE document_id = ?')
      .bind(docId).run();

    // Delete from Vectorize if configured
    if (c.env.VECTORIZE) {
      try {
        const { deleteDocumentVectors } = await import('../services/vectorize/indexer.js');
        await deleteDocumentVectors(c.env, docId);
      } catch (error) {
        console.error('Error deleting from Vectorize (non-fatal):', error);
      }
    }

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

    console.log('Search request:', {
      patientId,
      query,
      top_k,
      hasFileSearch: !!c.env.GEMINI_API_KEY,
      hasVectorize: !!c.env.VECTORIZE
    });

    if (!query) {
      throw new ValidationError('Query is required');
    }

    // Try File Search first if enabled
    const fileSearchEnabled = c.env.FILE_SEARCH_ENABLED !== 'false' && c.env.GEMINI_API_KEY;
    let result;

    if (fileSearchEnabled) {
      // Check if patient has any documents uploaded to File Search
      const fileSearchDocCount = await c.env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM documents 
        WHERE patient_id = ? 
        AND file_search_document_name IS NOT NULL 
        AND file_search_document_name != ''
      `).bind(patientId).first();

      const hasFileSearchDocs = fileSearchDocCount?.count > 0;
      console.log(`File Search check: ${fileSearchDocCount?.count || 0} documents in File Search for patient ${patientId}`);

      if (!hasFileSearchDocs) {
        console.warn('⚠️  No documents in File Search, falling back to Vectorize');
        // Fall through to Vectorize fallback
      } else {
        try {
          console.log('🔍 Using File Search for query');
          const geminiService = new GeminiService(c.env.GEMINI_API_KEY);
          const fileSearchResult = await geminiService.searchWithFileSearch(patientId, query);

          // Check if File Search store is empty
          if (fileSearchResult.error) {
            console.warn('File Search store empty, falling back to Vectorize');
            // Fall through to Vectorize fallback
          } else {
            // Format File Search results to match existing API structure
            // File Search returns an answer with citations, so we create result entries for each citation
            const formattedResults = fileSearchResult.citations && fileSearchResult.citations.length > 0
              ? fileSearchResult.citations.map((citation, idx) => ({
                  id: citation.documentName || `file-search-${idx}`,
                  score: citation.relevanceScore || 1.0,
                  metadata: {
                    document_name: citation.displayName || citation.documentName,
                    document_id: citation.documentName,
                    source: 'file_search'
                  },
                  text: fileSearchResult.text, // Include answer text in each result
                  answer: fileSearchResult.text
                }))
              : fileSearchResult.text && fileSearchResult.text.length > 0
              ? [{
                  id: 'file-search-answer',
                  score: 1.0,
                  metadata: {
                    source: 'file_search'
                  },
                  text: fileSearchResult.text,
                  answer: fileSearchResult.text
                }]
              : [];

            // If no results and no citations, check if we should fallback
            if (formattedResults.length === 0 && fileSearchResult.citations.length === 0) {
              console.warn('File Search returned empty results, falling back to Vectorize');
              // Fall through to Vectorize fallback
            } else {
              return c.json({
                success: true,
                data: formattedResults.slice(0, top_k), // Limit to top_k
                answer: fileSearchResult.text, // Include answer separately for convenience
                citations: fileSearchResult.citations || [],
                method: 'file_search'
              });
            }
          }
        } catch (fileSearchError) {
          console.error('File Search failed, falling back to Vectorize:', fileSearchError);
          // Fall through to Vectorize fallback
        }
      }
    }

    // Fallback to Vectorize
    if (c.env.VECTORIZE) {
      console.log('🔄 Using Vectorize (fallback)');
      result = await searchDocuments(c.env, {
        patientId,
        query,
        topK: top_k
      });

      console.log('Search result status:', result.status, {
        resultsCount: result.results?.length || 0,
        error: result.error
      });

      if (result.status === 'skipped') {
        return c.json({
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Neither File Search nor Vectorize is configured'
          }
        }, 501);
      }

      if (result.status === 'failed') {
        throw new Error(result.error || 'Vectorize search failed');
      }

      return c.json({
        success: true,
        data: result.results,
        method: 'vectorize'
      });
    }

    // Neither File Search nor Vectorize available
    return c.json({
      success: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'No search method configured (File Search or Vectorize required)'
      }
    }, 501);

  } catch (error) {
    console.error('Error searching documents:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// BULK REPROCESS ALL DOCUMENTS
// ============================================================================

documents.post('/reprocess', async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const processMode = body.process_mode || c.req.query('process_mode') || 'full'; // 'fast' or 'full'
    const provider = body.provider || c.req.query('provider');

    // Get all documents for patient
    const documentsResult = await c.env.DB.prepare(`
      SELECT id FROM documents WHERE patient_id = ?
    `).bind(patientId).all();

    if (!documentsResult.results || documentsResult.results.length === 0) {
      return c.json({
        success: true,
        message: 'No documents found to reprocess',
        documents_reprocessed: 0
      });
    }

    const documentIds = documentsResult.results.map(row => row.id);

    // Reset processing status for all documents
    await c.env.DB.prepare(`
      UPDATE documents
      SET processing_status = 'pending',
          processing_error = NULL,
          processing_started_at = NULL,
          processing_completed_at = NULL,
          updated_at = ?
      WHERE patient_id = ?
    `).bind(getCurrentTimestamp(), patientId).run();

    // Trigger reprocessing in background for all documents
    for (const docId of documentIds) {
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const processor = new DocumentProcessor(c.env, { provider });
            if (processMode === 'fast') {
              await processor.processDocumentFast(docId, { provider });
            } else {
              await processor.processDocument(docId, { mode: 'full', provider });
            }
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
    }

    return c.json({
      success: true,
      message: `Bulk reprocessing started for ${documentIds.length} document(s) in ${processMode} mode`,
      documents_count: documentIds.length,
      process_mode: processMode
    }, 202);

  } catch (error) {
    console.error('Error bulk reprocessing documents:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// ============================================================================
// REPROCESS SINGLE DOCUMENT
// ============================================================================

documents.post('/:docId/reprocess', async (c) => {
  try {
    const { patientId, docId } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const processMode = body.process_mode || c.req.query('process_mode') || 'full'; // 'fast' or 'full'
    const provider = body.provider || c.req.query('provider');

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
          if (processMode === 'fast') {
            await processor.processDocumentFast(docId, { provider });
          } else {
            await processor.processDocument(docId, { mode: 'full', provider });
          }
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
      message: `Document reprocessing started in ${processMode} mode`,
      document_id: docId,
      process_mode: processMode
    }, 202);

  } catch (error) {
    console.error('Error reprocessing document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default documents;
