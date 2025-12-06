-- Migration: Add document classification and triage workflow fields
-- Date: 2025-12-04
-- Description: Adds classification, triage, and GP review fields to documents table

-- Classification fields
ALTER TABLE documents ADD COLUMN classification TEXT DEFAULT 'pending';
-- Values: 'pending' | 'cancer_core' | 'cancer_adjacent' | 'non_cancer'

ALTER TABLE documents ADD COLUMN classification_confidence REAL;
-- AI confidence score 0.0-1.0

ALTER TABLE documents ADD COLUMN classification_reason TEXT;
-- One-line AI explanation

ALTER TABLE documents ADD COLUMN document_category TEXT;
-- More specific type: 'biopsy' | 'imaging_ct' | 'imaging_pet' | 'imaging_mri' | 
-- 'blood_work' | 'chemo_protocol' | 'surgical_notes' | 'discharge_summary' | 
-- 'prescription' | 'consultation' | 'pathology' | 'radiology' | 'other'

-- Triage workflow fields
ALTER TABLE documents ADD COLUMN gp_reviewed INTEGER DEFAULT 0;
-- 0 = not reviewed, 1 = reviewed

ALTER TABLE documents ADD COLUMN gp_approved_for_extraction INTEGER DEFAULT 0;
-- 0 = not approved, 1 = approved for full extraction

ALTER TABLE documents ADD COLUMN gp_reviewed_at INTEGER;
-- Unix timestamp of review

ALTER TABLE documents ADD COLUMN gp_reviewed_by TEXT;
-- User ID of reviewing GP

ALTER TABLE documents ADD COLUMN gp_classification_override TEXT;
-- If GP changed the classification, store original AI classification here

-- Create indexes for classification queries
CREATE INDEX IF NOT EXISTS idx_documents_classification ON documents(patient_id, classification);
CREATE INDEX IF NOT EXISTS idx_documents_triage_status ON documents(patient_id, gp_reviewed, gp_approved_for_extraction);

