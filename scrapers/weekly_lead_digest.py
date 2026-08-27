#!/usr/bin/env python3
"""
Weekly lead digest for Tiffany (Steve George Law).

Cheap v1:
  - Lookback = last 7 days by cases.scraped_at
  - Excludes front-end-hidden counties (Pima)
  - Recipient: tiffany@stevengeorgelaw.com only (override DIGEST_TO for tests)
  - Sends via Resend when RESEND_API_KEY + DIGEST_FROM are set
  - DRY_RUN=1 prints HTML and exits 0 without sending

Schedule: Mondays ~8:00 AM Arizona (15:00 UTC) via weekly-lead-digest.yml
"""

from __future__ import annotations

import html
import json
import os
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

# Counties intentionally omitted from SPA + digest (client request)
HIDDEN_COUNTIES = {"pima"}

DEFAULT_TO = "tiffany@stevengeorgelaw.com"
APP_CASES_URL = "https://justice-watch-app.vercel.app/cases"
LOOKBACK_DAYS = 7


def _env(*names: str) -> Optional[str]:
    for n in names:
        v = os.environ.get(n)
        if v and v.strip():
            return v.strip()
    return None


def _http_json(
    method: str,
    url: str,
    headers: Dict[str, str],
    body: Optional[dict] = None,
    timeout: int = 60,
) -> Any:
    data = None
    hdrs = dict(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")[:500]
        raise SystemExit(f"HTTP {e.code} {url}: {err}") from e


def _supabase_cfg(service: bool = True) -> Dict[str, str]:
    url = _env("SUPABASE_URL", "VITE_SUPABASE_URL")
    key = (
        _env("SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY")
        if service
        else _env(
            "SUPABASE_ANON_KEY",
            "SUPABASE_PUBLISHABLE_KEY",
            "VITE_SUPABASE_ANON_KEY",
        )
    )
    if not url or not key:
        raise SystemExit(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY (or ANON) required for digest"
        )
    return {
        "url": url.rstrip("/"),
        "key": key,
        "headers": {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    }


def fetch_cases(lookback_days: int = LOOKBACK_DAYS) -> List[Dict[str, Any]]:
    sb = _supabase_cfg(service=True)
    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    # PostgREST wants a URL-safe timestamptz; avoid bare '+' in query string
    cutoff = cutoff_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    path = (
        f"{sb['url']}/rest/v1/cases"
        f"?select=id,case_number,court_name,case_title,case_type,county,source,"
        f"next_hearing,scraped_at,status,raw_data,case_parties(party_type,party_name,attorney)"
        f"&scraped_at=gte.{cutoff}"
        f"&order=scraped_at.desc"
        f"&limit=1000"
    )
    rows = _http_json("GET", path, sb["headers"]) or []
    out = []
    for row in rows:
        county = (row.get("county") or "maricopa").lower()
        if county in HIDDEN_COUNTIES:
            continue
        out.append(row)
    return out


def defendant_name(row: Dict[str, Any]) -> str:
    parties = row.get("case_parties") or []
    for p in parties:
        if (p.get("party_type") or "").lower() == "defendant" and p.get("party_name"):
            return str(p["party_name"]).strip()
    title = row.get("case_title") or ""
    if " vs " in title.lower():
        # "State vs NAME"
        parts = title.split(" vs ", 1) if " vs " in title else title.split(" VS ", 1)
        if len(parts) == 2:
            return parts[1].strip()
    return title or "—"


def charge_blurb(row: Dict[str, Any]) -> str:
    raw = row.get("raw_data") or {}
    if isinstance(raw, str):
        return ""
    codes = raw.get("ars_codes") or []
    if isinstance(codes, list) and codes:
        return "; ".join(str(c) for c in codes[:2])[:180]
    return (row.get("case_type") or "")[:120]


def fmt_dt(val: Optional[str]) -> str:
    if not val:
        return "—"
    try:
        d = datetime.fromisoformat(val.replace("Z", "+00:00"))
        return d.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(val)[:16]


def build_html(rows: List[Dict[str, Any]], lookback_days: int) -> str:
    by_county: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_county[(r.get("county") or "maricopa").lower()].append(r)

    parts = [
        "<html><body style='font-family:system-ui,Segoe UI,sans-serif;font-size:14px;color:#111'>",
        f"<h2>Justice Watch — new leads (last {lookback_days} days)</h2>",
        f"<p>{len(rows)} case(s). Open the app: "
        f"<a href='{html.escape(APP_CASES_URL)}'>{html.escape(APP_CASES_URL)}</a></p>",
        "<p style='color:#555'>Default site filter is <b>New this week (7 days)</b> "
        "so Yavapai same-day dockets stay visible for a weekly mail run. "
        "Pima is omitted.</p>",
    ]

    if not rows:
        parts.append("<p><b>No new cases in this window.</b></p>")
    else:
        for county in sorted(by_county.keys()):
            group = by_county[county]
            parts.append(f"<h3 style='text-transform:capitalize'>{html.escape(county)} "
                         f"({len(group)})</h3>")
            parts.append(
                "<table cellpadding='6' cellspacing='0' border='1' "
                "style='border-collapse:collapse;border-color:#ccc;width:100%'>"
                "<thead><tr style='background:#f4f4f4'>"
                "<th align='left'>Defendant</th>"
                "<th align='left'>Case #</th>"
                "<th align='left'>Court</th>"
                "<th align='left'>Hearing</th>"
                "<th align='left'>Scraped</th>"
                "<th align='left'>Charges / type</th>"
                "</tr></thead><tbody>"
            )
            for r in group:
                parts.append(
                    "<tr>"
                    f"<td>{html.escape(defendant_name(r))}</td>"
                    f"<td>{html.escape(str(r.get('case_number') or '—'))}</td>"
                    f"<td>{html.escape(str(r.get('court_name') or '—'))}</td>"
                    f"<td>{html.escape(fmt_dt(r.get('next_hearing')))}</td>"
                    f"<td>{html.escape(fmt_dt(r.get('scraped_at')))}</td>"
                    f"<td>{html.escape(charge_blurb(r))}</td>"
                    "</tr>"
                )
            parts.append("</tbody></table>")

    parts.append(
        "<p style='margin-top:24px;color:#888;font-size:12px'>"
        "Automated weekly digest · Justice Watch · Tiffany only · "
        f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC"
        "</p></body></html>"
    )
    return "\n".join(parts)


def build_text(rows: List[Dict[str, Any]], lookback_days: int) -> str:
    lines = [
        f"Justice Watch — new leads (last {lookback_days} days)",
        f"{len(rows)} case(s). App: {APP_CASES_URL}",
        "",
    ]
    for r in rows:
        lines.append(
            f"- [{(r.get('county') or 'maricopa').upper()}] {defendant_name(r)} | "
            f"{r.get('case_number')} | {r.get('court_name')} | "
            f"hearing {fmt_dt(r.get('next_hearing'))} | scraped {fmt_dt(r.get('scraped_at'))}"
        )
    if not rows:
        lines.append("(none)")
    return "\n".join(lines)


def send_resend(subject: str, html_body: str, text_body: str) -> None:
    api_key = _env("RESEND_API_KEY")
    from_addr = _env("DIGEST_FROM", "RESEND_FROM")
    to_addr = _env("DIGEST_TO") or DEFAULT_TO

    if not api_key:
        raise SystemExit(
            "RESEND_API_KEY missing — add GH Actions secret to enable send "
            "(DRY_RUN=1 to preview without sending)"
        )
    if not from_addr:
        raise SystemExit(
            "DIGEST_FROM missing — verified Resend sender, e.g. "
            "'Justice Watch <leads@yourdomain.com>'"
        )

    payload = {
        "from": from_addr,
        "to": [to_addr],
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }
    resp = _http_json(
        "POST",
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        body=payload,
    )
    print(f"sent ok → {to_addr} id={resp.get('id')}")


def main() -> int:
    lookback = int(os.environ.get("DIGEST_LOOKBACK_DAYS") or LOOKBACK_DAYS)
    dry = os.environ.get("DRY_RUN", "").strip() in ("1", "true", "TRUE", "yes")

    rows = fetch_cases(lookback)
    print(f"digest rows={len(rows)} lookback_days={lookback} dry_run={dry}")

    html_body = build_html(rows, lookback)
    text_body = build_text(rows, lookback)
    subject = (
        f"Justice Watch weekly leads — {len(rows)} new "
        f"({datetime.now(timezone.utc).strftime('%Y-%m-%d')})"
    )

    if dry:
        print("--- SUBJECT ---")
        print(subject)
        print("--- TEXT ---")
        print(text_body)
        print("--- HTML bytes ---", len(html_body))
        return 0

    send_resend(subject, html_body, text_body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
