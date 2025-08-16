#!/usr/bin/env python3
"""
Database handler for enhanced Maricopa County scraper.
Handles saving enriched case data to PostgreSQL/Supabase.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor, Json

logger = logging.getLogger(__name__)

class DatabaseHandler:
    """Handle database operations for enriched case data."""
    
    def __init__(self):
        """Initialize database connection."""
        self.connection = None
        self.cursor = None
        self.connect()
    
    def connect(self):
        """Establish database connection."""
        try:
            # Get database URL from environment
            database_url = os.environ.get('DATABASE_URL', 
                'postgresql://postgres:postgres@127.0.0.1:54322/postgres')
            
            self.connection = psycopg2.connect(
                database_url,
                cursor_factory=RealDictCursor
            )
            self.cursor = self.connection.cursor()
            logger.info("Database connected successfully")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def save_enriched_case_data(self, case_data: Dict[str, Any]) -> Optional[int]:
        """
        Save all enriched data to database.
        Returns the case_id if successful.
        """
        try:
            # Start transaction
            self.connection.autocommit = False
            
            # 1. Save or update main case
            case_id = self.save_case(case_data)
            
            if not case_id:
                raise Exception("Failed to save case")
            
            # 2. Save ALL charges (delete existing first to avoid duplicates)
            self.cursor.execute(
                "DELETE FROM case_charges WHERE case_id = %s",
                (case_id,)
            )
            for charge in case_data.get('charges', []):
                self.save_charge(case_id, charge)
            
            # 3. Save ALL parties (delete existing first)
            self.cursor.execute(
                "DELETE FROM case_parties WHERE case_id = %s",
                (case_id,)
            )
            for party in case_data.get('parties', []):
                self.save_party(case_id, party)
            
            # 4. Save documents (delete existing first)
            self.cursor.execute(
                "DELETE FROM case_documents WHERE case_id = %s",
                (case_id,)
            )
            for doc in case_data.get('documents', []):
                self.save_document(case_id, doc)
            
            # 5. Save events (delete existing first)
            self.cursor.execute(
                "DELETE FROM case_events WHERE case_id = %s",
                (case_id,)
            )
            for event in case_data.get('events', []):
                self.save_event(case_id, event)
            
            # 6. Save judgments (delete existing first)
            self.cursor.execute(
                "DELETE FROM case_judgments WHERE case_id = %s",
                (case_id,)
            )
            for judgment in case_data.get('judgments', []):
                self.save_judgment(case_id, judgment)
            
            # 7. Save calendar entries (delete existing first)
            self.cursor.execute(
                "DELETE FROM case_calendar WHERE case_id = %s",
                (case_id,)
            )
            for calendar_entry in case_data.get('case_calendar', []):
                self.save_calendar_entry(case_id, calendar_entry)
            
            # 8. Save raw data
            self.save_raw_data(case_id, case_data.get('raw_data', {}))
            
            # Commit transaction
            self.connection.commit()
            self.connection.autocommit = True
            
            logger.info(f"Successfully saved enriched data for case {case_data.get('case_number')}")
            return case_id
            
        except Exception as e:
            # Rollback on error
            self.connection.rollback()
            self.connection.autocommit = True
            logger.error(f"Error saving enriched data: {e}")
            return None
    
    def save_case(self, case_data: Dict[str, Any]) -> Optional[int]:
        """Save or update main case record."""
        try:
            # Extract case info
            case_info = case_data.get('case_information', {})
            case_number = case_data.get('case_number') or case_info.get('case_number')
            
            # Calculate next hearing from arraignment date
            next_hearing = None
            if case_data.get('arraignment_date'):
                try:
                    next_hearing = datetime.strptime(case_data['arraignment_date'], '%m/%d/%Y').date()
                except:
                    pass
            
            # Upsert case
            self.cursor.execute("""
                INSERT INTO cases (
                    case_number, court_id, case_title, case_type,
                    case_status, filing_date, judge_name, next_hearing,
                    location, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (case_number) 
                DO UPDATE SET
                    court_id = EXCLUDED.court_id,
                    case_title = EXCLUDED.case_title,
                    case_type = EXCLUDED.case_type,
                    case_status = EXCLUDED.case_status,
                    filing_date = EXCLUDED.filing_date,
                    judge_name = EXCLUDED.judge_name,
                    next_hearing = EXCLUDED.next_hearing,
                    location = EXCLUDED.location,
                    updated_at = NOW()
                RETURNING id
            """, (
                case_number,
                case_data.get('court_id'),
                case_data.get('case_title'),
                case_data.get('case_type') or case_info.get('case_type'),
                case_data.get('status') or case_info.get('case_status'),
                case_data.get('filing_date') or case_info.get('file_date'),
                case_data.get('judge') or case_info.get('judge'),
                next_hearing,
                case_info.get('location')
            ))
            
            result = self.cursor.fetchone()
            return result['id'] if result else None
            
        except Exception as e:
            logger.error(f"Error saving case: {e}")
            return None
    
    def save_charge(self, case_id: int, charge: Dict[str, Any]):
        """Save a charge record."""
        try:
            self.cursor.execute("""
                INSERT INTO case_charges (
                    case_id, party_name, ars_code, description,
                    severity, crime_date, disposition_code,
                    disposition_date, disposition
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                case_id,
                charge.get('party_name'),
                charge.get('ars_code'),
                charge.get('description'),
                charge.get('severity'),
                charge.get('crime_date'),
                charge.get('disposition_code'),
                charge.get('disposition_date'),
                charge.get('disposition')
            ))
            logger.debug(f"  Saved charge: {charge.get('ars_code')}")
        except Exception as e:
            logger.error(f"Error saving charge: {e}")
    
    def save_party(self, case_id: int, party: Dict[str, Any]):
        """Save a party record."""
        try:
            self.cursor.execute("""
                INSERT INTO case_parties (
                    case_id, party_type, party_name, relationship,
                    sex, attorney
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                case_id,
                party.get('party_type'),
                party.get('party_name'),
                party.get('relationship'),
                party.get('sex'),
                party.get('attorney')
            ))
            logger.debug(f"  Saved party: {party.get('party_name')}")
        except Exception as e:
            logger.error(f"Error saving party: {e}")
    
    def save_document(self, case_id: int, document: Dict[str, Any]):
        """Save a document record."""
        try:
            self.cursor.execute("""
                INSERT INTO case_documents (
                    case_id, document_name, document_type,
                    filed_date, filed_by, document_url
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                case_id,
                document.get('document_name'),
                document.get('document_type'),
                document.get('filed_date'),
                document.get('filed_by'),
                document.get('document_url')
            ))
            logger.debug(f"  Saved document: {document.get('document_name')}")
        except Exception as e:
            logger.error(f"Error saving document: {e}")
    
    def save_event(self, case_id: int, event: Dict[str, Any]):
        """Save an event record."""
        try:
            self.cursor.execute("""
                INSERT INTO case_events (
                    case_id, event_date, event_type,
                    event_description, event_result
                ) VALUES (%s, %s, %s, %s, %s)
            """, (
                case_id,
                event.get('event_date'),
                event.get('event_type'),
                event.get('event_description'),
                event.get('event_result')
            ))
            logger.debug(f"  Saved event: {event.get('event_type')}")
        except Exception as e:
            logger.error(f"Error saving event: {e}")
    
    def save_judgment(self, case_id: int, judgment: Dict[str, Any]):
        """Save a judgment record."""
        try:
            self.cursor.execute("""
                INSERT INTO case_judgments (
                    case_id, judgment_date, judgment_type,
                    judgment_amount, judgment_description
                ) VALUES (%s, %s, %s, %s, %s)
            """, (
                case_id,
                judgment.get('judgment_date'),
                judgment.get('judgment_type'),
                judgment.get('judgment_amount', 0.0),
                judgment.get('judgment_description')
            ))
            logger.debug(f"  Saved judgment: {judgment.get('judgment_type')}")
        except Exception as e:
            logger.error(f"Error saving judgment: {e}")
    
    def save_calendar_entry(self, case_id: int, calendar_entry: Dict[str, Any]):
        """Save a calendar entry."""
        try:
            # Parse date and time
            hearing_date = None
            if calendar_entry.get('date'):
                try:
                    date_str = calendar_entry['date']
                    time_str = calendar_entry.get('time', '09:00 AM')
                    datetime_str = f"{date_str} {time_str}"
                    hearing_date = datetime.strptime(datetime_str, '%m/%d/%Y %I:%M %p')
                except:
                    try:
                        hearing_date = datetime.strptime(calendar_entry['date'], '%m/%d/%Y')
                    except:
                        pass
            
            if hearing_date:
                self.cursor.execute("""
                    INSERT INTO case_calendar (
                        case_id, hearing_date, event_type, event_result
                    ) VALUES (%s, %s, %s, %s)
                """, (
                    case_id,
                    hearing_date,
                    calendar_entry.get('event'),
                    calendar_entry.get('result')
                ))
                logger.debug(f"  Saved calendar entry: {calendar_entry.get('event')}")
        except Exception as e:
            logger.error(f"Error saving calendar entry: {e}")
    
    def save_raw_data(self, case_id: int, raw_data: Dict[str, Any]):
        """Save complete raw data as JSON."""
        try:
            # Check if raw data record exists
            self.cursor.execute(
                "SELECT id FROM case_raw_data WHERE case_id = %s",
                (case_id,)
            )
            existing = self.cursor.fetchone()
            
            if existing:
                # Update existing
                self.cursor.execute("""
                    UPDATE case_raw_data
                    SET raw_data = %s, updated_at = NOW()
                    WHERE case_id = %s
                """, (Json(raw_data), case_id))
            else:
                # Insert new
                self.cursor.execute("""
                    INSERT INTO case_raw_data (case_id, raw_data)
                    VALUES (%s, %s)
                """, (case_id, Json(raw_data)))
            
            logger.debug("  Saved raw data")
        except Exception as e:
            logger.error(f"Error saving raw data: {e}")
    
    def get_case_stats(self) -> Dict[str, Any]:
        """Get statistics about saved cases."""
        try:
            stats = {}
            
            # Total cases
            self.cursor.execute("SELECT COUNT(*) as count FROM cases")
            stats['total_cases'] = self.cursor.fetchone()['count']
            
            # Total charges
            self.cursor.execute("SELECT COUNT(*) as count FROM case_charges")
            stats['total_charges'] = self.cursor.fetchone()['count']
            
            # Total parties
            self.cursor.execute("SELECT COUNT(*) as count FROM case_parties")
            stats['total_parties'] = self.cursor.fetchone()['count']
            
            # Total documents
            self.cursor.execute("SELECT COUNT(*) as count FROM case_documents")
            stats['total_documents'] = self.cursor.fetchone()['count']
            
            # Total events
            self.cursor.execute("SELECT COUNT(*) as count FROM case_events")
            stats['total_events'] = self.cursor.fetchone()['count']
            
            # Total judgments
            self.cursor.execute("SELECT COUNT(*) as count FROM case_judgments")
            stats['total_judgments'] = self.cursor.fetchone()['count']
            
            # Cases with multiple charges
            self.cursor.execute("""
                SELECT COUNT(DISTINCT case_id) as count
                FROM case_charges
                GROUP BY case_id
                HAVING COUNT(*) > 1
            """)
            result = self.cursor.fetchall()
            stats['cases_with_multiple_charges'] = len(result)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}
    
    def close(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        logger.info("Database connection closed")


# Integration with enhanced scraper
def integrate_with_scraper():
    """Example of integrating database handler with enhanced scraper."""
    from maricopa_arraignment_scraper_enhanced import MaricopaArraignmentScraperEnhanced
    
    # Create scraper and database handler
    scraper = MaricopaArraignmentScraperEnhanced()
    db_handler = DatabaseHandler()
    
    try:
        # Run scraper
        results = scraper.run()
        
        # Save all cases to database
        saved_count = 0
        for case_data in results.get('data', []):
            case_id = db_handler.save_enriched_case_data(case_data)
            if case_id:
                saved_count += 1
                logger.info(f"Saved case {case_data.get('case_number')} with ID {case_id}")
        
        # Get and log statistics
        stats = db_handler.get_case_stats()
        logger.info(f"Database statistics: {json.dumps(stats, indent=2)}")
        
        return {
            'success': True,
            'cases_scraped': len(results.get('data', [])),
            'cases_saved': saved_count,
            'database_stats': stats
        }
        
    except Exception as e:
        logger.error(f"Integration error: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        db_handler.close()


if __name__ == "__main__":
    # Test database handler
    logging.basicConfig(level=logging.INFO)
    result = integrate_with_scraper()
    print(json.dumps(result, indent=2))