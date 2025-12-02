import { generateId, getCurrentTimestamp } from '../utils/helpers.js';

export class Document {
  constructor(data) {
    this.id = data.id || generateId('doc');
    this.patient_id = data.patient_id;

    // File metadata
    this.filename = data.filename;
    this.file_type = data.file_type;
    this.mime_type = data.mime_type || null;
    this.file_size = data.file_size || 0;
    this.storage_key = data.storage_key || `${data.patient_id}/${this.id}/${data.filename}`;

    // Document classification (new fields)
    this.category = data.category || null; // pathology, radiology, lab, clinical_notes, etc.
    this.subcategory = data.subcategory || null; // biopsy, ct_scan, mri, blood_test, etc.
    this.title = data.title || null;
    this.document_date = data.document_date || null;

    // Backward compatibility (deprecated)
    // Default to 'other' to satisfy NOT NULL constraint while allowing omission
    this.document_type = data.document_type || data.category || 'other';
    this.document_subtype = data.document_subtype || data.subcategory || null;

    // Case pack integration (merged functionality)
    this.case_pack_order = data.case_pack_order || null;

    // Processing status
    this.processing_status = data.processing_status || 'pending';
    this.processing_started_at = data.processing_started_at || null;
    this.processing_completed_at = data.processing_completed_at || null;
    this.processing_error = data.processing_error || null;

    // Vectorization status
    this.vectorize_status = data.vectorize_status || 'pending';
    this.vectorized_at = data.vectorized_at || null;

    // Review status
    this.reviewed_status = data.reviewed_status || 'pending';
    this.reviewed_by = data.reviewed_by || null;
    this.reviewed_date = data.reviewed_date || null;

    // AI processing metadata
    this.gemini_model = data.gemini_model || null;
    this.tokens_used = data.tokens_used || null;
    this.thought_signature = data.thought_signature || null;
    this.extraction_confidence = data.extraction_confidence || null;

    // Extracted content
    this.extracted_text = data.extracted_text || null;
    this.extracted_data = data.extracted_data || null;
    this.medical_highlight = data.medical_highlight || null;
    this.critical_findings = data.critical_findings || null; // JSON array
    this.summary = data.summary || null;

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

    // Category/subcategory are optional - they will be inferred during AI processing
    // Users can optionally provide them, but they're not required

    const validCategories = [
      'pathology',
      'radiology',
      'lab',
      'clinical_notes',
      'consultation',
      'imaging',
      'gp_notes',
      'prescription',
      'discharge_summary',
      'other'
    ];

    // Validate category if provided
    const categoryToValidate = data.category || data.document_type;
    if (categoryToValidate && !validCategories.includes(categoryToValidate)) {
      errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    }

    const validReviewedStatus = ['pending', 'reviewed', 'flagged'];
    if (data.reviewed_status && !validReviewedStatus.includes(data.reviewed_status)) {
      errors.push('Reviewed status must be pending, reviewed, or flagged');
    }

    const validVectorizeStatus = ['pending', 'processing', 'completed', 'failed'];
    if (data.vectorize_status && !validVectorizeStatus.includes(data.vectorize_status)) {
      errors.push('Vectorize status must be pending, processing, completed, or failed');
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      patient_id: this.patient_id,

      // File metadata
      filename: this.filename,
      file_type: this.file_type,
      mime_type: this.mime_type,
      file_size: this.file_size,
      storage_key: this.storage_key,

      // Document classification
      category: this.category,
      subcategory: this.subcategory,
      title: this.title,
      document_date: this.document_date,

      // Backward compatibility (deprecated)
      document_type: this.document_type,
      document_subtype: this.document_subtype,

      // Case pack integration
      case_pack_order: this.case_pack_order,

      // Processing status
      processing_status: this.processing_status,
      processing_started_at: this.processing_started_at,
      processing_completed_at: this.processing_completed_at,
      processing_error: this.processing_error,

      // Vectorization status
      vectorize_status: this.vectorize_status,
      vectorized_at: this.vectorized_at,

      // Review status
      reviewed_status: this.reviewed_status,
      reviewed_by: this.reviewed_by,
      reviewed_date: this.reviewed_date,

      // AI processing metadata
      gemini_model: this.gemini_model,
      tokens_used: this.tokens_used,
      extraction_confidence: this.extraction_confidence,

      // Extracted content
      medical_highlight: this.medical_highlight,
      critical_findings: this.critical_findings,
      summary: this.summary,

      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromDBRow(row) {
    return new Document(row);
  }
}
