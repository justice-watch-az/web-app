#!/usr/bin/env python3
"""
Yavapai County Justice Court calendar adapter (skeleton).

Spike 2026-08-18:
  - Prescott JC online calendar is live at:
      https://apps.yavapaiaz.gov/Courtcalendar_PCC/
  - ASP.NET WebForms GridView columns:
      Case Number | Session Date | Party Name | Court Room
  - Example case #: J1303CM2026000153, J1303TR2026000250
  - courts.yavapaiaz.gov returns 403 from datacenter egress — avoid as entrypoint
  - Other precinct app paths not yet discovered (guessed URLs 404)

This module is intentionally NOT wired to Actions yet.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

try:
    from .base import CaseLead
except ImportError:  # allow `python scrapers/adapters/yavapai_jc.py`
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from adapters.base import CaseLead

logger = logging.getLogger(__name__)

PRESCOTT_CALENDAR_URL = "https://apps.yavapaiaz.gov/Courtcalendar_PCC/"
CASE_NUMBER_RE = re.compile(r"\bJ\d{4}(?:CM|TR|CR|CV)\d{8,}\b", re.I)

# Session date formats observed: "8/17/2026 8:00 AM"
SESSION_RE = re.compile(
    r"(?P<date>\d{1,2}/\d{1,2}/\d{4})\s+(?P<time>\d{1,2}:\d{2}\s*[AP]M)",
    re.I,
)


class YavapaiJcAdapter:
    """Prescott-first Yavapai JC calendar reader."""

    source_id = "yavapai_jc_prescott"
    county = "yavapai"
    court_name = "Prescott Justice Court"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
                )
            }
        )
        self.entrypoint = self.config.get("entrypoint") or PRESCOTT_CALENDAR_URL

    def run(self, config: Optional[Dict[str, Any]] = None) -> List[CaseLead]:
        cfg = {**self.config, **(config or {})}
        url = cfg.get("entrypoint") or self.entrypoint
        html = self.fetch_calendar_html(url)
        return self.parse_grid(html, source_id=cfg.get("source_id") or self.source_id)

    def fetch_calendar_html(self, url: str) -> str:
        logger.info("GET %s", url)
        r = self.session.get(url, timeout=60)
        r.raise_for_status()
        if "CourtGridView" not in r.text and "Case Number" not in r.text:
            raise RuntimeError(
                f"Yavapai calendar page missing expected grid markers ({len(r.text)} bytes)"
            )
        return r.text

    def parse_grid(self, html: str, source_id: str) -> List[CaseLead]:
        """Parse ASP.NET GridView table into CaseLead rows."""
        soup = BeautifulSoup(html, "html.parser")
        table = None
        for t in soup.find_all("table"):
            header = t.get_text(" ", strip=True).lower()
            if "case number" in header and "party name" in header:
                table = t
                break
        if table is None:
            # Fallback: regex over full page
            return self._parse_regex_fallback(html, source_id)

        leads: List[CaseLead] = []
        for tr in table.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all("td")]
            if len(cells) < 3:
                continue
            case_number = cells[0].strip()
            # Cell 0 must be exactly a case number (skip header / mashed rows)
            if not CASE_NUMBER_RE.fullmatch(case_number):
                continue
            session_raw = cells[1].strip() if len(cells) > 1 else ""
            party = cells[2].strip() if len(cells) > 2 else ""
            room = cells[3].strip() if len(cells) > 3 else ""
            if not party or party.upper().startswith("PARTY"):
                continue
            next_hearing = self._parse_session(session_raw)
            case_type = self._case_type_from_number(case_number)
            leads.append(
                CaseLead(
                    case_number=case_number.upper(),
                    county=self.county,
                    source=source_id,
                    court_name=self.court_name,
                    case_type=case_type,
                    next_hearing=next_hearing,
                    location=room or self.court_name,
                    party_name=party or None,
                    case_title=f"State vs {party}" if party else None,
                    raw_data={
                        "session_raw": session_raw,
                        "room": room,
                        "entrypoint": self.entrypoint,
                        "portal": "apps.yavapaiaz.gov",
                    },
                )
            )
        logger.info("Parsed %d Yavapai calendar rows", len(leads))
        return leads

    def _parse_regex_fallback(self, html: str, source_id: str) -> List[CaseLead]:
        leads: List[CaseLead] = []
        # Row-ish: case, date time, PARTY, ROOM
        pattern = re.compile(
            r"(J\d{4}(?:CM|TR|CR|CV)\d{8,})\s+"
            r"(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)\s+"
            r"([A-Z][A-Z\s\-\.',]+?)\s+"
            r"(COURT ROOM[^<\n]+|[^<\n]+)",
            re.I,
        )
        for m in pattern.finditer(html):
            case_number, session_raw, party, room = m.groups()
            leads.append(
                CaseLead(
                    case_number=case_number.upper(),
                    county=self.county,
                    source=source_id,
                    court_name=self.court_name,
                    case_type=self._case_type_from_number(case_number),
                    next_hearing=self._parse_session(session_raw),
                    location=room.strip(),
                    party_name=party.strip(),
                    case_title=f"State vs {party.strip()}",
                    raw_data={"session_raw": session_raw, "parse": "regex_fallback"},
                )
            )
        logger.info("Regex fallback parsed %d rows", len(leads))
        return leads

    @staticmethod
    def _case_type_from_number(case_number: str) -> Optional[str]:
        m = re.search(r"J\d{4}(CM|TR|CR|CV)", case_number, re.I)
        if not m:
            return None
        return {
            "CM": "Criminal Misdemeanor",
            "TR": "Criminal Traffic",
            "CR": "Criminal",
            "CV": "Civil",
        }.get(m.group(1).upper())

    @staticmethod
    def _parse_session(session_raw: str) -> Optional[str]:
        m = SESSION_RE.search(session_raw or "")
        if not m:
            return None
        try:
            dt = datetime.strptime(
                f"{m.group('date')} {m.group('time').upper().replace(' ', '')}",
                "%m/%d/%Y %I:%M%p",
            )
            # Store naive local wall time as ISO without TZ (matches Maricopa looseness)
            return dt.isoformat()
        except ValueError:
            try:
                dt = datetime.strptime(
                    f"{m.group('date')} {m.group('time')}".replace("  ", " "),
                    "%m/%d/%Y %I:%M %p",
                )
                return dt.isoformat()
            except ValueError:
                return None


def smoke_parse_prescott() -> List[CaseLead]:
    """Manual smoke: fetch + parse Prescott grid (no DB)."""
    adapter = YavapaiJcAdapter()
    return adapter.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    rows = smoke_parse_prescott()
    print(f"leads={len(rows)}")
    for lead in rows[:5]:
        print(lead.case_number, lead.party_name, lead.next_hearing, lead.location)
