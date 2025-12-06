/**
 * Document Classification Service
 * 
 * Classifies medical documents into cancer_core, cancer_adjacent, or non_cancer
 * Uses existing AI services (Gemini or OpenAI) with a specialized classification prompt
 */

import { GeminiService } from '../gemini/client.js';
import { OpenAIService } from '../openai/client.js';
import { DocumentRepository } from '../../repositories/document.repository.js';
import { PatientRepository } from '../../repositories/patient.repository.js';

export class DocumentClassifier {
  constructor(env, options = {}) {
    this.env = env;
    this.provider = options.provider || 'openai'; // Default to OpenAI, can use gemini

    this.services = {};
    if (env.GEMINI_API_KEY) {
      this.services.gemini = new GeminiService(env.GEMINI_API_KEY);
    }
    if (env.OPENAI_API_KEY) {
      this.services.openai = new OpenAIService(env.OPENAI_API_KEY);
    }
  }

  getService(providerOverride) {
    const provider = (providerOverride || this.provider || 'openai').toLowerCase();
    
    if (this.services[provider]) {
      return { provider, service: this.services[provider] };
    }

    // Fallback to any available provider
    const available = Object.keys(this.services)[0];
    if (!available) {
      throw new Error('No AI provider configured. Add GEMINI_API_KEY or OPENAI_API_KEY.');
    }

    console.log(`ℹ️  Default provider ${provider} unavailable, using ${available}`);
    return { provider: available, service: this.services[available] };
  }

  /**
   * Generate classification prompt with patient context
   */
  generateClassificationPrompt(patientContext, filename) {
    const contextSection = patientContext ? `## Patient Context
- Known cancer type: ${patientContext.cancer_type || 'Unknown'}
- Diagnosis date: ${patientContext.diagnosis_date || 'Unknown'}

` : '';

    return `You are classifying Indian oncology documents. Categorize by primary category and subcategory, and assign cancer relevance.

${contextSection}## Output JSON
{
  "classification": "cancer_core | cancer_adjacent | non_cancer",
  "confidence": 0.0-1.0,
  "reason": "One sentence (<=120 chars)",
  "category": "pathology | imaging | laboratory | clinical | treatment | surgical | admin",
  "subcategory": "<see tables below>",
  "document_date": "YYYY-MM-DD or null",
  "facility": "Normalized hospital/lab name or null",
  "is_handwritten": true/false
}

## Primary Categories (7)
- pathology
- imaging
- laboratory
- clinical
- treatment
- surgical
- admin

## Subcategories
### pathology
- biopsy | fnac | cytology | ihc | hpe_review | frozen
### imaging
- ct | pet | mri | xray | usg | mammo | bone_scan | echo | endoscopy
### laboratory
- cbc | lft | kft | tumor_marker | coag | thyroid | viral | sugar | electrolytes | urine | lab_other
### clinical
- discharge | opd | case_summary | referral | tumor_board | second_opinion | admission | progress | death_summary
### treatment
- chemo_chart | chemo_protocol | rt_plan | rt_summary | drug_chart | transfusion | consent | supportive
### surgical
- op_notes | ot_summary | anesthesia | postop | procedure
### admin
- insurance | ayushman | cghs | bill | id | prescription

## Classification rules
- cancer_core: Directly about cancer diagnosis, staging, or treatment (pathology confirming malignancy, oncologic imaging, chemo/RT/surgery notes, tumor board)
- cancer_adjacent: Related but indirect (labs monitoring treatment, general imaging, OPD/referral, supportive care)
- non_cancer: Unrelated (dental, ophthalmology, generic admin without cancer context)

## Handwritten detection (set is_handwritten=true if likely)
- OPD chits, chemo charts, prescriptions from gov hospitals
- OCR text confidence low or layout irregular

Return ONLY JSON. Filename: ${filename || 'Unknown'}`;
  }

  /**
   * Classify a single document
   */
  async classifyDocument(patientId, documentId, providerOverride = null) {
    try {
      const docRepo = DocumentRepository(this.env.DB);
      const doc = await docRepo.findById(documentId, patientId);

      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      if (doc.patient_id !== patientId) {
        throw new Error(`Document ${documentId} does not belong to patient ${patientId}`);
      }

      // Get patient context for better classification
      const patientRepo = PatientRepository(this.env.DB);
      const patient = await patientRepo.findById(patientId);
      
      // Get existing diagnosis if available
      const diagnosis = await this.env.DB.prepare(
        'SELECT primary_cancer_type, diagnosis_date FROM diagnosis WHERE patient_id = ?'
      ).bind(patientId).first();

      const patientContext = diagnosis ? {
        cancer_type: diagnosis.primary_cancer_type,
        diagnosis_date: diagnosis.diagnosis_date
      } : null;

      // Get file from R2
      const object = await this.env.DOCUMENTS.get(doc.storage_key);
      if (!object) {
        throw new Error(`Document file not found in R2: ${doc.storage_key}`);
      }

      const fileBuffer = await object.arrayBuffer();
      const mimeType = doc.mime_type || 'application/pdf';

      // Get AI service
      const { provider, service } = this.getService(providerOverride);

      // Generate prompt
      const prompt = this.generateClassificationPrompt(patientContext, doc.filename);

      // Process document with AI (first page only for classification)
      const result = await service.processDocument({
        fileBuffer,
        mimeType,
        customPrompt: prompt,
        firstPageOnly: true
      });

      // Parse JSON response
      let classificationData;
      try {
        const parsed = JSON.parse(result.text);
        classificationData = {
          classification: parsed.classification || 'cancer_adjacent',
          confidence: parsed.confidence || 0.5,
          reason: parsed.reason || 'Classification completed',
          category: parsed.category || parsed.document_category || null,
          subcategory: parsed.subcategory || null,
          document_date: parsed.document_date || null,
          facility: parsed.facility || null,
          is_handwritten: parsed.is_handwritten === true
        };
      } catch (parseError) {
        console.error('Failed to parse classification response:', parseError);
        classificationData = {
          classification: 'cancer_adjacent',
          confidence: 0.5,
          reason: 'AI response parsing failed',
          category: null,
          subcategory: null,
          document_date: null,
          facility: null,
          is_handwritten: false
        };
      }

      // Validate classification value
      const validClassifications = ['cancer_core', 'cancer_adjacent', 'non_cancer', 'classification_failed'];
      if (!validClassifications.includes(classificationData.classification)) {
        classificationData.classification = 'cancer_adjacent';
      }

      const validCategories = ['pathology','imaging','laboratory','clinical','treatment','surgical','admin'];
      if (classificationData.category && !validCategories.includes(classificationData.category)) {
        classificationData.category = null;
      }

      classificationData.document_category = classificationData.category || null;

      // Update document with classification
      await this.env.DB.prepare(`
        UPDATE documents
        SET classification = ?,
            classification_confidence = ?,
            classification_reason = ?,
            category = ?,
            subcategory = ?,
            facility = ?,
            document_category = ?,
            document_date = COALESCE(?, document_date),
            updated_at = ?
        WHERE id = ?
      `).bind(
        classificationData.classification,
        classificationData.confidence,
        classificationData.reason,
        classificationData.category,
        classificationData.subcategory,
        this.normalizeFacility(classificationData.facility),
        classificationData.category || classificationData.document_category || null,
        classificationData.document_date,
        Date.now(),
        documentId
      ).run();

      console.log(`✅ Classified document ${documentId}: ${classificationData.classification} (confidence: ${classificationData.confidence})`);

      return {
        document_id: documentId,
        ...classificationData
      };
    } catch (error) {
      console.error(`Error classifying document ${documentId}:`, error);
      
      // Mark document as classification_failed so it surfaces in triage
      try {
        await this.env.DB.prepare(`
          UPDATE documents
          SET classification = 'classification_failed',
              classification_confidence = 0,
              classification_reason = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(
          `Classification failed: ${error.message}`.substring(0, 500),
          Date.now(),
          documentId
        ).run();
        console.log(`⚠️ Marked document ${documentId} as classification_failed`);
      } catch (updateError) {
        console.error(`Failed to mark document ${documentId} as classification_failed:`, updateError);
      }
      
      throw error;
    }
  }

  normalizeFacility(facility) {
    if (!facility) return null;
    const normalized = facility.toLowerCase();
    const map = {
      'tmh': 'Tata Memorial Hospital',
      'tata memorial': 'Tata Memorial Hospital',
      'aiims': 'AIIMS Delhi',
      'all india institute': 'AIIMS Delhi',
      'cmc vellore': 'CMC Vellore',
      'apollo chennai': 'Apollo Hospitals Chennai',
      'thyrocare': 'Thyrocare',
      'lal path': 'Dr. Lal PathLabs',
      'dr lal pathlabs': 'Dr. Lal PathLabs'
    };
    for (const [key, value] of Object.entries(map)) {
      if (normalized.includes(key)) return value;
    }
    return facility;
  }

  /**
   * Classify multiple documents in bulk
   */
  async classifyDocumentsBulk(patientId, documentIds = null, providerOverride = null) {
    try {
      const docRepo = DocumentRepository(this.env.DB);
      
      // Get documents to classify
      let documents;
      if (documentIds && documentIds.length > 0) {
        // Classify specific documents
        const placeholders = documentIds.map(() => '?').join(',');
        documents = await this.env.DB.prepare(`
          SELECT id, filename, classification
          FROM documents
          WHERE patient_id = ? AND id IN (${placeholders})
        `).bind(patientId, ...documentIds).all();
      } else {
        // Classify all unclassified or failed documents for patient
        documents = await this.env.DB.prepare(`
          SELECT id, filename, classification
          FROM documents
          WHERE patient_id = ? AND (classification IS NULL OR classification = 'pending' OR classification = 'classification_failed')
        `).bind(patientId).all();
      }

      const results = [];
      const errors = [];

      for (const doc of documents.results) {
        try {
          const result = await this.classifyDocument(patientId, doc.id, providerOverride);
          results.push(result);
        } catch (error) {
          console.error(`Failed to classify document ${doc.id}:`, error);
          errors.push({
            document_id: doc.id,
            error: error.message
          });
        }
      }

      return {
        total_documents: documents.results.length,
        classified: results.length,
        already_classified: 0, // Could track this if needed
        results,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error in bulk classification:', error);
      throw error;
    }
  }
}

