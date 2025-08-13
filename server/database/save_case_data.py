#!/usr/bin/env python3
"""
Save case data to the new normalized database schema.
This shows how the scraper data maps to the relational tables.
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

def save_case_to_database(case_data, db_config):
    """
    Save a case with all its related data to the normalized database schema.
    
    Args:
        case_data: Dictionary containing all scraped case data
        db_config: Database connection configuration
    
    Returns:
        case_id: The ID of the saved case
    """
    conn = psycopg2.connect(**db_config)
    cur = conn.cursor()
    
    try:
        # 1. Insert or update main case record
        cur.execute("""
            INSERT INTO cases (
                case_number, court_id, court_name, case_title, case_type, 
                case_status, filing_date, judge, location, case_url
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (case_number, court_id) 
            DO UPDATE SET
                case_title = EXCLUDED.case_title,
                case_type = EXCLUDED.case_type,
                case_status = EXCLUDED.case_status,
                filing_date = EXCLUDED.filing_date,
                judge = EXCLUDED.judge,
                location = EXCLUDED.location,
                case_url = EXCLUDED.case_url,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (
            case_data['case_number'],
            case_data['court_id'],
            case_data.get('court_name'),
            case_data.get('case_title'),
            case_data['raw_data']['case_information'].get('case_type'),
            case_data['raw_data']['case_information'].get('case_status'),
            parse_date(case_data['raw_data']['case_information'].get('file_date')),
            case_data['raw_data']['case_information'].get('judge'),
            case_data['raw_data']['case_information'].get('location'),
            case_data.get('case_url')
        ))
        
        case_id = cur.fetchone()[0]
        
        # 2. Delete existing related records (for updates)
        cur.execute("DELETE FROM case_parties WHERE case_id = %s", (case_id,))
        cur.execute("DELETE FROM case_charges WHERE case_id = %s", (case_id,))
        cur.execute("DELETE FROM case_calendar WHERE case_id = %s", (case_id,))
        cur.execute("DELETE FROM case_documents WHERE case_id = %s", (case_id,))
        cur.execute("DELETE FROM case_events WHERE case_id = %s", (case_id,))
        cur.execute("DELETE FROM case_judgments WHERE case_id = %s", (case_id,))
        
        # 3. Insert parties
        party_info = case_data['raw_data'].get('party_information', {})
        
        # Insert plaintiff(s)
        if 'plaintiff' in party_info:
            plaintiff = party_info['plaintiff']
            if isinstance(plaintiff, dict):
                cur.execute("""
                    INSERT INTO case_parties (
                        case_id, party_type, party_name, relationship, sex, attorney
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    case_id, 'plaintiff',
                    plaintiff.get('party_name'),
                    plaintiff.get('relationship'),
                    plaintiff.get('sex'),
                    plaintiff.get('attorney')
                ))
        
        # Insert defendant(s)
        if 'defendant' in party_info:
            defendant = party_info['defendant']
            if isinstance(defendant, dict):
                cur.execute("""
                    INSERT INTO case_parties (
                        case_id, party_type, party_name, relationship, sex, attorney
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    case_id, 'defendant',
                    defendant.get('party_name'),
                    defendant.get('relationship'),
                    defendant.get('sex'),
                    defendant.get('attorney')
                ))
        
        # 4. Insert charges/disposition information
        for charge in case_data['raw_data'].get('disposition_information', []):
            # Extract severity from ARS code (e.g., "28-1381A1 (M1)" -> "M1")
            ars_code = charge.get('ars_code', '')
            severity = None
            if '(' in ars_code and ')' in ars_code:
                severity = ars_code[ars_code.find('(')+1:ars_code.find(')')]
            
            cur.execute("""
                INSERT INTO case_charges (
                    case_id, party_name, ars_code, description, crime_date,
                    disposition_code, disposition_date, disposition, severity
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                case_id,
                charge.get('party_name'),
                ars_code,
                charge.get('description'),
                parse_datetime(charge.get('crime_date')),
                charge.get('disposition_code'),
                parse_date(charge.get('disposition_date')),
                charge.get('disposition'),
                severity
            ))
        
        # 5. Insert calendar entries
        for calendar_entry in case_data['raw_data'].get('case_calendar', []):
            cur.execute("""
                INSERT INTO case_calendar (
                    case_id, hearing_date, hearing_time, event_type, result
                ) VALUES (%s, %s, %s, %s, %s)
            """, (
                case_id,
                parse_date(calendar_entry.get('date')),
                parse_time(calendar_entry.get('time')),
                calendar_entry.get('event'),
                calendar_entry.get('result')
            ))
        
        # 6. Insert documents (if any)
        for doc in case_data['raw_data'].get('case_documents', []):
            if isinstance(doc, dict):
                cur.execute("""
                    INSERT INTO case_documents (
                        case_id, document_name, document_type, filed_date, filed_by
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (
                    case_id,
                    doc.get('name'),
                    doc.get('type'),
                    parse_date(doc.get('filed_date')),
                    doc.get('filed_by')
                ))
        
        # 7. Insert events (if any)
        for event in case_data['raw_data'].get('events', []):
            if isinstance(event, dict):
                cur.execute("""
                    INSERT INTO case_events (
                        case_id, event_date, event_type, event_description
                    ) VALUES (%s, %s, %s, %s)
                """, (
                    case_id,
                    parse_date(event.get('date')),
                    event.get('type'),
                    event.get('description')
                ))
        
        # 8. Insert judgments (if any)
        for judgment in case_data['raw_data'].get('judgments', []):
            if isinstance(judgment, dict):
                cur.execute("""
                    INSERT INTO case_judgments (
                        case_id, judgment_date, judgment_type, judgment_description
                    ) VALUES (%s, %s, %s, %s)
                """, (
                    case_id,
                    parse_date(judgment.get('date')),
                    judgment.get('type'),
                    judgment.get('description')
                ))
        
        # 9. Save raw data for backup/reference
        cur.execute("""
            INSERT INTO case_raw_data (case_id, raw_data)
            VALUES (%s, %s)
        """, (case_id, json.dumps(case_data['raw_data'])))
        
        conn.commit()
        print(f"Successfully saved case {case_data['case_number']} with:")
        print(f"  - {len(case_data['raw_data'].get('disposition_information', []))} charges")
        print(f"  - {len(case_data['raw_data'].get('case_calendar', []))} calendar entries")
        print(f"  - {len(case_data['raw_data'].get('case_documents', []))} documents")
        
        return case_id
        
    except Exception as e:
        conn.rollback()
        print(f"Error saving case: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def parse_date(date_str):
    """Parse various date formats to PostgreSQL date."""
    if not date_str:
        return None
    try:
        # Handle MM/DD/YYYY format
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) == 3:
                month, day, year = parts
                return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        return date_str
    except:
        return None

def parse_time(time_str):
    """Parse time string to PostgreSQL time."""
    if not time_str:
        return None
    try:
        # Handle HH:MM format
        if ':' in time_str:
            return time_str + ':00' if len(time_str.split(':')) == 2 else time_str
        return time_str
    except:
        return None

def parse_datetime(datetime_str):
    """Parse datetime string to PostgreSQL timestamp."""
    if not datetime_str:
        return None
    try:
        # Handle "MM/DD/YYYY HH:MM AM/PM" format
        if '/' in datetime_str and ':' in datetime_str:
            # Remove the time portion for now (can be enhanced)
            date_part = datetime_str.split()[0]
            return parse_date(date_part) + ' 00:00:00'
        return datetime_str
    except:
        return None

if __name__ == "__main__":
    # Example usage
    sample_case = {
        'case_number': 'TR2025128220',
        'court_id': 'agua_fria',
        'court_name': 'Agua Fria Justice Court',
        'case_title': 'State of Arizona vs GRACIELA M MARTINEZ PALMA',
        'case_url': 'https://example.com/case',
        'raw_data': {
            'case_information': {
                'case_number': 'TR2025128220',
                'judge': 'Guzman, Joe',
                'file_date': '7/10/2025',
                'location': 'Agua Fria Justice Court',
                'case_type': 'Criminal Traffic',
                'case_status': '01 - New Case'
            },
            'party_information': {
                'plaintiff': {
                    'party_name': '(1) State Of Arizona',
                    'relationship': 'Plaintiff',
                    'sex': 'N/A',
                    'attorney': 'To Be Determined'
                },
                'defendant': {
                    'party_name': 'GRACIELA M MARTINEZ PALMA',
                    'relationship': 'Defendant',
                    'sex': 'Female',
                    'attorney': None
                }
            },
            'disposition_information': [
                {
                    'party_name': 'GRACIELA M MARTINEZ PALMA',
                    'ars_code': '28-1381A1 (M1)',
                    'description': 'DUI-LIQUOR/DRUGS/VAPORS/COMBO',
                    'crime_date': '4/20/2025 12:00 AM',
                    'disposition_code': None,
                    'disposition_date': None,
                    'disposition': None
                },
                # ... more charges
            ],
            'case_calendar': [
                {
                    'date': '8/14/2025',
                    'time': '10:00',
                    'event': 'Arraignment Hearing',
                    'result': ''
                }
            ],
            'case_documents': [],
            'events': [],
            'judgments': []
        }
    }
    
    print("This script demonstrates how to save case data to the normalized schema.")
    print("Each data point gets its own record in the appropriate table.")
    print("\nTables created:")
    print("- cases: Main case information (1 record per case)")
    print("- case_parties: All parties involved (multiple per case)")
    print("- case_charges: All charges/dispositions (multiple per case)")
    print("- case_calendar: All hearings/events (multiple per case)")
    print("- case_documents: All documents (multiple per case)")
    print("- case_events: All case events (multiple per case)")
    print("- case_judgments: All judgments (multiple per case)")
    print("- case_raw_data: Complete raw data backup (1 per case)")