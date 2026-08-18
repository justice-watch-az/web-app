#!/usr/bin/env python3
"""Pima Consolidated JC DUI arraignment scraper — Justice Watch Pima expansion.

Source: https://www.jp.pima.gov/NewCalendar2018/ (Consolidated Justice Court)
- County-native DUI filter (Case Type = Criminal DUI) + Criminal Arraignment
  event + empty attorney field = unrepresented DUI leads (Steve's Long-Form
  rule, Pima edition). No charges proxy needed — county labels it directly.
- Requires cases.county/cases.source migration (JWAZ-14). Without it, writes
  fail with a clear blocked error and the run is logged to scrape_logs.

Runs on GitHub Actions weekdays ~9:30 AM MST (pima-jc-schedule.yml).
"""

import json
import logging
import sys
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from adapters.pima_jc import PimaJcAdapter  # noqa: E402


def run() -> dict:
    stats = {"grid_rows": 0, "leads": 0, "upserted": 0, "errors": 0,
             "blocked_on_migration": False}
    started = datetime.now(timezone.utc)

    # Scrape a full week forward (today..+6d), matching the Maricopa convention
    # of populating the whole week's arraignment docket. Daily runs upsert the
    # same case_numbers and pick up schedule changes.
    today = datetime.now()  # runner is UTC; AZ = UTC-7, calendar dates local
    cfg = {
        "start_date": today.strftime("%-m/%-d/%Y"),
        "end_date": (today + timedelta(days=6)).strftime("%-m/%-d/%Y"),
    }
    adapter = PimaJcAdapter()
    leads = adapter.run(cfg)
    stats["leads"] = len(leads)

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
            "case_type": row["case_type"],
            "status": row["status"],
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
            logger.info("Pima lead: %s %s — %s", payload["case_number"],
                        lead.party_name, lead.next_hearing)
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

        if lead.party_name and not stats["blocked_on_migration"]:
            try:
                res = (sb.table("cases").select("id")
                       .eq("case_number", payload["case_number"]).execute())
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

    status = ("blocked_missing_migration" if stats["blocked_on_migration"]
              else "completed" if stats["errors"] == 0
              else "completed_with_errors")
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
