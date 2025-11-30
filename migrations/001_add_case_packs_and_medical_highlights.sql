-- Migration: Add case-packs and medical highlights
-- Date: 2025-11-30
-- Description: Adds support for multi-document uploads with medical highlights and case-pack catalogs

-- Add medical_highlight column to documents table
ALTER TABLE documents ADD COLUMN medical_highlight TEXT;

-- Create case_packs table
CREATE TABLE IF NOT EXISTS case_packs (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,

    title TEXT,
    description TEXT,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Create case_pack_documents junction table
CREATE TABLE IF NOT EXISTS case_pack_documents (
    case_pack_id TEXT NOT NULL,
    document_id TEXT NOT NULL,

    display_order INTEGER DEFAULT 0,
    added_at INTEGER NOT NULL,

    PRIMARY KEY (case_pack_id, document_id),
    FOREIGN KEY (case_pack_id) REFERENCES case_packs(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_case_packs_patient ON case_packs(patient_id);
CREATE INDEX IF NOT EXISTS idx_case_pack_docs_pack ON case_pack_documents(case_pack_id);
CREATE INDEX IF NOT EXISTS idx_case_pack_docs_doc ON case_pack_documents(document_id);
