#!/usr/bin/env python3
"""
Mock scraper for testing without Chrome/ChromeDriver
"""

import json
import sys
from datetime import datetime

def main():
    config = {}
    if len(sys.argv) > 1:
        config = json.loads(sys.argv[1])
    
    # Mock data that would normally come from scraping
    mock_cases = [
        {
            "case_number": "TEST2025000001",
            "court_id": "test_court",
            "court_name": "Test Justice Court",
            "case_title": "State vs Test Defendant 1",
            "case_type": "Criminal",
            "case_status": "Active",
            "filing_date": "2025-08-01",
            "judge": "Test Judge",
            "location": "Test Court",
            "next_hearing": "2025-08-20",
            "scraped_at": datetime.now().isoformat()
        },
        {
            "case_number": "TEST2025000002", 
            "court_id": "test_court",
            "court_name": "Test Justice Court",
            "case_title": "State vs Test Defendant 2",
            "case_type": "Criminal",
            "case_status": "Active",
            "filing_date": "2025-08-05",
            "judge": "Test Judge",
            "location": "Test Court",
            "next_hearing": "2025-08-22",
            "scraped_at": datetime.now().isoformat()
        }
    ]
    
    result = {
        "status": "success",
        "arraignment_cases": mock_cases,
        "stats": {
            "courts_discovered": 1,
            "arraignment_cases_found": len(mock_cases),
            "case_histories_accessed": len(mock_cases),
            "errors": 0
        },
        "timestamp": datetime.now().isoformat()
    }
    
    print(json.dumps(result))
    return 0

if __name__ == "__main__":
    sys.exit(main())