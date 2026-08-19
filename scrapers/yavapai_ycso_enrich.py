#!/usr/bin/env python3
"""YCSO roster → AZ Public Access enrichment bridge (JWAZ-16 follow-up).

For each unclassified ycso_bookings row (is_dui IS NULL, seen in the last
14 days), name-search AZ Public Access, match cases at Yavapai County courts
by exact defendant name, follow to the detail page, and classify DUI from
charges. Writes verdicts back to ycso_bookings.is_dui and caches per-case in
charge_enrichment. Nothing unclassified ever becomes publicly readable
(RLS only exposes is_dui = true rows).

AZPA data lags real time, so rows that aren't found simply stay NULL and get
retried on the next run. Cost: 1 captcha solve per ~2 searches, capped by
MAX_LOOKUPS (default 60 names/run).

Requires: TWOCAPTCHA_API_KEY. Weekdays 9:45 AM MST (yavapai-ycso-enrich.yml).
"""

import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Yavapai County court IDs in the AZPA dropdown (discovered 2026-08-19)
YAVAPAI_COURTS = {
    "174": "Prescott Justice", "183": "Prescott Municipal",
    "19": "Prescott Valley Municipal", "13": "Camp Verde Municipal",
    "22": "Verde Valley Justice", "18": "Mayer Justice",
    "10": "Bagdad Justice", "21": "Seligman Justice",
}
YAVAPAI_COURT_NAMES = {v.lower() for v in YAVAPAI_COURTS.values()}
MAX_LOOKUPS = int(os.environ.get("MAX_LOOKUPS", "60"))
STALE_DAYS = 14


def _norm_name(n: str) -> str:
    return re.sub(r"[^a-z]", "", (n or "").lower())


def run() -> dict:
    stats = {"candidates": 0, "looked_up": 0, "dui": 0, "not_dui": 0,
             "not_found": 0, "errors": 0}
    started = datetime.now(timezone.utc)

    from supabase_writer import SupabaseWriter
    sb = SupabaseWriter().supabase

    cutoff = (datetime.now(timezone.utc) - timedelta(days=STALE_DAYS)).isoformat()
    res = (
        sb.table("ycso_bookings")
        .select("id,inmate_number,full_name,last_name,first_name")
        .is_("is_dui", "null")
        .gte("first_seen_at", cutoff)
        .order("first_seen_at")
        .limit(MAX_LOOKUPS)
        .execute()
    )
    candidates = res.data or []
    stats["candidates"] = len(candidates)
    if not candidates:
        logger.info("No unclassified roster rows to enrich")
        return stats

    from enrichment.az_public_access import AZPublicAccessClient
    from bs4 import BeautifulSoup

    client = AZPublicAccessClient()  # raises SolverUnavailable w/o key
    now = datetime.now(timezone.utc).isoformat()

    for person in candidates:
        lname, fname = person.get("last_name") or "", person.get("first_name") or ""
        if not lname:
            continue
        stats["looked_up"] += 1
        verdict = None  # True/False once we have evidence
        try:
            grid = client._search_by_name(f"{lname}, {fname}")
            if grid:
                soup = BeautifulSoup(grid, "html.parser")
                # Collect Yavapai-court case links from the grid
                links = []
                for a in soup.find_all("a"):
                    href = a.get("href", "")
                    if "lbCaseNum" not in href:
                        continue
                    row_text = a.find_parent("tr").get_text(" ", strip=True) if a.find_parent("tr") else ""
                    if any(c in row_text.lower() for c in YAVAPAI_COURT_NAMES):
                        m = client.RESULT_LINK_RE.search(href)
                        if m:
                            links.append((a.get_text(strip=True), m.group(1), row_text))
                for case_label, target, _row in links[:3]:
                    data = {}
                    for inp in soup.find_all("input"):
                        if (inp.get("name") or "").startswith("__"):
                            data[inp["name"]] = inp.get("value", "")
                    data["__EVENTTARGET"] = target
                    data["__EVENTARGUMENT"] = ""
                    r = client.session.post(client.__init__.__globals__["LOOKUP_URL"], data=data, timeout=30)
                    from enrichment.az_public_access import CaseCharges
                    info = CaseCharges(case_number=case_label)
                    client._parse_result(r.text, info)
                    # Defendant-name guard against same-name false positives
                    page_norm = _norm_name(BeautifulSoup(r.text, "html.parser").get_text(" "))
                    if _norm_name(lname) not in page_norm or (fname and _norm_name(fname.split()[0]) not in page_norm):
                        logger.info("skip %s: defendant name mismatch on detail page", case_label)
                        continue
                    logger.info("enriched %s (%s %s): found=%s dui=%s charges=%d",
                                case_label, lname, fname, info.found, info.is_dui, len(info.charges))
                    try:
                        sb.table("charge_enrichment").upsert({
                            "case_number": case_label, "county": "yavapai",
                            "source": "ycso_booking", "found": info.found,
                            "is_dui": info.is_dui, "charges": json.dumps(info.charges),
                            "enriched_at": now,
                        }, on_conflict="case_number").execute()
                    except Exception as e:
                        logger.warning("cache write failed %s: %s", case_label, e)
                    if info.is_dui:
                        verdict = True
                        break
                    if info.found:
                        # Only a RECENT case counts as evidence against DUI —
                        # an old non-DUI case doesn't prove the new booking
                        # isn't DUI (AZPA lags; the new case may not be indexed
                        # yet). Old-only evidence => stay NULL, retry next run.
                        yr = re.search(r"-((?:19|20)\d{2})-", case_label)
                        if yr and int(yr.group(1)) >= 2025:
                            verdict = False
        except Exception as e:
            stats["errors"] += 1
            logger.error("lookup failed for %s %s: %s", lname, fname, e)
            continue

        if verdict is None:
            stats["not_found"] += 1
            continue  # stays NULL — retried next run
        try:
            sb.table("ycso_bookings").update({"is_dui": verdict}).eq("id", person["id"]).execute()
            stats["dui" if verdict else "not_dui"] += 1
        except Exception as e:
            stats["errors"] += 1
            logger.error("verdict write failed for %s: %s", person["inmate_number"], e)

    try:
        sb.table("scrape_logs").insert({
            "scrape_type": "ycso_enrich",
            "status": "completed" if stats["errors"] == 0 else "completed_with_errors",
            "courts_processed": 1,
            "cases_found": stats["dui"],
            "started_at": started.isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning("scrape_logs insert failed: %s", e)

    logger.info("DONE: %s", stats)
    return stats


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
