import { generateId, getCurrentTimestamp } from '../utils/helpers.js';

export class Document {
  constructor(data) {
    this.id = data.id || generateId('doc');
    this.patient_id = data.patient_id;
    
    this.filename = data.filename;
    this.file_type = data.file_type;
    this.document_type = data.document_type;
    this.document_subtype = data.document_subtype || null;
    this.document_date = data.document_date || null;
    
    this.storage_key = data.storage_key || `${data.patient_id}/${this.id}/${data.filename}`;
    this.file_size = data.file_size || 0;
    this.mime_type = data.mime_type || null;
    
    this.processing_status = data.processing_status || 'pending';
    this.processing_started_at = data.processing_started_at || null;
    this.processing_completed_at = data.processing_completed_at || null;
    this.processing_error = data.processing_error || null;
    
    this.gemini_model = data.gemini_model || null;
    this.tokens_used = data.tokens_used || null;
    this.thought_signature = data.thought_signature || null;
    this.extraction_confidence = data.extraction_confidence || null;
    
    this.extracted_text = data.extracted_text || null;
    this.extracted_data = data.extracted_data || null;
    
    this.created_at = data.created_at || getCurrentTimestamp();
    this.updated_at = data.updated_at || getCurrentTimestamp();
  }

  static validate(data) {
    const errors = [];
    
    if (!data.patient_id) {
      errors.push('Patient ID is required');
    }
    
    if (!data.filename) {
      errors.push('Filename is required');
    }
    
    if (!data.document_type) {
      errors.push('Document type is required');
    }
    
    const validTypes = ['pathology', 'imaging', 'lab', 'consultation', 'gp_notes', 'other'];
    if (!validTypes.includes(data.document_type)) {
      errors.push(`Document type must be one of: ${validTypes.join(', ')}`);
    }
    
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      patient_id: this.patient_id,
      filename: this.filename,
      file_type: this.file_type,
      document_type: this.document_type,
      document_subtype: this.document_subtype,
      document_date: this.document_date,
      storage_key: this.storage_key,
      file_size: this.file_size,
      mime_type: this.mime_type,
      processing_status: this.processing_status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromDBRow(row) {
    return new Document(row);
  }
}
