-- Add treatment_context column to medications table for bucketing by treatment type
-- Safe migration: uses IF NOT EXISTS pattern where possible

-- Add treatment_context column (ignore error if already exists)
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- This will fail gracefully if column already exists
ALTER TABLE medications ADD COLUMN treatment_context TEXT;

-- Create index for faster grouping queries
CREATE INDEX IF NOT EXISTS idx_medications_treatment_context ON medications(treatment_context);

