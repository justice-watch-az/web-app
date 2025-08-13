#!/usr/bin/env python3
"""
Test Arraignment Scraper - Returns 2 realistic arraignment cases
"""
import json
import sys
from datetime import datetime, timedelta

def generate_test_arraignments():
    """Generate 2 realistic test arraignment cases"""
    
    base_date = datetime.now()
    
    cases = [
        {
            'case_number': 'CR2025-001234',
            'court_id': 'hassayampa',
            'court_name': 'Hassayampa Justice Court',
            'hearing_date': (base_date + timedelta(days=7)).strftime('%m/%d/%Y'),
            'hearing_time': '09:00 AM',
            'hearing_type': 'Arraignment Hearing - Long Form',
            'defendant_name': 'Johnson, Robert Michael',
            'party_name': 'State of Arizona vs. Johnson, Robert Michael',
            'case_url': 'https://justicecourts.maricopa.gov/case/CR2025-001234',
            'calendar_url': 'https://justicecourts.maricopa.gov/hassayampa/calendar',
            'scraped_at': datetime.now().isoformat(),
            'case_title': 'State of Arizona v. Johnson, Robert Michael',
            'filing_date': (base_date - timedelta(days=3)).strftime('%m/%d/%Y'),
            'judge': 'Hon. Patricia Smith',
            'charges': [
                'Count 1: Possession of Dangerous Drug for Sale (Class 2 Felony)',
                'Count 2: Possession of Drug Paraphernalia (Class 6 Felony)'
            ],
            'docket_entries': [
                {
                    'date': (base_date - timedelta(days=3)).strftime('%m/%d/%Y'),
                    'description': 'Long Form Criminal Complaint Filed'
                },
                {
                    'date': (base_date - timedelta(days=3)).strftime('%m/%d/%Y'),
                    'description': 'Summons Issued'
                },
                {
                    'date': base_date.strftime('%m/%d/%Y'),
                    'description': 'Arraignment Scheduled'
                }
            ],
            'raw_data': 'CR2025-001234 | 09:00 AM | Arraignment Hearing - Long Form | Johnson, Robert Michael'
        },
        {
            'case_number': 'CR2025-001456',
            'court_id': 'encanto',
            'court_name': 'Encanto Justice Court',
            'hearing_date': (base_date + timedelta(days=14)).strftime('%m/%d/%Y'),
            'hearing_time': '02:30 PM',
            'hearing_type': 'Arraignment Hearing - Long Form',
            'defendant_name': 'Martinez, Maria Elena',
            'party_name': 'State of Arizona vs. Martinez, Maria Elena',
            'case_url': 'https://justicecourts.maricopa.gov/case/CR2025-001456',
            'calendar_url': 'https://justicecourts.maricopa.gov/encanto/calendar',
            'scraped_at': datetime.now().isoformat(),
            'case_title': 'State of Arizona v. Martinez, Maria Elena',
            'filing_date': (base_date - timedelta(days=5)).strftime('%m/%d/%Y'),
            'judge': 'Hon. James Wilson',
            'charges': [
                'Count 1: Aggravated Assault (Class 3 Felony)',
                'Count 2: Criminal Damage (Class 4 Felony)',
                'Count 3: Disorderly Conduct (Class 1 Misdemeanor)'
            ],
            'docket_entries': [
                {
                    'date': (base_date - timedelta(days=5)).strftime('%m/%d/%Y'),
                    'description': 'Long Form Criminal Complaint Filed'
                },
                {
                    'date': (base_date - timedelta(days=5)).strftime('%m/%d/%Y'),
                    'description': 'Arrest Warrant Issued'
                },
                {
                    'date': (base_date - timedelta(days=2)).strftime('%m/%d/%Y'),
                    'description': 'Defendant Arrested'
                },
                {
                    'date': base_date.strftime('%m/%d/%Y'),
                    'description': 'Arraignment Scheduled - Long Form'
                }
            ],
            'raw_data': 'CR2025-001456 | 02:30 PM | Arraignment Hearing - Long Form | Martinez, Maria Elena'
        }
    ]
    
    return {
        'status': 'success',
        'arraignment_cases': cases,
        'stats': {
            'courts_discovered': 2,
            'dockets_scraped': 2,
            'total_cases_checked': 50,  # Simulating checking many cases
            'arraignment_cases_found': 2,
            'errors': 0
        },
        'timestamp': datetime.now().isoformat()
    }

if __name__ == "__main__":
    try:
        # Get config if provided
        config = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        
        # Generate test data
        result = generate_test_arraignments()
        
        # Print to stdout for the queue processor
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)