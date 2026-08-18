#!/usr/bin/env python3
"""
Pima County Consolidated Justice Court calendar adapter (JWAZ, Pima expansion).

Portal: https://www.jp.pima.gov/NewCalendar2018/Filter.aspx
- Plain ASP.NET WebForms; reachable from datacenter egress; no captcha on calendar.
- County-native DUI classification: Case Type = "Criminal DUI" (case numbers -DU).
- Lead-timing filter (Steve's Maricopa Long-Form rule, Pima edition):
    Event Type = "Criminal Arraignment"  AND  attorney field empty
  (CMC/Review/Trial rows almost always have counsel listed — not leads.)
- ARS note: query is case-type-side (Criminal DUI), so misfiled non--DU DUI rows
  (rare; 1 in 550/month sample, and it was a 2016 review) are not fetched. ARS
  codes are still captured into raw_data for downstream verification.

Verified 2026-08-18: month window all-case-types = 550 rows; 43 DUI-ARS rows,
42 of them -DU; the one -MI outlier was a 2016 review (not a lead).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup

try:
    from .base import CaseLead
except ImportError:  # allow `python scrapers/adapters/pima_jc.py`
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from adapters.base import CaseLead

logger = logging.getLogger(__name__)

FILTER_URL = "https://www.jp.pima.gov/NewCalendar2018/Filter.aspx"
RESULT_URL = "https://www.jp.pima.gov/NewCalendar2018/SearchResult.aspx"
GRID_ID = "MainContent_searchResultDView"
CASE_TYPE_DUI = "Criminal DUI"
EVENT_ARRAIGNMENT = "Criminal Arraignment"
DUI_ARS_RE = re.compile(r"28-138[125]", re.I)
CASE_NUM_RE = re.compile(r"^[A-Z]{2}\d{2}-\d+")


class PimaJcAdapter:
    """Pima Consolidated JC DUI arraignment reader."""

    source_id = "pima_jc"
    county = "pima"
    court_name = "Pima County Consolidated Justice Court"

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

    # ---------- ASP.NET plumbing ----------

    @staticmethod
    def _hidden(soup: BeautifulSoup) -> Dict[str, str]:
        d = {}
        for inp in soup.find_all("input"):
            nm = inp.get("name")
            if nm and inp.get("type", "") == "hidden":
                d[nm] = inp.get("value", "")
        return d

    def _post_filter(self, start: str, end: str, case_type: str, event_type: str) -> BeautifulSoup:
        r = self.session.get(FILTER_URL, timeout=45)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        data = self._hidden(soup)
        data.update(
            {
                "CaseNum1": "",
                "CaseNum2": "",
                "CaseNum3": "",
                "Party": "All",
                "Attorney": "All",
                "drpDnJudge": "All",
                "startDate": start,
                "endDate": end,
                "drpDnCaseType": case_type,
                "ctl00$MainContent$drpDnEventType": event_type,
                "ARSCode": "All",
                "ctl00$MainContent$submitFilter": "submit",
            }
        )
        r2 = self.session.post(RESULT_URL, data=data, timeout=90)
        r2.raise_for_status()
        return BeautifulSoup(r2.text, "html.parser")

    def _goto_page(self, soup: BeautifulSoup, page: int) -> Optional[BeautifulSoup]:
        data = self._hidden(soup)
        data["__EVENTTARGET"] = "ctl00$MainContent$searchResultDView"
        data["__EVENTARGUMENT"] = f"Page${page}"
        r = self.session.post(RESULT_URL, data=data, timeout=90)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")

    # ---------- parsing ----------

    @staticmethod
    def _rows(soup: BeautifulSoup) -> List[List[str]]:
        grid = soup.find("table", id=GRID_ID)
        if not grid:
            return []
        out = []
        for tr in grid.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all("td")]
            if len(cells) >= 8 and CASE_NUM_RE.match(cells[0]):
                out.append(cells)
        return out

    @staticmethod
    def _pages(soup: BeautifulSoup) -> List[int]:
        grid = soup.find("table", id=GRID_ID)
        pages = set()
        if grid:
            for a in grid.find_all("a"):
                m = re.search(r"Page\$(\d+)", a.get("href", ""))
                if m:
                    pages.add(int(m.group(1)))
        return sorted(pages)

    @staticmethod
    def _to_iso(date_s: str, time_s: str) -> Optional[str]:
        # "08-19-2026" + "09:00 AM" -> naive local ISO (matches Maricopa looseness)
        try:
            dt = datetime.strptime(f"{date_s} {time_s}", "%m-%d-%Y %I:%M %p")
            return dt.isoformat()
        except ValueError:
            return None

    def _cells_to_lead(self, cells: List[str]) -> Optional[CaseLead]:
        case_number = cells[0]
        party = re.sub(r"\s*\(Defendant\)\s*$", "", cells[1]).strip()
        next_hearing = self._to_iso(cells[2], cells[3])
        event = cells[4]
        room = cells[6] if len(cells) > 6 else ""
        judge = cells[7] if len(cells) > 7 else ""
        attorney = cells[8] if len(cells) > 8 else ""
        ars = cells[9] if len(cells) > 9 else ""

        # Lead gate: DUI by case type (query-side) OR DUI ARS safety net;
        # arraignment event AND no attorney listed = unrepresented = lead.
        if event != EVENT_ARRAIGNMENT:
            return None
        if attorney.strip():
            return None

        return CaseLead(
            case_number=case_number,
            county=self.county,
            source=self.source_id,
            court_name=self.court_name,
            case_type="DUI",
            status="Pending",
            next_hearing=next_hearing,
            location=f"Room {room}" if room else self.court_name,
            party_name=party or None,
            case_title=f"State vs {party}" if party else None,
            charges_raw=ars or None,
            raw_data={
                "event": event,
                "room": room,
                "judge": judge,
                "attorney": attorney,
                "ars_codes": ars.split() if ars else [],
                "portal": "jp.pima.gov",
            },
        )

    def run(self, config: Optional[Dict[str, Any]] = None) -> List[CaseLead]:
        cfg = {**self.config, **(config or {})}
        start = cfg.get("start_date") or datetime.now().strftime("%-m/%-d/%Y")
        end = cfg.get("end_date") or start  # default: today's docket only

        soup = self._post_filter(start, end, CASE_TYPE_DUI, "All")
        raw = self._rows(soup)
        for page in self._pages(soup):
            if page <= 1:
                continue
            soup = self._goto_page(soup, page)
            if soup:
                raw += self._rows(soup)
        logger.info("Pima grid rows (DUI case type, %s..%s): %d", start, end, len(raw))

        leads = []
        for cells in raw:
            lead = self._cells_to_lead(cells)
            if lead:
                leads.append(lead)
        logger.info("Pima DUI arraignment leads (no attorney): %d", len(leads))
        return leads


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    rows = PimaJcAdapter().run()
    print(f"leads={len(rows)}")
    for lead in rows[:10]:
        print(lead.case_number, "|", lead.party_name, "|", lead.next_hearing, "|", lead.location)
