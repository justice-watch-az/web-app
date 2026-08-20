#!/usr/bin/env python3
"""Coconino County discovery via AZ Public Access case-number enumeration.

Frank's call (2026-08-20): skip JailTracker (upstream outage) — use AZPA
directly. AZPA has no browsable roster, but case numbers are sequential
per court/type/year (J-0301-CT-2025001455 was filed mid-Feb 2025), so we
enumerate forward from a stored watermark: exact-match number searches,
open each hit's detail page, classify DUI from the plain-English charge
descriptions, and store defendant + charges + counsel signal.

Key facts (verified live 2026-08-20):
  * Case-number search split: txtCNum1 = 2-char case TYPE (CT/CR/TR),
    txtCNum2 = sequence (e.g. 2025001455), court via ddlCourtByNum.
    (enrichment/az_public_access.py's _split_candidates docstring predates
    this — the dashed prefix does NOT fit CNUM1, maxlength=2.)
  * Partial/wildcard numbers return nothing — exact match only.
  * Detail pages carry: defendant name + DOB (gvPartyInfo), charges grid
    (citation/count/description/disposition), docket events (gvEvents).
  * No dedicated attorney field; counsel appears only as docket events
    ("ORDER: APPOINTING COUNSEL", "NOTICE OF APPEARANCE", "WITHDRAW COUNSEL").

Gate: writes need tables azpa_cases + azpa_enum_state (SQL in
migrations/20260820_azpa_cases.sql, part of Frank's JWAZ-14 batch).
Until then run with --probe (read-only, prints what it would write).

Cost: 1 BotDetect solve per session (~few dozen searches), +1 request per
case probed. Daily incremental scans are small (~tens of new cases/day
across all Coconino justice/municipal courts).
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Coconino County courts in the AZPA dropdown (values discovered 2026-08-19).
# case_prefix is the display prefix used in canonical case numbers.
COCONINO_COURTS = [
    {"value": "2", "name": "Flagstaff Justice",   "prefix": "J-0301"},
    {"value": "7", "name": "Page Justice",        "prefix": "J-0303"},
    {"value": "8", "name": "Williams Justice",    "prefix": "J-0302"},
    {"value": "6", "name": "Fredonia Justice",    "prefix": "J-0304"},
    {"value": "1", "name": "Flagstaff Municipal", "prefix": "M-0301"},
    {"value": "5", "name": "Page Municipal",      "prefix": "M-0303"},
    {"value": "9", "name": "Williams Municipal",  "prefix": "M-0302"},
    {"value": "4", "name": "Fredonia Municipal",  "prefix": "M-0304"},
]
CASE_TYPES = ["CT", "CR"]  # criminal traffic (DUI home) + criminal
CURRENT_YEAR = datetime.now().year

# Counsel heuristics from docket events (no attorney field exists on AZPA).
COUNSEL_APPEAR_RE = re.compile(
    r"appoint\w*\s+counsel|appearance of counsel|notice of appearance|"
    r"public defender|defense attorn|counsel (appointed|appears|retained)",
    re.I,
)
COUNSEL_WITHDRAW_RE = re.compile(r"withdraw\w*\s+counsel|counsel.{0,20}withdraw", re.I)

MAX_MISSES = 5          # consecutive empty numbers before stopping a scan
BOOTSTRAP_STEP = 200    # exponential-ish probe step when no watermark exists
REQUEST_PAUSE = 0.4     # be polite


def parse_detail(html: str) -> dict:
    """Parse an AZPA case detail page into a structured record."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    out = {"defendant": None, "dob": None, "filing_date": None, "judge": None,
           "disposition_date": None, "charges": [], "events": [],
           "has_counsel": None}

    info = soup.find("table", id=re.compile("gvCaseInfo$"))
    if info:
        txt = info.get_text(" ", strip=True)
        m = re.search(r"Filing Date:\s*([\d/]+)", txt)
        if m: out["filing_date"] = m.group(1)
        m = re.search(r"Judge:\s*([^\n]*?)\s*(?:Disposition|$)", txt)
        if m and m.group(1).strip(): out["judge"] = m.group(1).strip()
        m = re.search(r"Disposition Date:\s*([\d/]+)", txt)
        if m: out["disposition_date"] = m.group(1)

    party = soup.find("table", id=re.compile("gvPartyInfo$"))
    if party:
        # First DEFENDANT party header: "NAME DEFENDANT - D1 Date of Birth: MM/YYYY"
        ptxt = party.get_text(" ", strip=True)
        m = re.search(r"([A-Z][A-Z ,.'-]+?)\s+DEFENDANT", ptxt)
        if m: out["defendant"] = " ".join(m.group(1).split())
        m = re.search(r"Date of Birth:\s*([\d/]+)", ptxt)
        if m: out["dob"] = m.group(1)
        # Charge grids: Citation | Count | Description | Disp. Date | Disposition
        for grid in party.find_all("table", id=re.compile("gvCounts")):
            rows = grid.find_all("tr")
            for tr in rows[1:]:
                cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
                if len(cells) >= 3:
                    out["charges"].append({
                        "citation": cells[0], "count": cells[1],
                        "description": cells[2],
                        "disp_date": cells[3] if len(cells) > 3 else "",
                        "disposition": cells[4] if len(cells) > 4 else "",
                    })

    ev = soup.find("table", id=re.compile("gvEvents$"))
    events = []
    if ev:
        for tr in ev.find_all("tr")[1:]:
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
            if len(cells) >= 2:
                events.append({"date": cells[0], "description": cells[1],
                               "party": cells[2] if len(cells) > 2 else ""})
    out["events"] = events
    blob = "\n".join(e["description"] for e in events)
    if blob:
        appeared = bool(COUNSEL_APPEAR_RE.search(blob))
        withdrawn = bool(COUNSEL_WITHDRAW_RE.search(blob))
        out["has_counsel"] = True if (appeared and not withdrawn) else (False if appeared or withdrawn else None)
    return out


def is_dui_detail(detail: dict) -> bool:
    from enrichment.az_public_access import DUI_ARS_RE, DUI_WORD_RE
    for c in detail["charges"]:
        if DUI_ARS_RE.search(c.get("description", "")) or DUI_WORD_RE.search(c.get("description", "")):
            return True
    return False


def seq_of(case_number: str) -> int | None:
    m = re.search(r"-(\d{10})$", case_number)
    return int(m.group(1)) if m else None


def probe_number(client, court: dict, ctype: str, seq: int):
    """Exact-match case-number search. Returns (case_number, detail) or None."""
    soup = client._get_search_form()
    if soup is None:
        raise RuntimeError("AZPA gate re-locked and re-unlock failed")
    from enrichment.az_public_access import _viewstate_fields
    data = _viewstate_fields(soup)
    for inp in soup.find_all("input", {"type": "hidden"}):
        nm = inp.get("name")
        if nm and not nm.startswith("__") and nm not in data:
            data[nm] = inp.get("value", "")
    data[client.CNUM1] = ctype
    data[client.CNUM2] = str(seq)
    data[client.COURT_NUM] = court["value"]
    data[client.BTN_NUM] = "Search"
    r = client.session.post(client.__init__.__globals__["LOOKUP_URL"], data=data, timeout=30)
    if "Page Error" in r.text:
        raise RuntimeError(f"AZPA page error on {court['name']} {ctype} {seq}")
    from bs4 import BeautifulSoup
    grid = BeautifulSoup(r.text, "html.parser")
    # any case-number link in the results grid?
    m = client.RESULT_LINK_RE.search(r.text)
    if not m:
        return None
    cn_a = None
    for a in grid.find_all("a"):
        if "lbCaseNum" in (a.get("href") or "") and re.match(r"^[A-Z]-\d{4}-", a.get_text(strip=True)):
            cn_a = a.get_text(strip=True)
            break
    detail_html = client._follow_result(r.text)
    if not detail_html or "Page Error" in detail_html:
        return None
    return cn_a, parse_detail(detail_html)


def bootstrap_max(client, court: dict, ctype: str, year: int) -> int | None:
    """Find the highest existing seq for (court, type, year) via bracket+bisect.
    Returns None if the court/type has no cases this year."""
    def exists(seq):
        try:
            return probe_number(client, court, ctype, seq) is not None
        except Exception:
            return False

    base = year * 1000000  # seq format: YYYY + 6-digit serial (2025001455)
    lo, hi = base + 1, base + BOOTSTRAP_STEP
    # grow until miss
    while exists(hi) and hi < base + 999999:
        lo = hi
        hi += BOOTSTRAP_STEP
        time.sleep(REQUEST_PAUSE)
    if not exists(lo):
        return None  # no cases this year at all
    # bisect (lo exists, hi doesn't)
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if exists(mid):
            lo = mid
        else:
            hi = mid
        time.sleep(REQUEST_PAUSE)
    return lo


def backfill(court: dict, ctype: str, year: int, out_path: str,
             seq_start: int = 1, seq_end: int | None = None) -> dict:
    """Walk seq space from the year start up to the current max, fetching each
    case detail and writing DUI hits (plus a per-court summary) as JSONL.
    Read-only against AZPA; no Supabase needed — load the JSONL after the
    azpa_cases migration lands."""
    from enrichment.az_public_access import AZPublicAccessClient
    stats = {"court": court["name"], "type": ctype, "probed": 0, "found": 0,
             "dui": 0, "errors": 0}
    client = AZPublicAccessClient()
    if not client.unlock():
        raise RuntimeError("AZPA captcha gate could not be unlocked")
    if seq_end is None:
        seq_end = bootstrap_max(client, court, ctype, year)
        if seq_end is None:
            logger.info("backfill %s %s %d: no cases", court["name"], ctype, year)
            return stats
        logger.info("backfill %s %s %d: max=%d", court["name"], ctype, year, seq_end)
    base = year * 1000000
    with open(out_path, "a") as f:
        for n in range(base + seq_start, seq_end + 1):
            stats["probed"] += 1
            try:
                hit = probe_number(client, court, ctype, n)
            except Exception as e:
                stats["errors"] += 1
                logger.error("backfill %s %d failed: %s", court["name"], n, e)
                time.sleep(1.0)
                continue
            time.sleep(REQUEST_PAUSE)
            if hit is None:
                continue
            case_number, detail = hit
            stats["found"] += 1
            if not is_dui_detail(detail):
                continue
            stats["dui"] += 1
            rec = {"case_number": case_number, "county": "coconino",
                   "court": court["name"], "case_type": ctype,
                   "defendant": detail.get("defendant"), "dob": detail.get("dob"),
                   "filing_date": detail.get("filing_date"),
                   "charges": detail["charges"],
                   "is_dui": True, "has_counsel": detail.get("has_counsel")}
            f.write(json.dumps(rec) + "\n")
            f.flush()
            logger.info("DUI %s: %s (counsel=%s)", case_number,
                        detail.get("defendant"), detail.get("has_counsel"))
    logger.info("BACKFILL DONE %s %s: %s", court["name"], ctype, stats)
    return stats


def run(probe: bool = True, max_new_per_court: int = 200) -> dict:
    from enrichment.az_public_access import AZPublicAccessClient
    stats = {"courts": 0, "probed": 0, "found": 0, "dui": 0, "errors": 0}
    client = AZPublicAccessClient()
    if not client.unlock():
        raise RuntimeError("AZPA captcha gate could not be unlocked")

    sb = None
    if not probe:
        from supabase_writer import SupabaseWriter
        sb = SupabaseWriter().supabase

    for court in COCONINO_COURTS:
        stats["courts"] += 1
        for ctype in CASE_TYPES:
            watermark = None
            if sb:
                try:
                    res = sb.table("azpa_enum_state").select("last_seq") \
                        .eq("court_value", court["value"]).eq("case_type", ctype) \
                        .eq("year", CURRENT_YEAR).execute()
                    watermark = res.data[0]["last_seq"] if res.data else None
                except Exception as e:
                    logger.warning("watermark read failed %s/%s: %s", court["name"], ctype, e)
            if watermark is None:
                logger.info("bootstrapping %s %s %d...", court["name"], ctype, CURRENT_YEAR)
                watermark = bootstrap_max(client, court, ctype, CURRENT_YEAR)
                logger.info("bootstrap %s %s -> %s", court["name"], ctype, watermark)
                if watermark is None:
                    continue
                if sb:
                    sb.table("azpa_enum_state").upsert({
                        "court_value": court["value"], "case_type": ctype,
                        "year": CURRENT_YEAR, "last_seq": watermark,
                    }, on_conflict="court_value,case_type,year").execute()
                if probe:
                    continue  # in probe mode bootstrap is the deliverable

            # forward scan from watermark+1
            misses, found_this = 0, 0
            seq = watermark + 1
            while misses < MAX_MISSES and found_this < max_new_per_court:
                stats["probed"] += 1
                try:
                    hit = probe_number(client, court, ctype, seq)
                except Exception as e:
                    stats["errors"] += 1
                    logger.error("probe %s %s %d failed: %s", court["name"], ctype, seq, e)
                    misses += 1
                    seq += 1
                    continue
                time.sleep(REQUEST_PAUSE)
                if hit is None:
                    misses += 1
                    seq += 1
                    continue
                misses = 0
                case_number, detail = hit
                stats["found"] += 1
                found_this += 1
                dui = is_dui_detail(detail)
                if dui:
                    stats["dui"] += 1
                logger.info("%s %s: %s dui=%s counsel=%s charges=%d",
                            court["name"], case_number, detail.get("defendant"),
                            dui, detail.get("has_counsel"), len(detail["charges"]))
                if sb:
                    sb.table("azpa_cases").upsert({
                        "case_number": case_number, "county": "coconino",
                        "court": court["name"], "case_type": ctype,
                        "defendant": detail.get("defendant"), "dob": detail.get("dob"),
                        "filing_date": detail.get("filing_date"),
                        "charges": json.dumps(detail["charges"]),
                        "is_dui": dui, "has_counsel": detail.get("has_counsel"),
                        "scraped_at": datetime.now(timezone.utc).isoformat(),
                    }, on_conflict="case_number").execute()
                watermark = seq
                seq += 1
            if sb:
                sb.table("azpa_enum_state").upsert({
                    "court_value": court["value"], "case_type": ctype,
                    "year": CURRENT_YEAR, "last_seq": watermark,
                }, on_conflict="court_value,case_type,year").execute()

    logger.info("DONE: %s", stats)
    return stats


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true",
                    help="read-only: bootstrap watermarks, print, no writes")
    ap.add_argument("--backfill-court", type=int, default=None,
                    help="index into COCONINO_COURTS; run DUI backfill for that court")
    ap.add_argument("--case-type", default="CT")
    ap.add_argument("--year", type=int, default=CURRENT_YEAR)
    ap.add_argument("--out", default="/tmp/azpa_backfill.jsonl")
    ap.add_argument("--seq-end", type=int, default=None,
                    help="skip bootstrap; scan up to this absolute seq")
    args = ap.parse_args()
    if args.backfill_court is not None:
        court = COCONINO_COURTS[args.backfill_court]
        print(json.dumps(backfill(court, args.case_type, args.year, args.out,
                                  seq_end=args.seq_end), indent=2))
    else:
        print(json.dumps(run(probe=args.probe), indent=2))
