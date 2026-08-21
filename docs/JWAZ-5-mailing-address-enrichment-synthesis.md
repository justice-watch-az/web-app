# JWAZ-5 — Mailing Address Enrichment (OSINT / Skip-Trace)

**Status:** Design + pilot ready  
**Updated:** 2026-08-19  
**Owner lane:** Romulus (product/eng) · Geraldo (vendor recon) · Frank/Steve (pilot + ethics)  
**Huly:** JWAZ-5 · teamspace Justice Watch · P3 OSINT / warmer leads  

---

## Client problem (liaison, 2026-08-19)

Secretary currently:

1. Takes defendant names from Justice Watch leads  
2. Manually people-searches for addresses  
3. Picks the address she thinks is **closest to that court**  
4. Mails a physical card  

**Ask:** Search feature that runs names and **displays all address candidates** so she stops doing the hunt by hand. Human still chooses and mails.

Reply from liaison side: “That can be real cool.”

---

## Non-negotiable constraints

| Fact | Implication |
|------|-------------|
| AZ court calendars / MCSO wall **do not** expose mailing address or phone | Enrichment is a **separate layer**, not better scraping |
| No commercial vendor accepts **case number → address** | Always name (+ DOB/city) first |
| MVP contact channel = **postal mail only** | No auto-SMS, auto-dial, auto-mail |
| Human-in-the-loop required | Secretary (or Steve office) **must click** chosen address |
| Auto-contact blocked until compliance/ethics agreed | JWAZ-5 design rule unchanged |

Related prior research:

- `/workspace/arizona-dui-lead-generation-research.md` (May 2026)  
- `/workspace/justice-watch-app/docs/research-mailing-address-enrichment-chatgpt-2026-08.txt` (Frank ChatGPT dump, 2026-08-19)  

---

## Synthesis of ChatGPT research (Romulus review)

### Keep

- Pay-per-hit **person** skip-trace APIs for MVP cost structure  
- Candidate list + rank (distance to court, recency, residential vs PO box, vendor confidence)  
- On-demand button first; optional nightly batch later  
- Store vendor, timestamp, confidence, chosen flag  
- Geocode court + addresses for distance  
- Phones/emails: may arrive free with hit — **store, don’t surface as contact actions** in MVP  
- ER 7.3 shape: live solicit restricted; written mail generally in play — **Steve counsel owns final copy/timing**  
- Voter file: **not** for commercial attorney marketing  

### Distrust / verify before buy

| Claim | Romulus note |
|-------|----------------|
| Apify ~$0.0065/match | Community actor; not sole primary |
| 70–98% hit rates | Marketing; only **20-name pilot** is truth |
| “Marketing skip-trace never FCRA” | Oversimplified; vendor-class dependent |
| Tracerfy / DataSkip as primary | Often **property/RE** directionality; need **person-name → address** |
| Ethics detail from LLM | Checklist only until bar counsel |

---

## Recommended architecture

```
Lead (name, court/precinct, case#, charges, attorney empty?)
        │
        ▼
[optional] DOB enrich (booking fields / Public Access when available)
        │
        ▼
Person skip-trace API  →  address_candidates[]
        │
        ▼
Geocode + rank (miles_to_court, recency, residential, confidence)
        │
        ▼
UI: ranked list → human selects → chosen_for_mail
        │
        ▼
Mail remains human process (print / secretary)
```

### Minimal data model

**`enrichment_runs`**

- `id`, `lead_id` (cases or mcso_bookings FK + source), `vendor`, `query_json`, `started_at`, `finished_at`, `status`, `raw_ref` (storage path or blob id)

**`address_candidates`**

- `id`, `run_id`, `line1`, `line2`, `city`, `state`, `postal`, `lat`, `lng`  
- `address_type` (residential | po_box | business | unknown)  
- `first_seen` / `last_seen` if vendor provides  
- `miles_to_court`, `confidence`, `vendor_rank`, `is_most_likely`  
- `raw_json` (optional, truncated)

**Chosen**

- `chosen_candidate_id`, `chosen_by`, `chosen_at` on lead or join table  

Phones/emails: optional sibling table or JSON on run — **MVP UI does not offer Call/SMS.**

---

## MVP scope (ship after pilot vendor pick)

### In

1. **Find addresses** control on case and/or booking detail  
2. One primary person-search API adapter (+ interface for a second)  
3. Ranked candidate list (distance, recency flags, PO box flag)  
4. **Select for mailer** mandatory human action  
5. Optional CSV export of chosen rows for her card workflow  
6. Audit fields: who ran enrich, who chose, when  

### Out (explicit)

- Auto-mail / print integration  
- Auto-SMS / dialer / TCPA stack  
- Bulk silent enrichment of entire historical DB without human workflow  
- Voter-file marketing  
- Scraping Whitepages/Spokeo HTML as primary  
- Case-number-only lookup  
- TLO/Accurint contracts until pilot proves cheap APIs fail  

---

## Vendor strategy

| Role | Guidance |
|------|----------|
| Primary MVP | Person-name REST API, pay-per-hit, address history, AZ coverage |
| Shortlist to validate | Searchbug-class, SkipReach-class, LocatePLUS/Tracers **if** Steve already credentialed; other person APIs Geraldo confirms |
| Backup | Second person API on no-hit / low confidence |
| Deprioritize as primary | Pure property owner APIs unless we already have an address |
| Enterprise later | TLO / Accurint only if pilot quality fails and volume justifies |
| Kill as primary | Whitepages scrape, voter marketing, Apify-only |

**Cost noise:** at ~$0.02–$0.10/hit, 50–500 names/mo is tiny vs secretary time. Optimize **hit quality + ToS**, not pennies.

---

## Pilot gate (required before eng build)

See: `docs/JWAZ-5-20-name-pilot-protocol.md`

- 20 real unrepresented leads from prod  
- 2–3 vendors side-by-side  
- Score sheet → pick primary vendor  
- Then Romulus implements Find addresses  

---

## Compliance checklist (product + office)

| Item | Owner |
|------|--------|
| Mailer copy + timing under ARPC 7.1–7.3 | Steve / bar counsel |
| Vendor ToS + permissible purpose attestation | Frank + Geraldo verify |
| Log case# / lead id with every lookup | Product |
| Opt-out / “do not mail” flag when office gets one | Product (later) |
| No phone/SMS in MVP UI | Product |
| Don’t present relative addresses as defendant home without flag | Product |

---

## Work split

| Who | What |
|-----|------|
| **Geraldo** | Vendor recon: person vs property APIs, live pricing, ToS/FCRA posture, signup barriers, recommend primary+backup for pilot |
| **Romulus** | Spec, Huly, pilot protocol, post-pilot adapter + UI |
| **Frank** | Greenlight pilot accounts, paste any more research, Huly priority |
| **Steve office** | Ethics on mailer; run secretary UX feedback after spike |

---

## Acceptance for “design done”

- [x] Client use-case documented  
- [x] Architecture + MVP in/out  
- [x] Vendor strategy + distrust list  
- [x] Pilot protocol drafted  
- [ ] Geraldo vendor verify complete  
- [ ] 20-name pilot scored  
- [ ] Primary vendor chosen  
- [ ] Implementation issues split from JWAZ-5  

---

## References

- Huly JWAZ-5 — OSINT / enrichment / warmer-lead design  
- Huly Goals backlog — P3 OSINT  
- Roadmap Phase 4 — skip-trace handoff path  
- ChatGPT research dump (2026-08-19)  
- arizona-dui-lead-generation-research.md  

*Romulus — 2026-08-19*  
