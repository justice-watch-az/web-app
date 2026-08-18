-- Multi-county / multi-source support for statewide expansion
-- 2026-08-18

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS county VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source VARCHAR(50);

-- Backfill existing Maricopa JC inventory
UPDATE cases
SET
  county = COALESCE(county, 'maricopa'),
  source = COALESCE(source, 'maricopa_jc')
WHERE county IS NULL OR source IS NULL;

CREATE INDEX IF NOT EXISTS idx_cases_county ON cases(county);
CREATE INDEX IF NOT EXISTS idx_cases_source ON cases(source);
CREATE INDEX IF NOT EXISTS idx_cases_county_scraped ON cases(county, scraped_at DESC);

COMMENT ON COLUMN cases.county IS 'AZ county slug, e.g. maricopa, yavapai';
COMMENT ON COLUMN cases.source IS 'Ingest source id from sources.yaml, e.g. maricopa_jc, yavapai_jc_prescott';
