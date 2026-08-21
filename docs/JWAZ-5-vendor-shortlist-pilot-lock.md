# JWAZ-5 — Vendor shortlist (Geraldo) + Romulus pilot lock

**Source task:** research `t_99dbf3ac` (geraldov21) — done 2026-08-19  
**Full memo path (host, may be outside Romulus docker):**  
`/home/ice/.hermes/kanban/boards/research/workspaces/t_99dbf3ac/JWAZ-5-skip-trace-vendor-memo.md`  
**This file:** durable workspace copy of decisions + caveats (Romulus could not mount scratch memo from container).

---

## Geraldo pilot recommendation (from completion handoff)

| Slot | Vendor | Why (Geraldo) | Est. cost (Geraldo) |
|------|--------|---------------|---------------------|
| **A Primary** | **Searchbug** People Trace / people APIs | Name-first person search; ToS language around locate individual + legal proceeding support | ~**$5.50/hit** (see Romulus caveat) |
| **B Backup** | **DataSkip** | 4¢/match, misses free, bulk API, non-CRA | ~**$0.80 / 20** matches |
| **C Optional** | **Tracerfy** ($0.02/credit) or **SkipReach** ($0.05/success) | Cheap volume | Low |

**Explicit kills (Geraldo):** voter file marketing, Whitepages scrape as primary, pure property-only tools as primary.

---

## Romulus caveats (read before opening wallets)

### 1. Searchbug price — verify at signup
Live public pages (2026-08 search) show Searchbug people tiers roughly:

| Product / tier | Published ballpark |
|----------------|--------------------|
| api_nape (lighter) | from ~$0.15/hit (volume lower) |
| api_contact | from ~$0.50/hit |
| api_ppl (premium people / skip-ish) | from ~**$0.79**/hit volume down to ~$0.33 |
| “People Trace” legacy list | ~**$1.97**/query on price list page |
| ChatGPT earlier dump | ~$0.30–$0.77 |

**Geraldo’s ~$5.50/hit is an outlier** vs public rate cards — could be a restricted/enhanced product, prepaid bundle, or memo error.  
**Action at signup:** confirm **which API code** (api_ppl vs People Trace vs other) and **prepaid hit cost** before loading big balance. Start with **$10–$25** test credit.

Searchbug links:
- https://www.searchbug.com/api/
- https://www.searchbug.com/pricing-api.aspx
- People-oriented API landing: https://www.searchbug.com/info/people-search-api-landing-page/

**Still correct about Searchbug:** genuine **person-name** directionality → good primary *class*.

### 2. DataSkip — likely wrong directionality for our inputs
DataSkip public docs emphasize: **property address → owner name + mailing/phones** (RE skip), not **person name → address**.

Our pilot inputs are **defendant names from court** (no home address yet).  
**Do not use DataSkip as primary person search.**  
As backup only if: we already have a candidate property address to reverse, or their API has a separate person endpoint Geraldo’s full memo proves (Romulus could not re-read full memo from docker).

Until person-mode is confirmed on DataSkip:
- Treat **B as provisional**
- Prefer **SkipReach** or another **name-first** API as true B if DataSkip is address-in only

### 3. Tracerfy / SkipReach (C)
Same RE bias risk as other cheap skip brands — OK for optional cost probe **only if** person-name endpoint exists. Otherwise skip C and run **two Searchbug tiers** (e.g. api_contact vs api_ppl) as A/B quality test.

---

## Romulus recommended pilot matrix (adjusted)

| Slot | Vendor / product | Role | Signup |
|------|------------------|------|--------|
| **A** | Searchbug **api_ppl** or People Trace (confirm name) | Quality / person-first primary | https://www.searchbug.com — API test account; load small prepaid |
| **B** | Searchbug **api_contact** *or* confirmed name-first alt (SkipReach if person API) | Cheaper person tier / second opinion | Same account different endpoint, or second vendor |
| **C** | DataSkip **only if** person lookup confirmed; else drop | Cost probe | https://app.dataskip.io/signup |

**Pilot cost cap still $25 total** unless Frank raises it.

If Searchbug alone: run **same 20 names on two Searchbug SKUs** — still a valid A/B for quality vs price.

---

## Account steps for Frank (same day)

### Searchbug
1. Open https://www.searchbug.com → API / developer signup  
2. Request API access / test credit (pages advertise free test credit historically)  
3. In dashboard note: account type, FCRA restricted add-on **off** unless Steve needs it  
4. Permissible purpose wording if asked: *locate mailing address for postal contact related to public court matter / law office administration* — **Steve should confirm language**  
5. Create API key; store in **project** secret place (not Discord)  
6. Tell Romulus: which SKU + $/hit shown in account  

### DataSkip (optional / only if person mode)
1. https://app.dataskip.io/signup  
2. Get API key  
3. Read developers docs: confirm whether request accepts **name** or **only street address**  
4. If address-only → **disqualify for pilot B**

### SkipReach (optional true-B)
1. https://skipreach.com/  
2. Confirm person skip API + ToS for attorney mail locate  
3. $0.05/success class pricing per earlier research  

---

## Open questions (Frank / Steve)

1. Will Steve’s firm be the **contracting party** on Searchbug (preferred) or TriCon?  
2. Any existing PI / TLO / Accurint seat we should use instead?  
3. OK to spend ≤$25 on 20×2 lookups?  
4. Permissible-purpose checkbox text Steve wants on file  
5. After accounts: Romulus exports 20 leads + runs protocol, or secretary runs web UI?

---

## Next steps (ordered)

1. **Frank:** open Searchbug (required); optional second person API  
2. **Romulus:** export 20-lead pilot CSV (local/PII-safe) when keys ready  
3. **Run** `docs/JWAZ-5-20-name-pilot-protocol.md` score sheet  
4. **Lock** primary vendor → eng spike Find addresses  
5. **Huly:** Julio already has JWAZ-5 bump task `t_3631f1c9`; comment vendor lock after pilot  

---

## Explicit kills (unchanged)

| Kill | Why |
|------|-----|
| AZ voter file for mail campaign | Purpose-restricted |
| Whitepages/Spokeo scrape primary | Fragile, ToS, quality |
| Property-only APIs as primary | We don’t have defendant address yet |
| Apify community sole primary | Stability/ToS |
| Auto-SMS/dial in MVP | Compliance separate track |

---

*Romulus 2026-08-19 — post–Geraldo t_99dbf3ac*  
