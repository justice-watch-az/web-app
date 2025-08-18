-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS case_calendar CASCADE;
DROP TABLE IF EXISTS case_charges CASCADE;
DROP TABLE IF EXISTS case_parties CASCADE;
DROP TABLE IF EXISTS cases CASCADE;

-- Cases table (main data)
CREATE TABLE cases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_number VARCHAR(50) UNIQUE NOT NULL,
  court_name VARCHAR(100),
  case_title VARCHAR(200),
  case_type VARCHAR(50),
  status VARCHAR(50),
  filing_date DATE,
  judge VARCHAR(100),
  location VARCHAR(100),
  next_hearing TIMESTAMP,
  case_url TEXT,
  raw_data JSONB,
  scraped_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Parties table
CREATE TABLE case_parties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  party_type VARCHAR(20) CHECK (party_type IN ('plaintiff', 'defendant')),
  party_name VARCHAR(200),
  relationship VARCHAR(100),
  sex VARCHAR(10),
  attorney VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Charges table
CREATE TABLE case_charges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  ars_code VARCHAR(50),
  description TEXT,
  crime_date DATE,
  severity VARCHAR(10),
  disposition VARCHAR(100),
  disposition_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Calendar/Hearings table
CREATE TABLE case_calendar (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  hearing_date DATE,
  hearing_time TIME,
  event_type VARCHAR(100),
  result VARCHAR(200),
  location VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_case_number ON cases(case_number);
CREATE INDEX idx_court_name ON cases(court_name);
CREATE INDEX idx_scraped_at ON cases(scraped_at DESC);
CREATE INDEX idx_next_hearing ON cases(next_hearing);
CREATE INDEX idx_case_parties_case_id ON case_parties(case_id);
CREATE INDEX idx_case_charges_case_id ON case_charges(case_id);
CREATE INDEX idx_case_calendar_case_id ON case_calendar(case_id);

-- Enable Row Level Security
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_calendar ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public can read cases" ON cases
  FOR SELECT USING (true);

CREATE POLICY "Public can read parties" ON case_parties
  FOR SELECT USING (true);

CREATE POLICY "Public can read charges" ON case_charges
  FOR SELECT USING (true);

CREATE POLICY "Public can read calendar" ON case_calendar
  FOR SELECT USING (true);

-- Only service role can write (for scrapers)
CREATE POLICY "Service role can insert cases" ON cases
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update cases" ON cases
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert parties" ON case_parties
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can insert charges" ON case_charges
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can insert calendar" ON case_calendar
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Create view for recent cases
CREATE OR REPLACE VIEW recent_cases AS
SELECT 
  c.*,
  COUNT(DISTINCT cp.id) as party_count,
  COUNT(DISTINCT cc.id) as charge_count,
  COUNT(DISTINCT cal.id) as hearing_count
FROM cases c
LEFT JOIN case_parties cp ON c.id = cp.case_id
LEFT JOIN case_charges cc ON c.id = cc.case_id
LEFT JOIN case_calendar cal ON c.id = cal.case_id
WHERE c.scraped_at > NOW() - INTERVAL '7 days'
GROUP BY c.id
ORDER BY c.scraped_at DESC;

-- Create function for case statistics
CREATE OR REPLACE FUNCTION get_case_stats()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'total_cases', (SELECT COUNT(*) FROM cases),
    'courts', (SELECT COUNT(DISTINCT court_name) FROM cases),
    'today_cases', (SELECT COUNT(*) FROM cases WHERE DATE(scraped_at) = CURRENT_DATE),
    'open_cases', (SELECT COUNT(*) FROM cases WHERE status != 'Closed'),
    'arraignments_today', (
      SELECT COUNT(*) FROM case_calendar 
      WHERE DATE(hearing_date) = CURRENT_DATE 
      AND event_type LIKE '%Arraignment%'
    ),
    'last_scrape', (SELECT MAX(scraped_at) FROM cases)
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to get full case details
CREATE OR REPLACE FUNCTION get_case_details(case_num VARCHAR)
RETURNS JSON AS $$
DECLARE
  case_data JSON;
BEGIN
  SELECT json_build_object(
    'case', row_to_json(c),
    'parties', (
      SELECT json_agg(row_to_json(cp))
      FROM case_parties cp
      WHERE cp.case_id = c.id
    ),
    'charges', (
      SELECT json_agg(row_to_json(cc))
      FROM case_charges cc
      WHERE cc.case_id = c.id
    ),
    'calendar', (
      SELECT json_agg(row_to_json(cal))
      FROM case_calendar cal
      WHERE cal.case_id = c.id
      ORDER BY cal.hearing_date DESC
    )
  ) INTO case_data
  FROM cases c
  WHERE c.case_number = case_num;
  
  RETURN case_data;
END;
$$ LANGUAGE plpgsql;

-- Create function for searching cases
CREATE OR REPLACE FUNCTION search_cases(query_text VARCHAR)
RETURNS TABLE(
  id UUID,
  case_number VARCHAR,
  court_name VARCHAR,
  case_title VARCHAR,
  status VARCHAR,
  next_hearing TIMESTAMP,
  relevance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.case_number,
    c.court_name,
    c.case_title,
    c.status,
    c.next_hearing,
    CASE 
      WHEN c.case_number ILIKE '%' || query_text || '%' THEN 1.0
      WHEN c.case_title ILIKE '%' || query_text || '%' THEN 0.8
      WHEN EXISTS (
        SELECT 1 FROM case_parties cp 
        WHERE cp.case_id = c.id 
        AND cp.party_name ILIKE '%' || query_text || '%'
      ) THEN 0.6
      ELSE 0.4
    END as relevance
  FROM cases c
  WHERE 
    c.case_number ILIKE '%' || query_text || '%'
    OR c.case_title ILIKE '%' || query_text || '%'
    OR c.court_name ILIKE '%' || query_text || '%'
    OR EXISTS (
      SELECT 1 FROM case_parties cp 
      WHERE cp.case_id = c.id 
      AND cp.party_name ILIKE '%' || query_text || '%'
    )
  ORDER BY relevance DESC, c.scraped_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();