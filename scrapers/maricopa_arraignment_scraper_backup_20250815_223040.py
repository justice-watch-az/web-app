#!/usr/bin/env python3
"""
Arraignment scraper for Maricopa County Justice Courts.
Based on the working multi_level_scraper.py
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


class MaricopaArraignmentScraper:
    """Scraper for Maricopa County arraignment cases."""
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize the scraper."""
        self.config = config or {}
        self.driver: Optional[webdriver.Chrome] = None
        self.base_url = "https://justicecourts.maricopa.gov"
        
        self.stats = {
            'courts_discovered': 0,
            'arraignment_cases_found': 0,
            'case_histories_accessed': 0,
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
                    links = cell.find_elements(By.TAG_NAME, "a")
                    if links:
                        link = links[0]
                        court_name = link.text.strip()
                        
                        if court_name:  # Skip empty cells
                            court = {
                                'name': f"{court_name} Justice Court",
                                'element_text': court_name,
                                'calendar_url': self.driver.current_url,
                                'location': court_name
                            }
                            courts.append(court)
                            logger.info(f"   Found court: {court_name}")
                except:
                    continue
            
            self.stats['courts_discovered'] = len(courts)
            logger.info(f"✅ Discovered {len(courts)} courts from table")
            
            return courts
            
        except Exception as e:
            logger.error(f"❌ Failed to discover courts: {e}")
            return []
    
    def scrape_court_calendar(self, court: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Click on a court name and scrape its calendar for arraignment cases."""
        logger.info(f"📅 Clicking on {court['name']} to view calendar...")
        arraignment_cases = []
        
        try:
            # Go back to main calendar page
            time.sleep(2)  # Rate limiting
            self.driver.get(f"{self.base_url}/app/courtrecords/CourtCalendars")
            
            # Wait for table
            WebDriverWait(self.driver, 20).until(
                EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
            )
            
            # Find and click the court link
            links = self.driver.find_elements(By.PARTIAL_LINK_TEXT, court['element_text'])
            
            if links:
                court_link = links[0]
                logger.info(f"   Clicking on {court['element_text']}...")
                court_link.click()
                
                # Wait for page to load
                time.sleep(3)
                
                # Try to find tables first
                tables = self.driver.find_elements(By.TAG_NAME, "table")
                
                if tables and len(tables) > 0:
                    # Table-based extraction
                    logger.info(f"   Found {len(tables)} tables, extracting cases...")
                    
                    for table in tables:
                        rows = table.find_elements(By.TAG_NAME, "tr")
                        
                        for row in rows:
                            try:
                                cells = row.find_elements(By.TAG_NAME, "td")
                                
                                if len(cells) >= 4:
                                    cell_texts = [cell.text.strip() for cell in cells]
                                    
                                    # Look for case number
                                    case_pattern = re.compile(r'(TR|JC|CC|CT)\d{10}')
                                    case_number = None
                                    
                                    for text in cell_texts:
                                        if case_pattern.search(text):
                                            case_number = case_pattern.search(text).group()
                                            break
                                    
                                    if case_number:
                                        # Check if this is an arraignment
                                        row_text = ' '.join(cell_texts)
                                        if "Arraignment Hearing - Long Form" in row_text:
                                            logger.info(f"   ✅ Found arraignment case: {case_number}")
                                            
                                            # Extract arraignment date and time from the calendar row
                                            # Typically: [case_number, date, time, "Arraignment Hearing - Long Form", ...]
                                            arraignment_date = None
                                            arraignment_time = None
                                            for i, text in enumerate(cell_texts):
                                                # Look for date pattern (MM/DD/YYYY)
                                                if re.match(r'\d{1,2}/\d{1,2}/\d{4}', text):
                                                    arraignment_date = text
                                                # Look for time pattern (HH:MM AM/PM)
                                                elif re.match(r'\d{1,2}:\d{2}\s*(AM|PM)', text):
                                                    arraignment_time = text
                                            
                                            logger.info(f"      Arraignment scheduled for: {arraignment_date} at {arraignment_time}")
                                            
                                            # Find the case link
                                            case_links = row.find_elements(By.TAG_NAME, "a")
                                            for link in case_links:
                                                if case_number in link.text or case_number in link.get_attribute('href', ''):
                                                    # Click to get case details
                                                    logger.info(f"      Clicking case {case_number}...")
                                                    link.click()
                                                    time.sleep(3)
                                                    
                                                    # Extract case details
                                                    raw_data = self.extract_case_details()
                                                    
                                                    # Map to database schema
                                                    case_data = {
                                                        'case_number': case_number,
                                                        'court_id': court['name'].lower().replace(' justice court', '').replace(' ', '_'),
                                                        'case_title': f"State of Arizona vs {raw_data['party_information']['defendant'].get('party_name', 'Unknown')}",
                                                        'filing_date': raw_data['case_information'].get('file_date'),
                                                        'case_type': raw_data['case_information'].get('case_type', 'Criminal Traffic'),
                                                        'status': raw_data['case_information'].get('case_status', 'Pending'),
                                                        'judge': raw_data['case_information'].get('judge'),
                                                        'parties': raw_data['party_information'],
                                                        'docket_entries': raw_data.get('events', []),
                                                        'next_hearing': {'date': arraignment_date, 'time': arraignment_time, 'event': 'Arraignment Hearing - Long Form'},
                                                        'arraignment_date': arraignment_date,  # Store arraignment date explicitly
                                                        'court_name': court['name'],
                                                        'disposition_information': raw_data.get('disposition_information', []),
                                                        'case_documents': raw_data.get('case_documents', []),
                                                        'raw_data': raw_data  # Store all extracted data
                                                    }
                                                    arraignment_cases.append(case_data)
                                                    self.stats['case_histories_accessed'] += 1
                                                    
                                                    # Go back
                                                    self.driver.back()
                                                    time.sleep(2)
                                                    break
                                            
                                            self.stats['arraignment_cases_found'] += 1
                            except Exception as e:
                                logger.debug(f"      Error parsing row: {e}")
                                continue
                
                else:
                    # Text-based extraction (fallback)
                    logger.info("   No tables found, using text-based extraction...")
                    soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                    page_text = soup.get_text()
                    
                    lines = page_text.split('\n')
                    lines = [line.strip() for line in lines if line.strip()]
                    
                    case_pattern = re.compile(r'(TR|CT|JC|CC)\d{10}')
                    
                    i = 0
                    while i < len(lines):
                        line = lines[i]
                        
                        # Check if this line is a case number
                        case_match = case_pattern.match(line)
                        if case_match:
                            case_number = case_match.group()
                            
                            # Look ahead for arraignment
                            if i + 3 < len(lines):
                                event_line = lines[i + 3]
                                
                                # Check for arraignment (handle multi-line format)
                                is_long_form = False
                                if event_line == "Arraignment Hearing - Long Form":
                                    is_long_form = True
                                elif event_line == "Arraignment Hearing" and i + 4 < len(lines):
                                    next_line = lines[i + 4]
                                    if next_line.strip() == "- Long Form":
                                        is_long_form = True
                                
                                if is_long_form and case_number.startswith('TR'):
                                    logger.info(f"   ✅ Found arraignment case: {case_number}")
                                    
                                    # Extract date and time from calendar lines
                                    # Typically layout: case_number, date, time, event
                                    arraignment_date = None
                                    arraignment_time = None
                                    if i + 1 < len(lines):
                                        # Check if next line is a date
                                        if re.match(r'\d{1,2}/\d{1,2}/\d{4}', lines[i + 1]):
                                            arraignment_date = lines[i + 1]
                                            if i + 2 < len(lines) and re.match(r'\d{1,2}:\d{2}\s*(AM|PM)', lines[i + 2]):
                                                arraignment_time = lines[i + 2]
                                    
                                    logger.info(f"      Arraignment scheduled for: {arraignment_date} at {arraignment_time}")
                                    
                                    # CLICK on the case number link instead of building URL
                                    logger.info(f"      Looking for case {case_number} link to click...")
                                    case_links = self.driver.find_elements(By.PARTIAL_LINK_TEXT, case_number)
                                    
                                    if case_links:
                                        logger.info(f"      Clicking on case {case_number} link...")
                                        # Scroll to the element first
                                        self.driver.execute_script("arguments[0].scrollIntoView(true);", case_links[0])
                                        time.sleep(1)
                                        case_links[0].click()
                                        time.sleep(3)
                                        
                                        # Extract case details from the page we navigated to
                                        raw_data = self.extract_case_details()
                                        
                                        # Map to database schema
                                        case_data = {
                                            'case_number': case_number,
                                            'court_id': court['name'].lower().replace(' justice court', '').replace(' ', '_'),
                                            'case_title': f"State of Arizona vs {raw_data['party_information']['defendant'].get('party_name', 'Unknown')}",
                                            'filing_date': raw_data['case_information'].get('file_date'),
                                            'case_type': raw_data['case_information'].get('case_type', 'Criminal Traffic'),
                                            'status': raw_data['case_information'].get('case_status', 'Pending'),
                                            'judge': raw_data['case_information'].get('judge'),
                                            'parties': raw_data['party_information'],
                                            'docket_entries': raw_data.get('events', []),
                                            'next_hearing': {'date': arraignment_date, 'time': arraignment_time, 'event': 'Arraignment Hearing - Long Form'},
                                            'arraignment_date': arraignment_date,  # Store arraignment date explicitly
                                            'court_name': court['name'],
                                            'disposition_information': raw_data.get('disposition_information', []),
                                            'case_documents': raw_data.get('case_documents', []),
                                            'raw_data': raw_data  # Store all extracted data
                                        }
                                        arraignment_cases.append(case_data)
                                        self.stats['case_histories_accessed'] += 1
                                        self.stats['arraignment_cases_found'] += 1
                                        
                                        # Go back to calendar using browser back
                                        self.driver.back()
                                        time.sleep(3)
                                    else:
                                        logger.warning(f"      Could not find clickable link for case {case_number}")
                        
                        i += 1
            
            logger.info(f"   Found {len(arraignment_cases)} arraignment cases in {court['name']}")
            
        except Exception as e:
            logger.error(f"   Error scraping {court['name']}: {e}")
            self.stats['errors'] += 1
        
        return arraignment_cases
    
    def extract_case_details(self) -> Dict[str, Any]:
        """Extract ALL details from case history page in structured format."""
        logger.info("      Extracting all case details...")
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
        
        try:
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # Get all text content for parsing
            full_text = soup.get_text(separator='\n', strip=True)
            case_data['full_text'] = full_text
            
            # Parse text line by line for structured extraction
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            i = 0
            logger.info(f"      Starting to parse {len(lines)} lines")
            while i < len(lines):
                line = lines[i]
                
                # CASE INFORMATION SECTION
                if line == "Case Number:" and i + 1 < len(lines):
                    case_data['case_information']['case_number'] = lines[i + 1]
                    i += 1
                elif line == "Judge:" and i + 1 < len(lines):
                    case_data['case_information']['judge'] = lines[i + 1]
                    i += 1
                elif line == "File Date:" and i + 1 < len(lines):
                    case_data['case_information']['file_date'] = lines[i + 1]
                    i += 1
                elif line == "Location:" and i + 1 < len(lines):
                    case_data['case_information']['location'] = lines[i + 1]
                    i += 1
                elif line == "Case Type:" and i + 1 < len(lines):
                    case_data['case_information']['case_type'] = lines[i + 1]
                    i += 1
                elif line == "Case Status:" and i + 1 < len(lines):
                    case_data['case_information']['case_status'] = lines[i + 1]
                    i += 1
                
                # PARTY INFORMATION SECTION
                elif line == "Plaintiff" and i + 1 < len(lines):
                    # Parse plaintiff info
                    j = i + 1
                    current_plaintiff = {}
                    while j < len(lines) and lines[j] != "Defendant":
                        if lines[j] == "Party Name" and j + 1 < len(lines):
                            current_plaintiff['party_name'] = lines[j + 1]
                            j += 1
                        elif lines[j] == "Relationship" and j + 1 < len(lines):
                            current_plaintiff['relationship'] = lines[j + 1]
                            j += 1
                        elif lines[j] == "Sex" and j + 1 < len(lines):
                            current_plaintiff['sex'] = lines[j + 1]
                            j += 1
                        elif lines[j] == "Attorney" and j + 1 < len(lines):
                            current_plaintiff['attorney'] = lines[j + 1]
                            j += 1
                        j += 1
                    case_data['party_information']['plaintiff'] = current_plaintiff
                    i = j - 1
                
                elif line == "Defendant" and i + 1 < len(lines):
                    # Parse defendant info
                    j = i + 1
                    current_defendant = {}
                    while j < len(lines) and lines[j] != "Disposition Information":
                        if lines[j] == "Party Name" and j + 1 < len(lines):
                            current_defendant['party_name'] = lines[j + 1]
                            j += 1
                        elif lines[j] == "Relationship" and j + 1 < len(lines):
                            current_defendant['relationship'] = lines[j + 1]
                            j += 1
                        elif lines[j] == "Sex" and j + 1 < len(lines):
                            current_defendant['sex'] = lines[j + 1]
                            j += 1
                        elif lines[j] == "Attorney" and j + 1 < len(lines):
                            # Handle empty attorney field
                            if j + 1 < len(lines) and lines[j + 1] not in ["Disposition Information", "Party Name"]:
                                current_defendant['attorney'] = lines[j + 1]
                                j += 1
                            else:
                                current_defendant['attorney'] = None
                        j += 1
                    case_data['party_information']['defendant'] = current_defendant
                    # Don't skip past Disposition Information
                    if j < len(lines) and lines[j] == "Disposition Information":
                        i = j - 1  # Will be incremented to j at end of loop
                    else:
                        i = j - 1
                
                # DISPOSITION INFORMATION SECTION (Multiple charges)
                elif line == "Disposition Information":
                    logger.info(f"      Found Disposition Information at line {i}")
                    j = i + 1
                    while j < len(lines) and lines[j] != "Case Documents":
                        if lines[j] == "Party Name" and j + 1 < len(lines):
                            logger.info(f"        Found Party Name at line {j}: {lines[j + 1]}")
                            charge = {'party_name': lines[j + 1]}
                            j += 2
                            
                            # Parse each charge - collect fields until we hit Disposition
                            while j < len(lines):
                                if lines[j] == "ARSCode" and j + 1 < len(lines):
                                    charge['ars_code'] = lines[j + 1]
                                    j += 2
                                elif lines[j] == "Description" and j + 1 < len(lines):
                                    charge['description'] = lines[j + 1]
                                    j += 2
                                elif lines[j] == "Crime Date" and j + 1 < len(lines):
                                    charge['crime_date'] = lines[j + 1]
                                    j += 2
                                elif lines[j] == "Disposition Code":
                                    # Skip empty disposition code field
                                    j += 1
                                    if j < len(lines) and lines[j] != "Date":
                                        charge['disposition_code'] = lines[j]
                                        j += 1
                                    else:
                                        charge['disposition_code'] = None
                                elif lines[j] == "Date":
                                    # Skip empty date field
                                    j += 1
                                    if j < len(lines) and lines[j] != "Disposition":
                                        charge['disposition_date'] = lines[j]
                                        j += 1
                                    else:
                                        charge['disposition_date'] = None
                                elif lines[j] == "Disposition":
                                    # Skip empty disposition field and save charge
                                    j += 1
                                    if j < len(lines) and lines[j] not in ["Party Name", "Case Documents"]:
                                        charge['disposition'] = lines[j]
                                        j += 1
                                    else:
                                        charge['disposition'] = None
                                    # Save this charge and continue
                                    case_data['disposition_information'].append(charge)
                                    break
                                elif lines[j] in ["Party Name", "Case Documents"]:
                                    # Hit next section or charge
                                    if 'ars_code' in charge:  # Only save if we got some data
                                        case_data['disposition_information'].append(charge)
                                    j -= 1  # Back up to process this line next iteration
                                    break
                                else:
                                    j += 1
                        else:
                            j += 1
                    i = j - 1
                
                # CASE CALENDAR SECTION
                elif line == "Case Calendar":
                    logger.info(f"      Found Case Calendar at line {i}")
                    j = i + 1
                    # Skip headers (Date, Time, Event, Result)
                    if j < len(lines) and lines[j] == "Date":
                        j += 4  # Skip header row
                    
                    while j < len(lines) and lines[j] != "Events":
                        # Check if this looks like a calendar entry (date pattern)
                        if "/" in lines[j] and len(lines[j]) <= 12:  # Date pattern
                            calendar_entry = {
                                'date': lines[j],
                                'time': lines[j + 1] if j + 1 < len(lines) and ":" in lines[j + 1] else "",
                                'event': lines[j + 2] if j + 2 < len(lines) and "Events" not in lines[j + 2] else "",
                                'result': ""  # Result often empty
                            }
                            # Adjust for missing result field
                            if calendar_entry['event'] and "Hearing" in calendar_entry['event']:
                                case_data['case_calendar'].append(calendar_entry)
                                j += 3
                            else:
                                j += 1
                        else:
                            j += 1
                    i = j - 1
                
                # CASE DOCUMENTS SECTION
                elif line == "Case Documents":
                    j = i + 1
                    if j < len(lines):
                        if "no case documents" in lines[j].lower():
                            case_data['case_documents'] = []
                        else:
                            # Parse any documents if they exist
                            while j < len(lines) and lines[j] != "Case Calendar":
                                # Document parsing logic would go here
                                j += 1
                    i = j - 1
                
                # EVENTS SECTION
                elif line == "Events":
                    j = i + 1
                    if j < len(lines):
                        if "no events" in lines[j].lower():
                            case_data['events'] = []
                        else:
                            # Parse any events if they exist
                            while j < len(lines) and lines[j] != "Judgments":
                                # Event parsing logic would go here
                                j += 1
                    i = j - 1
                
                # JUDGMENTS SECTION
                elif line == "Judgments":
                    j = i + 1
                    if j < len(lines):
                        if "no judgments" in lines[j].lower():
                            case_data['judgments'] = []
                        else:
                            # Parse any judgments if they exist
                            while j < len(lines):
                                # Judgment parsing logic would go here
                                j += 1
                    i = j - 1
                
                i += 1
            
            # Debug: Show what sections were found
            logger.info(f"      Reached line {i} of {len(lines)}")
            
            # Add metadata
            case_data['case_url'] = self.driver.current_url
            case_data['scraped_at'] = datetime.now().isoformat()
            
            # Log extraction summary
            logger.info(f"      Extracted Case Info: {len(case_data['case_information'])} fields")
            logger.info(f"      Extracted Charges: {len(case_data['disposition_information'])} charges")
            logger.info(f"      Extracted Calendar: {len(case_data['case_calendar'])} entries")
            
        except Exception as e:
            logger.error(f"      Error extracting case details: {e}")
            case_data['extraction_error'] = str(e)
        
        return case_data
    
    def run(self) -> Dict[str, Any]:
        """Main execution - discover courts and scrape arraignment cases."""
        logger.info("=" * 50)
        logger.info("Starting Maricopa Arraignment Scraper")
        logger.info("=" * 50)
        
        result = {
            'status': 'starting',
            'arraignment_cases': [],
            'stats': self.stats,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            # Initialize driver
            self.setup_driver()
            
            # Discover all courts
            courts = self.discover_courts_from_table()
            
            if not courts:
                logger.warning("No courts discovered, cannot proceed")
                result['status'] = 'error'
                result['error'] = 'No courts found'
                return result
            
            # Process ALL courts
            for court in courts:
                logger.info(f"Processing {court['name']}...")
                cases = self.scrape_court_calendar(court)
                result['arraignment_cases'].extend(cases)
            
            result['status'] = 'success'
            result['stats'] = self.stats
            
            logger.info("=" * 50)
            logger.info("Scraping Complete!")
            logger.info(f"Courts discovered: {self.stats['courts_discovered']}")
            logger.info(f"Arraignment cases found: {self.stats['arraignment_cases_found']}")
            logger.info(f"Case histories accessed: {self.stats['case_histories_accessed']}")
            logger.info(f"Errors: {self.stats['errors']}")
            logger.info("=" * 50)
            
        except Exception as e:
            logger.error(f"Fatal error: {e}")
            result['status'] = 'error'
            result['error'] = str(e)
        
        finally:
            if self.driver:
                self.driver.quit()
        
        return result


if __name__ == "__main__":
    import sys
    
    try:
        # Get config if provided
        config = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        
        # Run the scraper
        scraper = MaricopaArraignmentScraper(config)
        result = scraper.run()
        
        # Output result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)