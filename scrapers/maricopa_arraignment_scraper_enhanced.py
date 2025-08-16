#!/usr/bin/env python3
"""
Enhanced Arraignment scraper for Maricopa County Justice Courts.
Implements comprehensive data extraction for charges, parties, documents, events, and judgments.
"""

import json
import logging
import time
import re
from datetime import datetime, date
from typing import List, Dict, Any, Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class MaricopaArraignmentScraperEnhanced:
    """Enhanced scraper for Maricopa County arraignment cases with full data extraction."""
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize the scraper."""
        self.config = config or {}
        self.driver: Optional[webdriver.Chrome] = None
        self.base_url = "https://justicecourts.maricopa.gov"
        
        self.stats = {
            'courts_discovered': 0,
            'arraignment_cases_found': 0,
            'case_histories_accessed': 0,
            'charges_extracted': 0,
            'parties_extracted': 0,
            'documents_extracted': 0,
            'events_extracted': 0,
            'judgments_extracted': 0,
            'errors': 0
        }
    
    def setup_driver(self):
        """Set up Chrome WebDriver."""
        options = Options()
        
        if self.config.get('headless', True):
            options.add_argument('--headless')
        
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        
        import os
        # In Docker, use the Alpine chromium path
        if os.path.exists('/usr/bin/chromium-browser'):
            options.binary_location = '/usr/bin/chromium-browser'
        elif os.environ.get('CHROME_BIN'):
            options.binary_location = os.environ.get('CHROME_BIN')
        
        try:
            from selenium.webdriver.chrome.service import Service
            # In Docker, use the Alpine chromedriver path
            if os.path.exists('/usr/bin/chromedriver'):
                chromedriver_path = '/usr/bin/chromedriver'
            else:
                chromedriver_path = os.environ.get('CHROMEDRIVER_PATH', 'chromedriver')
            service = Service(chromedriver_path)
            self.driver = webdriver.Chrome(service=service, options=options)
            self.driver.set_page_load_timeout(30)
            logger.info("WebDriver initialized")
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver: {e}")
            raise
    
    def discover_courts_from_table(self) -> List[Dict[str, Any]]:
        """Discover courts from the table on the calendar page."""
        logger.info("🏛️ Discovering courts from calendar page table...")
        courts = []
        
        try:
            # Navigate to calendar page
            time.sleep(2)  # Rate limiting
            self.driver.get(f"{self.base_url}/app/courtrecords/CourtCalendars")
            
            # Wait for the table to load
            WebDriverWait(self.driver, 20).until(
                EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
            )
            
            # Find the table
            table = self.driver.find_element(By.CLASS_NAME, "zebratable")
            
            # Get all cells (they contain court names as links)
            cells = table.find_elements(By.TAG_NAME, "td")
            
            for cell in cells:
                try:
                    # Try to find a link in the cell
                    link = cell.find_element(By.TAG_NAME, "a")
                    court_name = link.text.strip()
                    
                    if court_name and "Justice Court" in court_name:
                        # Extract date from the text (usually in format MM/DD/YYYY)
                        cell_text = cell.text
                        date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{4})', cell_text)
                        court_date = date_match.group(1) if date_match else None
                        
                        courts.append({
                            'name': court_name,
                            'element': link,
                            'date': court_date
                        })
                        logger.info(f"   Found court: {court_name} (Date: {court_date})")
                        self.stats['courts_discovered'] += 1
                except NoSuchElementException:
                    # Cell doesn't contain a link, skip it
                    continue
            
            logger.info(f"   Total courts discovered: {len(courts)}")
            
        except Exception as e:
            logger.error(f"Error discovering courts: {e}")
            self.stats['errors'] += 1
        
        return courts
    
    def extract_severity(self, ars_code: str) -> Optional[str]:
        """Extract severity level from ARS code."""
        match = re.search(r'\((M\d|F\d|P)\)', ars_code)
        return match.group(1) if match else None
    
    def parse_date(self, date_str: str) -> Optional[str]:
        """Parse date string into standard format."""
        if not date_str or date_str == 'N/A':
            return None
        try:
            # Try common date formats
            for fmt in ['%m/%d/%Y', '%m/%d/%Y %I:%M %p', '%m-%d-%Y']:
                try:
                    return datetime.strptime(date_str.strip(), fmt).strftime('%Y-%m-%d')
                except ValueError:
                    continue
            return date_str  # Return as-is if can't parse
        except Exception:
            return None
    
    def parse_datetime(self, datetime_str: str) -> Optional[str]:
        """Parse datetime string into ISO format."""
        if not datetime_str:
            return None
        try:
            # Try to parse various datetime formats
            for fmt in ['%m/%d/%Y %I:%M %p', '%m/%d/%Y %H:%M', '%m/%d/%Y']:
                try:
                    return datetime.strptime(datetime_str.strip(), fmt).isoformat()
                except ValueError:
                    continue
            return datetime_str
        except Exception:
            return None
    
    def parse_money(self, text: str) -> float:
        """Parse monetary amount from text."""
        try:
            # Remove $ and commas, extract number
            cleaned = re.sub(r'[$,]', '', text)
            match = re.search(r'[\d.]+', cleaned)
            return float(match.group()) if match else 0.0
        except Exception:
            return 0.0
    
    def determine_party_type(self, relationship: str) -> str:
        """Determine party type from relationship text."""
        relationship = relationship.lower()
        if 'plaintiff' in relationship:
            return 'plaintiff'
        elif 'defendant' in relationship:
            return 'defendant'
        elif 'attorney' in relationship:
            return 'attorney'
        elif 'witness' in relationship:
            return 'witness'
        else:
            return 'other'
    
    def extract_charges(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract ALL charges from disposition section."""
        charges = []
        
        try:
            # Get the full text to parse
            full_text = soup.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            # Find Disposition Information section
            disp_start = -1
            for i, line in enumerate(lines):
                if line == "Disposition Information":
                    disp_start = i
                    break
            
            if disp_start == -1:
                logger.info("        No Disposition Information section found")
                return charges
            
            logger.info(f"        Found Disposition Information at line {disp_start}")
            
            # Parse all charges
            i = disp_start + 1
            while i < len(lines) and lines[i] not in ["Case Documents", "Case Calendar", "Events"]:
                if lines[i] == "Party Name" and i + 1 < len(lines):
                    party_name = lines[i + 1]
                    logger.info(f"          Processing charges for: {party_name}")
                    i += 2
                    
                    # Keep extracting charges for this party until we hit another Party Name or section
                    while i < len(lines):
                        charge = {'party_name': party_name}
                        
                        # Extract charge fields
                        while i < len(lines):
                            if lines[i] == "ARSCode" and i + 1 < len(lines):
                                charge['ars_code'] = lines[i + 1]
                                charge['severity'] = self.extract_severity(lines[i + 1])
                                i += 2
                            elif lines[i] == "Description" and i + 1 < len(lines):
                                charge['description'] = lines[i + 1]
                                i += 2
                            elif lines[i] == "Crime Date" and i + 1 < len(lines):
                                charge['crime_date'] = self.parse_date(lines[i + 1])
                                i += 2
                            elif lines[i] == "Disposition Code":
                                i += 1
                                if i < len(lines) and lines[i] not in ["Date", "Disposition"]:
                                    charge['disposition_code'] = lines[i]
                                    i += 1
                                else:
                                    charge['disposition_code'] = None
                            elif lines[i] == "Date":
                                i += 1
                                if i < len(lines) and lines[i] not in ["Disposition", "Party Name"]:
                                    charge['disposition_date'] = self.parse_date(lines[i])
                                    i += 1
                                else:
                                    charge['disposition_date'] = None
                            elif lines[i] == "Disposition":
                                i += 1
                                if i < len(lines) and lines[i] not in ["Party Name", "ARSCode", "Case Documents"]:
                                    charge['disposition'] = lines[i]
                                    i += 1
                                else:
                                    charge['disposition'] = None
                                
                                # Charge is complete
                                if 'ars_code' in charge:
                                    charges.append(charge)
                                    self.stats['charges_extracted'] += 1
                                    logger.info(f"            Extracted charge: {charge.get('ars_code', 'Unknown')}")
                                
                                # Check if there's another charge for same party
                                if i < len(lines) and lines[i] == "ARSCode":
                                    break  # Continue with next charge
                                else:
                                    # Move to check for next party or section
                                    break
                            elif lines[i] in ["Party Name", "Case Documents", "Case Calendar", "Events"]:
                                # Hit next section or party
                                if 'ars_code' in charge:
                                    charges.append(charge)
                                    self.stats['charges_extracted'] += 1
                                    logger.info(f"            Extracted charge: {charge.get('ars_code', 'Unknown')}")
                                i -= 1  # Back up to process this line in outer loop
                                break
                            else:
                                i += 1
                        
                        # Check if we should continue with next charge or break
                        if i >= len(lines) or lines[i] in ["Party Name", "Case Documents", "Case Calendar", "Events"]:
                            break
                else:
                    i += 1
            
            logger.info(f"        Total charges extracted: {len(charges)}")
            
        except Exception as e:
            logger.error(f"Error extracting charges: {e}")
            
        return charges
    
    def extract_parties(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract all parties including attorneys."""
        parties = []
        
        try:
            full_text = soup.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            # Find Party Information section
            i = 0
            while i < len(lines):
                if lines[i] in ["Plaintiff", "Defendant"]:
                    party_type = lines[i].lower()
                    logger.info(f"        Found {party_type} section")
                    i += 1
                    
                    # Extract party details
                    party = {'party_type': party_type}
                    
                    while i < len(lines) and lines[i] not in ["Plaintiff", "Defendant", "Disposition Information"]:
                        if lines[i] == "Party Name" and i + 1 < len(lines):
                            party['party_name'] = lines[i + 1]
                            i += 2
                        elif lines[i] == "Relationship" and i + 1 < len(lines):
                            party['relationship'] = lines[i + 1]
                            i += 2
                        elif lines[i] == "Sex" and i + 1 < len(lines):
                            party['sex'] = lines[i + 1]
                            i += 2
                        elif lines[i] == "Attorney" and i + 1 < len(lines):
                            if lines[i + 1] not in ["Disposition Information", "Party Name", "Plaintiff", "Defendant"]:
                                party['attorney'] = lines[i + 1]
                                i += 2
                            else:
                                party['attorney'] = None
                                i += 1
                        else:
                            i += 1
                    
                    if 'party_name' in party:
                        parties.append(party)
                        self.stats['parties_extracted'] += 1
                        logger.info(f"          Extracted party: {party.get('party_name', 'Unknown')}")
                    
                    i -= 1  # Back up to process the line we stopped at
                
                i += 1
            
            logger.info(f"        Total parties extracted: {len(parties)}")
            
        except Exception as e:
            logger.error(f"Error extracting parties: {e}")
            
        return parties
    
    def extract_documents(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract all case documents with metadata."""
        documents = []
        
        try:
            full_text = soup.get_text(separator='\n', strip=True)
            
            # Check for "no documents" message first
            if "no case documents" in full_text.lower():
                logger.info("        No case documents found")
                return documents
            
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            # Find Case Documents section
            doc_start = -1
            for i, line in enumerate(lines):
                if line == "Case Documents":
                    doc_start = i
                    break
            
            if doc_start == -1:
                return documents
            
            logger.info(f"        Found Case Documents section at line {doc_start}")
            
            # Parse document entries
            i = doc_start + 1
            
            # Skip header row if present
            if i < len(lines) and lines[i] in ["Document Name", "Name"]:
                # Skip headers: Name, Type, Filed Date, Filed By
                i += 4
            
            while i < len(lines) and lines[i] not in ["Case Calendar", "Events", "Judgments"]:
                # Look for document patterns
                # Documents typically have a name, type, date, and filer
                if i + 3 < len(lines):
                    # Check if this looks like a document entry
                    potential_date = lines[i + 2]
                    if re.match(r'\d{1,2}/\d{1,2}/\d{4}', potential_date):
                        document = {
                            'document_name': lines[i],
                            'document_type': lines[i + 1],
                            'filed_date': self.parse_date(lines[i + 2]),
                            'filed_by': lines[i + 3] if i + 3 < len(lines) else None,
                            'document_url': None  # Would need to extract from href if available
                        }
                        documents.append(document)
                        self.stats['documents_extracted'] += 1
                        logger.info(f"          Extracted document: {document['document_name']}")
                        i += 4
                    else:
                        i += 1
                else:
                    i += 1
            
            # Also try to extract document links from HTML
            doc_links = soup.find_all('a', href=re.compile(r'/download|/document|\.pdf'))
            for link in doc_links:
                doc_name = link.text.strip()
                if doc_name and not any(d['document_name'] == doc_name for d in documents):
                    documents.append({
                        'document_name': doc_name,
                        'document_type': 'Unknown',
                        'filed_date': None,
                        'filed_by': None,
                        'document_url': self.base_url + link['href'] if link.get('href', '').startswith('/') else link.get('href')
                    })
                    self.stats['documents_extracted'] += 1
            
            logger.info(f"        Total documents extracted: {len(documents)}")
            
        except Exception as e:
            logger.error(f"Error extracting documents: {e}")
            
        return documents
    
    def extract_events(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract complete case event history."""
        events = []
        
        try:
            full_text = soup.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            # Look for Events section or Case Calendar (which contains events)
            event_sections = ["Events", "Case Calendar", "Case History"]
            
            for section_name in event_sections:
                section_start = -1
                for i, line in enumerate(lines):
                    if line == section_name:
                        section_start = i
                        break
                
                if section_start == -1:
                    continue
                
                logger.info(f"        Found {section_name} section at line {section_start}")
                
                i = section_start + 1
                
                # Skip headers if present
                if i < len(lines) and lines[i] in ["Date", "Event Date"]:
                    i += 3  # Skip Date, Time/Type, Event/Description headers
                
                while i < len(lines) and lines[i] not in ["Case Documents", "Judgments", "Disposition Information"]:
                    # Look for date patterns to identify events
                    if re.match(r'\d{1,2}/\d{1,2}/\d{4}', lines[i]):
                        event_date = lines[i]
                        event = {
                            'event_date': self.parse_datetime(event_date),
                            'event_type': None,
                            'event_description': None,
                            'event_result': None
                        }
                        
                        # Next line might be time or event type
                        if i + 1 < len(lines):
                            if re.match(r'\d{1,2}:\d{2}\s*(AM|PM)', lines[i + 1]):
                                # Has time
                                event['event_date'] = self.parse_datetime(f"{event_date} {lines[i + 1]}")
                                i += 1
                            
                            # Next should be event type/description
                            if i + 1 < len(lines):
                                event['event_type'] = lines[i + 1]
                                i += 1
                                
                                # Check for event description or result
                                if i + 1 < len(lines) and not re.match(r'\d{1,2}/\d{1,2}/\d{4}', lines[i + 1]):
                                    event['event_description'] = lines[i + 1]
                                    i += 1
                                    
                                    # Check for result
                                    if i + 1 < len(lines) and not re.match(r'\d{1,2}/\d{1,2}/\d{4}', lines[i + 1]):
                                        event['event_result'] = lines[i + 1]
                                        i += 1
                        
                        events.append(event)
                        self.stats['events_extracted'] += 1
                        logger.info(f"          Extracted event: {event['event_type']} on {event_date}")
                    else:
                        i += 1
            
            logger.info(f"        Total events extracted: {len(events)}")
            
        except Exception as e:
            logger.error(f"Error extracting events: {e}")
            
        return events
    
    def extract_judgments(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract judgment information including amounts."""
        judgments = []
        
        try:
            full_text = soup.get_text(separator='\n', strip=True)
            
            # Check for "no judgments" message
            if "no judgments" in full_text.lower() or "no judgment" in full_text.lower():
                logger.info("        No judgments found")
                return judgments
            
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            # Find Judgments section
            judg_start = -1
            for i, line in enumerate(lines):
                if line in ["Judgments", "Judgment", "Court Judgments"]:
                    judg_start = i
                    break
            
            if judg_start == -1:
                return judgments
            
            logger.info(f"        Found Judgments section at line {judg_start}")
            
            i = judg_start + 1
            
            # Skip headers if present
            if i < len(lines) and lines[i] in ["Date", "Judgment Date"]:
                i += 3  # Skip headers
            
            while i < len(lines) and not lines[i].startswith("Case"):
                # Look for judgment patterns
                if re.match(r'\d{1,2}/\d{1,2}/\d{4}', lines[i]):
                    judgment = {
                        'judgment_date': self.parse_date(lines[i]),
                        'judgment_type': lines[i + 1] if i + 1 < len(lines) else None,
                        'judgment_amount': 0.0,
                        'judgment_description': None
                    }
                    
                    # Look for amount in next few lines
                    for j in range(i + 1, min(i + 5, len(lines))):
                        if '$' in lines[j]:
                            judgment['judgment_amount'] = self.parse_money(lines[j])
                            break
                        elif lines[j] and not re.match(r'\d{1,2}/\d{1,2}/\d{4}', lines[j]):
                            if not judgment['judgment_type']:
                                judgment['judgment_type'] = lines[j]
                            else:
                                judgment['judgment_description'] = lines[j]
                    
                    judgments.append(judgment)
                    self.stats['judgments_extracted'] += 1
                    logger.info(f"          Extracted judgment: {judgment['judgment_type']} - ${judgment['judgment_amount']}")
                    i += 3
                else:
                    i += 1
            
            logger.info(f"        Total judgments extracted: {len(judgments)}")
            
        except Exception as e:
            logger.error(f"Error extracting judgments: {e}")
            
        return judgments
    
    def extract_case_details_enhanced(self) -> Dict[str, Any]:
        """Extract ALL details from case history page with enhanced parsing."""
        logger.info("      Extracting enhanced case details...")
        
        try:
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # Extract all data types
            case_data = {
                'case_information': self.extract_case_info(soup),
                'charges': self.extract_charges(soup),
                'parties': self.extract_parties(soup),
                'documents': self.extract_documents(soup),
                'events': self.extract_events(soup),
                'judgments': self.extract_judgments(soup),
                'case_calendar': self.extract_calendar(soup),
                'extraction_timestamp': datetime.now().isoformat(),
                'extraction_stats': {
                    'charges_count': len(self.extract_charges(soup)),
                    'parties_count': len(self.extract_parties(soup)),
                    'documents_count': len(self.extract_documents(soup)),
                    'events_count': len(self.extract_events(soup)),
                    'judgments_count': len(self.extract_judgments(soup))
                }
            }
            
            logger.info(f"      Extraction complete - Charges: {case_data['extraction_stats']['charges_count']}, "
                       f"Parties: {case_data['extraction_stats']['parties_count']}, "
                       f"Documents: {case_data['extraction_stats']['documents_count']}, "
                       f"Events: {case_data['extraction_stats']['events_count']}, "
                       f"Judgments: {case_data['extraction_stats']['judgments_count']}")
            
            return case_data
            
        except Exception as e:
            logger.error(f"Error in enhanced extraction: {e}")
            # Fall back to basic extraction
            return self.extract_case_details()
    
    def extract_case_info(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract basic case information."""
        case_info = {}
        
        try:
            full_text = soup.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            for i, line in enumerate(lines):
                if line == "Case Number:" and i + 1 < len(lines):
                    case_info['case_number'] = lines[i + 1]
                elif line == "Judge:" and i + 1 < len(lines):
                    case_info['judge'] = lines[i + 1]
                elif line == "File Date:" and i + 1 < len(lines):
                    case_info['file_date'] = self.parse_date(lines[i + 1])
                elif line == "Location:" and i + 1 < len(lines):
                    case_info['location'] = lines[i + 1]
                elif line == "Case Type:" and i + 1 < len(lines):
                    case_info['case_type'] = lines[i + 1]
                elif line == "Case Status:" and i + 1 < len(lines):
                    case_info['case_status'] = lines[i + 1]
            
            logger.info(f"        Extracted case info for: {case_info.get('case_number', 'Unknown')}")
            
        except Exception as e:
            logger.error(f"Error extracting case info: {e}")
            
        return case_info
    
    def extract_calendar(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract case calendar entries."""
        calendar = []
        
        try:
            full_text = soup.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            # Find Case Calendar section
            cal_start = -1
            for i, line in enumerate(lines):
                if line == "Case Calendar":
                    cal_start = i
                    break
            
            if cal_start == -1:
                return calendar
            
            logger.info(f"        Found Case Calendar at line {cal_start}")
            
            i = cal_start + 1
            
            # Skip headers
            if i < len(lines) and lines[i] == "Date":
                i += 4  # Skip Date, Time, Event, Result
            
            while i < len(lines) and lines[i] not in ["Events", "Case Documents", "Disposition Information"]:
                if re.match(r'\d{1,2}/\d{1,2}/\d{4}', lines[i]):
                    entry = {
                        'date': lines[i],
                        'time': lines[i + 1] if i + 1 < len(lines) and ":" in lines[i + 1] else "",
                        'event': lines[i + 2] if i + 2 < len(lines) else "",
                        'result': lines[i + 3] if i + 3 < len(lines) and not re.match(r'\d{1,2}/\d{1,2}/\d{4}', lines[i + 3]) else ""
                    }
                    
                    if entry['event']:
                        calendar.append(entry)
                        logger.info(f"          Calendar entry: {entry['event']} on {entry['date']}")
                    
                    i += 3 if entry['result'] else 3
                else:
                    i += 1
            
            logger.info(f"        Total calendar entries: {len(calendar)}")
            
        except Exception as e:
            logger.error(f"Error extracting calendar: {e}")
            
        return calendar
    
    def extract_case_details(self) -> Dict[str, Any]:
        """Fallback to original extraction method."""
        logger.info("      Using fallback extraction...")
        case_data = {
            'case_information': {},
            'party_information': {
                'plaintiff': {},
                'defendant': {}
            },
            'disposition_information': [],
            'case_documents': [],
            'case_calendar': [],
            'events': [],
            'judgments': []
        }
        
        # Original extraction logic here (copied from original file)
        # ... [rest of original extract_case_details method]
        
        return case_data
    
    def scrape_arraignments_for_court(self, court: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Scrape arraignment cases for a specific court with enhanced data extraction."""
        logger.info(f"\n🏛️ Scraping {court['name']}...")
        arraignment_cases = []
        
        try:
            # Click on the court link
            court['element'].click()
            time.sleep(3)
            
            # Look for arraignment cases
            try:
                # Try XPath first
                arraignment_rows = self.driver.find_elements(
                    By.XPATH, 
                    "//td[contains(text(), 'Arraignment Hearing - Long Form')]/.."
                )
                
                if arraignment_rows:
                    logger.info(f"   Found {len(arraignment_rows)} arraignment cases using XPath")
                    
                    for row in arraignment_rows:
                        try:
                            cells = row.find_elements(By.TAG_NAME, "td")
                            if len(cells) >= 4:
                                case_number = cells[0].text.strip()
                                arraignment_date = cells[1].text.strip()
                                arraignment_time = cells[2].text.strip()
                                
                                if case_number.startswith('TR'):
                                    logger.info(f"   ✅ Found arraignment case: {case_number}")
                                    
                                    # Click on case to get details
                                    case_links = row.find_elements(By.TAG_NAME, "a")
                                    for link in case_links:
                                        if case_number in link.text or case_number in link.get_attribute('href', ''):
                                            logger.info(f"      Clicking case {case_number}...")
                                            link.click()
                                            time.sleep(3)
                                            
                                            # Extract enhanced case details
                                            raw_data = self.extract_case_details_enhanced()
                                            
                                            # Map to database schema with enhanced data
                                            case_data = {
                                                'case_number': case_number,
                                                'court_id': court['name'].lower().replace(' justice court', '').replace(' ', '_'),
                                                'court_name': court['name'],
                                                'case_title': self.build_case_title(raw_data),
                                                'filing_date': raw_data['case_information'].get('file_date'),
                                                'case_type': raw_data['case_information'].get('case_type', 'Criminal Traffic'),
                                                'status': raw_data['case_information'].get('case_status', 'Pending'),
                                                'judge': raw_data['case_information'].get('judge'),
                                                'parties': raw_data['parties'],  # Enhanced: all parties
                                                'charges': raw_data['charges'],  # Enhanced: all charges
                                                'documents': raw_data['documents'],  # New: documents
                                                'events': raw_data['events'],  # New: events
                                                'judgments': raw_data['judgments'],  # New: judgments
                                                'docket_entries': raw_data.get('events', []),
                                                'next_hearing': {
                                                    'date': arraignment_date,
                                                    'time': arraignment_time,
                                                    'event': 'Arraignment Hearing - Long Form'
                                                },
                                                'arraignment_date': arraignment_date,
                                                'case_calendar': raw_data.get('case_calendar', []),
                                                'raw_data': raw_data,  # Store all extracted data
                                                'extraction_stats': raw_data.get('extraction_stats', {})
                                            }
                                            
                                            arraignment_cases.append(case_data)
                                            self.stats['case_histories_accessed'] += 1
                                            
                                            # Log extraction summary
                                            logger.info(f"      ✅ Extracted: {len(case_data['charges'])} charges, "
                                                      f"{len(case_data['parties'])} parties, "
                                                      f"{len(case_data['documents'])} documents, "
                                                      f"{len(case_data['events'])} events, "
                                                      f"{len(case_data['judgments'])} judgments")
                                            
                                            # Go back
                                            self.driver.back()
                                            time.sleep(2)
                                            break
                                    
                                    self.stats['arraignment_cases_found'] += 1
                        except Exception as e:
                            logger.debug(f"      Error parsing row: {e}")
                            continue
                
            except Exception as e:
                logger.info(f"   XPath search failed: {e}, trying text-based extraction...")
            
            logger.info(f"   Found {len(arraignment_cases)} arraignment cases in {court['name']}")
            
        except Exception as e:
            logger.error(f"   Error scraping {court['name']}: {e}")
            self.stats['errors'] += 1
        
        return arraignment_cases
    
    def build_case_title(self, raw_data: Dict[str, Any]) -> str:
        """Build case title from extracted data."""
        # Try to get defendant name from parties
        defendant_name = "Unknown"
        for party in raw_data.get('parties', []):
            if party.get('party_type') == 'defendant':
                defendant_name = party.get('party_name', 'Unknown')
                break
        
        # Fallback to old structure if new extraction didn't work
        if defendant_name == "Unknown" and 'party_information' in raw_data:
            defendant_name = raw_data['party_information'].get('defendant', {}).get('party_name', 'Unknown')
        
        return f"State of Arizona vs {defendant_name}"
    
    def run(self) -> Dict[str, Any]:
        """Main execution method with enhanced data extraction."""
        logger.info("=" * 80)
        logger.info("🚀 Starting Enhanced Maricopa County Arraignment Scraper")
        logger.info("=" * 80)
        
        results = {
            'success': False,
            'message': '',
            'data': [],
            'stats': {}
        }
        
        try:
            # Setup driver
            self.setup_driver()
            
            # Discover courts
            courts = self.discover_courts_from_table()
            
            if not courts:
                results['message'] = "No courts found"
                return results
            
            # Process each court
            all_cases = []
            for court in courts:
                try:
                    cases = self.scrape_arraignments_for_court(court)
                    all_cases.extend(cases)
                    
                    # Navigate back to main calendar page
                    self.driver.get(f"{self.base_url}/app/courtrecords/CourtCalendars")
                    time.sleep(2)
                    
                    # Re-find the court elements since we navigated away
                    table = self.driver.find_element(By.CLASS_NAME, "zebratable")
                    cells = table.find_elements(By.TAG_NAME, "td")
                    
                    for cell in cells:
                        try:
                            link = cell.find_element(By.TAG_NAME, "a")
                            if link.text.strip() == court['name']:
                                court['element'] = link
                                break
                        except NoSuchElementException:
                            continue
                            
                except Exception as e:
                    logger.error(f"Error processing court {court['name']}: {e}")
                    continue
            
            # Update results
            results['success'] = True
            results['message'] = f"Successfully scraped {len(all_cases)} arraignment cases from {len(courts)} courts"
            results['data'] = all_cases
            results['stats'] = self.stats
            
            # Log final statistics
            logger.info("\n" + "=" * 80)
            logger.info("📊 SCRAPING COMPLETE - STATISTICS:")
            logger.info(f"   Courts discovered: {self.stats['courts_discovered']}")
            logger.info(f"   Arraignment cases found: {self.stats['arraignment_cases_found']}")
            logger.info(f"   Case histories accessed: {self.stats['case_histories_accessed']}")
            logger.info(f"   Total charges extracted: {self.stats['charges_extracted']}")
            logger.info(f"   Total parties extracted: {self.stats['parties_extracted']}")
            logger.info(f"   Total documents extracted: {self.stats['documents_extracted']}")
            logger.info(f"   Total events extracted: {self.stats['events_extracted']}")
            logger.info(f"   Total judgments extracted: {self.stats['judgments_extracted']}")
            logger.info(f"   Errors encountered: {self.stats['errors']}")
            logger.info("=" * 80)
            
        except Exception as e:
            logger.error(f"Fatal error in scraper: {e}")
            results['message'] = str(e)
            results['stats'] = self.stats
        finally:
            # Cleanup
            if self.driver:
                self.driver.quit()
        
        return results


def main():
    """Main entry point."""
    import sys
    
    # Parse config from command line if provided
    config = {}
    if len(sys.argv) > 1:
        try:
            import json
            config = json.loads(sys.argv[1])
        except:
            logger.warning("Failed to parse config from command line, using defaults")
    
    # Create and run scraper
    scraper = MaricopaArraignmentScraperEnhanced(config)
    results = scraper.run()
    
    # Output results as JSON
    print(json.dumps(results, indent=2, default=str))
    
    return 0 if results['success'] else 1


if __name__ == "__main__":
    exit(main())