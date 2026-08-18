#!/usr/bin/env python3
"""Yavapai Justice Court calendar scraper — Justice Watch statewide expansion (JWAZ-16).

Source: https://apps.yavapaiaz.gov/Courtcalendar_PCC/ (Prescott JC)
- ASP.NET GridView: Case Number | Session Date | Party Name | Court Room
- No charges on the grid — we ingest all CM/TR rows and classify downstream
  (roadmap Option C; DUI enrichment is a follow-up under JWAZ-16).
- Requires prod migration supabase/migrations/20260818_cases_county_source.sql
  (cases.county + cases.source columns) — JWAZ-14. Without it, writes fail with
  a clear "missing column" error and the run is logged to scrape_logs.

Runs on GitHub Actions weekdays ~9:15 AM MST (yavapai-jc-schedule.yml),
offset 15 min from the Maricopa JC run.
"""

import json
import logging
import sys
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Allow running as `python scrapers/yavapai_jc_scraper.py`
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from adapters.yavapai_jc import YavapaiJcAdapter  # noqa: E402


def run() -> dict:
    stats = {
        "parsed": 0,
        "upserted": 0,
        "errors": 0,
        "blocked_on_migration": False,
    }
    started = datetime.now(timezone.utc)

    adapter = YavapaiJcAdapter()
    all_leads = adapter.run()
    if not all_leads:
        raise RuntimeError("Zero Yavapai rows parsed — page layout likely changed")
    # Criminal calendars only — CV (civil) rows are not DUI leads.
    leads = [
        l for l in all_leads
        if l.case_type in ("Criminal Misdemeanor", "Criminal Traffic", "Criminal")
    ]
    stats["parsed"] = len(leads)

    from supabase_writer import SupabaseWriter
    writer = SupabaseWriter()
    sb = writer.supabase

    now = datetime.now(timezone.utc).isoformat()
    for lead in leads:
        row = lead.to_case_row()
        payload = {
            "case_number": row["case_number"],
            "county": row["county"],
            "source": row["source"],
            "court_name": row["court_name"],
            "case_title": row["case_title"],
            "case_type": row["case_type"] or "Criminal Misdemeanor",
            "status": row["status"] or "Pending",
            "location": row["location"],
            "case_url": row["case_url"],
            "next_hearing": row["next_hearing"],
            "scraped_at": now,
            "updated_at": now,
            "raw_data": json.dumps(row["raw_data"] or {}),
        }
        try:
            sb.table("cases").upsert(payload, on_conflict="case_number").execute()
            stats["upserted"] += 1
        except Exception as e:
            msg = str(e)
            if "county" in msg or "source" in msg or "column" in msg:
                stats["blocked_on_migration"] = True
                logger.error(
                    "cases.county/source missing — apply JWAZ-14 migration "
                    "(supabase/migrations/20260818_cases_county_source.sql): %s", msg,
                )
                break
            stats["errors"] += 1
            logger.error("Upsert failed for %s: %s", payload["case_number"], msg)

        # Party row (defendant from grid) — same table the Maricopa path uses
        if lead.party_name and not stats["blocked_on_migration"]:
            try:
                res = (
                    sb.table("cases")
                    .select("id")
                    .eq("case_number", payload["case_number"])
                    .execute()
                )
                case_id = res.data[0]["id"] if res.data else None
                if case_id:
                    sb.table("case_parties").delete().eq("case_id", case_id).execute()
                    sb.table("case_parties").insert({
                        "case_id": case_id,
                        "party_type": "defendant",
                        "party_name": lead.party_name,
                        "created_at": now,
                    }).execute()
            except Exception as e:
                logger.warning("party write failed for %s: %s", payload["case_number"], e)

    status = (
        "blocked_missing_migration" if stats["blocked_on_migration"]
        else "completed" if stats["errors"] == 0
        else "completed_with_errors"
    )
    try:
        sb.table("scrape_logs").insert({
            "scrape_type": adapter.source_id,
            "status": status,
            "courts_processed": 1,
            "cases_found": stats["upserted"],
            "started_at": started.isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning("scrape_logs insert failed: %s", e)

    logger.info("DONE: %s", stats)
    if stats["blocked_on_migration"]:
        raise SystemExit(2)
    return stats


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
