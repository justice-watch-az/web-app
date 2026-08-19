-- YCSO booking roster expansion — Yavapai county-wide lead source (JWAZ-16)
-- 2026-08-19 — probe: apps.yavapaiaz.gov/InmateSearch/ live roster, no captcha,
-- columns: Inmate No / Booking Date / Location / Name. NO charges on roster —
-- DUI confirmation happens via charge_enrichment (AZ Public Access), so
-- is_dui starts NULL and NOTHING surfaces in the UI until confirmed DUI.

CREATE TABLE IF NOT EXISTS ycso_bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inmate_number VARCHAR(20) NOT NULL,
  booking_date TIMESTAMP,
  full_name VARCHAR(200),
  last_name VARCHAR(100),
  first_name VARCHAR(100),
  housing_location VARCHAR(50),              -- e.g. "CVDC UNIT 3", "PJC UNIT A"
  is_dui BOOLEAN,                            -- NULL = unclassified; set by enrichment
  source VARCHAR(30) DEFAULT 'ycso_booking',
  first_seen_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (inmate_number, booking_date)
);

CREATE INDEX IF NOT EXISTS idx_ycso_bookings_dui ON ycso_bookings(is_dui, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_ycso_bookings_name ON ycso_bookings(last_name);

ALTER TABLE ycso_bookings ENABLE ROW LEVEL SECURITY;

-- NOTE: no public-read policy yet — rows are UNCLASSIFIED (is_dui NULL) until
-- enrichment confirms DUI. Add a SELECT policy scoped to is_dui = TRUE when
-- the /bookings UI surface for Yavapai ships.
