#!/usr/bin/env python3
"""YCSO inmate roster scraper — Yavapai county-wide booking lead source.

Source: https://apps.yavapaiaz.gov/InmateSearch/ (official YCSO roster)
- No captcha, datacenter-reachable, updated daily ("accurate as of" stamp).
- Name-search only, so we sweep last-name letters a-z and dedupe by
  (inmate_number, booking_date) — the roster is current-inmates only, so
  book-and-release DUIs rotate off fast: 2h polling catches them.
- Roster exposes NO charges. Rows are written with is_dui = NULL
  (unclassified). DUI confirmation is a separate enrichment pass
  (charge_enrichment / AZ Public Access). Per Frank's DUI-only rule,
  unclassified rows must NOT surface in the public UI.

Requires supabase/migrations/20260819_ycso_bookings.sql (Frank runs).
Runs on GitHub Actions every 2 hours (yavapai-ycso-booking-schedule.yml),
offset from the MCSO wall run.
"""

import json
import logging
import os
import re
import string
import sys
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SEARCH_URL = "https://apps.yavapaiaz.gov/InmateSearch/InmateSearchYC.asp"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
SOURCE_ID = "ycso_booking"

INMATE_NO_RE = re.compile(r"^\d{5,7}$")


def _parse_results(html: str) -> list:
    """Result rows: [Inmate No, Booking Date, Location, 'LAST, FIRST M']."""
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for tr in soup.find_all("tr"):
        tds = [
            td.get_text(strip=True).replace("\xa0", " ").strip()
            for td in tr.find_all("td")
        ]
        tds = [t for t in tds if t]
        if len(tds) < 4 or not INMATE_NO_RE.match(tds[0]):
            continue
        try:
            booking_dt = datetime.strptime(tds[1], "%m/%d/%Y %I:%M:%S %p")
        except ValueError:
            continue
        name = tds[3]
        last, _, first = name.partition(",")
        out.append({
            "inmate_number": tds[0],
            "booking_date": booking_dt.isoformat(),
            "full_name": name,
            "last_name": last.strip().title(),
            "first_name": first.strip().title(),
            "housing_location": tds[2],
        })
    return out


def fetch_roster() -> list:
    """Sweep the alphabet; the roster is name-search-only. Dedupe by
    (inmate_number, booking_date)."""
    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    found = {}
    for letter in string.ascii_lowercase:
        try:
            r = session.post(
                SEARCH_URL,
                data={"txtLastName": letter, "submit": "Search"},
                timeout=30,
            )
            r.raise_for_status()
        except Exception as e:
            logger.warning("letter %s fetch failed: %s", letter, e)
            continue
        for rec in _parse_results(r.text):
            found.setdefault((rec["inmate_number"], rec["booking_date"]), rec)
        time.sleep(0.4)  # polite crawl
    return list(found.values())


def run() -> dict:
    stats = {"roster_rows": 0, "new_bookings": 0, "errors": 0, "blocked_on_migration": False}
    started = datetime.now(timezone.utc)

    roster = fetch_roster()
    stats["roster_rows"] = len(roster)
    if not roster:
        raise RuntimeError("Zero YCSO roster rows parsed — page layout likely changed")
    logger.info("YCSO roster: %d current inmates", len(roster))

    from supabase_writer import SupabaseWriter
    sb = SupabaseWriter().supabase

    now = datetime.now(timezone.utc).isoformat()
    for rec in roster:
        try:
            res = (
                sb.table("ycso_bookings")
                .upsert(
                    {**rec, "source": SOURCE_ID},
                    on_conflict="inmate_number,booking_date",
                    ignore_duplicates=True,  # existing row = already seen; keep first_seen_at
                )
                .execute()
            )
            if res.data:
                stats["new_bookings"] += 1
        except Exception as e:
            msg = str(e)
            if "ycso_bookings" in msg or "PGRST205" in msg or "schema cache" in msg:
                stats["blocked_on_migration"] = True
                logger.error(
                    "ycso_bookings table missing — apply "
                    "supabase/migrations/20260819_ycso_bookings.sql: %s", msg,
                )
                break
            stats["errors"] += 1
            logger.error("upsert failed %s: %s", rec["inmate_number"], msg)

    status = (
        "blocked_missing_migration" if stats["blocked_on_migration"]
        else "completed" if stats["errors"] == 0
        else "completed_with_errors"
    )
    try:
        sb.table("scrape_logs").insert({
            "scrape_type": SOURCE_ID,
            "status": status,
            "courts_processed": 1,
            "cases_found": stats["new_bookings"],
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
