-- Add missing columns to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS parties JSONB,
ADD COLUMN IF NOT EXISTS docket_entries JSONB,
ADD COLUMN IF NOT EXISTS next_hearing DATE,
ADD COLUMN IF NOT EXISTS raw_data JSONB,
ADD COLUMN IF NOT EXISTS events JSONB,
ADD COLUMN IF NOT EXISTS documents JSONB;

-- Rename case_status to status for consistency
ALTER TABLE cases 
RENAME COLUMN case_status TO status;