#!/usr/bin/env python3
"""
Refactored Maricopa County Arraignment Scraper
Cleaner, more maintainable version with better separation of concerns
"""

import json
import logging
import time
import re
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# Data Classes for Better Type Safety
# ============================================================================

@dataclass
class Court:
    """Represents a court entity"""
    name: str
    element_text: str
    calendar_url: str
    location: str


@dataclass
class CaseInfo:
    """Basic case information"""
    case_number: str
    case_type: str = ""
    file_date: str = ""
    case_status: str = ""
    judge: str = ""
    location: str = ""


@dataclass
class PartyInfo:
    """Party information in a case"""
    party_name: str
    party_type: str
    relationship: str = ""
    sex: str = ""
    race: str = ""
    dob: str = ""


@dataclass
class ChargeInfo:
    """Charge/citation information"""
    statute: str
    description: str
    level: str = ""
    date: str = ""


@dataclass
class DispositionInfo:
    """Disposition details"""
    statute: str
    description: str
    plea: str = ""
    disposition: str = ""
    disposition_date: str = ""


@dataclass
class ArraignmentCase:
    """Complete arraignment case data"""
    case_number: str
    court_name: str
    case_title: str
    arraignment_date: str
    arraignment_time: str
    case_info: CaseInfo
    parties: Dict[str, PartyInfo] = field(default_factory=dict)
    charges: List[ChargeInfo] = field(default_factory=list)
    dispositions: List[DispositionInfo] = field(default_factory=list)
    events: List[Dict] = field(default_factory=list)
    raw_data: Dict = field(default_factory=dict)


# ============================================================================
# Configuration
# ============================================================================

class ScraperConfig:
    """Scraper configuration"""
    BASE_URL = "https://justicecourts.maricopa.gov"
    CALENDAR_URL = f"{BASE_URL}/app/courtrecords/CourtCalendars"
    
    # Timeouts
    PAGE_LOAD_TIMEOUT = 30
    ELEMENT_WAIT_TIMEOUT = 20
    
    # Rate limiting
    NAVIGATION_DELAY = 2
    CLICK_DELAY = 3
    
    # Patterns
    CASE_NUMBER_PATTERN = re.compile(r'(TR|JC|CC|CT)\d{10}')
    DATE_PATTERN = re.compile(r'\d{1,2}/\d{1,2}/\d{4}')
    TIME_PATTERN = re.compile(r'\d{1,2}:\d{2}\s*(AM|PM)')
    
    # Target hearing type
    TARGET_HEARING = "Arraignment Hearing - Long Form"


# ============================================================================
# WebDriver Manager
# ============================================================================

class WebDriverManager:
    """Manages WebDriver lifecycle and configuration"""
    
    @staticmethod
    def create_driver(headless: bool = True) -> webdriver.Chrome:
        """Create and configure Chrome WebDriver"""
        options = Options()
        
        if headless:
            options.add_argument('--headless')
        
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        
        # Handle Docker environment
        if os.path.exists('/usr/bin/chromium-browser'):
            options.binary_location = '/usr/bin/chromium-browser'
        elif os.environ.get('CHROME_BIN'):
            options.binary_location = os.environ.get('CHROME_BIN')
        
        try:
            from selenium.webdriver.chrome.service import Service
            
            if os.path.exists('/usr/bin/chromedriver'):
                chromedriver_path = '/usr/bin/chromedriver'
            else:
                chromedriver_path = os.environ.get('CHROMEDRIVER_PATH', 'chromedriver')
            
            service = Service(chromedriver_path)
            driver = webdriver.Chrome(service=service, options=options)
            driver.set_page_load_timeout(ScraperConfig.PAGE_LOAD_TIMEOUT)
            
            logger.info("WebDriver initialized successfully")
            return driver
            
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver: {e}")
            raise


# ============================================================================
# Page Parsers
# ============================================================================

class CourtDiscovery:
    """Discovers courts from the calendar page"""
    
    @staticmethod
    def discover_courts(driver: webdriver.Chrome) -> List[Court]:
        """Extract court list from calendar page table"""
        courts = []
        
        try:
            # Navigate to calendar page
            driver.get(ScraperConfig.CALENDAR_URL)
            
            # Wait for table to load
            WebDriverWait(driver, ScraperConfig.ELEMENT_WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
            )
            
            # Extract courts from table cells
            table = driver.find_element(By.CLASS_NAME, "zebratable")
            cells = table.find_elements(By.TAG_NAME, "td")
            
            for cell in cells:
                try:
                    links = cell.find_elements(By.TAG_NAME, "a")
                    if links and links[0].text.strip():
                        court_name = links[0].text.strip()
                        courts.append(Court(
                            name=f"{court_name} Justice Court",
                            element_text=court_name,
                            calendar_url=driver.current_url,
                            location=court_name
                        ))
                        logger.info(f"Found court: {court_name}")
                except Exception:
                    continue
            
            logger.info(f"Discovered {len(courts)} courts")
            return courts
            
        except Exception as e:
            logger.error(f"Failed to discover courts: {e}")
            return []


class CalendarParser:
    """Parses court calendar pages for arraignment cases"""
    
    @staticmethod
    def find_arraignment_cases(driver: webdriver.Chrome) -> List[Dict]:
        """Extract arraignment cases from calendar page"""
        cases = []
        
        # Try table-based extraction first
        tables = driver.find_elements(By.TAG_NAME, "table")
        
        if tables:
            cases = CalendarParser._extract_from_tables(driver, tables)
        else:
            # Fallback to text-based extraction
            cases = CalendarParser._extract_from_text(driver)
        
        return cases
    
    @staticmethod
    def _extract_from_tables(driver: webdriver.Chrome, tables: List) -> List[Dict]:
        """Extract cases from HTML tables"""
        cases = []
        
        for table in tables:
            rows = table.find_elements(By.TAG_NAME, "tr")
            
            for row in rows:
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if len(cells) < 4:
                        continue
                    
                    cell_texts = [cell.text.strip() for cell in cells]
                    row_text = ' '.join(cell_texts)
                    
                    # Check for arraignment case
                    if ScraperConfig.TARGET_HEARING not in row_text:
                        continue
                    
                    # Extract case number
                    case_number = None
                    for text in cell_texts:
                        match = ScraperConfig.CASE_NUMBER_PATTERN.search(text)
                        if match:
                            case_number = match.group()
                            break
                    
                    if not case_number:
                        continue
                    
                    # Extract date and time
                    date, time = CalendarParser._extract_datetime(cell_texts)
                    
                    # Find clickable link
                    links = row.find_elements(By.TAG_NAME, "a")
                    case_link = None
                    for link in links:
                        if case_number in link.text or case_number in link.get_attribute('href', ''):
                            case_link = link
                            break
                    
                    if case_link:
                        cases.append({
                            'case_number': case_number,
                            'date': date,
                            'time': time,
                            'link_element': case_link
                        })
                        logger.info(f"Found arraignment: {case_number} on {date} at {time}")
                    
                except Exception as e:
                    logger.debug(f"Error parsing row: {e}")
                    continue
        
        return cases
    
    @staticmethod
    def _extract_from_text(driver: webdriver.Chrome) -> List[Dict]:
        """Extract cases from page text (fallback method)"""
        cases = []
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        page_text = soup.get_text()
        lines = [line.strip() for line in page_text.split('\n') if line.strip()]
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Check for case number
            case_match = ScraperConfig.CASE_NUMBER_PATTERN.match(line)
            if case_match:
                case_number = case_match.group()
                
                # Look for arraignment hearing
                if i + 3 < len(lines) and ScraperConfig.TARGET_HEARING in ' '.join(lines[i:i+5]):
                    # Extract date and time
                    date = None
                    time = None
                    
                    for j in range(i+1, min(i+4, len(lines))):
                        if not date and ScraperConfig.DATE_PATTERN.match(lines[j]):
                            date = lines[j]
                        elif not time and ScraperConfig.TIME_PATTERN.match(lines[j]):
                            time = lines[j]
                    
                    # Find clickable link
                    links = driver.find_elements(By.PARTIAL_LINK_TEXT, case_number)
                    if links:
                        cases.append({
                            'case_number': case_number,
                            'date': date,
                            'time': time,
                            'link_element': links[0]
                        })
                        logger.info(f"Found arraignment: {case_number}")
            
            i += 1
        
        return cases
    
    @staticmethod
    def _extract_datetime(texts: List[str]) -> tuple:
        """Extract date and time from text list"""
        date = None
        time = None
        
        for text in texts:
            if not date and ScraperConfig.DATE_PATTERN.match(text):
                date = text
            elif not time and ScraperConfig.TIME_PATTERN.match(text):
                time = text
        
        return date, time


class CaseDetailsExtractor:
    """Extracts detailed case information from case pages"""
    
    @staticmethod
    def extract_all_details(driver: webdriver.Chrome) -> Dict:
        """Extract comprehensive case details from current page"""
        details = {}
        
        # Get page source
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        
        # Extract each section
        details['case_information'] = CaseDetailsExtractor._extract_case_info(soup)
        details['party_information'] = CaseDetailsExtractor._extract_parties(soup)
        details['charge_information'] = CaseDetailsExtractor._extract_charges(soup)
        details['events'] = CaseDetailsExtractor._extract_events(soup)
        details['disposition_information'] = CaseDetailsExtractor._extract_dispositions(soup)
        
        return details
    
    @staticmethod
    def _extract_case_info(soup: BeautifulSoup) -> Dict:
        """Extract basic case information"""
        info = {}
        
        # Look for labeled fields
        labels = soup.find_all(['th', 'td', 'strong'])
        
        for label in labels:
            text = label.get_text().strip()
            
            if 'Case Number' in text:
                info['case_number'] = CaseDetailsExtractor._get_next_value(label)
            elif 'Case Type' in text:
                info['case_type'] = CaseDetailsExtractor._get_next_value(label)
            elif 'File Date' in text or 'Filed' in text:
                info['file_date'] = CaseDetailsExtractor._get_next_value(label)
            elif 'Case Status' in text or 'Status' in text:
                info['case_status'] = CaseDetailsExtractor._get_next_value(label)
            elif 'Judge' in text or 'Judicial Officer' in text:
                info['judge'] = CaseDetailsExtractor._get_next_value(label)
        
        return info
    
    @staticmethod
    def _extract_parties(soup: BeautifulSoup) -> Dict:
        """Extract party information"""
        parties = {'defendant': {}, 'plaintiff': {}}
        
        # Find party sections
        text = soup.get_text()
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            if 'Party Information' in line or 'Defendant' in line:
                # Extract defendant info
                j = i + 1
                while j < min(i + 10, len(lines)):
                    if 'Party Name' in lines[j]:
                        parties['defendant']['party_name'] = lines[j + 1] if j + 1 < len(lines) else ""
                    elif 'Sex' in lines[j]:
                        parties['defendant']['sex'] = lines[j + 1] if j + 1 < len(lines) else ""
                    elif 'Race' in lines[j]:
                        parties['defendant']['race'] = lines[j + 1] if j + 1 < len(lines) else ""
                    j += 1
            
            i += 1
        
        return parties
    
    @staticmethod
    def _extract_charges(soup: BeautifulSoup) -> List[Dict]:
        """Extract charge information"""
        charges = []
        
        # Look for charge/citation sections
        text = soup.get_text()
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        i = 0
        while i < len(lines):
            if 'Charge Information' in lines[i] or 'Citation Information' in lines[i]:
                # Extract charges from subsequent lines
                j = i + 1
                current_charge = {}
                
                while j < min(i + 20, len(lines)):
                    if 'Statute' in lines[j]:
                        current_charge['statute'] = lines[j + 1] if j + 1 < len(lines) else ""
                    elif 'Description' in lines[j]:
                        current_charge['description'] = lines[j + 1] if j + 1 < len(lines) else ""
                    elif 'Level' in lines[j]:
                        current_charge['level'] = lines[j + 1] if j + 1 < len(lines) else ""
                    
                    # Check if we've completed a charge
                    if current_charge and 'statute' in current_charge:
                        charges.append(current_charge)
                        current_charge = {}
                    
                    j += 1
            
            i += 1
        
        return charges
    
    @staticmethod
    def _extract_events(soup: BeautifulSoup) -> List[Dict]:
        """Extract case events/calendar"""
        events = []
        
        # Look for events section
        text = soup.get_text()
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        i = 0
        while i < len(lines):
            if 'Case Calendar' in lines[i] or 'Events' in lines[i]:
                # Extract events from subsequent lines
                j = i + 1
                while j < min(i + 50, len(lines)):
                    # Look for date pattern
                    if ScraperConfig.DATE_PATTERN.match(lines[j]):
                        event = {
                            'date': lines[j],
                            'description': lines[j + 1] if j + 1 < len(lines) else ""
                        }
                        events.append(event)
                    j += 1
            i += 1
        
        return events
    
    @staticmethod
    def _extract_dispositions(soup: BeautifulSoup) -> List[Dict]:
        """Extract disposition information"""
        dispositions = []
        
        # Similar pattern to charges
        text = soup.get_text()
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        i = 0
        while i < len(lines):
            if 'Disposition Information' in lines[i]:
                j = i + 1
                current_disp = {}
                
                while j < min(i + 30, len(lines)):
                    if 'Plea' in lines[j]:
                        current_disp['plea'] = lines[j + 1] if j + 1 < len(lines) else ""
                    elif 'Disposition' in lines[j] and 'Date' not in lines[j]:
                        current_disp['disposition'] = lines[j + 1] if j + 1 < len(lines) else ""
                    elif 'Disposition Date' in lines[j]:
                        current_disp['disposition_date'] = lines[j + 1] if j + 1 < len(lines) else ""
                    
                    if current_disp and 'disposition' in current_disp:
                        dispositions.append(current_disp)
                        current_disp = {}
                    
                    j += 1
            i += 1
        
        return dispositions
    
    @staticmethod
    def _get_next_value(element) -> str:
        """Get the next sibling value after a label"""
        next_sibling = element.find_next_sibling()
        if next_sibling:
            return next_sibling.get_text().strip()
        
        # Try parent's next sibling
        parent = element.parent
        if parent:
            next_elem = parent.find_next_sibling()
            if next_elem:
                return next_elem.get_text().strip()
        
        return ""


# ============================================================================
# Main Scraper Class
# ============================================================================

class MaricopaArraignmentScraper:
    """Refactored Maricopa County Arraignment Scraper"""
    
    def __init__(self, headless: bool = True):
        self.driver = None
        self.headless = headless
        self.stats = {
            'courts_discovered': 0,
            'arraignment_cases_found': 0,
            'case_histories_accessed': 0,
            'errors': 0
        }
    
    def initialize(self):
        """Initialize the scraper"""
        try:
            self.driver = WebDriverManager.create_driver(self.headless)
            logger.info("Scraper initialized")
        except Exception as e:
            logger.error(f"Failed to initialize scraper: {e}")
            raise
    
    def scrape_all_arraignments(self) -> List[ArraignmentCase]:
        """Main method to scrape all arraignment cases"""
        all_cases = []
        
        try:
            # Discover courts
            courts = CourtDiscovery.discover_courts(self.driver)
            self.stats['courts_discovered'] = len(courts)
            
            # Process each court
            for court in courts:
                logger.info(f"Processing {court.name}...")
                cases = self._scrape_court_arraignments(court)
                all_cases.extend(cases)
                
                # Rate limiting
                time.sleep(ScraperConfig.NAVIGATION_DELAY)
            
            logger.info(f"Scraping complete. Found {len(all_cases)} arraignment cases")
            
        except Exception as e:
            logger.error(f"Fatal error during scraping: {e}")
            self.stats['errors'] += 1
            
        return all_cases
    
    def _scrape_court_arraignments(self, court: Court) -> List[ArraignmentCase]:
        """Scrape arraignments for a specific court"""
        cases = []
        
        try:
            # Navigate to calendar page
            self.driver.get(ScraperConfig.CALENDAR_URL)
            time.sleep(ScraperConfig.NAVIGATION_DELAY)
            
            # Wait for page to load
            WebDriverWait(self.driver, ScraperConfig.ELEMENT_WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
            )
            
            # Click on court link
            court_links = self.driver.find_elements(By.PARTIAL_LINK_TEXT, court.element_text)
            
            if not court_links:
                logger.warning(f"No link found for {court.name}")
                return cases
            
            court_links[0].click()
            time.sleep(ScraperConfig.CLICK_DELAY)
            
            # Find arraignment cases
            arraignment_refs = CalendarParser.find_arraignment_cases(self.driver)
            self.stats['arraignment_cases_found'] += len(arraignment_refs)
            
            # Process each case
            for ref in arraignment_refs:
                case = self._extract_case_details(ref, court)
                if case:
                    cases.append(case)
                    self.stats['case_histories_accessed'] += 1
            
        except Exception as e:
            logger.error(f"Error processing {court.name}: {e}")
            self.stats['errors'] += 1
        
        return cases
    
    def _extract_case_details(self, case_ref: Dict, court: Court) -> Optional[ArraignmentCase]:
        """Extract detailed information for a case"""
        try:
            # Click on case link
            case_ref['link_element'].click()
            time.sleep(ScraperConfig.CLICK_DELAY)
            
            # Extract details
            details = CaseDetailsExtractor.extract_all_details(self.driver)
            
            # Create case object
            case = ArraignmentCase(
                case_number=case_ref['case_number'],
                court_name=court.name,
                case_title=self._build_case_title(details),
                arraignment_date=case_ref.get('date', ''),
                arraignment_time=case_ref.get('time', ''),
                case_info=CaseInfo(**details.get('case_information', {})),
                parties=details.get('party_information', {}),
                charges=[ChargeInfo(**c) for c in details.get('charge_information', [])],
                dispositions=[DispositionInfo(**d) for d in details.get('disposition_information', [])],
                events=details.get('events', []),
                raw_data=details
            )
            
            # Navigate back
            self.driver.back()
            time.sleep(ScraperConfig.NAVIGATION_DELAY)
            
            return case
            
        except Exception as e:
            logger.error(f"Error extracting details for {case_ref['case_number']}: {e}")
            self.stats['errors'] += 1
            
            # Try to navigate back on error
            try:
                self.driver.back()
            except:
                pass
            
            return None
    
    def _build_case_title(self, details: Dict) -> str:
        """Build case title from party information"""
        parties = details.get('party_information', {})
        defendant = parties.get('defendant', {})
        defendant_name = defendant.get('party_name', 'Unknown')
        return f"State of Arizona vs {defendant_name}"
    
    def get_stats(self) -> Dict:
        """Get scraping statistics"""
        return self.stats
    
    def cleanup(self):
        """Clean up resources"""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("WebDriver closed")
            except Exception as e:
                logger.error(f"Error closing WebDriver: {e}")


# ============================================================================
# Main Execution
# ============================================================================

def main():
    """Main entry point"""
    import sys
    
    # Parse arguments
    config = {}
    if len(sys.argv) > 1:
        try:
            config = json.loads(sys.argv[1])
        except:
            logger.warning("Invalid config JSON, using defaults")
    
    headless = config.get('headless', True)
    
    # Run scraper
    scraper = MaricopaArraignmentScraper(headless=headless)
    
    try:
        logger.info("="*50)
        logger.info("Starting Maricopa Arraignment Scraper (Refactored)")
        logger.info("="*50)
        
        scraper.initialize()
        cases = scraper.scrape_all_arraignments()
        
        # Print results
        logger.info("\n" + "="*50)
        logger.info("SCRAPING COMPLETE")
        logger.info("="*50)
        
        stats = scraper.get_stats()
        logger.info(f"Courts discovered: {stats['courts_discovered']}")
        logger.info(f"Arraignment cases found: {stats['arraignment_cases_found']}")
        logger.info(f"Case histories accessed: {stats['case_histories_accessed']}")
        logger.info(f"Errors encountered: {stats['errors']}")
        
        # Save results
        if cases:
            output = {
                'timestamp': datetime.now().isoformat(),
                'stats': stats,
                'cases': [asdict(case) for case in cases]
            }
            
            with open('arraignment_cases.json', 'w') as f:
                json.dump(output, f, indent=2, default=str)
            
            logger.info(f"Results saved to arraignment_cases.json")
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        
    finally:
        scraper.cleanup()


if __name__ == "__main__":
    main()