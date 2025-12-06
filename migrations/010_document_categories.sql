-- Migration 010: Document Categories Framework
-- Adds facility column, creates document_categories reference table, and adds index

-- Add facility column to documents (if not exists)
-- Note: category and subcategory should already exist from migration 008
ALTER TABLE documents ADD COLUMN facility TEXT;

-- Create reference table for valid categories
CREATE TABLE IF NOT EXISTS document_categories (
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  display_name TEXT,
  extraction_priority TEXT,  -- 'P0', 'P1', 'P2', 'P3'
  PRIMARY KEY (category, subcategory)
);

-- Populate reference data (using INSERT OR IGNORE to handle duplicates)
INSERT OR IGNORE INTO document_categories VALUES
  ('pathology', 'biopsy', 'Biopsy / Histopathology', 'P0'),
  ('pathology', 'fnac', 'FNAC', 'P0'),
  ('pathology', 'cytology', 'Cytology', 'P1'),
  ('pathology', 'ihc', 'IHC / Molecular', 'P0'),
  ('pathology', 'hpe_review', 'HPE Review', 'P1'),
  ('pathology', 'frozen', 'Frozen Section', 'P1'),
  ('imaging', 'ct', 'CT Scan', 'P0'),
  ('imaging', 'pet', 'PET-CT', 'P0'),
  ('imaging', 'mri', 'MRI', 'P1'),
  ('imaging', 'xray', 'X-Ray', 'P2'),
  ('imaging', 'usg', 'Ultrasound', 'P2'),
  ('imaging', 'mammo', 'Mammography', 'P1'),
  ('imaging', 'bone_scan', 'Bone Scan', 'P1'),
  ('imaging', 'echo', '2D Echo', 'P2'),
  ('imaging', 'endoscopy', 'Endoscopy', 'P1'),
  ('laboratory', 'cbc', 'Complete Blood Count', 'P2'),
  ('laboratory', 'lft', 'Liver Function', 'P2'),
  ('laboratory', 'kft', 'Kidney Function', 'P2'),
  ('laboratory', 'tumor_marker', 'Tumor Markers', 'P1'),
  ('laboratory', 'coag', 'Coagulation', 'P2'),
  ('laboratory', 'thyroid', 'Thyroid', 'P2'),
  ('laboratory', 'viral', 'Viral Markers', 'P2'),
  ('laboratory', 'sugar', 'Blood Sugar', 'P3'),
  ('laboratory', 'electrolytes', 'Electrolytes', 'P2'),
  ('laboratory', 'urine', 'Urine', 'P3'),
  ('laboratory', 'lab_other', 'Other Labs', 'P3'),
  ('clinical', 'discharge', 'Discharge Summary', 'P0'),
  ('clinical', 'opd', 'OPD Notes', 'P2'),
  ('clinical', 'case_summary', 'Case Summary', 'P1'),
  ('clinical', 'referral', 'Referral Letter', 'P3'),
  ('clinical', 'tumor_board', 'Tumor Board Notes', 'P0'),
  ('clinical', 'second_opinion', 'Second Opinion', 'P1'),
  ('clinical', 'admission', 'Admission Notes', 'P2'),
  ('clinical', 'progress', 'Progress Notes', 'P2'),
  ('clinical', 'death_summary', 'Death Summary', 'P1'),
  ('treatment', 'chemo_chart', 'Chemotherapy Chart', 'P0'),
  ('treatment', 'chemo_protocol', 'Chemotherapy Protocol', 'P0'),
  ('treatment', 'rt_plan', 'Radiation Plan', 'P0'),
  ('treatment', 'rt_summary', 'Radiation Summary', 'P1'),
  ('treatment', 'drug_chart', 'Drug Chart', 'P2'),
  ('treatment', 'transfusion', 'Transfusion Record', 'P2'),
  ('treatment', 'consent', 'Consent Form', 'P3'),
  ('treatment', 'supportive', 'Supportive Care', 'P2'),
  ('surgical', 'op_notes', 'Operative Notes', 'P1'),
  ('surgical', 'ot_summary', 'OT Summary', 'P1'),
  ('surgical', 'anesthesia', 'Anesthesia Record', 'P2'),
  ('surgical', 'postop', 'Post-Op Notes', 'P2'),
  ('surgical', 'procedure', 'Procedure Notes', 'P2'),
  ('admin', 'insurance', 'Insurance Claim', 'P3'),
  ('admin', 'ayushman', 'Ayushman Bharat', 'P3'),
  ('admin', 'cghs', 'CGHS/ECHS', 'P3'),
  ('admin', 'bill', 'Hospital Bill', 'P3'),
  ('admin', 'id', 'ID Documents', 'P3'),
  ('admin', 'prescription', 'Prescription', 'P3');

-- Create index for category lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(patient_id, category, subcategory);

