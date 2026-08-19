# JWAZ-5 — 20-Name Pilot Protocol  
## Person skip-trace → mailing address candidates

**Purpose:** Pick a **primary** (and backup) person-search vendor with real AZ DUI-lead names before any eng build.  
**Status:** Ready to run  
**Updated:** 2026-08-19  
**Owner:** Frank (accounts + run or delegate) · Romulus (score rollup + product decision) · Geraldo (vendor shortlist verify) · Steve office (optional “would we mail this?” sanity)  

**Do not start product UI until this pilot is scored.**

---

## 0. Success criteria

Pilot **passes** when we can answer:

1. Which vendor has the best **usable mailing address** rate on our actual leads?  
2. How often is there a **clear single best** address vs messy multi-hit?  
3. Does **court-proximity ranking** match secretary intuition often enough?  
4. Are ToS / signup barriers acceptable for a law-office mailer use case?  
5. Primary + backup vendor chosen with $ estimate at 50 / 150 / 500 lookups/mo  

**Fail / extend** if both cheap person APIs produce &lt;50% usable addresses or high wrong-person risk — then evaluate LocatePLUS/Tracers/TLO with credentials.

---

## 1. Prerequisites

| Item | Who | Done? |
|------|-----|-------|
| Geraldo vendor shortlist (person-name APIs only) | Geraldo | ☐ |
| 2–3 trial accounts / API keys (or web credits) | Frank | ☐ |
| Export of 20 pilot leads (see §2) | Romulus or Frank | ☐ |
| Court lat/lng table for precincts in sample | Romulus (can geocode once) | ☐ |
| Score sheet (copy of §5) filled per vendor | Runner | ☐ |
| Steve aware this is research only (no mass mail from pilot) | Frank | ☐ |

---

## 2. Sample construction (n = 20)

### Source
Pull from **prod** Justice Watch (prefer recent):

- Prefer **unrepresented** signals when available (e.g. Pima empty attorney; Maricopa long-form leads Steve would actually card)  
- Mix: ~12–15 **Maricopa JC** cases + ~3–5 **MCSO bookings** + ~2 **Pima** if available  
- **No** rows that already have counsel if the office would skip them  

### Required fields per lead

| Field | Required |
|-------|----------|
| `pilot_id` | P01–P20 |
| `source` | maricopa_jc / mcso_booking / pima_jc |
| `full_name` | as in DB |
| `case_or_booking_id` | case # or booking # |
| `court_or_agency` | precinct name or MCSO |
| `court_city` / best geo anchor | for distance rank |
| `hearing_or_booking_date` | |
| `dob` | if known; else blank |
| `middle_initial` | if known |
| `notes` | e.g. common name risk |

### Export format
CSV: `docs/pilots/jwaz5-address-pilot-leads.csv` (gitignored if contains PII — **prefer local only, do not commit real names to public forks**).

**PII rule:** Real defendant names stay off public GitHub. Keep CSV under `/workspace/justice-watch-app/docs/pilots/` and ensure `docs/pilots/` is gitignored, or store only outside repo.

### Diversity targets (soft)

- ≥5 names that look high-collision (common first+last)  
- ≥5 with middle initial or DOB available  
- Geographic spread across ≥3 Maricopa precinct areas if possible  

---

## 3. Vendors under test

**Locked 2026-08-19** after Geraldo `t_99dbf3ac` + Romulus review.  
Details: `docs/JWAZ-5-vendor-shortlist-pilot-lock.md`

| Slot | Vendor | Person-name→address API? | Account ready | Notes |
|------|--------|---------------------------|---------------|-------|
| A | **Searchbug** api_ppl or People Trace (confirm SKU at signup) | ✅ name-first | ☐ | Primary quality. Verify $/hit in dashboard (public ~$0.79–$1.97; Geraldo noted ~$5.50 — reconcile). |
| B | **Searchbug** api_contact **or** other confirmed name-first (SkipReach) | ✅ | ☐ | Price/quality contrast. |
| C | **DataSkip** only if person-name mode confirmed | ⚠️ often address→owner | ☐ | Disqualify if API is property-only. |

**Exclude as primary for this pilot:**

- Pure property “address → owner” tools used backwards (DataSkip default mode)  
- Apify community actors as sole source  
- Voter file  

**Query template (same for every vendor):**

1. Full name + state=AZ + court_city (or Maricopa/Pima/Yavapai)  
2. If no good hit: retry with DOB/birth year if present  
3. If still weak: retry with middle initial  
4. Do **not** pass case number as if vendor supports it  

Record exact query variants used.

---

## 4. Run procedure (per vendor)

For each lead P01–P20:

1. Run lookup with standard query  
2. Capture **raw** response (JSON/PDF/screenshot) into  
   `docs/pilots/raw/{vendor}/{pilot_id}/`  
3. List up to **5** address candidates (current + recent history)  
4. Classify each address:
   - `residential` | `po_box` | `business` | `unknown`  
5. Geocode candidates + court anchor → `miles_to_court`  
6. Mark vendor’s “best” if they expose confidence / mostLikely  
7. Runner picks **blind best mail target** using only: recency + residential + distance (before talking to secretary)  
8. Optional second pass: Steve/secretary “would you mail this?” (Y/N/Unsure) on the top-1 only  

**Timebox:** ~2–4 hours total for 20 × 2 vendors if APIs are smooth; web-only UIs take longer.

**Cost cap:** stop if any vendor would exceed **$25** for the full 20 without Frank OK.

---

## 5. Score sheet (per lead × vendor)

Copy one row per lead into a spreadsheet.

| Column | Values |
|--------|--------|
| pilot_id | P01… |
| vendor | |
| hit_any | Y/N — any person record returned |
| hit_address | Y/N — ≥1 US mailing address |
| usable_mail | Y/N — residential or plausible home mail (not obvious junk) |
| n_candidates | int |
| clear_single_best | Y/N — one address obviously correct without heavy judgment |
| top1_miles_to_court | float or NA |
| top1_type | residential/po_box/… |
| wrong_person_risk | low/med/high — common name, conflicting cities, etc. |
| dob_helped | Y/N/NA |
| query_variant | standard / +dob / +mi |
| latency_s | optional |
| cost_usd | optional |
| secretary_would_mail | Y/N/U/skip — optional |
| notes | free text |

### Aggregate metrics (per vendor)

| Metric | Formula |
|--------|---------|
| Address hit rate | usable_mail / 20 |
| Clear-best rate | clear_single_best / 20 |
| High wrong-person share | count(risk=high) / 20 |
| Median miles (usable only) | median top1_miles_to_court |
| Est. $/mo @ 150 lookups | 150 × avg cost |

---

## 6. Decision rubric

| Outcome | Action |
|---------|--------|
| Vendor A usable ≥70% and clear-best ≥40%, low high-risk share | **Primary = A**; implement MVP |
| Two vendors close | Primary = better ToS/API ergonomics; other = backup re-query |
| All usable &lt;50% | Escalate to credentialed investigative DB; delay UI |
| Great phones, weak addresses | Still fail MVP (mailer needs addresses); note phones for later |
| ToS forbids marketing/locate for attorney ads | Disqualify even if quality high |

**MVP go** requires: primary chosen + ToS OK for “locate mailing address for attorney postal mail related to public court matter” (wording per vendor counsel/ToS) + sample raw payloads saved for adapter design.

---

## 7. Deliverables after pilot

1. Filled score workbook: `docs/pilots/jwaz5-address-pilot-scores.xlsx` (or csv)  
2. One-page decision note: primary, backup, no-gos, $ model  
3. Comment on **JWAZ-5** + link artifacts  
4. If go: Romulus opens implementation children (adapter, schema, UI)  
5. If no-go: document blocker and next vendor class  

---

## 8. Ethics / safety during pilot

- Pilot lookups are **research**; do **not** mail cards from pilot picks without Steve’s normal process  
- Minimize copies of PII; delete trial CSVs from chat uploads when done  
- Do not blast bulk historical DB “for fun”  
- Log that purpose is office mailer workflow evaluation  

---

## 9. Romulus handoff after GO

Implementation order:

1. Schema: `enrichment_runs` + `address_candidates`  
2. Adapter interface + primary vendor  
3. Geocode + rank helper (court anchor table)  
4. UI **Find addresses** + **Select for mailer**  
5. Optional CSV export  
6. Version bump when shipped  

See: `docs/JWAZ-5-mailing-address-enrichment-synthesis.md`

---

## 10. Checklist (run day)

- [ ] Shortlist locked (Geraldo)  
- [ ] Accounts live  
- [ ] 20 leads exported (PII-safe storage)  
- [ ] Vendor A scored  
- [ ] Vendor B scored  
- [ ] Aggregates computed  
- [ ] Decision note written  
- [ ] JWAZ-5 updated  
- [ ] Frank/Steve sign primary vendor  

---

*Protocol v1 — Romulus 2026-08-19*  
