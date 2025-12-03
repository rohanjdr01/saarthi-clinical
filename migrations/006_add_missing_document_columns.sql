-- Add missing document columns that are expected by the code
-- Based on production schema check, these columns are missing:
-- category, subcategory, title, case_pack_order, reviewed_status, reviewed_by, reviewed_date

-- Document classification fields
ALTER TABLE documents ADD COLUMN category TEXT;
ALTER TABLE documents ADD COLUMN subcategory TEXT;
ALTER TABLE documents ADD COLUMN title TEXT;

-- Case pack integration
ALTER TABLE documents ADD COLUMN case_pack_order INTEGER;

-- Review status fields
ALTER TABLE documents ADD COLUMN reviewed_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN reviewed_by TEXT;
ALTER TABLE documents ADD COLUMN reviewed_date INTEGER;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_subcategory ON documents(subcategory);
CREATE INDEX IF NOT EXISTS idx_documents_reviewed_status ON documents(reviewed_status);
CREATE INDEX IF NOT EXISTS idx_documents_case_pack_order ON documents(case_pack_order);

