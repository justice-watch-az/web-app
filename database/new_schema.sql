-- Justice Watch Database Schema
-- Designed to handle all court case data with proper relationships

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- 'user', 'admin', 'viewer'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Main cases table (one record per case)
CREATE TABLE IF NOT EXISTS cases (
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
    user_id INTEGER REFERENCES users(id),
    UNIQUE(case_number, court_id)
);

-- Parties table (multiple parties per case)
CREATE TABLE IF NOT EXISTS case_parties (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    party_type VARCHAR(50), -- 'plaintiff' or 'defendant'
    party_name VARCHAR(255),
    relationship VARCHAR(100),
    sex VARCHAR(20),
    attorney VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Disposition/Charges table (multiple charges per case)
CREATE TABLE IF NOT EXISTS case_charges (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    party_name VARCHAR(255), -- Which defendant this charge is for
    ars_code VARCHAR(50),
    description TEXT,
    crime_date TIMESTAMP,
    disposition_code VARCHAR(100),
    disposition_date DATE,
    disposition TEXT,
    severity VARCHAR(10), -- M1, M2, F1, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar/Hearings table (multiple hearings per case)
CREATE TABLE IF NOT EXISTS case_calendar (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    hearing_date DATE,
    hearing_time TIME,
    event_type VARCHAR(255),
    result TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table (multiple documents per case)
CREATE TABLE IF NOT EXISTS case_documents (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    document_name VARCHAR(255),
    document_type VARCHAR(100),
    filed_date DATE,
    filed_by VARCHAR(255),
    document_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table (multiple events per case)
CREATE TABLE IF NOT EXISTS case_events (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    event_date DATE,
    event_type VARCHAR(255),
    event_description TEXT,
    filed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Judgments table (multiple judgments per case)
CREATE TABLE IF NOT EXISTS case_judgments (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    judgment_date DATE,
    judgment_type VARCHAR(100),
    judgment_amount DECIMAL(10, 2),
    judgment_description TEXT,
    in_favor_of VARCHAR(255),
    against VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw data backup (stores complete scraped data as JSON)
CREATE TABLE IF NOT EXISTS case_raw_data (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    raw_data JSONB,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_filing_date ON cases(filing_date);
CREATE INDEX IF NOT EXISTS idx_cases_court_id ON cases(court_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_status ON cases(case_status);
CREATE INDEX IF NOT EXISTS idx_case_parties_case_id ON case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_party_type ON case_parties(party_type);
CREATE INDEX IF NOT EXISTS idx_case_charges_case_id ON case_charges(case_id);
CREATE INDEX IF NOT EXISTS idx_case_charges_ars_code ON case_charges(ars_code);
CREATE INDEX IF NOT EXISTS idx_case_calendar_case_id ON case_calendar(case_id);
CREATE INDEX IF NOT EXISTS idx_case_calendar_hearing_date ON case_calendar(hearing_date);
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_judgments_case_id ON case_judgments(case_id);

-- Create views for common queries
CREATE OR REPLACE VIEW upcoming_hearings AS
SELECT 
    c.case_number,
    c.case_title,
    c.court_name,
    c.judge,
    cal.hearing_date,
    cal.hearing_time,
    cal.event_type,
    cal.location
FROM cases c
JOIN case_calendar cal ON c.id = cal.case_id
WHERE cal.hearing_date >= CURRENT_DATE
ORDER BY cal.hearing_date, cal.hearing_time;

CREATE OR REPLACE VIEW active_charges AS
SELECT 
    c.case_number,
    c.case_title,
    ch.party_name,
    ch.ars_code,
    ch.description,
    ch.crime_date,
    ch.disposition
FROM cases c
JOIN case_charges ch ON c.id = ch.case_id
WHERE ch.disposition IS NULL OR ch.disposition = ''
ORDER BY c.case_number, ch.ars_code;

-- Function to get case summary
CREATE OR REPLACE FUNCTION get_case_summary(p_case_number VARCHAR)
RETURNS TABLE(
    case_number VARCHAR,
    case_title VARCHAR,
    total_charges BIGINT,
    total_parties BIGINT,
    next_hearing_date DATE,
    next_hearing_event VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.case_number,
        c.case_title,
        COUNT(DISTINCT ch.id) as total_charges,
        COUNT(DISTINCT cp.id) as total_parties,
        MIN(cal.hearing_date) FILTER (WHERE cal.hearing_date >= CURRENT_DATE) as next_hearing_date,
        MIN(cal.event_type) FILTER (WHERE cal.hearing_date >= CURRENT_DATE) as next_hearing_event
    FROM cases c
    LEFT JOIN case_charges ch ON c.id = ch.case_id
    LEFT JOIN case_parties cp ON c.id = cp.case_id
    LEFT JOIN case_calendar cal ON c.id = cal.case_id
    WHERE c.case_number = p_case_number
    GROUP BY c.case_number, c.case_title;
END;
$$ LANGUAGE plpgsql;

-- Migration from old schema (if needed)
-- This preserves existing data while migrating to new structure
DO $$
BEGIN
    -- Check if old court_cases table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_cases') THEN
        -- Migrate data from old schema
        INSERT INTO cases (case_number, court_id, case_title, case_type, filing_date, status, judge, scraped_at, user_id)
        SELECT 
            case_number,
            court_id,
            case_title,
            case_type,
            filing_date,
            status,
            judge,
            scraped_at,
            user_id
        FROM court_cases
        ON CONFLICT (case_number, court_id) DO NOTHING;
        
        -- Migrate parties data from JSON
        INSERT INTO case_parties (case_id, party_type, party_name)
        SELECT 
            c.id,
            'plaintiff',
            parties->>'plaintiff'
        FROM cases c
        JOIN court_cases cc ON c.case_number = cc.case_number
        WHERE parties->>'plaintiff' IS NOT NULL;
        
        -- Migrate raw data
        INSERT INTO case_raw_data (case_id, raw_data, scraped_at)
        SELECT 
            c.id,
            cc.raw_data,
            cc.scraped_at
        FROM cases c
        JOIN court_cases cc ON c.case_number = cc.case_number
        WHERE cc.raw_data IS NOT NULL;
        
        -- Rename old table for backup
        ALTER TABLE court_cases RENAME TO court_cases_old;
    END IF;
END
$$;