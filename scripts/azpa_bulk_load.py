#!/usr/bin/env python3
"""Bulk-load Coconino AZPA DUI history into azpa_cases (post JWAZ-14 batch).

Usage:
    SUPABASE_URL=https://<project>.supabase.co \
    SUPABASE_SERVICE_KEY=<service_role_key> \
    python3 azpa_bulk_load.py coconino_dui_all.jsonl

- Upserts by case_number (safe to re-run).
- Sets scraped_at from filing_date so the public wall (ORDER BY scraped_at DESC)
  orders history correctly, matching the bookings-wall pattern.
- Requires SUPABASE_URL + SUPABASE_SERVICE_KEY env vars (service role bypasses RLS).
"""
import json
import os
import sys
from datetime import datetime

import requests


def parse_filing_date(raw: str | None) -> str:
    """'9/19/2019' -> ISO timestamptz. Falls back to now() if unparseable."""
    if raw:
        for fmt in ("%m/%d/%Y", "%m/%d/%y"):
            try:
                return datetime.strptime(raw.strip(), fmt).isoformat() + "Z"
            except (ValueError, AttributeError):
                continue
    return datetime.utcnow().isoformat() + "Z"


def main() -> None:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_KEY"]
    path = sys.argv[1] if len(sys.argv) > 1 else "coconino_dui_all.jsonl"

    rows = []
    with open(path) as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            rows.append({
                "case_number": r["case_number"],
                "county": r.get("county", "coconino"),
                "court": r["court"],
                "case_type": r.get("case_type"),
                "defendant": r.get("defendant"),
                "dob": r.get("dob"),
                "filing_date": r.get("filing_date"),
                "charges": r.get("charges") or [],
                "is_dui": bool(r.get("is_dui", True)),
                "has_counsel": r.get("has_counsel"),
                "scraped_at": parse_filing_date(r.get("filing_date")),
            })

    print(f"Loaded {len(rows)} rows from {path}")

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    # PostgREST upsert, batches of 200
    ok = 0
    for i in range(0, len(rows), 200):
        batch = rows[i : i + 200]
        resp = requests.post(
            f"{url}/rest/v1/azpa_cases?on_conflict=case_number",
            headers=headers,
            json=batch,
            timeout=60,
        )
        if resp.status_code not in (200, 201):
            print(f"FATAL batch {i}: HTTP {resp.status_code}: {resp.text[:500]}")
            sys.exit(1)
        ok += len(batch)
        print(f"  upserted {ok}/{len(rows)}")

    print("DONE — azpa_cases populated. Verify:")
    print(f"  {url}/rest/v1/azpa_cases?is_dui=eq.true&select=case_number&order=scraped_at.desc&limit=5")


if __name__ == "__main__":
    main()
