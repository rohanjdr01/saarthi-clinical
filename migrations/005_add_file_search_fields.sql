-- Add File Search tracking fields to documents table
-- Safe migration: uses IF NOT EXISTS pattern where possible

-- Add File Search fields (ignore error if already exists)
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- This will fail gracefully if columns already exist
ALTER TABLE documents ADD COLUMN file_search_store_name TEXT;
ALTER TABLE documents ADD COLUMN file_search_document_name TEXT;

-- Create index for faster File Search queries
CREATE INDEX IF NOT EXISTS idx_documents_file_search_store ON documents(file_search_store_name);
CREATE INDEX IF NOT EXISTS idx_documents_file_search_document ON documents(file_search_document_name);

