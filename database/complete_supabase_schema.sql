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

-- Create scraping_jobs table
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  job_type VARCHAR(50) DEFAULT 'general',
  config JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  cases_found INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_filing_date ON cases(filing_date);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user ON scraping_jobs(user_id);