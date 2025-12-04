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
import { FileSearchService } from '../gemini/file-search.js';
import { OpenAIService } from '../openai/client.js';
import { vectorizeDocument } from '../vectorize/indexer.js';
import { Diagnosis } from '../../models/diagnosis.js';
import { Treatment } from '../../models/treatment.js';
import { PatientRepository } from '../../repositories/patient.repository.js';
import { DocumentRepository } from '../../repositories/document.repository.js';
import { trackFieldSource, parseDataSources, serializeDataSources } from '../../utils/data-source.js';
import { getCurrentTimestamp } from '../../utils/helpers.js';
import { validateExtractedData } from './extraction-schema.js';

export class DocumentProcessor {
  constructor(env, options = {}) {
    this.env = env;
    // Default provider: OpenAI (gpt-5) for full processing.
    // Gemini can be selected explicitly via ?provider=gemini when needed.
    this.provider = options.provider || 'openai';

    this.services = {};

    if (env.GEMINI_API_KEY) {
      this.services.gemini = new GeminiService(env.GEMINI_API_KEY);
      // Dedicated File Search service (used regardless of extraction provider)
      this.fileSearchService = new FileSearchService(env.GEMINI_API_KEY);
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

  /**
   * Fast processing: Extract highlight + vectorize only
   * Makes document searchable immediately without full extraction
   */
  async processDocumentFast(documentId, options = {}) {
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
        throw new Error(`Document not found in database: ${documentId}`);
      }

      console.log(`🔍 Fast processing document:`, {
        id: doc.id,
        filename: doc.filename,
        storage_key: doc.storage_key,
        patient_id: doc.patient_id,
        status: doc.processing_status
      });

      await this.updateStatus(documentId, 'processing');

      // 2. Get file from R2
      console.log(`📥 Fetching from R2: ${doc.storage_key}`);
      const object = await this.env.DOCUMENTS.get(doc.storage_key);
      if (!object) {
        console.error(`❌ Document not found in R2:`, {
          storage_key: doc.storage_key,
          document_id: documentId,
          patient_id: doc.patient_id
        });
        throw new Error(`Document file not found in R2 storage at key: ${doc.storage_key}. The file may not have been uploaded successfully.`);
      }

      console.log(`✅ Retrieved from R2: ${object.size} bytes`);

      // 3. Read file buffer once
      const fileBuffer = await object.arrayBuffer();
      const mimeType = doc.mime_type || 'application/pdf';

      console.log(`⚡ Fast processing ${doc.filename} (${mimeType}) with ${provider}`);

      // 4. Extract medical highlight
      const highlightResult = await service.extractMedicalHighlight({
        fileBuffer,
        mimeType,
        documentType: doc.document_type
      });
      const medicalHighlight = highlightResult.text;
      console.log(`💡 Highlight: ${medicalHighlight}`);

      // 5. Save highlight only
      await this.env.DB.prepare(`
        UPDATE documents
        SET medical_highlight = ?, tokens_used = ?, gemini_model = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        medicalHighlight,
        highlightResult.tokensUsed || 0,
        highlightResult.model || 'unknown',
        getCurrentTimestamp(),
        documentId
      ).run();

      // 6. Upload to File Search (or Vectorize as fallback)
      let vectorizeStatus = 'skipped';
      let fileSearchDocumentName = null;
      let fileSearchStoreName = null;

      // Try File Search first if enabled (uses Gemini File Search even when OpenAI is the extractor)
      const fileSearchEnabled = this.env.FILE_SEARCH_ENABLED !== 'false' && !!this.fileSearchService;
      
      if (fileSearchEnabled) {
        try {
          console.log(`📤 Uploading to File Search: ${doc.filename}`);
          fileSearchDocumentName = await this.fileSearchService.uploadDocumentToFileSearch(
            doc.patient_id,
            documentId,
            fileBuffer,
            mimeType,
            doc.filename
          );
          
          // Get store name for tracking
          fileSearchStoreName = await this.fileSearchService.createFileSearchStore(doc.patient_id);
          
          vectorizeStatus = 'completed';
          await this.updateFileSearchStatus(documentId, 'completed', fileSearchStoreName, fileSearchDocumentName);
          console.log(`✅ File Search upload completed: ${fileSearchDocumentName}`);
        } catch (error) {
          console.error('File Search upload failed, falling back to Vectorize:', error);
          vectorizeStatus = 'failed';
          await this.updateFileSearchStatus(documentId, 'failed', null, null);
          
          // Fallback to Vectorize if available
          if (this.env.VECTORIZE) {
            console.log('🔄 Falling back to Vectorize...');
            // For fast mode, we need some text to vectorize - use highlight or filename
            const textToVectorize = medicalHighlight || doc.filename;
            const vectorizeResult = await vectorizeDocument(this.env, {
              documentId,
              patientId: doc.patient_id,
              text: textToVectorize,
              metadata: {
                document_type: doc.document_type,
                category: doc.category,
                subcategory: doc.subcategory
              }
            });
            vectorizeStatus = vectorizeResult.status;
            await this.updateVectorizeStatus(documentId, vectorizeStatus);
            console.log(`Vectorize fallback status: ${vectorizeStatus}`);
          }
        }
      } else if (this.env.VECTORIZE) {
        // Use Vectorize if File Search not enabled
        console.log('📊 Using Vectorize (File Search not enabled)');
        const textToVectorize = medicalHighlight || doc.filename;
        const vectorizeResult = await vectorizeDocument(this.env, {
          documentId,
          patientId: doc.patient_id,
          text: textToVectorize,
          metadata: {
            document_type: doc.document_type,
            category: doc.category,
            subcategory: doc.subcategory
          }
        });
        vectorizeStatus = vectorizeResult.status;
        await this.updateVectorizeStatus(documentId, vectorizeStatus);
        console.log(`Vectorize status: ${vectorizeStatus}`);
      } else {
        await this.updateVectorizeStatus(documentId, 'skipped');
      }

      // 7. Mark complete
      const processingTime = Date.now() - startTime;
      await this.updateStatus(documentId, 'completed');

      // 8. Log
      await this.logProcessing(doc.patient_id, documentId, highlightResult.tokensUsed || 0, processingTime, `${provider}:${highlightResult.model || 'unknown'}`, vectorizeStatus);

      return {
        success: true,
        document_id: documentId,
        medical_highlight: medicalHighlight,
        tokens_used: highlightResult.tokensUsed || 0,
        processing_time_ms: processingTime,
        provider,
        model: highlightResult.model || 'unknown',
        vectorize_status: vectorizeStatus
      };

    } catch (error) {
      console.error('❌ Fast processing failed:', error.message);
      await this.updateStatus(documentId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Full processing: Extract highlight + full structured extraction + patient profile sync
   */
  async processDocument(documentId, options = {}) {
    const opts = typeof options === 'string' ? { mode: options } : options;
    const { provider: requestedProvider, processMode } = opts;
    const { provider, service } = this.getService(requestedProvider);
    const startTime = Date.now();

    try {
      // 1. Get document metadata
      const doc = await this.env.DB.prepare(
        'SELECT * FROM documents WHERE id = ?'
      ).bind(documentId).first();

      if (!doc) {
        throw new Error(`Document not found in database: ${documentId}`);
      }

      console.log(`🔍 Full processing document:`, {
        id: doc.id,
        filename: doc.filename,
        storage_key: doc.storage_key,
        patient_id: doc.patient_id,
        status: doc.processing_status
      });

      await this.updateStatus(documentId, 'processing');

      // 2. Get file from R2
      console.log(`📥 Fetching from R2: ${doc.storage_key}`);
      const object = await this.env.DOCUMENTS.get(doc.storage_key);
      if (!object) {
        console.error(`❌ Document not found in R2:`, {
          storage_key: doc.storage_key,
          document_id: documentId,
          patient_id: doc.patient_id
        });
        throw new Error(`Document file not found in R2 storage at key: ${doc.storage_key}. The file may not have been uploaded successfully.`);
      }

      console.log(`✅ Retrieved from R2: ${object.size} bytes`);

      // 3. Read file buffer once
      const fileBuffer = await object.arrayBuffer();
      const mimeType = doc.mime_type || 'application/pdf';

      console.log(`📄 Full processing ${doc.filename} (${mimeType}) with ${provider}`);

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

      // 6. Parse and validate response
      let extractedData;
      try {
        const parsedData = JSON.parse(extractionResult.text);

        // Validate against schema
        try {
          extractedData = validateExtractedData(parsedData);
          console.log(`📊 Extracted data structure (validated):`, {
            hasPatientDemographics: !!extractedData.patient_demographics,
            patientDemographicsKeys: extractedData.patient_demographics ? Object.keys(extractedData.patient_demographics) : [],
            topLevelKeys: Object.keys(extractedData)
          });
        } catch (validationError) {
          console.error('⚠️ Schema validation failed, but continuing with unvalidated data:', validationError.message);
          // Log the invalid fields for debugging
          console.error('Invalid data structure:', {
            topLevelKeys: Object.keys(parsedData),
            sampleData: JSON.stringify(parsedData).substring(0, 500)
          });

          // Still use the data but mark it as unvalidated
          extractedData = parsedData;
          extractedData._validation_failed = true;
          extractedData._validation_error = validationError.message;
        }
      } catch (parseError) {
        console.error('❌ Response not valid JSON:', parseError.message);
        extractedData = {
          raw_response: extractionResult.text,
          _parse_failed: true
        };
      }

      const tokensUsed = highlightResult.tokensUsed + extractionResult.tokensUsed;

      // 7. Save extracted data
      await this.saveExtractedData(documentId, extractedData, tokensUsed, extractionResult.model, medicalHighlight, extractionResult.text);

      // 7.5. Auto-extract and update patient demographics (updates all missing/null fields)
      await this.extractAndUpdatePatientDemographics(doc.patient_id, extractedData);

      // 8. Update clinical sections
      await this.updateClinicalSections(doc.patient_id, extractedData, doc.document_type);

      // 9. Sync diagnosis (auto-upsert if extracted)
      await this.syncDiagnosisFromExtraction(doc.patient_id, documentId, extractedData);

      // 10. Sync treatment (auto-upsert if extracted)
      await this.syncTreatmentFromExtraction(doc.patient_id, documentId, extractedData);

      // 11. Sync medications (auto-upsert if extracted)
      await this.syncMedicationsFromExtraction(doc.patient_id, documentId, extractedData);

      // 12. Extract timeline events
      await this.extractTimelineEvents(service, doc.patient_id, extractedData, documentId);

      // 13. Upload to File Search (or Vectorize as fallback)
      let vectorizeStatus = 'skipped';
      let fileSearchDocumentName = null;
      let fileSearchStoreName = null;

      // Try File Search first if enabled (uses Gemini File Search even when OpenAI is the extractor)
      const fileSearchEnabled = this.env.FILE_SEARCH_ENABLED !== 'false' && !!this.fileSearchService;
      
      if (fileSearchEnabled) {
        try {
          console.log(`📤 Uploading to File Search: ${doc.filename}`);
          fileSearchDocumentName = await this.fileSearchService.uploadDocumentToFileSearch(
            doc.patient_id,
            documentId,
            fileBuffer,
            mimeType,
            doc.filename
          );
          
          // Get store name for tracking
          fileSearchStoreName = await this.fileSearchService.createFileSearchStore(doc.patient_id);
          
          vectorizeStatus = 'completed';
          await this.updateFileSearchStatus(documentId, 'completed', fileSearchStoreName, fileSearchDocumentName);
          console.log(`✅ File Search upload completed: ${fileSearchDocumentName}`);
        } catch (error) {
          console.error('File Search upload failed, falling back to Vectorize:', error);
          vectorizeStatus = 'failed';
          await this.updateFileSearchStatus(documentId, 'failed', null, null);
          
          // Fallback to Vectorize if available
          if (this.env.VECTORIZE) {
            console.log('🔄 Falling back to Vectorize...');
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
            console.log(`Vectorize fallback status: ${vectorizeStatus}`);
          }
        }
      } else if (this.env.VECTORIZE) {
        // Use Vectorize if File Search not enabled
        console.log('📊 Using Vectorize (File Search not enabled)');
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
        console.log(`Vectorize status: ${vectorizeStatus}`);
      } else {
        await this.updateVectorizeStatus(documentId, 'skipped');
      }

      // 14. Mark complete
      const processingTime = Date.now() - startTime;
      await this.updateStatus(documentId, 'completed');

      // 15. Log
      await this.logProcessing(doc.patient_id, documentId, tokensUsed, processingTime, `${provider}:${extractionResult.model}`, vectorizeStatus);

      // 16. Fetch updated patient demographics after sync
      const patientRepo = PatientRepository(this.env.DB);
      const updatedPatient = await patientRepo.findDemographicsById(doc.patient_id);

      // Extract patient demographics from extracted data (for response)
      const demographics = extractedData.patient_demographics || {};
      const patientDemographics = {
        // Use extracted values if available, otherwise use current patient values
        name: demographics.name || updatedPatient?.name || null,
        age: demographics.age || updatedPatient?.age || null,
        age_unit: demographics.age_unit || updatedPatient?.age_unit || null,
        sex: demographics.gender || demographics.sex || updatedPatient?.sex || null,
        dob: demographics.dob || demographics.date_of_birth || updatedPatient?.dob || null,
        mrn: demographics.mrn || updatedPatient?.mrn || null,
        patient_id_uhid: demographics.patient_id_uhid || updatedPatient?.patient_id_uhid || null,
        patient_id_ipd: demographics.patient_id_ipd || updatedPatient?.patient_id_ipd || null,
        blood_type: demographics.blood_type || updatedPatient?.blood_type || null,
        height_cm: demographics.height_cm || updatedPatient?.height_cm || null,
        weight_kg: demographics.weight_kg || updatedPatient?.weight_kg || null,
        bsa: demographics.bsa || updatedPatient?.bsa || null,
        ecog_status: demographics.ecog_status !== null && demographics.ecog_status !== undefined 
          ? demographics.ecog_status 
          : (updatedPatient?.ecog_status || null),
        language_preference: demographics.language_preference || updatedPatient?.language_preference || null
      };

      return {
        success: true,
        document_id: documentId,
        extracted_data: extractedData,
        medical_highlight: medicalHighlight,
        tokens_used: tokensUsed,
        processing_time_ms: processingTime,
        provider,
        model: extractionResult.model,
        patient_demographics: patientDemographics
      };

    } catch (error) {
      console.error('❌ Processing failed:', error.message);
      await this.updateStatus(documentId, 'failed', error.message);
      throw error;
    }
  }

  async updateStatus(documentId, status, error = null) {
    const docRepo = DocumentRepository(this.env.DB);
    await docRepo.updateProcessingStatus(documentId, status, error);
  }

  async saveExtractedData(documentId, extractedData, tokensUsed, model, medicalHighlight, rawText = '') {
    const docRepo = DocumentRepository(this.env.DB);
    await docRepo.updateById(documentId, {
      extracted_data: JSON.stringify(extractedData),
      extracted_text: rawText,
      tokens_used: tokensUsed,
      gemini_model: model,
      medical_highlight: medicalHighlight
    });
  }

  /**
   * Extract and update patient demographics from extracted data
   * Only updates if patient has placeholder/minimal data
   */
  async extractAndUpdatePatientDemographics(patientId, extractedData) {
    try {
      // Get current patient data - get all fields to check what's missing
      const patientRepo = PatientRepository(this.env.DB);
      const patientRow = await this.env.DB.prepare(
        'SELECT * FROM patients WHERE id = ?'
      ).bind(patientId).first();
      
      if (!patientRow) {
        console.warn(`Patient ${patientId} not found, skipping demographic extraction`);
        return;
      }
      
      const patient = patientRow;

      if (!patient) {
        console.warn(`Patient ${patientId} not found, skipping demographic extraction`);
        return;
      }

      // Extract demographics from extracted data
      const demographics = extractedData.patient_demographics || {};
      
      // ADD THIS LOGGING:
      console.log(`🔍 Extracting demographics for patient ${patientId}:`, {
        hasDemographics: !!extractedData.patient_demographics,
        demographicsKeys: Object.keys(demographics),
        currentPatientName: patient.name,
        currentPatientAge: patient.age,
        extractedName: demographics.name,
        extractedAge: demographics.age
      });
      
      // Comprehensive diagnostic logging
      console.log(`📋 Full diagnostic info:`, {
        extractedDataKeys: Object.keys(extractedData),
        demographicsObject: demographics,
        currentPatient: {
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          sex: patient.sex,
          dob: patient.dob,
          external_mrn: patient.external_mrn,
          patient_id_uhid: patient.patient_id_uhid,
          patient_id_ipd: patient.patient_id_ipd
        },
        extractedDemographics: {
          name: demographics.name,
          age: demographics.age,
          gender: demographics.gender,
          sex: demographics.sex,
          dob: demographics.dob,
          mrn: demographics.mrn,
          patient_id_uhid: demographics.patient_id_uhid,
          patient_id_ipd: demographics.patient_id_ipd,
          primary_oncologist: demographics.primary_oncologist,
          primary_center: demographics.primary_center
        },
        documentInfo: extractedData.document_info || null
      });
      
      // Build updates array - only update fields that are null/empty or placeholder values
      const updates = [];
      const bindings = [];
      const updatedFields = {};

      // Helper to check if a value is a placeholder or empty
      const isPlaceholder = (value) => {
        if (!value) return true;
        const str = String(value).trim().toLowerCase();
        return str === '' || str === 'processing...' || str === 'unknown patient' || str === 'unknown';
      };

      // Helper to check if we should update a field (current value is null/empty/placeholder)
      const shouldUpdate = (currentValue, newValue) => {
        if (!newValue) return false; // No new value to set
        const result = isPlaceholder(currentValue) || !currentValue;
        console.log(`  🔎 shouldUpdate: current="${currentValue}", new="${newValue}", result=${result}`);
        return result;
      };

      // Helper for fields that should always update if extracted (even if patient has a value)
      // Used for fields that can change over time or be more accurate in newer documents
      const shouldAlwaysUpdate = (newValue) => {
        if (!newValue) return false;
        const str = String(newValue).trim();
        return str !== '' && !isPlaceholder(str);
      };

      // Name - update if missing or placeholder
      const extractedName = demographics.name || extractedData.patient_name || extractedData.name;
      console.log(`  🔎 Name check: extracted="${extractedName}", current="${patient.name}", isPlaceholder=${isPlaceholder(patient.name)}`);
      if (extractedName && shouldUpdate(patient.name, extractedName)) {
        const cleanName = extractedName.trim();
        if (cleanName && !isPlaceholder(cleanName)) {
          updates.push('name = ?');
          bindings.push(cleanName);
          updatedFields.name = cleanName;
          console.log(`  ✅ Name added to updates: "${cleanName}"`);
        } else {
          console.log(`  ⚠️ Name extracted but is placeholder: "${cleanName}"`);
        }
      } else {
        console.log(`  ⚠️ Name skipped: extracted="${extractedName}", shouldUpdate=${extractedName ? shouldUpdate(patient.name, extractedName) : false}`);
      }

      // Age - update if missing
      console.log(`  🔎 Age check: extracted="${demographics.age}", current="${patient.age}"`);
      if (demographics.age && shouldUpdate(patient.age, demographics.age)) {
        const ageStr = String(demographics.age).replace(/[^\d]/g, '');
        const age = ageStr ? parseInt(ageStr) : null;
        if (age !== null && age > 0 && age <= 150) {
          updates.push('age = ?');
          bindings.push(age);
          updatedFields.age = age;
          console.log(`  ✅ Age added to updates: ${age}`);
        } else {
          console.log(`  ⚠️ Age invalid: "${demographics.age}" -> ${age}`);
        }
      } else {
        console.log(`  ⚠️ Age skipped: extracted="${demographics.age}", shouldUpdate=${demographics.age ? shouldUpdate(patient.age, demographics.age) : false}`);
      }

      // Age unit
      if (demographics.age_unit && shouldUpdate(patient.age_unit, demographics.age_unit)) {
        const ageUnit = demographics.age_unit.toLowerCase();
        if (['years', 'months', 'days'].includes(ageUnit)) {
          updates.push('age_unit = ?');
          bindings.push(ageUnit);
          updatedFields.age_unit = ageUnit;
        }
      }

      // Sex/Gender - update if missing
      const genderValue = demographics.gender || demographics.sex;
      console.log(`  🔎 Gender check: extracted="${genderValue}", current="${patient.gender || patient.sex}"`);
      if (genderValue && shouldUpdate(patient.gender || patient.sex, genderValue)) {
        const genderLower = String(genderValue).toLowerCase().trim();
        if (['male', 'female', 'other'].includes(genderLower)) {
          updates.push('gender = ?');
          updates.push('sex = ?');
          bindings.push(genderLower);
          bindings.push(genderLower);
          updatedFields.gender = genderLower;
          console.log(`  ✅ Gender added to updates: "${genderLower}"`);
        } else {
          console.log(`  ⚠️ Gender invalid: "${genderValue}" -> "${genderLower}"`);
        }
      } else {
        console.log(`  ⚠️ Gender skipped: extracted="${genderValue}", shouldUpdate=${genderValue ? shouldUpdate(patient.gender || patient.sex, genderValue) : false}`);
      }

      // Date of Birth
      const dobValue = demographics.dob || demographics.date_of_birth;
      if (dobValue && shouldUpdate(patient.dob || patient.date_of_birth, dobValue)) {
        // Try to parse and format as YYYY-MM-DD
        const dobStr = String(dobValue).trim();
        if (dobStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          updates.push('dob = ?');
          updates.push('date_of_birth = ?');
          bindings.push(dobStr);
          bindings.push(dobStr);
          updatedFields.dob = dobStr;
        }
      }

      // MRN
      if (demographics.mrn && shouldUpdate(patient.external_mrn, demographics.mrn)) {
        updates.push('external_mrn = ?');
        bindings.push(String(demographics.mrn).trim());
        updatedFields.external_mrn = demographics.mrn;
      }

      // Patient IDs
      if (demographics.patient_id_uhid && shouldUpdate(patient.patient_id_uhid, demographics.patient_id_uhid)) {
        updates.push('patient_id_uhid = ?');
        bindings.push(String(demographics.patient_id_uhid).trim());
        updatedFields.patient_id_uhid = demographics.patient_id_uhid;
      }

      if (demographics.patient_id_ipd && shouldUpdate(patient.patient_id_ipd, demographics.patient_id_ipd)) {
        updates.push('patient_id_ipd = ?');
        bindings.push(String(demographics.patient_id_ipd).trim());
        updatedFields.patient_id_ipd = demographics.patient_id_ipd;
      }

      // Blood type
      if (demographics.blood_type && shouldUpdate(patient.blood_type, demographics.blood_type)) {
        updates.push('blood_type = ?');
        bindings.push(String(demographics.blood_type).trim());
        updatedFields.blood_type = demographics.blood_type;
      }

      // Height
      if (demographics.height_cm && shouldUpdate(patient.height_cm, demographics.height_cm)) {
        const height = parseFloat(demographics.height_cm);
        if (!isNaN(height) && height > 0) {
          updates.push('height_cm = ?');
          bindings.push(height);
          updatedFields.height_cm = height;
        }
      }

      // Weight
      if (demographics.weight_kg && shouldUpdate(patient.weight_kg, demographics.weight_kg)) {
        const weight = parseFloat(demographics.weight_kg);
        if (!isNaN(weight) && weight > 0) {
          updates.push('weight_kg = ?');
          bindings.push(weight);
          updatedFields.weight_kg = weight;
        }
      }

      // BSA
      if (demographics.bsa && shouldUpdate(patient.bsa, demographics.bsa)) {
        const bsa = parseFloat(demographics.bsa);
        if (!isNaN(bsa) && bsa > 0) {
          updates.push('bsa = ?');
          bindings.push(bsa);
          updatedFields.bsa = bsa;
        }
      }

      // ECOG Status
      if (demographics.ecog_status !== null && demographics.ecog_status !== undefined && 
          shouldUpdate(patient.ecog_status, demographics.ecog_status)) {
        const ecog = parseInt(demographics.ecog_status);
        if (!isNaN(ecog) && ecog >= 0 && ecog <= 5) {
          updates.push('ecog_status = ?');
          bindings.push(ecog);
          updatedFields.ecog_status = ecog;
        }
      }

      // Language preference
      if (demographics.language_preference && shouldUpdate(patient.language_preference, demographics.language_preference)) {
        updates.push('language_preference = ?');
        bindings.push(String(demographics.language_preference).trim());
        updatedFields.language_preference = demographics.language_preference;
      }

      // Primary oncologist (can also come from document_info)
      // Always update if extracted (even if patient already has a value) - these can change over time
      const oncologist = demographics.primary_oncologist || 
                        extractedData.document_info?.provider ||
                        extractedData.primary_oncologist;
      console.log(`  🔎 Primary Oncologist check:`, {
        fromDemographics: demographics.primary_oncologist,
        fromDocumentInfo: extractedData.document_info?.provider,
        fromTopLevel: extractedData.primary_oncologist,
        extracted: oncologist,
        current: patient.primary_oncologist,
        willUpdate: shouldAlwaysUpdate(oncologist)
      });
      if (shouldAlwaysUpdate(oncologist)) {
        const cleanOncologist = String(oncologist).trim();
        updates.push('primary_oncologist = ?');
        bindings.push(cleanOncologist);
        updatedFields.primary_oncologist = cleanOncologist;
        console.log(`  ✅ Primary Oncologist added to updates: "${cleanOncologist}" (replacing "${patient.primary_oncologist || 'null'}")`);
      } else {
        console.log(`  ⚠️ Primary Oncologist skipped: extracted="${oncologist}", not valid or empty`);
      }

      // Primary center (can also come from document_info)
      // Always update if extracted (even if patient already has a value) - these can change over time
      const center = demographics.primary_center || 
                     extractedData.document_info?.facility ||
                     extractedData.primary_center;
      console.log(`  🔎 Primary Center check:`, {
        fromDemographics: demographics.primary_center,
        fromDocumentInfo: extractedData.document_info?.facility,
        fromTopLevel: extractedData.primary_center,
        extracted: center,
        current: patient.primary_center,
        willUpdate: shouldAlwaysUpdate(center)
      });
      if (shouldAlwaysUpdate(center)) {
        const cleanCenter = String(center).trim();
        updates.push('primary_center = ?');
        bindings.push(cleanCenter);
        updatedFields.primary_center = cleanCenter;
        console.log(`  ✅ Primary Center added to updates: "${cleanCenter}" (replacing "${patient.primary_center || 'null'}")`);
      } else {
        console.log(`  ⚠️ Primary Center skipped: extracted="${center}", not valid or empty`);
      }

      // Summary before update
      console.log(`📊 Update summary:`, {
        updatesCount: Object.keys(updatedFields).length,
        fieldsToUpdate: Object.keys(updatedFields),
        updatedFields: updatedFields,
        willExecute: Object.keys(updatedFields).length > 0
      });

      // Execute update if we have any changes
      if (Object.keys(updatedFields).length > 0) {
        console.log(`📝 About to update patient ${patientId} with ${Object.keys(updatedFields).length} fields:`, updatedFields);

        // Use repository's updateFields method
        const patientRepo = PatientRepository(this.env.DB);
        await patientRepo.updateFields(patientId, updatedFields);

        console.log(`✅ Successfully updated patient ${patientId} demographics:`, updatedFields);
        
        // Verify the update
        const updatedPatient = await patientRepo.findById(patientId);
        if (updatedPatient) {
          console.log(`✅ Verified patient ${patientId} after update:`, {
            name: updatedPatient.name,
            age: updatedPatient.age,
            gender: updatedPatient.gender || updatedPatient.sex,
            dob: updatedPatient.dob
          });
        }
      } else {
        console.log(`⚠️ No updates needed for patient ${patientId}. Current values:`, {
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          dob: patient.dob
        });
        console.log(`⚠️ Extracted demographics available:`, {
          name: demographics.name,
          age: demographics.age,
          gender: demographics.gender,
          dob: demographics.dob
        });
      }
    } catch (error) {
      console.error(`Error extracting demographics for patient ${patientId}:`, error);
      // Don't throw - demographic extraction is optional
    }
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
    const docRepo = DocumentRepository(this.env.DB);
    await docRepo.updateVectorizeStatus(documentId, status);
  }

  async updateFileSearchStatus(documentId, status, storeName, documentName) {
    const docRepo = DocumentRepository(this.env.DB);
    await docRepo.updateFileSearchStatus(documentId, status, storeName, documentName);
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

  async syncMedicationsFromExtraction(patientId, documentId, extractedData) {
    console.log('🔍 syncMedicationsFromExtraction called for patient:', patientId);
    if (!extractedData) {
      console.log('⚠️  No extractedData for medications sync');
      return;
    }

    const medications = extractedData.medications;
    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      console.log('⚠️  No medications array found - skipping sync');
      return;
    }

    console.log(`📋 Found ${medications.length} medications to sync`);

    // Get treatment context from extracted data (for bucketing)
    const treatment = extractedData.treatment || {};
    const treatmentContext = this.determineTreatmentContext(treatment, extractedData);

    // Get existing medications for this patient to avoid duplicates
    const existingMeds = await this.env.DB.prepare(`
      SELECT * FROM medications WHERE patient_id = ?
    `).bind(patientId).all();

    const existingMap = new Map();
    existingMeds.results.forEach(med => {
      const key = `${med.generic_name || med.medication_name}_${med.dose}_${med.frequency}`;
      existingMap.set(key, med);
    });

    for (const med of medications) {
      // Map extracted medication to database schema
      const mapped = {
        medication_name: med.brand_name || med.generic_name || 'Unknown',
        generic_name: med.generic_name || null,
        drug_class: med.category || null,
        dose: med.dose_value || null,
        dose_unit: med.dose_unit || null,
        frequency: med.frequency || null,
        route: med.route || null,
        start_date: med.start_date || null,
        end_date: med.end_date || null,
        medication_status: med.status || 'active',
        indication: med.indication || null,
        medication_type: this.determineMedicationType(med, treatment),
        treatment_context: treatmentContext,
        data_sources: JSON.stringify({
          source: documentId,
          extracted_at: new Date().toISOString()
        })
      };

      // Check if medication already exists (by generic name + dose + frequency)
      const key = `${mapped.generic_name || mapped.medication_name}_${mapped.dose}_${mapped.frequency}`;
      const existing = existingMap.get(key);

      if (existing) {
        // Update existing medication if new data is more recent
        console.log(`📝 Updating existing medication: ${existing.id}`);
        await this.env.DB.prepare(`
          UPDATE medications
          SET medication_name = ?, generic_name = ?, drug_class = ?,
              dose = ?, dose_unit = ?, frequency = ?, route = ?,
              start_date = ?, end_date = ?,
              medication_status = ?, indication = ?, medication_type = ?,
              treatment_context = ?, data_sources = ?, updated_at = ?
          WHERE id = ?
        `).bind(
          mapped.medication_name, mapped.generic_name, mapped.drug_class,
          mapped.dose, mapped.dose_unit, mapped.frequency, mapped.route,
          mapped.start_date, mapped.end_date,
          mapped.medication_status, mapped.indication, mapped.medication_type,
          mapped.treatment_context, mapped.data_sources, getCurrentTimestamp(),
          existing.id
        ).run();
      } else {
        // Create new medication
        const id = `med_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
        console.log(`📝 Creating new medication: ${id}`);
        await this.env.DB.prepare(`
          INSERT INTO medications (
            id, patient_id, medication_name, generic_name, drug_class,
            dose, dose_unit, frequency, route,
            start_date, end_date,
            medication_status, indication, medication_type, treatment_context,
            data_sources, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, patientId,
          mapped.medication_name, mapped.generic_name, mapped.drug_class,
          mapped.dose, mapped.dose_unit, mapped.frequency, mapped.route,
          mapped.start_date, mapped.end_date,
          mapped.medication_status, mapped.indication, mapped.medication_type,
          mapped.treatment_context, mapped.data_sources,
          getCurrentTimestamp(), getCurrentTimestamp()
        ).run();
      }
    }

    console.log(`✅ Synced ${medications.length} medications`);
  }

  // Helper: Determine treatment context for bucketing
  determineTreatmentContext(treatment, extractedData) {
    // If part of chemo regimen
    if (treatment?.regimen_name) {
      return treatment.regimen_name; // e.g., "m.FOLFOX-6"
    }

    // Check for infection-related context
    const alerts = extractedData.alerts || [];
    const infectionAlert = alerts.find(a => 
      a.category === 'infection' || 
      a.title?.toLowerCase().includes('infection') ||
      a.description?.toLowerCase().includes('salmonella')
    );
    if (infectionAlert) {
      return infectionAlert.title || 'Infection Treatment';
    }

    // Check for comorbidity (like epilepsy)
    const medHistory = extractedData.medical_history || [];
    const epilepsy = medHistory.find(m => 
      m.condition?.toLowerCase().includes('epilepsy') ||
      m.condition?.toLowerCase().includes('seizure')
    );
    if (epilepsy) {
      return 'Anti-Epileptic Therapy';
    }

    // Default to supportive care
    return 'Supportive Care';
  }

  // Helper: Determine medication type
  determineMedicationType(medication, treatment) {
    // If part of chemo regimen
    if (treatment?.drugs && Array.isArray(treatment.drugs)) {
      // Normalize drugs list – can be array of strings or objects
      const chemoDrugs = treatment.drugs
        .map((d) => {
          if (!d) return null;
          if (typeof d === 'string') return d.toLowerCase();
          // Handle structured drug entries from extraction
          const name =
            d.generic_name ||
            d.brand_name ||
            d.name ||
            d.drug_name ||
            d.drug ||
            null;
          return typeof name === 'string' ? name.toLowerCase() : null;
        })
        .filter(Boolean);

      const medGeneric = medication.generic_name?.toLowerCase();
      const medBrand = medication.brand_name?.toLowerCase();

      if ((medGeneric && chemoDrugs.includes(medGeneric)) ||
          (medBrand && chemoDrugs.includes(medBrand))) {
        return 'chemotherapy';
      }
    }

    // Check indication
    const indication = medication.indication?.toLowerCase() || '';
    if (indication.includes('infection') || indication.includes('antibiotic')) {
      return 'infection';
    }
    if (indication.includes('seizure') || indication.includes('epilepsy')) {
      return 'comorbidity';
    }

    // Default
    return medication.category || 'supportive';
  }
}
