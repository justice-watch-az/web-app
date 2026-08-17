-- MCSO booking (mugshot wall) expansion — Justice Watch dual-source MVP
-- 2026-08-16 — probe: wall hard-capped at 100 in-custody bookings, sequential G-series booking #s

-- Lead records from the MCSO booking wall
CREATE TABLE IF NOT EXISTS mcso_bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_number VARCHAR(20) UNIQUE NOT NULL,   -- e.g. G275257
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  charges TEXT[],                                -- parsed charge list
  charges_raw TEXT,                              -- original cell text (multi-charge)
  arresting_agency VARCHAR(150),
  is_dui BOOLEAN DEFAULT FALSE,
  mugshot_b64 TEXT,                              -- inline base64 from wall (DUI hits only if dui_only mode)
  source VARCHAR(30) DEFAULT 'mcso_booking',
  first_seen_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcso_bookings_dui ON mcso_bookings(is_dui, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcso_bookings_booking ON mcso_bookings(booking_number);

-- High-water mark / misc scraper state (shared by future sources too)
CREATE TABLE IF NOT EXISTS scrape_state (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
