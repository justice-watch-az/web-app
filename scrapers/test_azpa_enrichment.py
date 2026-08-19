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

    results = []
    for lead in sample:
        info = client.lookup_case(lead.case_number)
        results.append({
            "case_number": info.case_number,
            "found": info.found,
            "is_dui": info.is_dui,
            "charges": info.charges,
            "error": info.error,
        })
        print(json.dumps(results[-1]))
    print(json.dumps({"unlocked": True, "lookups": len(results),
                      "found": sum(1 for r in results if r["found"]),
                      "dui": sum(1 for r in results if r["is_dui"])}, indent=2))


if __name__ == "__main__":
    main()
