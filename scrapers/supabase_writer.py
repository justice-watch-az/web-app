#!/usr/bin/env python3
"""
Supabase writer for Maricopa County scraper.
Writes scraped arraignment data to production Supabase database.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

class SupabaseWriter:
    """Handle writing scraped data to Supabase."""
    
    def __init__(self):
        """Initialize Supabase connection to PRODUCTION database."""
        # CRITICAL: Use production database from environment
        self.supabase_url = os.environ.get('SUPABASE_URL', 'https://yylmsozhbhqebywavlzr.supabase.co')
        self.supabase_key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_ANON_KEY')
        
        if not self.supabase_key:
            raise ValueError("SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY required for database writes")
        
        # Log which database we're connecting to
        logger.info(f"Connecting to Supabase at: {self.supabase_url}")
        logger.info(f"Using key type: {'SERVICE_KEY' if 'service_role' in self.supabase_key else 'ANON_KEY'}")
        
        # Create Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Verify connection
        self.verify_connection()
    
    def verify_connection(self):
        """Verify we're connected to the correct database."""
        try:
            # Try to read from cases table
            result = self.supabase.table('cases').select('id').limit(1).execute()
            logger.info(f"✅ Connected to Supabase successfully")
            logger.info(f"✅ Database URL: {self.supabase_url}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to Supabase: {e}")
            raise
    
    def save_arraignment_cases(self, cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Save arraignment cases to Supabase.
        Only saves cases with "Arraignment Hearing - Long Form".
        """
        stats = {
            'total_cases': len(cases),
            'saved': 0,
            'skipped': 0,
            'errors': 0
        }
        
        for case in cases:
            try:
                # Verify this is a Long Form arraignment
                next_hearing = case.get('next_hearing', {})
                if 'Long Form' not in next_hearing.get('event', ''):
                    logger.warning(f"Skipping non-Long-Form case: {case.get('case_number')}")
                    stats['skipped'] += 1
                    continue
                
                # Prepare case data for Supabase
                case_data = {
                    'case_number': case.get('case_number'),
                    'court_id': case.get('court_id', '').lower().replace(' justice court', '').replace(' ', '_'),
                    'court_name': case.get('court_name'),
                    'case_title': case.get('case_title'),
                    'case_type': case.get('case_type', 'Criminal Traffic'),
                    'status': case.get('status', 'Pending'),
                    'filing_date': case.get('filing_date'),
                    'judge': case.get('judge'),
                    'location': case.get('court_name'),
                    'case_url': case.get('raw_data', {}).get('case_url'),
                    'scraped_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat(),
                    
                    # Store complex data as JSON
                    'parties': json.dumps(case.get('parties', {})),
                    'docket_entries': json.dumps(case.get('docket_entries', [])),
                    'next_hearing': case.get('arraignment_date'),  # Store the date
                    'raw_data': json.dumps(case.get('raw_data', {})),
                    'events': json.dumps([]),
                    'documents': json.dumps([])
                }
                
                # Check if case already exists
                existing = self.supabase.table('cases').select('id').eq('case_number', case_data['case_number']).execute()
                
                if existing.data:
                    # Update existing case
                    result = self.supabase.table('cases').update(case_data).eq('case_number', case_data['case_number']).execute()
                    logger.info(f"Updated case: {case_data['case_number']}")
                else:
                    # Insert new case
                    result = self.supabase.table('cases').insert(case_data).execute()
                    logger.info(f"Inserted new case: {case_data['case_number']}")
                
                stats['saved'] += 1
                
                # Also save to case_charges table if disposition info exists
                if 'disposition_information' in case.get('raw_data', {}):
                    self.save_charges(result.data[0]['id'], case.get('raw_data', {}).get('disposition_information', []))
                
                # Save calendar entries
                if 'case_calendar' in case.get('raw_data', {}):
                    self.save_calendar(result.data[0]['id'], case.get('raw_data', {}).get('case_calendar', []))
                    
            except Exception as e:
                logger.error(f"Failed to save case {case.get('case_number')}: {e}")
                stats['errors'] += 1
        
        logger.info(f"Database write complete: {stats}")
        return stats
    
    def save_charges(self, case_id: int, charges: List[Dict[str, Any]]):
        """Save charge information to case_charges table."""
        try:
            # Delete existing charges for this case
            self.supabase.table('case_charges').delete().eq('case_id', case_id).execute()
            
            # Insert new charges
            for charge in charges:
                charge_data = {
                    'case_id': case_id,
                    'party_name': charge.get('party_name'),
                    'ars_code': charge.get('ars_code'),
                    'description': charge.get('description'),
                    'crime_date': charge.get('crime_date'),
                    'disposition': charge.get('disposition'),
                    'disposition_date': charge.get('disposition_date'),
                    'created_at': datetime.now().isoformat()
                }
                self.supabase.table('case_charges').insert(charge_data).execute()
                
        except Exception as e:
            logger.error(f"Failed to save charges for case {case_id}: {e}")
    
    def save_calendar(self, case_id: int, calendar_entries: List[Dict[str, Any]]):
        """Save calendar entries to case_calendar table."""
        try:
            # Delete existing calendar entries for this case
            self.supabase.table('case_calendar').delete().eq('case_id', case_id).execute()
            
            # Insert new calendar entries
            for entry in calendar_entries:
                calendar_data = {
                    'case_id': case_id,
                    'hearing_date': entry.get('date'),
                    'hearing_time': entry.get('time'),
                    'event_type': entry.get('event'),
                    'result': entry.get('result'),
                    'created_at': datetime.now().isoformat()
                }
                self.supabase.table('case_calendar').insert(calendar_data).execute()
                
        except Exception as e:
            logger.error(f"Failed to save calendar for case {case_id}: {e}")
    
    def close(self):
        """Close database connection (Supabase handles this automatically)."""
        logger.info("Supabase connection closed")


def write_scraper_results_to_supabase(scraper_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main function to write scraper results to Supabase.
    Called after scraper completes.
    """
    try:
        # Initialize writer
        writer = SupabaseWriter()
        
        # Get arraignment cases from scraper result
        cases = scraper_result.get('arraignment_cases', [])
        
        if not cases:
            logger.warning("No arraignment cases to save")
            return {'status': 'success', 'message': 'No cases to save'}
        
        # Save cases to database
        stats = writer.save_arraignment_cases(cases)
        
        # Close connection
        writer.close()
        
        return {
            'status': 'success',
            'stats': stats,
            'database': writer.supabase_url
        }
        
    except Exception as e:
        logger.error(f"Failed to write to Supabase: {e}")
        return {
            'status': 'error',
            'error': str(e)
        }


if __name__ == "__main__":
    # Test the writer
    logging.basicConfig(level=logging.INFO)
    
    # Test connection
    writer = SupabaseWriter()
    print(f"Connected to: {writer.supabase_url}")