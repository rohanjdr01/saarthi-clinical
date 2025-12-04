import { Hono } from 'hono';
import { Patient } from '../models/patient.js';
import { Document } from '../models/document.js';
import { DocumentProcessor } from '../services/processing/processor.js';
import { ValidationError, errorResponse } from '../utils/errors.js';
import { generateId, getCurrentTimestamp } from '../utils/helpers.js';

const intake = new Hono();

intake.post('/', async (c) => {
  try {
    const formData = await c.req.formData();
    const files = formData.getAll('files');
    const caregiverName = formData.get('caregiver_name');
    const caregiverRelation = formData.get('caregiver_relation');
    const caregiverContact = formData.get('caregiver_contact');
    const provider = formData.get('provider') || c.req.query('provider'); // Get provider from form or query

    if (!files || files.length === 0) {
      throw new ValidationError('At least one document is required');
    }

    if (!caregiverName) {
      throw new ValidationError('Caregiver name is required');
    }
    
    // STEP 1: Create placeholder patient
    const placeholderPatient = new Patient({
      name: 'Processing...',
      age: null,
      gender: null,
      caregiver_name: caregiverName,
      caregiver_relation: caregiverRelation,
      caregiver_contact: caregiverContact
    });
    
    const placeholderRow = placeholderPatient.toDBRow();
    
    await c.env.DB.prepare(`
      INSERT INTO patients (
        id, name, age, gender,
        caregiver_name, caregiver_relation, caregiver_contact,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      placeholderRow.id, 
      placeholderRow.name, 
      placeholderRow.age, 
      placeholderRow.gender,
      placeholderRow.caregiver_name, 
      placeholderRow.caregiver_relation, 
      placeholderRow.caregiver_contact, 
      placeholderRow.status, 
      placeholderRow.created_at, 
      placeholderRow.updated_at
    ).run();
    
    // STEP 2: Upload documents
    const uploadedDocs = [];
    for (const file of files) {
      const documentData = {
        patient_id: placeholderPatient.id,
        filename: file.name,
        file_type: file.name.split('.').pop().toLowerCase(),
        document_type: formData.get('document_type') || 'other',
        file_size: file.size,
        mime_type: file.type
      };
      
      const document = new Document(documentData);
      
      // Upload to R2
      const fileBuffer = await file.arrayBuffer();
      console.log(`📤 Uploading to R2: ${document.storage_key} (${fileBuffer.byteLength} bytes)`);
      
      try {
        await c.env.DOCUMENTS.put(document.storage_key, fileBuffer, {
          httpMetadata: { contentType: file.type },
          customMetadata: {
            patient_id: placeholderPatient.id,
            document_type: document.document_type,
            uploaded_at: new Date().toISOString()
          }
        });
      } catch (r2Error) {
        console.error(`❌ R2 upload failed for ${document.storage_key}:`, r2Error);
        throw new Error(`Failed to upload file to storage: ${r2Error.message}`);
      }

      // IMPORTANT: Verify R2 upload succeeded before saving to DB
      const verifyUpload = await c.env.DOCUMENTS.head(document.storage_key);
      if (!verifyUpload) {
        console.error(`❌ R2 verification failed - file not found after upload: ${document.storage_key}`);
        throw new Error(`File upload verification failed for ${file.name}. The file was not stored properly.`);
      }
      console.log(`✅ R2 upload verified: ${document.storage_key} (${verifyUpload.size} bytes)`);
      
      // Save to D1
      await c.env.DB.prepare(`
        INSERT INTO documents (
          id, patient_id, filename, file_type, document_type,
          storage_key, file_size, mime_type, processing_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        document.id, document.patient_id, document.filename, document.file_type,
        document.document_type, document.storage_key, document.file_size,
        document.mime_type, 'pending', document.created_at, document.updated_at
      ).run();
      
      uploadedDocs.push(document);
    }
    
    // STEP 3: Process first document
    const processor = new DocumentProcessor(c.env, { provider });
    const processingResult = await processor.processDocument(uploadedDocs[0].id, { mode: 'initial', provider });
    
    let extractedData = processingResult.extracted_data;
    
    // Extract demographics - handle various formats
    const demographics = extractedData.patient_demographics || {};
    
    // Extract name from various possible fields
    let patientName = demographics.name || 
                      extractedData.patient_name || 
                      extractedData.name || 
                      'Unknown Patient';
    
    // Clean up the name (remove extra spaces, etc)
    patientName = patientName.trim();
    
    // Extract age - handle string/number
    let patientAge = null;
    if (demographics.age) {
      const ageStr = String(demographics.age).replace(/[^\d]/g, ''); // Remove non-digits
      patientAge = ageStr ? parseInt(ageStr) : null;
    }
    
    // Extract gender - normalize
    let patientGender = null;
    if (demographics.gender) {
      const genderLower = String(demographics.gender).toLowerCase().trim();
      if (['male', 'female', 'other'].includes(genderLower)) {
        patientGender = genderLower;
      }
    }
    
    // STEP 4: Update patient with extracted data
    await c.env.DB.prepare(`
      UPDATE patients 
      SET name = ?, age = ?, gender = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      patientName,
      patientAge,
      patientGender,
      getCurrentTimestamp(),
      placeholderPatient.id
    ).run();
    
    // Get updated patient
    const updatedPatient = await c.env.DB.prepare(
      'SELECT * FROM patients WHERE id = ?'
    ).bind(placeholderPatient.id).first();
    
    const finalPatient = Patient.fromDBRow(updatedPatient);
    
    // STEP 5: Process remaining documents in background
    if (uploadedDocs.length > 1) {
      for (let i = 1; i < uploadedDocs.length; i++) {
        processor.processDocument(uploadedDocs[i].id, { mode: 'incremental', provider }).catch(err => {
          console.error('Background processing error:', err);
        });
      }
    }
    
    return c.json({
      success: true,
      patient_id: finalPatient.id,
      message: 'Patient created from clinical documents',
      data: {
        patient: finalPatient.toJSON(),
        documents_uploaded: uploadedDocs.length,
        extracted_demographics: {
          name: patientName,
          age: patientAge,
          gender: patientGender
        }
      }
    }, 201);
    
  } catch (error) {
    console.error('Error in patient intake:', error);
    return c.json(errorResponse(error), error.statusCode || 500);
  }
});

export default intake;
