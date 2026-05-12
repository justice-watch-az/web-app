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
                
                # Prepare case data for Supabase - ONLY columns that exist in cloud DB
                case_data = {
                    'case_number': case.get('case_number'),
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
                    'next_hearing': case.get('arraignment_date'),  # Store the date
                    'raw_data': json.dumps(case.get('raw_data', {}))  # All detailed data goes here
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
                
                # Get case ID from result
                case_id = None
                if result.data and len(result.data) > 0:
                    case_id = result.data[0]['id']
                elif existing.data and len(existing.data) > 0:
                    case_id = existing.data[0]['id']
                
                if case_id:
                    # Save charges - disposition_information is at the top level of case dict
                    disposition_info = case.get('disposition_information', [])
                    if disposition_info:
                        logger.info(f"Found {len(disposition_info)} charges for case {case_data['case_number']}")
                        self.save_charges(case_id, disposition_info)
                    else:
                        # Also check in raw_data as fallback
                        raw_disposition = case.get('raw_data', {}).get('disposition_information', [])
                        if raw_disposition:
                            logger.info(f"Found {len(raw_disposition)} charges in raw_data for case {case_data['case_number']}")
                            self.save_charges(case_id, raw_disposition)
                        else:
                            logger.info(f"No charges found for case {case_data['case_number']}")
                    
                    # Save calendar entries - check both locations
                    calendar_entries = case.get('case_calendar', []) or case.get('raw_data', {}).get('case_calendar', [])
                    if calendar_entries:
                        self.save_calendar(case_id, calendar_entries)
                    
                    # Save parties - extract from raw_data.party_information
                    party_info = case.get('raw_data', {}).get('party_information', {})
                    if party_info:
                        self.save_parties(case_id, party_info)
                    
            except Exception as e:
                logger.error(f"Failed to save case {case.get('case_number')}: {e}")
                stats['errors'] += 1
        
        logger.info(f"Database write complete: {stats}")
        return stats
    
    def save_charges(self, case_id: int, charges: List[Dict[str, Any]]):
        """Save charge information to case_charges table."""
        if not charges:
            logger.info(f"No charges to save for case {case_id}")
            return
            
        logger.info(f"Attempting to save {len(charges)} charges for case {case_id}")
        
        try:
            # Delete existing charges for this case
            delete_result = self.supabase.table('case_charges').delete().eq('case_id', case_id).execute()
            logger.info(f"Deleted {len(delete_result.data) if delete_result.data else 0} existing charges")
            
            # Insert new charges
            saved_count = 0
            for idx, charge in enumerate(charges):
                # Prepare charge data - handle empty date strings
                charge_data = {
                    'case_id': case_id,
                    'ars_code': charge.get('ars_code'),
                    'description': charge.get('description'),
                    'crime_date': charge.get('crime_date') or None,
                    'disposition': charge.get('disposition') or None,
                    'created_at': datetime.now().isoformat()
                }
                
                # Only add disposition_date if it's not empty
                disp_date = charge.get('disposition_date')
                if disp_date and disp_date.strip():
                    charge_data['disposition_date'] = disp_date
                else:
                    charge_data['disposition_date'] = None
                
                # Log what we're trying to save
                logger.info(f"Saving charge {idx+1}: ARS {charge_data['ars_code']}")
                
                try:
                    result = self.supabase.table('case_charges').insert(charge_data).execute()
                    if result.data:
                        saved_count += 1
                        logger.info(f"Successfully saved charge {idx+1}")
                    else:
                        logger.error(f"No data returned when saving charge {idx+1}")
                except Exception as e:
                    logger.error(f"Error saving charge {idx+1}: {e}")
                    logger.error(f"Charge data: {charge_data}")
            
            logger.info(f"Saved {saved_count}/{len(charges)} charges for case {case_id}")
                    
        except Exception as e:
            logger.error(f"Failed to save charges for case {case_id}: {e}")
            import traceback
            logger.error(f"Full error: {traceback.format_exc()}")
    
    def save_parties(self, case_id: str, party_information: Dict[str, Any]):
        """Save party information (plaintiff/defendant) to case_parties table."""
        if not party_information:
            logger.info(f"No party information for case {case_id}")
            return
        
        try:
            # Delete existing parties for this case
            self.supabase.table('case_parties').delete().eq('case_id', case_id).execute()
            
            saved_count = 0
            for party_type in ['plaintiff', 'defendant']:
                party = party_information.get(party_type)
                if not party or not party.get('party_name'):
                    continue
                
                party_data = {
                    'case_id': case_id,
                    'party_type': party_type,
                    'party_name': party.get('party_name'),
                    'relationship': party.get('relationship'),
                    'sex': party.get('sex'),
                    'attorney': party.get('attorney'),
                    'created_at': datetime.now().isoformat()
                }
                
                result = self.supabase.table('case_parties').insert(party_data).execute()
                if result.data:
                    saved_count += 1
            
            logger.info(f"Saved {saved_count} parties for case {case_id}")
            
        except Exception as e:
            logger.error(f"Failed to save parties for case {case_id}: {e}")
            import traceback
            logger.error(f"Full error: {traceback.format_exc()}")

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
    
    def backfill_missing_parties(self) -> Dict[str, Any]:
        """
        Backfill party data for existing cases that have party_information in raw_data
        but no entries in the case_parties table.
        """
        stats = {
            'checked': 0,
            'backfilled': 0,
            'skipped': 0,
            'errors': 0
        }
        
        try:
            # Get all cases
            result = self.supabase.table('cases').select('id,case_number,raw_data').execute()
            if not result.data:
                logger.info("No cases found for backfill")
                return stats
            
            cases = result.data
            stats['checked'] = len(cases)
            logger.info(f"Checking {len(cases)} cases for missing parties...")
            
            for case in cases:
                try:
                    case_id = case['id']
                    
                    # Check if parties already exist for this case
                    existing = self.supabase.table('case_parties').select('id').eq('case_id', case_id).execute()
                    if existing.data and len(existing.data) > 0:
                        stats['skipped'] += 1
                        continue
                    
                    # Extract party_information from raw_data
                    raw_data = case.get('raw_data')
                    if not raw_data:
                        stats['skipped'] += 1
                        continue
                    
                    if isinstance(raw_data, str):
                        raw_data = json.loads(raw_data)
                    
                    party_info = raw_data.get('party_information', {})
                    if not party_info:
                        stats['skipped'] += 1
                        continue
                    
                    # Save parties
                    self.save_parties(case_id, party_info)
                    stats['backfilled'] += 1
                    
                except Exception as e:
                    logger.error(f"Backfill error for case {case.get('case_number')}: {e}")
                    stats['errors'] += 1
            
            logger.info(f"Backfill complete: {stats}")
            
        except Exception as e:
            logger.error(f"Backfill failed: {e}")
        
        return stats


def write_scraper_results_to_supabase(scraper_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main function to write scraper results to Supabase.
    Called after scraper completes.
    Always runs backfill for missing parties regardless of new cases found.
    """
    try:
        # Initialize writer
        writer = SupabaseWriter()
        
        stats = {'total_cases': 0, 'saved': 0, 'skipped': 0, 'errors': 0}
        
        # Get arraignment cases from scraper result
        cases = scraper_result.get('arraignment_cases', [])
        
        if cases:
            # Save cases to database
            stats = writer.save_arraignment_cases(cases)
        else:
            logger.warning("No arraignment cases to save — running backfill only")
        
        # ALWAYS run backfill — even when no new cases found
        logger.info("Running party backfill check...")
        backfill_stats = writer.backfill_missing_parties()
        logger.info(f"Backfill results: {backfill_stats}")
        
        # Close connection
        writer.close()
        
        return {
            'status': 'success',
            'stats': stats,
            'backfill': backfill_stats,
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
    
    import sys
    
    writer = SupabaseWriter()
    print(f"Connected to: {writer.supabase_url}")
    
    if len(sys.argv) > 1 and sys.argv[1] == '--backfill':
        print("Running standalone party backfill...")
        stats = writer.backfill_missing_parties()
        print(f"Backfill complete: {stats}")
    else:
        print("Connection verified. Use --backfill to run party backfill.")
    
    writer.close()