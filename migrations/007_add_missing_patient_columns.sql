-- Migration: Add missing patient columns to match schema
-- Date: 2025-01-XX
-- Description: Adds missing columns to patients table to match expected schema

-- External IDs
ALTER TABLE patients ADD COLUMN patient_id_uhid TEXT;
ALTER TABLE patients ADD COLUMN patient_id_ipd TEXT;

-- Demographics
ALTER TABLE patients ADD COLUMN age_unit TEXT DEFAULT 'years';
ALTER TABLE patients ADD COLUMN sex TEXT;
ALTER TABLE patients ADD COLUMN dob TEXT;

-- Physical attributes
ALTER TABLE patients ADD COLUMN blood_type TEXT;
ALTER TABLE patients ADD COLUMN height_cm REAL;
ALTER TABLE patients ADD COLUMN weight_kg REAL;
ALTER TABLE patients ADD COLUMN bsa REAL;

-- Clinical status
ALTER TABLE patients ADD COLUMN ecog_status INTEGER;
ALTER TABLE patients ADD COLUMN current_status TEXT;
ALTER TABLE patients ADD COLUMN current_status_detail TEXT;

-- Care team
ALTER TABLE patients ADD COLUMN primary_oncologist TEXT;
ALTER TABLE patients ADD COLUMN primary_center TEXT;

-- Preferences
ALTER TABLE patients ADD COLUMN language_preference TEXT;
ALTER TABLE patients ADD COLUMN allergy_status TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_patients_current_status ON patients(current_status);
CREATE INDEX IF NOT EXISTS idx_patients_primary_oncologist ON patients(primary_oncologist);
CREATE INDEX IF NOT EXISTS idx_patients_external_mrn ON patients(external_mrn);

