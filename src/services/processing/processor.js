import { GeminiService } from '../gemini/client.js';
import { getCurrentTimestamp } from '../../utils/helpers.js';

export class DocumentProcessor {
  constructor(env) {
    this.env = env;
    this.gemini = new GeminiService(env.GEMINI_API_KEY);
  }

  async processDocument(documentId, mode = 'incremental') {
    const startTime = Date.now();
    
    try {
      // 1. Get document metadata
      const doc = await this.env.DB.prepare(
        'SELECT * FROM documents WHERE id = ?'
      ).bind(documentId).first();

      if (!doc) {
        throw new Error('Document not found');
      }

      // Update status to processing
      await this.updateDocumentStatus(documentId, 'processing');

      // 2. Get file from R2
      const object = await this.env.DOCUMENTS.get(doc.storage_key);
      
      if (!object) {
        throw new Error('Document file not found in storage');
      }

      // 3. Extract text
      const documentText = await object.text();

      // 4. Determine thinking level based on mode
      const thinkingLevel = mode === 'initial' ? 'high' : 'medium';

      // 5. Extract structured data using Gemini with specialized prompts
      const extractionResult = await this.gemini.extractFromDocument({
        documentText,
        documentType: doc.document_type,
        thinkingLevel
      });

      let extractedData = null;
      try {
        extractedData = JSON.parse(extractionResult.text);
      } catch (e) {
        console.warn('Failed to parse extraction as JSON:', extractionResult.text);
        extractedData = { 
          raw_text: extractionResult.text,
          parsing_error: e.message
        };
      }

      // 6. Save extracted data
      await this.saveExtractedData(
        documentId,
        documentText,
        extractedData,
        extractionResult.tokensUsed,
        extractionResult.model,
        extractionResult.thinking  // Save the thinking process
      );

      // 7. Update clinical sections
      await this.updateClinicalSections(doc.patient_id, extractedData, doc.document_type);

      // 8. Extract timeline events
      await this.extractAndSaveTimelineEvents(doc.patient_id, extractedData, documentId);

      // 9. Mark as completed
      const processingTime = Date.now() - startTime;
      await this.updateDocumentStatus(documentId, 'completed', null, processingTime);

      // 10. Log processing
      await this.logProcessing(doc.patient_id, documentId, extractionResult.tokensUsed, processingTime, mode);

      return {
        success: true,
        document_id: documentId,
        extracted_data: extractedData,
        thinking_process: extractionResult.thinking,
        tokens_used: extractionResult.tokensUsed,
        processing_time_ms: processingTime
      };

    } catch (error) {
      console.error('Error processing document:', error);
      await this.updateDocumentStatus(documentId, 'failed', error.message);
      throw error;
    }
  }

  async updateDocumentStatus(documentId, status, error = null, processingTime = null) {
    const now = getCurrentTimestamp();
    
    let stmt;
    if (status === 'processing') {
      stmt = this.env.DB.prepare(`
        UPDATE documents 
        SET processing_status = ?, processing_started_at = ?, updated_at = ?
        WHERE id = ?
      `);
      await stmt.bind(status, now, now, documentId).run();
    } else if (status === 'completed') {
      stmt = this.env.DB.prepare(`
        UPDATE documents 
        SET processing_status = ?, processing_completed_at = ?, updated_at = ?
        WHERE id = ?
      `);
      await stmt.bind(status, now, now, documentId).run();
    } else if (status === 'failed') {
      stmt = this.env.DB.prepare(`
        UPDATE documents 
        SET processing_status = ?, processing_error = ?, updated_at = ?
        WHERE id = ?
      `);
      await stmt.bind(status, error, now, documentId).run();
    }
  }

  async saveExtractedData(documentId, extractedText, extractedData, tokensUsed, model, thinking) {
    const stmt = this.env.DB.prepare(`
      UPDATE documents 
      SET extracted_text = ?, extracted_data = ?, tokens_used = ?, gemini_model = ?, thought_signature = ?, updated_at = ?
      WHERE id = ?
    `);
    
    await stmt.bind(
      extractedText,
      JSON.stringify(extractedData),
      tokensUsed,
      model,
      thinking ? thinking.substring(0, 1000) : null,  // Store first 1000 chars of thinking
      getCurrentTimestamp(),
      documentId
    ).run();
  }

  async updateClinicalSections(patientId, extractedData, documentType) {
    // Map document types to section types
    const sectionMapping = {
      'pathology': 'diagnosis_staging',
      'imaging': 'imaging_findings',
      'lab': 'lab_results',
      'consultation': 'consultation_notes'
    };

    const sectionType = sectionMapping[documentType] || 'general_findings';

    // Generate summary based on extracted data
    let summary = '';
    if (extractedData.primary_diagnosis) {
      summary = `${extractedData.primary_diagnosis.cancer_type || 'Diagnosis'} - ${extractedData.staging?.stage_group || 'Stage pending'}`;
    } else if (extractedData.impression) {
      summary = extractedData.impression;
    } else if (extractedData.assessment) {
      summary = extractedData.assessment;
    } else {
      summary = `${documentType} report processed`;
    }

    const detailed = JSON.stringify(extractedData);

    // Check if section exists
    const existing = await this.env.DB.prepare(`
      SELECT * FROM clinical_sections 
      WHERE patient_id = ? AND section_type = ?
    `).bind(patientId, sectionType).first();

    if (existing) {
      // Update existing
      await this.env.DB.prepare(`
        UPDATE clinical_sections 
        SET summary_content = ?, detailed_content = ?, last_processed_at = ?, version = version + 1
        WHERE patient_id = ? AND section_type = ?
      `).bind(summary, detailed, getCurrentTimestamp(), patientId, sectionType).run();
    } else {
      // Create new
      const sectionId = `sec_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
      await this.env.DB.prepare(`
        INSERT INTO clinical_sections 
        (id, patient_id, section_type, summary_content, detailed_content, last_processed_at, version)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).bind(sectionId, patientId, sectionType, summary, detailed, getCurrentTimestamp()).run();
    }
  }

  async extractAndSaveTimelineEvents(patientId, extractedData, sourceDocumentId) {
    // Extract timeline events using Gemini
    const result = await this.gemini.extractTimelineEvents({
      extractedData,
      thinkingLevel: 'medium'
    });

    let events = [];
    try {
      events = JSON.parse(result.text);
    } catch (e) {
      console.warn('Failed to parse timeline events:', e);
      return;
    }

    // Save each event
    for (const event of events) {
      const eventId = `evt_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
      
      await this.env.DB.prepare(`
        INSERT INTO timeline_events 
        (id, patient_id, event_date, event_type, event_category, title, description, details, source_document_id, confidence_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        eventId,
        patientId,
        event.date,
        event.event_type,
        event.event_category,
        event.title,
        event.description,
        JSON.stringify({ clinical_significance: event.clinical_significance }),
        sourceDocumentId,
        0.9,  // High confidence from AI extraction
        getCurrentTimestamp()
      ).run();
    }
  }

  async logProcessing(patientId, documentId, tokensUsed, processingTime, mode) {
    const logId = `log_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    
    await this.env.DB.prepare(`
      INSERT INTO processing_log 
      (id, patient_id, action, documents_processed, tokens_used, processing_time_ms, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'success', ?)
    `).bind(
      logId,
      patientId,
      `document_processing_${mode}`,
      JSON.stringify([documentId]),
      tokensUsed,
      processingTime,
      getCurrentTimestamp()
    ).run();
  }
}
