#!/usr/bin/env python3
"""One-shot live test: AZ Public Access captcha enrichment (JWAZ-16).

Grabs real case numbers from today's Prescott JC calendar, unlocks the
BotDetect gate ONCE via 2captcha, then looks up charges for a few cases
and reports DUI classification. Manual/dispatch use only.
"""

import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from adapters.yavapai_jc import YavapaiJcAdapter  # noqa: E402
from enrichment.az_public_access import AZPublicAccessClient  # noqa: E402


def main():
    adapter = YavapaiJcAdapter()
    leads = adapter.run()
    cm = [l for l in leads if l.case_type in ("Criminal Misdemeanor", "Criminal Traffic", "Criminal")]
    print(f"Prescott calendar: {len(leads)} rows, {len(cm)} CM/TR")
    sample = cm[:5]

    client = AZPublicAccessClient()
    ok = client.unlock()
    print(f"gate unlock: {ok}")
    if not ok:
        print(json.dumps({"unlocked": False}, indent=2))
        sys.exit(1)

    # Debug: dump the post-gate form structure
    from bs4 import BeautifulSoup
    BS = BeautifulSoup
    r = client.session.get(client.__init__.__globals__["LOOKUP_URL"], timeout=30)
    soup = BeautifulSoup(r.text, "html.parser")
    print("=== POST-GATE FORM ===")
    for form in soup.find_all("form"):
        print("FORM action:", form.get("action"), "method:", form.get("method"))
        for el in form.find_all(["input", "select", "button"]):
            print("  ", el.name, "| name:", el.get("name"), "| id:", el.get("id"),
                  "| type:", el.get("type"), "| value:", (el.get("value") or "")[:40])
        for sel in form.find_all("select"):
            opts = [(o.get("value"), o.get_text(strip=True)[:40]) for o in sel.find_all("option")]
            if "Court" in (sel.get("name") or ""):
                prescott = [o for o in opts if "prescott" in o[1].lower() or "verde" in o[1].lower() or "mayer" in o[1].lower() or "bagdad" in o[1].lower() or "seligman" in o[1].lower()]
                print("   YAVAPAI OPTIONS", sel.get("name"), prescott)
            else:
                print("   OPTIONS", sel.get("name"), opts[:25])

    # Name-search sanity test with a known defendant from today's calendar
    with_comma = [l for l in sample if "," in (l.party_name or "")]
    first = with_comma[0] if with_comma else sample[0]
    print("=== NAME SEARCH TEST ===")
    parts = first.party_name.split(",")
    lname = parts[0].strip()
    fname = parts[1].strip().split()[0] if len(parts) > 1 else ""
    print("searching:", repr(lname), "/", repr(fname), "case:", first.case_number)
    nres = client.lookup_by_name(lname, fname)
    print("name result:", json.dumps({"found": nres.found, "is_dui": nres.is_dui,
                                    "charges": nres.charges, "error": nres.error}))
    if hasattr(client, "last_html"):
        t = BS(client.last_html, "html.parser").get_text(" ", strip=True)
        print("=== NAME RESULT PAGE (first 2500 chars) ===")
        print(t[:2500])
        import re as _re
        print("case-number-ish strings:", sorted(set(_re.findall(r"[A-Z]-?\d{4}-?[A-Z]{2}-?\d{4}-?\d{4,6}|J1303[A-Z]{2}\d{10}", client.last_html)))[:20])
        for a in BS(client.last_html, "html.parser").find_all("a", href=True):
            if "case" in a["href"].lower() or "detail" in a["href"].lower():
                print("  CASE LINK:", a.get_text(strip=True)[:50], "->", a["href"][:150])

    results = []
    for i, lead in enumerate(sample):
        info = client.lookup_case(lead.case_number)
        results.append({
            "case_number": info.case_number,
            "found": info.found,
            "is_dui": info.is_dui,
            "charges": info.charges,
            "error": info.error,
        })
        print(json.dumps(results[-1]))
        if i == 0 and hasattr(client, "last_html"):
            from bs4 import BeautifulSoup as BS
            t = BS(client.last_html, "html.parser").get_text(" ", strip=True)
            print("=== FIRST LOOKUP RESULT PAGE (first 1500 chars) ===")
            print(t[:1500])
            for a in BS(client.last_html, "html.parser").find_all("a", href=True)[:15]:
                print("  LINK:", a.get_text(strip=True)[:40], "->", a["href"][:120])
    print(json.dumps({"unlocked": True, "lookups": len(results),
                      "found": sum(1 for r in results if r["found"]),
                      "dui": sum(1 for r in results if r["is_dui"])}, indent=2))


if __name__ == "__main__":
    main()
