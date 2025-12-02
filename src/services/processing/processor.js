/**
 * Document Processor
 * 
 * Simple, clean document processing using:
 * - Gemini 3 Pro (https://ai.google.dev/gemini-api/docs/gemini-3)
 * - OpenAI GPT-4o / o3-mini
 * 
 * No text extraction needed - models handle documents natively.
 */

import { GeminiService } from '../gemini/client.js';
import { OpenAIService } from '../openai/client.js';
import { vectorizeDocument } from '../vectorize/indexer.js';
import { Diagnosis } from '../../models/diagnosis.js';
import { Treatment } from '../../models/treatment.js';
import { trackFieldSource, parseDataSources, serializeDataSources } from '../../utils/data-source.js';
import { getCurrentTimestamp } from '../../utils/helpers.js';

export class DocumentProcessor {
  constructor(env, options = {}) {
    this.env = env;
    this.provider = options.provider || 'gemini';

    this.services = {};

    if (env.GEMINI_API_KEY) {
      this.services.gemini = new GeminiService(env.GEMINI_API_KEY);
    }

    if (env.OPENAI_API_KEY) {
      this.services.openai = new OpenAIService(env.OPENAI_API_KEY);
    }
  }

  getService(providerOverride) {
    const provider = (providerOverride || this.provider || 'gemini').toLowerCase();
    
    if (this.services[provider]) {
      return { provider, service: this.services[provider] };
    }

    // If user explicitly requested a provider that's not configured, throw error
    if (providerOverride) {
      throw new Error(`Provider '${provider}' not configured. Add ${provider.toUpperCase()}_API_KEY.`);
    }

    // Fallback to any available provider only if no specific provider was requested
    const available = Object.keys(this.services)[0];
    if (!available) {
      throw new Error('No AI provider configured. Add GEMINI_API_KEY or OPENAI_API_KEY.');
    }

    console.log(`ℹ️  Default provider gemini unavailable, using ${available}`);
    return { provider: available, service: this.services[available] };
  }

  async processDocument(documentId, options = {}) {
    const opts = typeof options === 'string' ? { mode: options } : options;
    const { provider: requestedProvider } = opts;
    const { provider, service } = this.getService(requestedProvider);
    const startTime = Date.now();

    try {
      // 1. Get document metadata
      const doc = await this.env.DB.prepare(
        'SELECT * FROM documents WHERE id = ?'
      ).bind(documentId).first();

      if (!doc) {
        throw new Error('Document not found');
      }

      await this.updateStatus(documentId, 'processing');

      // 2. Get file from R2
      const object = await this.env.DOCUMENTS.get(doc.storage_key);
      if (!object) {
        throw new Error('Document file not found in storage');
      }

      // 3. Read file buffer once
      const fileBuffer = await object.arrayBuffer();
      const mimeType = doc.mime_type || 'application/pdf';

      console.log(`📄 Processing ${doc.filename} (${mimeType}) with ${provider}`);

      // 4. Extract medical highlight
      const highlightResult = await service.extractMedicalHighlight({
        fileBuffer,
        mimeType,
        documentType: doc.document_type
      });
      const medicalHighlight = highlightResult.text;
      console.log(`💡 Highlight: ${medicalHighlight}`);

      // 5. Process document with AI
      const extractionResult = await service.processDocument({
        fileBuffer,
        mimeType,
        documentType: doc.document_type,
        thinkingLevel: 'low' // For Gemini 3
      });

      // 6. Parse response
      let extractedData;
      try {
        extractedData = JSON.parse(extractionResult.text);
      } catch {
        console.warn('Response not JSON, storing as raw text');
        extractedData = { raw_response: extractionResult.text };
      }

      const tokensUsed = highlightResult.tokensUsed + extractionResult.tokensUsed;

      // 7. Save extracted data
      await this.saveExtractedData(documentId, extractedData, tokensUsed, extractionResult.model, medicalHighlight, extractionResult.text);

      // 8. Update clinical sections
      await this.updateClinicalSections(doc.patient_id, extractedData, doc.document_type);

      // 9. Sync diagnosis (auto-upsert if extracted)
      await this.syncDiagnosisFromExtraction(doc.patient_id, documentId, extractedData);

      // 10. Sync treatment (auto-upsert if extracted)
      await this.syncTreatmentFromExtraction(doc.patient_id, documentId, extractedData);

      // 11. Extract timeline events
      await this.extractTimelineEvents(service, doc.patient_id, extractedData, documentId);

      // 12. Vectorize content if configured
      let vectorizeStatus = 'skipped';
      if (this.env.VECTORIZE) {
        const vectorizeResult = await vectorizeDocument(this.env, {
          documentId,
          patientId: doc.patient_id,
          text: extractionResult.text || JSON.stringify(extractedData),
          metadata: {
            document_type: doc.document_type,
            category: doc.category,
            subcategory: doc.subcategory
          }
        });

        vectorizeStatus = vectorizeResult.status;
        await this.updateVectorizeStatus(documentId, vectorizeStatus);
        console.log(`Vectorize status for ${documentId}: ${vectorizeStatus}`);
      } else {
        await this.updateVectorizeStatus(documentId, 'skipped');
      }

      // 13. Mark complete
      const processingTime = Date.now() - startTime;
      await this.updateStatus(documentId, 'completed');

      // 14. Log
      await this.logProcessing(doc.patient_id, documentId, tokensUsed, processingTime, `${provider}:${extractionResult.model}`, vectorizeStatus);

      return {
        success: true,
        document_id: documentId,
        extracted_data: extractedData,
        medical_highlight: medicalHighlight,
        tokens_used: tokensUsed,
        processing_time_ms: processingTime,
        provider,
        model: extractionResult.model
      };

    } catch (error) {
      console.error('❌ Processing failed:', error.message);
      await this.updateStatus(documentId, 'failed', error.message);
      throw error;
    }
  }

  async updateStatus(documentId, status, error = null) {
    const now = getCurrentTimestamp();
    
    if (status === 'processing') {
      await this.env.DB.prepare(
        'UPDATE documents SET processing_status = ?, processing_started_at = ?, updated_at = ? WHERE id = ?'
      ).bind(status, now, now, documentId).run();
    } else if (status === 'completed') {
      await this.env.DB.prepare(
        'UPDATE documents SET processing_status = ?, processing_completed_at = ?, updated_at = ? WHERE id = ?'
      ).bind(status, now, now, documentId).run();
    } else if (status === 'failed') {
      await this.env.DB.prepare(
        'UPDATE documents SET processing_status = ?, processing_error = ?, updated_at = ? WHERE id = ?'
      ).bind(status, error, now, documentId).run();
    }
  }

  async saveExtractedData(documentId, extractedData, tokensUsed, model, medicalHighlight, rawText = '') {
    await this.env.DB.prepare(`
      UPDATE documents
      SET extracted_data = ?, extracted_text = ?, tokens_used = ?, gemini_model = ?, medical_highlight = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      JSON.stringify(extractedData),
      rawText,
      tokensUsed,
      model,
      medicalHighlight,
      getCurrentTimestamp(),
      documentId
    ).run();
  }

  async updateClinicalSections(patientId, extractedData, documentType) {
    const sectionMapping = {
      pathology: 'diagnosis_staging',
      imaging: 'imaging_findings',
      lab: 'lab_results',
      consultation: 'consultation_notes'
    };

    const sectionType = sectionMapping[documentType] || 'general_findings';

    // Generate summary
    let summary = extractedData.impression || 
                  extractedData.primary_diagnosis?.cancer_type ||
                  extractedData.assessment ||
                  `${documentType} processed`;

    const existing = await this.env.DB.prepare(
      'SELECT id FROM clinical_sections WHERE patient_id = ? AND section_type = ?'
    ).bind(patientId, sectionType).first();

    if (existing) {
      await this.env.DB.prepare(`
        UPDATE clinical_sections 
        SET summary_content = ?, detailed_content = ?, last_processed_at = ?, version = version + 1
        WHERE patient_id = ? AND section_type = ?
      `).bind(summary, JSON.stringify(extractedData), getCurrentTimestamp(), patientId, sectionType).run();
    } else {
      const sectionId = `sec_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
      await this.env.DB.prepare(`
        INSERT INTO clinical_sections (id, patient_id, section_type, summary_content, detailed_content, last_processed_at, version)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).bind(sectionId, patientId, sectionType, summary, JSON.stringify(extractedData), getCurrentTimestamp()).run();
    }
  }

  async extractTimelineEvents(service, patientId, extractedData, sourceDocumentId) {
    try {
      const prompt = `Extract timeline events from this medical data. Return JSON array:
[{"date": "YYYY-MM-DD", "event_type": "diagnosis|procedure|treatment|imaging|lab", "title": "", "description": ""}]

Data: ${JSON.stringify(extractedData)}`;

      const result = await service.generateContent({ prompt, temperature: 0.1 });

      let events = [];
      try {
        events = JSON.parse(result.text);
      } catch {
        return;
      }

      if (!Array.isArray(events)) return;

      for (const event of events) {
        const eventId = `evt_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
        await this.env.DB.prepare(`
          INSERT INTO timeline_events (id, patient_id, event_date, event_type, title, description, source_document_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          eventId,
          patientId,
          event.date || new Date().toISOString().split('T')[0],
          event.event_type || 'other',
          event.title || 'Event',
          event.description || '',
          sourceDocumentId,
          getCurrentTimestamp()
        ).run();
      }
    } catch (error) {
      console.warn('Timeline extraction failed:', error.message);
    }
  }

  async syncDiagnosisFromExtraction(patientId, documentId, extractedData) {
    if (!extractedData) return;

    const diag = extractedData.primary_diagnosis || extractedData.diagnosis || {};
    if (!diag || Object.keys(diag).length === 0) return;

    const existing = await Diagnosis.getByPatientId(this.env, patientId);

    const mapped = {
      primary_cancer_type: diag.cancer_type || diag.primary_cancer_type || null,
      primary_cancer_subtype: diag.primary_cancer_subtype || null,
      icd_code: diag.icd_code || null,
      diagnosis_date: diag.diagnosis_date || extractedData.document_date || null,
      tumor_location: diag.location || null,
      tumor_laterality: diag.laterality || null,
      tumor_size_cm: diag.tumor_size_cm || null,
      tumor_grade: diag.grade || diag.tumor_grade || null,
      histology: diag.histology || null,
      biomarkers: diag.biomarkers || null,
      genetic_mutations: diag.genetic_mutations || null,
      metastatic_sites: diag.metastatic_sites || null
    };

    // Track sources per field
    let sources = existing?.data_sources ? parseDataSources(existing.data_sources) : {};
    for (const [field, value] of Object.entries(mapped)) {
      if (value !== null && value !== undefined) {
        sources = trackFieldSource(sources, field, value, documentId);
      }
    }

    if (!existing) {
      await Diagnosis.create(this.env, {
        patient_id: patientId,
        ...mapped,
        data_sources: serializeDataSources(sources)
      });
      return;
    }

    await Diagnosis.update(this.env, existing.id, {
      ...mapped,
      data_sources: serializeDataSources(sources)
    });
  }

  async updateVectorizeStatus(documentId, status) {
    await this.env.DB.prepare(`
      UPDATE documents
      SET vectorize_status = ?, vectorized_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      status,
      getCurrentTimestamp(),
      getCurrentTimestamp(),
      documentId
    ).run();
  }

  async logProcessing(patientId, documentId, tokensUsed, processingTime, model, vectorizeStatus = null) {
    const logId = `log_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
    await this.env.DB.prepare(`
      INSERT INTO processing_log (id, patient_id, action, documents_processed, gemini_model, tokens_used, processing_time_ms, status, changes_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?)
    `).bind(
      logId,
      patientId,
      'document_processing',
      JSON.stringify([documentId]),
      model,
      tokensUsed,
      processingTime,
      vectorizeStatus ? `vectorize_status:${vectorizeStatus}` : null,
      getCurrentTimestamp()
    ).run();
  }

  async syncTreatmentFromExtraction(patientId, documentId, extractedData) {
    console.log('🔍 syncTreatmentFromExtraction called for patient:', patientId);
    if (!extractedData) {
      console.log('⚠️  No extractedData for treatment sync');
      return;
    }

    console.log('📊 Available extraction keys:', Object.keys(extractedData));

    // With the new schema, treatment should always be in the same place
    const tx = extractedData.treatment;

    if (!tx || Object.keys(tx).length === 0) {
      console.log('⚠️  No treatment data found in schema - skipping sync');
      return;
    }

    console.log('📋 Treatment data to sync:', JSON.stringify(tx, null, 2));

    const normalizeDate = (value) => {
      if (!value) return null;
      // Handle ranges like "31/10/2025 - 2/11/2025"
      const first = String(value).split('-')[0].trim();
      const parts = first.split('/'); // dd/mm/yyyy
      if (parts.length === 3) {
        const [d, m, y] = parts;
        if (d && m && y) return `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return first || null;
    };

    // Convert drugs array to JSON string if needed
    let drugsList = tx.drugs || null;
    if (Array.isArray(drugsList)) {
      drugsList = JSON.stringify(drugsList);
    }

    const mapped = {
      regimen_name: tx.regimen_name || null,
      treatment_intent: tx.treatment_intent || null,
      treatment_line: tx.treatment_line || null,
      protocol: tx.protocol || null,
      drugs: drugsList,
      start_date: tx.start_date || null,
      planned_end_date: tx.planned_end_date || null,
      actual_end_date: tx.end_date || null,
      total_planned_cycles: tx.cycles_planned || null,
      treatment_status: tx.treatment_status || 'active',
      best_response: tx.best_response || null,
      response_date: tx.response_date || null
    };

    console.log('🔄 Mapped treatment fields:', JSON.stringify(mapped, null, 2));

    // If no key fields, skip
    const hasContent = Object.values(mapped).some(v => v !== null && v !== undefined);
    if (!hasContent) {
      console.log('⚠️  No content in mapped fields - skipping');
      return;
    }

    // Get current active treatment or latest
    let existing = await Treatment.getCurrentByPatientId(this.env, patientId);
    if (!existing) {
      const all = await Treatment.getAllByPatientId(this.env, patientId);
      if (all && all.length > 0) {
        existing = all[0]; // latest
      }
    }

    let sources = existing?.data_sources ? parseDataSources(existing.data_sources) : {};
    for (const [field, value] of Object.entries(mapped)) {
      if (value !== null && value !== undefined) {
        sources = trackFieldSource(sources, field, value, documentId);
      }
    }

    if (!existing) {
      console.log('📝 Creating new treatment record...');
      const newTreatment = await Treatment.create(this.env, {
        patient_id: patientId,
        ...mapped,
        data_sources: serializeDataSources(sources)
      });
      console.log('✅ Treatment created successfully:', newTreatment.id);
      return;
    }

    console.log('📝 Updating existing treatment:', existing.id);
    await Treatment.update(this.env, existing.id, {
      ...mapped,
      data_sources: serializeDataSources(sources)
    });
    console.log('✅ Treatment updated successfully');
  }
}
