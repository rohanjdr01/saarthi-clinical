-- Migration: Create staging_snapshots table for event-based staging
-- Date: 2025-12-04
-- Description: Creates new table to track staging evolution over time (never overwrite)

CREATE TABLE staging_snapshots (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  document_id TEXT,
  
  -- When/why this staging was captured
  staging_type TEXT,  -- 'initial' | 'restaging' | 'post_treatment' | 'recurrence'
  staging_date TEXT,  -- Date of the staging evaluation
  staging_system TEXT,  -- 'AJCC 8th Edition', 'FIGO', etc.
  
  -- TNM (store as simple strings)
  clinical_tnm TEXT,  -- 'cT2N1M0'
  pathological_tnm TEXT,  -- 'pT2N1M0'
  
  -- Overall stage
  overall_stage TEXT,  -- 'IIB', 'IIIA', etc.
  
  -- Metadata
  notes TEXT,
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Create indexes for staging queries
CREATE INDEX IF NOT EXISTS idx_staging_snapshots_patient ON staging_snapshots(patient_id);
CREATE INDEX IF NOT EXISTS idx_staging_snapshots_date ON staging_snapshots(patient_id, staging_date);

