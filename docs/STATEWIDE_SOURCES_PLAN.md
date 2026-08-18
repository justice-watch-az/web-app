# Statewide court sources — plan (v3.2+)

## Goal
Expand beyond Maricopa Justice Courts without cloning scrapers per county.
Treat each county/portal as a **source adapter** feeding a shared `cases` schema.

## Non-goals (this PR)
- Live Yavapai scrape in production
- Changing Maricopa scraper behavior
- Prod deploy / secret changes

## Architecture

```
sources.yaml          # enabled sources + adapter ids + URLs
scrapers/adapters/    # one module per portal family
  base.py             # Protocol + normalized CaseLead
  maricopa_jc.py      # thin wrapper around existing scraper (later)
  yavapai_jc.py       # stub + spike notes (this PR)
pipeline/
  normalize → cases (county, source, court_name, ...)
  scrape_logs / scrape_state keyed by source
.github/workflows/
  matrix job per enabled source (later)
```

### Schema (migration in this PR)
| Column | Purpose |
|--------|---------|
| `county` | e.g. `maricopa`, `yavapai` |
| `source` | e.g. `maricopa_jc`, `yavapai_jc_prescott` |

Backfill existing rows: `county=maricopa`, `source=maricopa_jc`.

### UI (later PR)
- County filter on `/cases`
- Source badge (optional)

## Phased rollout
1. **This PR** — plan doc, migration, `sources.yaml`, adapter stubs, Yavapai spike notes
2. Extract Maricopa into `adapters/maricopa_jc.py` (behavior unchanged)
3. Implement Yavapai Prescott JC calendar adapter (proven URL)
4. Workflow matrix + scrape_logs per source
5. Next counties by lawyer demand / volume

## Yavapai spike (2026-08-18)

### Courts (5 precincts)
- Bagdad-Yarnell Justice Court
- Mayer Justice Court
- Prescott Justice / City Court
- Seligman Justice Court
- Verde Valley Justice Court

### Portal reality
| URL | Result |
|-----|--------|
| `https://courts.yavapaiaz.gov/*` | **403** from datacenter egress (Akamai/Edge). Marketing site unusable as scrape entry from GH Actions without residential/proxy path. |
| `https://apps.yavapaiaz.gov/Courtcalendar_PCC/` | **200** — Prescott JC **online calendar**. ASP.NET WebForms + `CourtGridView`. |
| `https://apps.yavapaiaz.gov/CourtCalendar/` | **200** — Superior Court day calendar (empty on probe day; date postback needed). |

### Prescott JC calendar shape (scrapable)
- Stack: ASP.NET WebForms (`__VIEWSTATE`, `__EVENTVALIDATION`, GridView sort postbacks)
- Columns: **Case Number | Session Date | Party Name | Court Room**
- Case # pattern: `J1303CM2026000153`, `J1303TR2026000250` (J + court code + CM/TR + year + seq)
- Default page: ~38 sessions for “today” on probe
- **No charge text on calendar grid** — DUI filter needs case-detail hop or Public Access enrichment
- Date navigation: ASP.NET calendar control (not a static query-string date)

### Adapter implications
1. Prefer `apps.yavapaiaz.gov` over `courts.yavapaiaz.gov` (bot wall).
2. Use `requests` + VIEWSTATE postbacks first; fall back to Selenium only if needed.
3. Maricopa path (Selenium + court table discovery) does **not** transfer.
4. Must discover remaining JC app paths (Verde Valley, Mayer, etc.) — only Prescott path confirmed (`Courtcalendar_PCC`). Others 404 under guessed names.
5. Enrichment options for charges/DUI:
   - Case detail links if present after click-through
   - `https://apps.azcourts.gov/publicaccess/` name/case lookup
   - Ingest all CM/TR calendar rows; classify later

### Recommended Yavapai MVP
1. Source `yavapai_jc_prescott` → `Courtcalendar_PCC` daily
2. Store county=`yavapai`, source=`yavapai_jc_prescott`, court_name=`Prescott Justice Court`
3. Parse grid → upsert by case_number
4. Optional phase-1b: Superior Court calendar + charge enrichment
5. Find other precinct calendar app roots via human browse (site 403 from bots) or AZCourts public access

## Success criteria (full feature, later)
- [ ] Maricopa still green on schedule
- [ ] ≥1 Yavapai source writes cases with county/source set
- [ ] scrape_logs rows for `yavapai_*`
- [ ] `/cases` can filter Maricopa vs Yavapai
- [ ] No secrets committed; Actions secrets unchanged until go-live
