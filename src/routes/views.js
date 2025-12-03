import { Hono } from 'hono';
import { PatientRepository } from '../repositories/patient.repository.js';
import { DocumentRepository } from '../repositories/document.repository.js';
import { TimelineRepository } from '../repositories/timeline.repository.js';
import { NotFoundError, errorResponse } from '../utils/errors.js';

const views = new Hono();

// Get patient summary (all sections)
views.get('/summary', async (c) => {
  try {
    const { patientId } = c.req.param();
    
    // Get patient info using repository
    const patientRepo = PatientRepository(c.env.DB);
    const patient = await patientRepo.findById(patientId);
    
    if (!patient) {
      throw new NotFoundError('Patient');
    }
    
    // Get all clinical sections (still need direct query as no repository exists)
    const sections = await c.env.DB.prepare(
      'SELECT * FROM clinical_sections WHERE patient_id = ?'
    ).bind(patientId).all();
    
    // Get document count using repository
    const docRepo = DocumentRepository(c.env.DB);
    const documents = await docRepo.findByPatientId(patientId);
    const docCount = documents.length;
    
    // Get timeline event count using repository
    const timelineRepo = TimelineRepository(c.env.DB);
    const events = await timelineRepo.findByPatientId(patientId);
    const eventCount = events.length;
    
    // Format sections
    const sectionsData = {};
    sections.results.forEach(section => {
      sectionsData[section.section_type] = {
        summary: section.summary_content,
        last_updated: section.last_processed_at
      };
    });
    
    return c.json({
      success: true,
      patient_id: patientId,
      patient_name: patient.name,
      last_updated: patient.updated_at,
      sections: sectionsData,
      document_count: docCount,
      timeline_event_count: eventCount
    });
    
  } catch (error) {
    console.error('Error getting summary:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

// Get detailed view of a specific section
views.get('/detailed/:section', async (c) => {
  try {
    const { patientId, section } = c.req.param();
    
    const result = await c.env.DB.prepare(`
      SELECT * FROM clinical_sections 
      WHERE patient_id = ? AND section_type = ?
    `).bind(patientId, section).first();
    
    if (!result) {
      throw new NotFoundError('Section');
    }
    
    let detailed = null;
    try {
      detailed = JSON.parse(result.detailed_content);
    } catch (e) {
      detailed = { raw: result.detailed_content };
    }
    
    return c.json({
      success: true,
      patient_id: patientId,
      section: section,
      last_updated: result.last_processed_at,
      summary: result.summary_content,
      detailed: detailed,
      confidence_score: result.confidence_score,
      version: result.version
    });
    
  } catch (error) {
    console.error('Error getting detailed view:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default views;
