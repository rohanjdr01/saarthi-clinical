import { Hono } from 'hono';
import { Document } from '../models/document.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';

const documents = new Hono();

// Upload document
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
    const file = formData.get('file');
    const documentType = formData.get('document_type');
    const documentDate = formData.get('document_date');
    const notes = formData.get('notes');
    
    if (!file) {
      throw new ValidationError('File is required');
    }
    
    // Create document metadata
    const documentData = {
      patient_id: patientId,
      filename: file.name,
      file_type: file.name.split('.').pop().toLowerCase(),
      document_type: documentType,
      document_date: documentDate,
      file_size: file.size,
      mime_type: file.type
    };
    
    // Validate
    const errors = Document.validate(documentData);
    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
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
        document_type: documentType,
        uploaded_at: new Date().toISOString()
      }
    });
    
    // Save metadata to D1
    const stmt = c.env.DB.prepare(`
      INSERT INTO documents (
        id, patient_id, filename, file_type, document_type, document_subtype,
        document_date, storage_key, file_size, mime_type, processing_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      document.id, document.patient_id, document.filename, document.file_type,
      document.document_type, document.document_subtype, document.document_date,
      document.storage_key, document.file_size, document.mime_type,
      document.processing_status, document.created_at, document.updated_at
    ).run();
    
    // TODO: Trigger processing pipeline (next phase)
    
    return c.json({
      success: true,
      document_id: document.id,
      processing_status: 'pending',
      message: 'Document uploaded successfully. Processing will begin shortly.',
      data: document.toJSON()
    }, 202);
    
  } catch (error) {
    console.error('Error uploading document:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// List documents for a patient
documents.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    
    const stmt = c.env.DB.prepare(`
      SELECT * FROM documents 
      WHERE patient_id = ?
      ORDER BY created_at DESC
    `);
    
    const result = await stmt.bind(patientId).all();
    const documentList = result.results.map(row => Document.fromDBRow(row).toJSON());
    
    return c.json({
      success: true,
      data: documentList,
      total: documentList.length
    });
    
  } catch (error) {
    console.error('Error listing documents:', error);
    return c.json(errorResponse(error), 500);
  }
});

// Get document metadata
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

// Download document
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

// Delete document
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

export default documents;
