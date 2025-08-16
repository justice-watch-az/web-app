#!/usr/bin/env python3
"""
Test script for enhanced scraper extraction methods.
"""

import logging
from bs4 import BeautifulSoup
from maricopa_arraignment_scraper_enhanced import MaricopaArraignmentScraperEnhanced

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample HTML with multiple charges and parties
SAMPLE_HTML = """
<html>
<body>
<div>
Case Number:
TR2024123456
Judge:
Hon. Jane Smith
File Date:
11/15/2024
Location:
Agua Fria Justice Court
Case Type:
Criminal Traffic
Case Status:
01 - New Case

Plaintiff
Party Name
(1) State Of Arizona
Relationship
Plaintiff
Sex
N/A
Attorney
To Be Determined

Defendant
Party Name
John Doe
Relationship
Defendant
Sex
Male
Attorney
Public Defender

Disposition Information
Party Name
John Doe
ARSCode
28-1381A1 (M1)
Description
DUI-LIQUOR/DRUGS/VAPORS/COMBO
Crime Date
11/01/2024
Disposition Code
Date
Disposition
Party Name
John Doe
ARSCode
28-701A (CV)
Description
SPEED GREATER THAN REASONABLE
Crime Date
11/01/2024
Disposition Code
Date
Disposition
Party Name
John Doe
ARSCode
28-3511A (M2)
Description
AGGRESSIVE DRIVING
Crime Date
11/01/2024
Disposition Code
Date
Disposition

Case Documents
Document Name
Type
Filed Date
Filed By
Initial Complaint
Complaint
11/15/2024
State Attorney
Officer Report
Report
11/16/2024
Officer Smith

Case Calendar
Date
Time
Event
Result
12/01/2024
9:00 AM
Arraignment Hearing - Long Form

12/15/2024
10:00 AM
Pretrial Conference

Events
11/15/2024
Case Filed
New criminal traffic case filed
11/16/2024
Documents Added
Officer report submitted

Judgments
no judgments
</div>
</body>
</html>
"""

def test_extraction():
    """Test all extraction methods."""
    scraper = MaricopaArraignmentScraperEnhanced()
    soup = BeautifulSoup(SAMPLE_HTML, 'html.parser')
    
    print("=" * 80)
    print("TESTING ENHANCED EXTRACTION METHODS")
    print("=" * 80)
    
    # Test charge extraction
    print("\n1. TESTING CHARGE EXTRACTION:")
    charges = scraper.extract_charges(soup)
    print(f"   Found {len(charges)} charges")
    for i, charge in enumerate(charges, 1):
        print(f"   Charge {i}: {charge.get('ars_code')} - {charge.get('description')}")
        print(f"      Severity: {charge.get('severity')}")
    assert len(charges) == 3, f"Expected 3 charges, got {len(charges)}"
    assert charges[0]['ars_code'] == '28-1381A1 (M1)', "First charge ARS code mismatch"
    assert charges[0]['severity'] == 'M1', "First charge severity not extracted"
    print("   ✅ Charge extraction PASSED")
    
    # Test party extraction
    print("\n2. TESTING PARTY EXTRACTION:")
    parties = scraper.extract_parties(soup)
    print(f"   Found {len(parties)} parties")
    for party in parties:
        print(f"   {party.get('party_type')}: {party.get('party_name')} - {party.get('relationship')}")
        if party.get('attorney'):
            print(f"      Attorney: {party.get('attorney')}")
    assert len(parties) == 2, f"Expected 2 parties, got {len(parties)}"
    assert any(p['party_type'] == 'plaintiff' for p in parties), "No plaintiff found"
    assert any(p['party_type'] == 'defendant' for p in parties), "No defendant found"
    print("   ✅ Party extraction PASSED")
    
    # Test document extraction
    print("\n3. TESTING DOCUMENT EXTRACTION:")
    documents = scraper.extract_documents(soup)
    print(f"   Found {len(documents)} documents")
    for doc in documents:
        print(f"   {doc.get('document_name')} ({doc.get('document_type')}) - Filed: {doc.get('filed_date')}")
    assert len(documents) == 2, f"Expected 2 documents, got {len(documents)}"
    assert documents[0]['document_name'] == 'Initial Complaint', "First document name mismatch"
    print("   ✅ Document extraction PASSED")
    
    # Test event extraction
    print("\n4. TESTING EVENT EXTRACTION:")
    events = scraper.extract_events(soup)
    print(f"   Found {len(events)} events")
    for event in events:
        print(f"   {event.get('event_date')}: {event.get('event_type')} - {event.get('event_description')}")
    assert len(events) >= 2, f"Expected at least 2 events, got {len(events)}"
    print("   ✅ Event extraction PASSED")
    
    # Test calendar extraction
    print("\n5. TESTING CALENDAR EXTRACTION:")
    calendar = scraper.extract_calendar(soup)
    print(f"   Found {len(calendar)} calendar entries")
    for entry in calendar:
        print(f"   {entry.get('date')} {entry.get('time')}: {entry.get('event')}")
    assert len(calendar) >= 2, f"Expected at least 2 calendar entries, got {len(calendar)}"
    assert any('Arraignment' in e.get('event', '') for e in calendar), "No arraignment found in calendar"
    print("   ✅ Calendar extraction PASSED")
    
    # Test judgment extraction
    print("\n6. TESTING JUDGMENT EXTRACTION:")
    judgments = scraper.extract_judgments(soup)
    print(f"   Found {len(judgments)} judgments")
    assert len(judgments) == 0, f"Expected 0 judgments (no judgments text), got {len(judgments)}"
    print("   ✅ Judgment extraction PASSED (correctly detected 'no judgments')")
    
    # Test case info extraction
    print("\n7. TESTING CASE INFO EXTRACTION:")
    case_info = scraper.extract_case_info(soup)
    print(f"   Case Number: {case_info.get('case_number')}")
    print(f"   Judge: {case_info.get('judge')}")
    print(f"   File Date: {case_info.get('file_date')}")
    assert case_info['case_number'] == 'TR2024123456', "Case number mismatch"
    assert case_info['judge'] == 'Hon. Jane Smith', "Judge name mismatch"
    print("   ✅ Case info extraction PASSED")
    
    print("\n" + "=" * 80)
    print("ALL EXTRACTION TESTS PASSED ✅")
    print("=" * 80)
    
    # Test statistics
    print("\nEXTRACTION STATISTICS:")
    print(f"  Total charges extracted: {scraper.stats.get('charges_extracted', 0)}")
    print(f"  Total parties extracted: {scraper.stats.get('parties_extracted', 0)}")
    print(f"  Total documents extracted: {scraper.stats.get('documents_extracted', 0)}")
    print(f"  Total events extracted: {scraper.stats.get('events_extracted', 0)}")
    print(f"  Total judgments extracted: {scraper.stats.get('judgments_extracted', 0)}")

if __name__ == "__main__":
    test_extraction()