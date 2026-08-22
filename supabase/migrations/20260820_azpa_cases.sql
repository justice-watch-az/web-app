-- AZPA case enumeration tables (Coconino discovery without JailTracker).
-- Part of Frank's JWAZ-14 SQL batch. 2026-08-20.

-- Watermarks for sequential case-number enumeration per court/type/year.
CREATE TABLE IF NOT EXISTS azpa_enum_state (
    court_value  text NOT NULL,
    case_type    text NOT NULL,
    year         int  NOT NULL,
    last_seq     bigint NOT NULL,
    updated_at   timestamptz DEFAULT now(),
    PRIMARY KEY (court_value, case_type, year)
);

-- Discovered AZPA cases (currently Coconino; keyed by case_number so other
-- counties can share the table later).
CREATE TABLE IF NOT EXISTS azpa_cases (
    case_number   text PRIMARY KEY,
    county        text NOT NULL,
    court         text NOT NULL,
    case_type     text,
    defendant     text,
    dob           text,
    filing_date   text,
    charges       jsonb,
    is_dui        boolean,
    has_counsel   boolean,           -- docket-event heuristic; NULL = unknown
    scraped_at    timestamptz DEFAULT now()
);

ALTER TABLE azpa_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE azpa_enum_state ENABLE ROW LEVEL SECURITY;

-- Public read of CONFIRMED-DUI cases only — matches the Maricopa/Yavapai
-- pattern (mcso_bookings / ycso_bookings_public_read_dui: gate is is_dui = true).
-- Recency is handled at query time (ORDER BY filing_date DESC, LIMIT) the same
-- way the bookings wall orders by first_seen_at DESC — no date predicate here.
-- has_counsel is kept as lead-qualification data on the row, not a gate.
DROP POLICY IF EXISTS "azpa_cases_public_read_dui" ON azpa_cases;
CREATE POLICY "azpa_cases_public_read_dui"
    ON azpa_cases FOR SELECT USING (is_dui = true);
