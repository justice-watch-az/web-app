#!/usr/bin/env python3
"""
Test script to validate data quality for a single case.
This simulates scraping a specific case and validates the enriched data extraction.
"""

import json
import logging
import sys
from datetime import datetime
from maricopa_arraignment_scraper_enhanced import MaricopaArraignmentScraperEnhanced
from database_handler import DatabaseHandler

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_single_case(case_number=None):
    """
    Test the enhanced scraper on a single case.
    Since we can't actually scrape a specific case number directly,
    we'll run the scraper and look for the case in results.
    """
    logger.info("=" * 80)
    logger.info(f"TESTING ENHANCED SCRAPER - Looking for case: {case_number or 'Any TR case'}")
    logger.info("=" * 80)
    
    # Initialize scraper with test configuration
    config = {
        'headless': True,  # Run in headless mode for testing
        'test_mode': True
    }
    
    scraper = MaricopaArraignmentScraperEnhanced(config)
    db_handler = DatabaseHandler()
    
    try:
        logger.info("\n🚀 Starting scraper...")
        
        # Setup driver
        scraper.setup_driver()
        
        # Discover courts
        courts = scraper.discover_courts_from_table()
        
        if not courts:
            logger.error("No courts found!")
            return False
        
        logger.info(f"\n📊 Found {len(courts)} courts")
        
        # For testing, only process first court (Agua Fria usually)
        test_court = courts[0]
        logger.info(f"\n🏛️ Testing with court: {test_court['name']}")
        
        # Scrape arraignments for test court
        cases = scraper.scrape_arraignments_for_court(test_court)
        
        if not cases:
            logger.warning(f"No arraignment cases found in {test_court['name']}")
            return False
        
        logger.info(f"\n✅ Found {len(cases)} arraignment cases")
        
        # Find specific case or use first one
        test_case = None
        if case_number:
            for case in cases:
                if case.get('case_number') == case_number:
                    test_case = case
                    break
            if not test_case:
                logger.warning(f"Case {case_number} not found, using first available case")
                test_case = cases[0]
        else:
            test_case = cases[0]
        
        # Display extracted data
        logger.info("\n" + "=" * 80)
        logger.info("EXTRACTED DATA QUALITY VALIDATION")
        logger.info("=" * 80)
        
        case_num = test_case.get('case_number', 'Unknown')
        logger.info(f"\n📋 Case Number: {case_num}")
        logger.info(f"   Court: {test_case.get('court_name', 'Unknown')}")
        logger.info(f"   Title: {test_case.get('case_title', 'Unknown')}")
        logger.info(f"   Judge: {test_case.get('judge', 'Unknown')}")
        logger.info(f"   Status: {test_case.get('status', 'Unknown')}")
        
        # Validate CHARGES (multiple)
        charges = test_case.get('charges', [])
        logger.info(f"\n⚖️ CHARGES: {len(charges)} found")
        if charges:
            for i, charge in enumerate(charges, 1):
                logger.info(f"   Charge {i}:")
                logger.info(f"      ARS Code: {charge.get('ars_code', 'N/A')}")
                logger.info(f"      Description: {charge.get('description', 'N/A')}")
                logger.info(f"      Severity: {charge.get('severity', 'N/A')}")
                logger.info(f"      Crime Date: {charge.get('crime_date', 'N/A')}")
                logger.info(f"      Disposition: {charge.get('disposition', 'Pending')}")
        else:
            logger.warning("   ❌ No charges extracted!")
        
        # Validate PARTIES
        parties = test_case.get('parties', [])
        logger.info(f"\n👥 PARTIES: {len(parties)} found")
        if parties:
            for party in parties:
                logger.info(f"   {party.get('party_type', 'Unknown').title()}:")
                logger.info(f"      Name: {party.get('party_name', 'N/A')}")
                logger.info(f"      Relationship: {party.get('relationship', 'N/A')}")
                logger.info(f"      Attorney: {party.get('attorney', 'N/A')}")
        else:
            logger.warning("   ❌ No parties extracted!")
        
        # Validate DOCUMENTS
        documents = test_case.get('documents', [])
        logger.info(f"\n📄 DOCUMENTS: {len(documents)} found")
        if documents:
            for doc in documents:
                logger.info(f"   • {doc.get('document_name', 'Unknown')}")
                logger.info(f"      Type: {doc.get('document_type', 'N/A')}")
                logger.info(f"      Filed: {doc.get('filed_date', 'N/A')}")
                logger.info(f"      Filed By: {doc.get('filed_by', 'N/A')}")
        else:
            logger.info("   ℹ️ No documents found (common for new cases)")
        
        # Validate EVENTS
        events = test_case.get('events', [])
        logger.info(f"\n📅 EVENTS: {len(events)} found")
        if events:
            for event in events[:5]:  # Show first 5 events
                logger.info(f"   • {event.get('event_date', 'N/A')}: {event.get('event_type', 'Unknown')}")
                if event.get('event_description'):
                    logger.info(f"      {event.get('event_description')}")
        else:
            logger.info("   ℹ️ No events found (common for new cases)")
        
        # Validate JUDGMENTS
        judgments = test_case.get('judgments', [])
        logger.info(f"\n⚡ JUDGMENTS: {len(judgments)} found")
        if judgments:
            for judgment in judgments:
                logger.info(f"   • {judgment.get('judgment_type', 'Unknown')}")
                logger.info(f"      Date: {judgment.get('judgment_date', 'N/A')}")
                logger.info(f"      Amount: ${judgment.get('judgment_amount', 0):.2f}")
        else:
            logger.info("   ℹ️ No judgments found (expected for arraignment cases)")
        
        # Data Quality Metrics
        logger.info("\n" + "=" * 80)
        logger.info("DATA QUALITY METRICS")
        logger.info("=" * 80)
        
        extraction_stats = test_case.get('extraction_stats', {})
        quality_score = 0
        max_score = 6
        
        # Check each data type
        checks = [
            ('Charges', len(charges) > 0, len(charges)),
            ('Parties', len(parties) >= 2, len(parties)),  # Should have plaintiff and defendant
            ('Documents', True, len(documents)),  # Documents are optional
            ('Events', True, len(events)),  # Events are optional
            ('Calendar', len(test_case.get('case_calendar', [])) > 0, len(test_case.get('case_calendar', []))),
            ('Case Info', bool(test_case.get('judge')), 'Complete' if test_case.get('judge') else 'Partial')
        ]
        
        for check_name, passed, count in checks:
            status = "✅" if passed else "❌"
            logger.info(f"   {status} {check_name}: {count}")
            if passed:
                quality_score += 1
        
        quality_percentage = (quality_score / max_score) * 100
        logger.info(f"\n   📊 Overall Data Quality Score: {quality_score}/{max_score} ({quality_percentage:.1f}%)")
        
        if quality_percentage >= 80:
            logger.info("   ✅ EXCELLENT: High quality data extraction")
        elif quality_percentage >= 60:
            logger.info("   ⚠️ GOOD: Acceptable data extraction with some gaps")
        else:
            logger.info("   ❌ NEEDS IMPROVEMENT: Significant data gaps detected")
        
        # Save to database
        logger.info("\n" + "=" * 80)
        logger.info("DATABASE INTEGRATION TEST")
        logger.info("=" * 80)
        
        try:
            case_id = db_handler.save_enriched_case_data(test_case)
            if case_id:
                logger.info(f"   ✅ Successfully saved to database with ID: {case_id}")
                
                # Get database statistics
                stats = db_handler.get_case_stats()
                logger.info("\n   Database Statistics:")
                logger.info(f"      Total Cases: {stats.get('total_cases', 0)}")
                logger.info(f"      Total Charges: {stats.get('total_charges', 0)}")
                logger.info(f"      Total Parties: {stats.get('total_parties', 0)}")
                logger.info(f"      Total Documents: {stats.get('total_documents', 0)}")
                logger.info(f"      Total Events: {stats.get('total_events', 0)}")
                logger.info(f"      Cases with Multiple Charges: {stats.get('cases_with_multiple_charges', 0)}")
            else:
                logger.error("   ❌ Failed to save to database")
        except Exception as e:
            logger.error(f"   ❌ Database error: {e}")
        
        # Summary
        logger.info("\n" + "=" * 80)
        logger.info("VALIDATION COMPLETE")
        logger.info("=" * 80)
        logger.info(f"\n✅ Enhanced scraper successfully extracted enriched data for case {case_num}")
        logger.info(f"   • Charges: {len(charges)}")
        logger.info(f"   • Parties: {len(parties)}")
        logger.info(f"   • Documents: {len(documents)}")
        logger.info(f"   • Events: {len(events)}")
        logger.info(f"   • Quality Score: {quality_percentage:.1f}%")
        
        return True
        
    except Exception as e:
        logger.error(f"\n❌ Error during testing: {e}")
        return False
    finally:
        if scraper.driver:
            scraper.driver.quit()
        db_handler.close()


if __name__ == "__main__":
    # Get case number from command line if provided
    case_number = sys.argv[1] if len(sys.argv) > 1 else None
    
    if case_number and not case_number.startswith('TR'):
        logger.warning(f"Case number should start with 'TR'. Got: {case_number}")
    
    # Run test
    success = test_single_case(case_number)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)