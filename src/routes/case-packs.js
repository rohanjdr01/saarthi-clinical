import { Hono } from 'hono';
import { CasePack } from '../models/case-pack.js';
import { Document } from '../models/document.js';
import { NotFoundError, ValidationError, errorResponse } from '../utils/errors.js';
import { getCurrentTimestamp } from '../utils/helpers.js';

const casePacks = new Hono();

// Get case-pack for a patient (with all documents and highlights)
casePacks.get('/', async (c) => {
  try {
    const { patientId } = c.req.param();

    // Get case-pack
    const casePackRow = await c.env.DB.prepare(
      'SELECT * FROM case_packs WHERE patient_id = ? LIMIT 1'
    ).bind(patientId).first();

    if (!casePackRow) {
      throw new NotFoundError('Case pack not found for this patient');
    }

    const casePack = CasePack.fromDBRow(casePackRow);

    // Get all documents in the case-pack with medical highlights
    const documentsResult = await c.env.DB.prepare(`
      SELECT d.*, cpd.added_at, cpd.display_order
      FROM documents d
      INNER JOIN case_pack_documents cpd ON d.id = cpd.document_id
      WHERE cpd.case_pack_id = ?
      ORDER BY cpd.display_order ASC, d.created_at DESC
    `).bind(casePack.id).all();

    const documents = documentsResult.results.map(row => ({
      id: row.id,
      filename: row.filename,
      document_type: row.document_type,
      document_date: row.document_date,
      medical_highlight: row.medical_highlight,
      processing_status: row.processing_status,
      file_size: row.file_size,
      created_at: row.created_at,
      added_to_case_pack: row.added_at
    }));

    return c.json({
      success: true,
      data: {
        case_pack: casePack.toJSON(),
        documents: documents,
        total_documents: documents.length
      }
    });

  } catch (error) {
    console.error('Error getting case-pack:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Update case-pack metadata
casePacks.put('/', async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();

    const { title, description } = body;

    // Get existing case-pack
    const existing = await c.env.DB.prepare(
      'SELECT * FROM case_packs WHERE patient_id = ? LIMIT 1'
    ).bind(patientId).first();

    if (!existing) {
      throw new NotFoundError('Case pack');
    }

    // Update
    await c.env.DB.prepare(`
      UPDATE case_packs
      SET title = ?, description = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      title || existing.title,
      description || existing.description,
      getCurrentTimestamp(),
      existing.id
    ).run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM case_packs WHERE id = ?'
    ).bind(existing.id).first();

    return c.json({
      success: true,
      data: CasePack.fromDBRow(updated).toJSON()
    });

  } catch (error) {
    console.error('Error updating case-pack:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Remove document from case-pack
casePacks.delete('/:docId', async (c) => {
  try {
    const { patientId, docId } = c.req.param();

    // Get case-pack
    const casePack = await c.env.DB.prepare(
      'SELECT * FROM case_packs WHERE patient_id = ? LIMIT 1'
    ).bind(patientId).first();

    if (!casePack) {
      throw new NotFoundError('Case pack');
    }

    // Remove document from case-pack
    await c.env.DB.prepare(`
      DELETE FROM case_pack_documents
      WHERE case_pack_id = ? AND document_id = ?
    `).bind(casePack.id, docId).run();

    return c.json({
      success: true,
      message: 'Document removed from case-pack'
    });

  } catch (error) {
    console.error('Error removing document from case-pack:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Reorder documents in case-pack
casePacks.post('/reorder', async (c) => {
  try {
    const { patientId } = c.req.param();
    const body = await c.req.json();
    const { document_ids } = body; // Array of document IDs in desired order

    if (!Array.isArray(document_ids)) {
      throw new ValidationError('document_ids must be an array');
    }

    // Get case-pack
    const casePack = await c.env.DB.prepare(
      'SELECT * FROM case_packs WHERE patient_id = ? LIMIT 1'
    ).bind(patientId).first();

    if (!casePack) {
      throw new NotFoundError('Case pack');
    }

    // Update display order for each document
    for (let i = 0; i < document_ids.length; i++) {
      await c.env.DB.prepare(`
        UPDATE case_pack_documents
        SET display_order = ?
        WHERE case_pack_id = ? AND document_id = ?
      `).bind(i, casePack.id, document_ids[i]).run();
    }

    return c.json({
      success: true,
      message: 'Documents reordered successfully'
    });

  } catch (error) {
    console.error('Error reordering documents:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default casePacks;
