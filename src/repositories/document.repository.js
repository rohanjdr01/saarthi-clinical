/**
 * Document Repository (Data Access Layer)
 * Handles all database operations for documents
 */

import { Document } from '../models/document.js';
import { getCurrentTimestamp } from '../utils/helpers.js';

export const DocumentRepository = (db) => ({
  /**
   * Find document by ID and patient ID
   */
  findById: async (docId, patientId) => {
    const row = await db.prepare(`
      SELECT * FROM documents
      WHERE id = ? AND patient_id = ?
    `).bind(docId, patientId).first();
    
    if (!row) {
      return null;
    }
    
    return Document.fromDBRow(row);
  },

  /**
   * Find all documents for a patient with optional filters
   */
  findByPatientId: async (patientId, filters = {}) => {
    const {
      category,
      start_date,
      end_date,
      reviewed_status,
      sort = 'created_at',
      order = 'desc'
    } = filters;

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

    const result = await db.prepare(query).bind(...bindings).all();
    
    return result.results.map(row => Document.fromDBRow(row));
  },

  /**
   * Create a new document
   */
  create: async (documentData) => {
    const document = new Document(documentData);
    
    await db.prepare(`
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

    return document;
  },

  /**
   * Update document by ID and patient ID
   */
  update: async (docId, patientId, updates) => {
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      setClause.push(`${key} = ?`);
      values.push(value);
    }

    if (setClause.length === 0) {
      return null;
    }

    values.push(getCurrentTimestamp());
    values.push(docId);
    values.push(patientId);

    await db.prepare(`
      UPDATE documents SET ${setClause.join(', ')}, updated_at = ?
      WHERE id = ? AND patient_id = ?
    `).bind(...values).run();

    // Return updated document
    return await this.findById(docId, patientId);
  },

  /**
   * Update document by ID only (for internal use when patientId is not available)
   */
  updateById: async (docId, updates) => {
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      setClause.push(`${key} = ?`);
      values.push(value);
    }

    if (setClause.length === 0) {
      return null;
    }

    values.push(getCurrentTimestamp());
    values.push(docId);

    await db.prepare(`
      UPDATE documents SET ${setClause.join(', ')}, updated_at = ?
      WHERE id = ?
    `).bind(...values).run();

    return true;
  },

  /**
   * Update processing status
   */
  updateProcessingStatus: async (docId, status, error = null) => {
    const now = getCurrentTimestamp();
    
    if (status === 'processing') {
      await db.prepare(
        'UPDATE documents SET processing_status = ?, processing_started_at = ?, updated_at = ? WHERE id = ?'
      ).bind(status, now, now, docId).run();
    } else if (status === 'completed') {
      await db.prepare(
        'UPDATE documents SET processing_status = ?, processing_completed_at = ?, updated_at = ? WHERE id = ?'
      ).bind(status, now, now, docId).run();
    } else if (status === 'failed') {
      await db.prepare(
        'UPDATE documents SET processing_status = ?, processing_error = ?, updated_at = ? WHERE id = ?'
      ).bind(status, error, now, docId).run();
    } else if (status === 'pending') {
      await db.prepare(`
        UPDATE documents
        SET processing_status = ?,
            processing_error = NULL,
            processing_started_at = NULL,
            processing_completed_at = NULL,
            updated_at = ?
        WHERE id = ?
      `).bind(status, now, docId).run();
    }
    
    return true;
  },

  /**
   * Update case pack order for multiple documents
   */
  updateCasePackOrder: async (patientId, orders) => {
    // orders is an array of { document_id, case_pack_order }
    for (const { document_id, case_pack_order } of orders) {
      await db.prepare(`
        UPDATE documents
        SET case_pack_order = ?, updated_at = ?
        WHERE id = ? AND patient_id = ?
      `).bind(case_pack_order, getCurrentTimestamp(), document_id, patientId).run();
    }
    
    return true;
  },

  /**
   * Delete document by ID
   */
  delete: async (docId) => {
    // Delete associated vectors first
    await db.prepare('DELETE FROM document_vectors WHERE document_id = ?')
      .bind(docId).run();
    
    // Delete document
    await db.prepare('DELETE FROM documents WHERE id = ?')
      .bind(docId).run();
    
    return true;
  },

  /**
   * Get all document IDs for a patient
   */
  findIdsByPatientId: async (patientId) => {
    const result = await db.prepare(`
      SELECT id FROM documents WHERE patient_id = ?
    `).bind(patientId).all();
    
    return result.results.map(row => row.id);
  },

  /**
   * Count documents with file search for a patient
   */
  countWithFileSearch: async (patientId) => {
    const result = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM documents 
      WHERE patient_id = ? 
      AND file_search_document_name IS NOT NULL 
      AND file_search_document_name != ''
    `).bind(patientId).first();
    
    return result?.count || 0;
  },

  /**
   * Update file search status
   */
  updateFileSearchStatus: async (docId, status, storeName = null, documentName = null) => {
    await db.prepare(`
      UPDATE documents
      SET file_search_store_name = ?,
          file_search_document_name = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(storeName, documentName, getCurrentTimestamp(), docId).run();
    
    return true;
  },

  /**
   * Update vectorize status
   */
  updateVectorizeStatus: async (docId, status) => {
    const now = getCurrentTimestamp();
    await db.prepare(`
      UPDATE documents
      SET vectorize_status = ?,
          vectorized_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(status, status === 'completed' ? now : null, now, docId).run();
    
    return true;
  }
});

