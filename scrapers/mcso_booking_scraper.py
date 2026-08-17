#!/usr/bin/env python3
"""
MCSO Booking (Mugshot Wall) scraper — Justice Watch dual-source expansion.

Source: https://www.mcso.org/Mugshot
- Latest ~100 IN-CUSTODY bookings, server-rendered HTML, mugshots inline base64
- No auth, no session, no JS execution needed — plain GET + parse
  (NOTE: the CLAUDE.md "never construct URLs / always click" rule applies to the
  justicecourts.maricopa.gov SESSION site, NOT to this page — probed 2026-08-16.)
- Wall is hard-capped at 100 entries; booking numbers are sequential (G-series),
  so we keep a high-water mark in scrape_state and only insert new bookings.
- Detail endpoint (/InmateInfo/SearchByBookingNumber) is server-side dead as of
  2026-08-16 (returns "not currently in custody" even from their own UI). MVP
  intentionally does NOT call it. Re-test later for bond/booking-time fields.

Runs on GitHub Actions every 2h (see .github/workflows/mcso-booking-schedule.yml).
"""

import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MUGSHOT_URL = "https://www.mcso.org/Mugshot"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

# DUI / felony-DUI charge filter — vocabulary proven against live wall data
# (DUI-LIQUOR/DRUGS/VAPORS/COMBO, DUI W/BAC OF .08 OR MORE, EXTREME DUI-BAC .15-.20,
#  EXTREME DUI-BAC > .20, AGG DUI-PASSENGER UNDER 15, AGG DUI-LIC SUSP/REV FOR DUI,
#  DUI/DRUGS/METABOLITE)
DUI_PATTERN = re.compile(r"\bDUI\b|AGG\s+DUI|EXTREME\s+DUI|DUI-", re.IGNORECASE)

# Booking number: G + 6 digits (G275257). Sequential => high-water mark works.
BOOKING_PATTERN = re.compile(r"\bG\d{6}\b")

STATE_KEY = "mcso_max_booking_num"  # in scrape_state table


def booking_seq(booking_number: str) -> int:
    """G275257 -> 275257 (int compare for watermark)."""
    digits = re.sub(r"\D", "", booking_number or "")
    return int(digits) if digits else 0


class McsoBookingScraper:
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.stats = {
            "wall_rows": 0,
            "dui_hits": 0,
            "new_inserted": 0,
            "already_seen": 0,
            "errors": 0,
        }

    # ---------- fetch ----------

    def fetch_wall(self) -> str:
        logger.info("GET %s", MUGSHOT_URL)
        r = self.session.get(MUGSHOT_URL, timeout=60)
        r.raise_for_status()
        if len(r.text) < 100_000:
            raise RuntimeError(f"Wall page suspiciously small ({len(r.text)} bytes) — layout change?")
        return r.text

    # ---------- parse ----------

    def parse_wall(self, html: str) -> List[Dict[str, Any]]:
        """Extract booking rows from the wall table."""
        soup = BeautifulSoup(html, "html.parser")  # stdlib parser — zero deps (runner lacks lxml)
        rows: List[Dict[str, Any]] = []

        for tr in soup.find_all("tr"):
            cells = tr.find_all("td")
            if len(cells) < 6:
                continue
            booking = cells[1].get_text(strip=True)
            if not BOOKING_PATTERN.fullmatch(booking):
                continue

            # mugshot: inline base64 png in first cell's <img>
            mugshot_b64 = None
            img = cells[0].find("img")
            if img and img.get("src", "").startswith("data:image/png;base64,"):
                mugshot_b64 = img["src"].split(",", 1)[1]

            charges_raw = cells[4].get_text(" ", strip=True)
            charges = [c.strip() for c in re.split(r"\s{2,}|\n", charges_raw) if c.strip()]
            if not charges:
                charges = [charges_raw] if charges_raw else []

            rows.append({
                "booking_number": booking,
                "booking_seq": booking_seq(booking),
                "first_name": cells[2].get_text(strip=True),
                "last_name": cells[3].get_text(strip=True),
                "charges": charges,
                "charges_raw": charges_raw,
                "arresting_agency": cells[5].get_text(strip=True),
                "mugshot_b64": mugshot_b64,
                "is_dui": bool(DUI_PATTERN.search(charges_raw)),
            })

        self.stats["wall_rows"] = len(rows)
        logger.info("Parsed %d booking rows from wall", len(rows))
        return rows

    # ---------- store ----------

    def save(self, rows: List[Dict[str, Any]], dui_only: bool = True) -> None:
        from supabase_writer import SupabaseWriter  # shared connection pattern

        writer = SupabaseWriter()
        sb = writer.supabase

        # high-water mark
        max_seen = 0
        try:
            res = sb.table("scrape_state").select("value").eq("key", STATE_KEY).execute()
            if res.data:
                max_seen = int(res.data[0]["value"])
        except Exception as e:
            logger.warning("scrape_state read failed (%s) — treating as first run", e)

        max_this_run = max_seen
        for row in rows:
            if row["booking_seq"] <= max_seen:
                self.stats["already_seen"] += 1
                continue
            max_this_run = max(max_this_run, row["booking_seq"])
            if dui_only and not row["is_dui"]:
                continue

            record = {
                "booking_number": row["booking_number"],
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "charges": row["charges"],
                "charges_raw": row["charges_raw"],
                "arresting_agency": row["arresting_agency"],
                "is_dui": row["is_dui"],
                "mugshot_b64": row["mugshot_b64"],  # ~60-100KB per DUI hit; revisit if storage grows
                "source": "mcso_booking",
                "first_seen_at": datetime.now(timezone.utc).isoformat(),
            }
            try:
                sb.table("mcso_bookings").upsert(record, on_conflict="booking_number").execute()
                self.stats["new_inserted"] += 1
                if row["is_dui"]:
                    self.stats["dui_hits"] += 1
                    logger.info("DUI lead: %s %s %s — %s",
                                row["booking_number"], row["first_name"],
                                row["last_name"], row["charges_raw"][:80])
            except Exception as e:
                self.stats["errors"] += 1
                logger.error("Insert failed for %s: %s", row["booking_number"], e)

        # advance watermark
        if max_this_run > max_seen:
            try:
                sb.table("scrape_state").upsert(
                    {"key": STATE_KEY, "value": str(max_this_run)}, on_conflict="key"
                ).execute()
            except Exception as e:
                logger.error("Failed to advance watermark: %s", e)

        # scrape log (same observability table as JC scraper)
        try:
            sb.table("scrape_logs").insert({
                "scrape_type": "mcso_booking",
                "status": "completed" if self.stats["errors"] == 0 else "completed_with_errors",
                "courts_processed": 1,
                "cases_found": self.stats["new_inserted"],
                "started_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.warning("scrape_logs insert failed: %s", e)

    # ---------- main ----------

    def run(self, dui_only: bool = True) -> Dict[str, Any]:
        html = self.fetch_wall()
        rows = self.parse_wall(html)
        if not rows:
            raise RuntimeError("Zero booking rows parsed — layout likely changed")
        self.save(rows, dui_only=dui_only)
        logger.info("DONE: %s", self.stats)
        return self.stats


if __name__ == "__main__":
    cfg = {}
    if len(sys.argv) > 1:
        cfg = json.loads(sys.argv[1])
    scraper = McsoBookingScraper(cfg)
    stats = scraper.run(dui_only=cfg.get("dui_only", True))
    print(json.dumps(stats, indent=2))
