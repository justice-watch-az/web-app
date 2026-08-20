#!/usr/bin/env python3
"""Coconino County jail roster scraper — JailTracker (omsweb) source.

Source: https://omsweb.public-safety-cloud.com/jtclientweb/ (agency
``coconino_county_az``) — the official Coconino County detention roster,
hosted on JailTracker's public Blazor WASM portal.

Why this source (recon 2026-08-19, JWAZ-3):
- coconino.az.gov (incl. Justice Courts + Sheriff pages) 403s from
  datacenter egress; coconinosuperiorcourt.com and
  justicecourts.coconino.az.gov don't resolve. The county's own web
  presence is unusable from CI.
- The JailTracker roster is fully browsable (``requiresNameSearch: false``
  — unlike YCSO's last-name-only lookup) and the data model includes
  charges inline (offenderCharges), plus cases (case number, court date,
  bond, status), holds, booking number, book date, arresting agency.
  Because charges are present at scrape time, DUI classification happens
  inline — no separate AZPA enrichment pass like Yavapai needed.

API flow (reverse-engineered from Roster_WASM.Client.dll):
  1. GET  captcha/getnewcaptchaclient
         -> {"captchaKey": ..., "captchaImage": "data:image/gif;base64,..."}
  2. solve image (2captcha "normal captcha" — see enrichment/solver.py)
  3. POST Captcha/validatecaptcha {"captchaKey", "captchaCode"}
         -> {"captchaMatched": true, "captchaKey": <validated key>}
  4. GET  Offender/coconino_county_az/offenderbucket/<validated key>
         -> roster JSON

Gate: one 4-char image captcha per session. Vision-model OCR failed 4/4
in recon; 2captcha ("normal captcha", ~$2.99/1000) is the intended solver.
Requires TWOCAPTCHA_API_KEY (already in repo secrets for Yavapai).

Modes:
  --dry-run   Fetch + solve + dump a roster sample to stdout. No Supabase
              writes. Used by the coconino-probe workflow to validate the
              chain before we commit to a table migration (ccso_bookings).
  (default)   Same, for now — Supabase write path lands with the
              ccso_bookings migration once the probe confirms data shape.
"""

import argparse
import json
import logging
import os
import sys

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE = "https://omsweb.public-safety-cloud.com/jtclientweb/"
AGENCY = "coconino_county_az"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
SOURCE_ID = "ccso_jailtracker"

# A.R.S. DUI statutes + free-text markers. JailTracker charge text is
# expected to be English descriptions (e.g. "DUI", "DUI W/BAC .08+",
# "AGGRAVATED DUI") and/or A.R.S. citations.
DUI_PATTERNS = [
    r"\bdui\b", r"\bduii\b", r"dui\s*[-/]", r"aggravated\s+dui",
    r"extreme\s+dui", r"super\s+extreme",
    r"28-1381", r"28-1382", r"28-1383",
    r"impaired\s+to\s+the\s+slightest",
    r"under\s+the\s+influence",
]


def is_dui_charge(text: str) -> bool:
    import re
    t = (text or "").lower()
    return any(re.search(p, t) for p in DUI_PATTERNS)


class JailTrackerClient:
    def __init__(self, agency: str = AGENCY):
        self.agency = agency
        self.http = requests.Session()
        self.http.headers.update({"User-Agent": UA, "Accept": "application/json"})

    def agency_options(self) -> dict:
        r = self.http.get(f"{BASE}Offender/{self.agency}/AgencyOptions", timeout=30)
        r.raise_for_status()
        return r.json()

    def new_captcha(self) -> dict:
        r = self.http.get(f"{BASE}captcha/getnewcaptchaclient", timeout=30)
        r.raise_for_status()
        return r.json()  # {"captchaKey", "captchaImage": "data:image/gif;base64,..."}

    def validate_captcha(self, key: str, code: str) -> dict:
        r = self.http.post(f"{BASE}Captcha/validatecaptcha",
                           json={"captchaKey": key, "captchaCode": code}, timeout=30)
        r.raise_for_status()
        return r.json()

    def fetch_roster(self, validated_key: str) -> list:
        r = self.http.get(f"{BASE}Offender/{self.agency}/offenderbucket/{validated_key}",
                          timeout=60)
        r.raise_for_status()
        ct = r.headers.get("Content-Type", "")
        if "json" not in ct:
            raise RuntimeError(f"roster endpoint returned non-JSON ({ct}) — "
                               "captcha key likely rejected or endpoint moved")
        data = r.json()
        if isinstance(data, dict):
            return data.get("offenders") or data.get("Offenders") or []
        return data


def run(dry_run: bool = True, max_solve_attempts: int = 3) -> dict:
    stats = {"solves": 0, "roster_rows": 0, "with_charges": 0, "dui": 0}
    client = JailTrackerClient()

    opts = client.agency_options()
    logger.info("AgencyOptions: %s", opts)
    if opts.get("requiresNameSearch"):
        raise RuntimeError("agency now requires name search — roster sweep not possible")

    from enrichment.solver import TwoCaptchaSolver, SolverUnavailable
    try:
        solver = TwoCaptchaSolver(case_sensitive=True)  # JailTracker codes are case-sensitive
    except SolverUnavailable as e:
        logger.error("No captcha solver: %s", e)
        raise

    roster = None
    for attempt in range(1, max_solve_attempts + 1):
        cap = client.new_captcha()
        b64 = cap["captchaImage"].split(",", 1)[1]
        import base64
        png = base64.b64decode(b64)
        logger.info("captcha fetched (%d bytes), solving (attempt %d)", len(png), attempt)
        code = solver.solve_image(png).strip()
        stats["solves"] += 1
        logger.info("solver returned %r; validating", code)
        res = client.validate_captcha(cap["captchaKey"], code)
        if res.get("captchaMatched"):
            logger.info("captcha matched — fetching roster")
            roster = client.fetch_roster(res["captchaKey"])
            break
        logger.warning("captcha mismatch (attempt %d/%d)", attempt, max_solve_attempts)
    if roster is None:
        raise RuntimeError(f"captcha failed {max_solve_attempts}x — aborting")

    stats["roster_rows"] = len(roster)
    logger.info("roster rows: %d", len(roster))

    dui_rows = []
    for off in roster:
        charges = off.get("offenderCharges") or off.get("charges") or []
        texts = [json.dumps(ch) if not isinstance(ch, str) else ch for ch in charges]
        if texts:
            stats["with_charges"] += 1
        if any(is_dui_charge(t) for t in texts):
            stats["dui"] += 1
            dui_rows.append(off)

    if dry_run:
        print(json.dumps({
            "stats": stats,
            "sample_offender_keys": sorted(roster[0].keys()) if roster else [],
            "sample_offender": roster[0] if roster else None,
            "dui_rows": dui_rows[:10],
        }, indent=2, default=str))
        return stats

    # Supabase write path lands with the ccso_bookings migration (JWAZ-14
    # pattern). Deliberately absent until the probe confirms the live
    # payload shape — see PR body.
    raise NotImplementedError("supabase write path pending ccso_bookings migration")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="fetch + solve + dump roster sample, no writes")
    args = ap.parse_args()
    out = run(dry_run=True if args.dry_run else False)
    logger.info("done: %s", out)
