-- scrape_logs observability table (JC + MCSO scrapers write run stats)
-- Prod was missing this; MCSO scraper 404'd on insert (PGRST205) as of 2026-08-17.

CREATE TABLE IF NOT EXISTS scrape_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  scrape_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  courts_processed INTEGER,
  cases_found INTEGER,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_started ON scrape_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_type ON scrape_logs(scrape_type, started_at DESC);

ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read scrape_logs" ON scrape_logs;
CREATE POLICY "Public can read scrape_logs" ON scrape_logs
  FOR SELECT USING (true);

-- Service role / secret key bypasses RLS for inserts; keep explicit write policies
-- for environments where legacy role claims still apply.
DROP POLICY IF EXISTS "Service role can insert scrape_logs" ON scrape_logs;
CREATE POLICY "Service role can insert scrape_logs" ON scrape_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update scrape_logs" ON scrape_logs;
CREATE POLICY "Service role can update scrape_logs" ON scrape_logs
  FOR UPDATE USING (true);

-- mcso_bookings shipped without RLS policies — frontend publishable key needs SELECT
ALTER TABLE mcso_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read mcso_bookings" ON mcso_bookings;
CREATE POLICY "Public can read mcso_bookings" ON mcso_bookings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can write mcso_bookings" ON mcso_bookings;
CREATE POLICY "Service role can write mcso_bookings" ON mcso_bookings
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scrape_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can write scrape_state" ON scrape_state;
CREATE POLICY "Service role can write scrape_state" ON scrape_state
  FOR ALL USING (true) WITH CHECK (true);
