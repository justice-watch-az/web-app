# Supabase Setup Instructions for Justice Watch v3.0

## Step 1: Create Supabase Account and Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" (free)
3. Sign up with GitHub (recommended) or email
4. Create a new project:
   - **Project Name**: `justice-watch-v3`
   - **Database Password**: Generate a strong password and save it securely
   - **Region**: Choose closest to Arizona (US West or US East)
   - **Pricing Plan**: Free tier

## Step 2: Save Your Credentials

Once the project is created (takes ~2 minutes), save these values:

```bash
# Create a .env.local file in the justice-watch-app directory
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # Found in Settings > API > anon public
SUPABASE_SERVICE_KEY=eyJ...     # Found in Settings > API > service_role (secret)
```

**Important**: 
- `ANON_KEY` is safe for frontend (public)
- `SERVICE_KEY` is secret (for scrapers/backend only)
- Never commit these to Git

## Step 3: Database Schema Setup

1. Go to SQL Editor in Supabase Dashboard
2. Create a new query
3. Run the following schema:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
```

## Step 4: Create API Views and Functions

Run this in a new SQL query:

```sql
-- Create view for recent cases
CREATE VIEW recent_cases AS
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
```

## Step 5: Enable Realtime (Optional but Recommended)

1. Go to Database > Replication in Supabase Dashboard
2. Enable replication for these tables:
   - `cases`
   - `case_calendar`
3. This allows real-time updates in the frontend

## Step 6: Test the Setup

Run this query to verify everything works:

```sql
-- Insert test case
INSERT INTO cases (case_number, court_name, case_title, case_type, status)
VALUES ('TEST2025000001', 'Test Court', 'Test vs Test', 'Test Type', 'Open')
RETURNING *;

-- Check if it worked
SELECT * FROM cases WHERE case_number = 'TEST2025000001';

-- Clean up test data
DELETE FROM cases WHERE case_number = 'TEST2025000001';
```

## Step 7: Configure Authentication (Optional for Phase 1)

If you want to preserve user authentication:

1. Go to Authentication > Providers
2. Enable Email provider
3. Configure email templates
4. Set JWT expiry (default 1 hour is fine)

## Local Development Option

For local development, you can also run Supabase locally:

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize local project
supabase init

# Start local Supabase
supabase start

# You'll get local URLs:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
```

## Environment Variables Summary

```bash
# Frontend (.env.local)
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Scraper/Backend (.env)
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# GitHub Secrets (for Actions)
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

## Next Steps

1. ✅ Supabase project created
2. ✅ Database schema setup
3. ✅ API views and functions created
4. ✅ Credentials saved securely
5. 🔄 Ready to proceed with frontend integration

## Troubleshooting

- **Connection refused**: Check if project is still initializing (takes 2-3 minutes)
- **Permission denied**: Verify RLS policies are correct
- **API key invalid**: Make sure you're using the right key (anon vs service)
- **Rate limits**: Free tier has 50K requests/month, monitor usage

## Documentation Links

- [Supabase Docs](https://supabase.com/docs)
- [JavaScript Client Library](https://supabase.com/docs/reference/javascript/introduction)
- [Python Client Library](https://supabase.com/docs/reference/python/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)