-- Justice Watch Database Schema (No Authentication)
-- Designed to handle all court case data with proper relationships

-- Main court_cases table to match existing structure
CREATE TABLE IF NOT EXISTS court_cases (
    id SERIAL PRIMARY KEY,
    case_number VARCHAR(100) NOT NULL,
    court_id VARCHAR(100) NOT NULL,
    court_name VARCHAR(255),
    case_title VARCHAR(500),
    case_type VARCHAR(100),
    case_status VARCHAR(100),
    filing_date DATE,
    judge VARCHAR(255),
    location VARCHAR(255),
    case_url VARCHAR(500),
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_hearing DATE,
    parties JSONB,
    docket_entries JSONB,
    events JSONB,
    documents JSONB,
    UNIQUE(case_number, court_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_court_cases_case_number ON court_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_court_cases_court_id ON court_cases(court_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_next_hearing ON court_cases(next_hearing);
CREATE INDEX IF NOT EXISTS idx_court_cases_case_status ON court_cases(case_status);
CREATE INDEX IF NOT EXISTS idx_court_cases_scraped_at ON court_cases(scraped_at DESC);

-- Create a view for active cases with upcoming hearings
CREATE OR REPLACE VIEW active_cases AS
SELECT * FROM court_cases 
WHERE next_hearing >= CURRENT_DATE 
ORDER BY next_hearing ASC;

-- Create a view for case statistics
CREATE OR REPLACE VIEW case_statistics AS
SELECT 
    COUNT(*) as total_cases,
    COUNT(DISTINCT court_id) as total_courts,
    COUNT(CASE WHEN next_hearing >= CURRENT_DATE THEN 1 END) as upcoming_hearings,
    COUNT(CASE WHEN next_hearing < CURRENT_DATE THEN 1 END) as past_hearings
FROM court_cases;