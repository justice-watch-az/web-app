-- Charge-enrichment cache for sources without public charge data (JWAZ-16).
-- One row per case, forever — each case is captcha-solved at most once.

CREATE TABLE IF NOT EXISTS charge_enrichment (
    case_number     TEXT PRIMARY KEY,
    county          TEXT NOT NULL,
    source          TEXT NOT NULL,
    found           BOOLEAN NOT NULL DEFAULT FALSE,
    is_dui          BOOLEAN NOT NULL DEFAULT FALSE,
    charges         JSONB NOT NULL DEFAULT '[]'::jsonb,
    court           TEXT,
    error           TEXT,
    enriched_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charge_enrichment_dui
    ON charge_enrichment (county, is_dui);

ALTER TABLE charge_enrichment ENABLE ROW LEVEL SECURITY;

-- Public read (the /cases UI may surface charge data later)
CREATE POLICY IF NOT EXISTS "charge_enrichment_public_read"
    ON charge_enrichment FOR SELECT USING (true);
