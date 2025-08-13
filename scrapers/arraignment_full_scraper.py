#!/usr/bin/env python3
"""
Full Arraignment Case Scraper for Maricopa County Justice Courts
Navigates from Calendar List to Case History page to capture ALL information
"""

import json
import sys
import time
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ArraignmentFullScraper:
    """
    Scraper that navigates to Case History pages for complete information
    """
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize the scraper."""
        self.config = config or {}
        self.driver: Optional[webdriver.Chrome] = None
        self.base_url = "https://justicecourts.maricopa.gov"
        
        self.stats = {
            'courts_checked': 0,
            'calendars_scraped': 0,
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
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--window-size=1920,1080')
        
        import os
        if os.environ.get('CHROME_BIN'):
            options.binary_location = os.environ.get('CHROME_BIN')
        
        try:
            from selenium.webdriver.chrome.service import Service
            chromedriver_path = os.environ.get('CHROMEDRIVER_PATH', 'chromedriver')
            service = Service(chromedriver_path)
            self.driver = webdriver.Chrome(service=service, options=options)
            self.driver.set_page_load_timeout(30)
            logger.info("WebDriver initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver: {e}")
            raise
    
    def scrape_agua_fria_arraignments(self) -> List[Dict[str, Any]]:
        """
        Specifically scrape Agua Fria court for arraignment cases
        """
        arraignment_cases = []
        
        try:
            logger.info("🎯 Targeting Agua Fria Justice Court for arraignment cases...")
            
            # Navigate directly to the Court Calendars page as indicated by user
            calendar_url = f"{self.base_url}/app/courtrecords/CourtCalendars"
            logger.info(f"Navigating to Court Calendars page: {calendar_url}")
            self.driver.get(calendar_url)
            
            # Wait for the zebratable to load (this is what the working scraper does!)
            logger.info("Waiting for zebratable to load...")
            try:
                WebDriverWait(self.driver, 20).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
                )
                logger.info("Zebratable found!")
            except TimeoutException:
                logger.warning("Zebratable not found, continuing anyway...")
            
            # Click on Agua Fria court link directly
            logger.info("Looking for Agua Fria court link to click...")
            
            try:
                # Find the zebratable first
                table = self.driver.find_element(By.CLASS_NAME, "zebratable")
                # Find all links in the table
                links = table.find_elements(By.TAG_NAME, "a")
                agua_fria_link = None
                
                for link in links:
                    link_text = link.text.strip()
                    if "Agua Fria" in link_text:
                        agua_fria_link = link
                        logger.info(f"Found Agua Fria link: {link_text}")
                        break
                
                if agua_fria_link:
                    logger.info("Clicking Agua Fria court link...")
                    # Scroll the link into view first
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", agua_fria_link)
                    time.sleep(1)
                    agua_fria_link.click()
                    time.sleep(5)  # Wait for calendar to load
                    
                    # Scroll down on the calendar page too
                    logger.info("Scrolling down on calendar page...")
                    self.driver.execute_script("window.scrollBy(0, 1000)")
                    time.sleep(2)
                else:
                    logger.warning("Agua Fria link not found, checking for other court links...")
                    # Just click the first court link for testing
                    if links:
                        for link in links:
                            href = link.get_attribute("href")
                            if href and "CourtCalendar" in href and link.text.strip():
                                logger.info(f"Clicking court link: {link.text.strip()}")
                                link.click()
                                time.sleep(5)
                                break
            except Exception as e:
                logger.error(f"Error clicking court link: {e}")
            
            logger.info("Calendar loaded. Searching for 'Arraignment Hearing - Long Form' entries...")
            
            # Check the current URL
            current_url = self.driver.current_url
            logger.info(f"Current URL: {current_url}")
            
            # Wait a bit more for calendar data to load
            time.sleep(5)
            
            # Check page source for debugging
            page_source = self.driver.page_source
            if "Arraignment" in page_source:
                logger.info("✅ Found 'Arraignment' in page source!")
            
            # Try to find table rows directly like the working scraper does
            tables = self.driver.find_elements(By.TAG_NAME, "table")
            logger.info(f"Found {len(tables)} table(s) on the page")
            
            # Also try looking for tr elements directly
            all_rows = self.driver.find_elements(By.TAG_NAME, "tr")
            logger.info(f"Found {len(all_rows)} tr elements total")
            
            # If no tables found, use text-based extraction like the working scraper
            if len(tables) == 0:
                logger.info("No tables found, using text-based extraction...")
                soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                page_text = soup.get_text()
                
                # Parse text for arraignment cases
                lines = page_text.split('\n')
                lines = [line.strip() for line in lines if line.strip()]
                
                # Look for case patterns
                case_pattern = re.compile(r'(TR|CT|JC|CC)\d{10}')
                
                for i, line in enumerate(lines):
                    # Check if this is a case number
                    case_match = case_pattern.match(line)
                    if case_match:
                        case_number = case_match.group()
                        
                        # Look ahead for "Arraignment Hearing - Long Form"
                        if i + 3 < len(lines):
                            event_line = lines[i + 3] if i + 3 < len(lines) else ""
                            
                            # Check for arraignment (handle multi-line format)
                            is_long_form = False
                            if event_line == "Arraignment Hearing - Long Form":
                                is_long_form = True
                            elif event_line == "Arraignment Hearing" and i + 4 < len(lines):
                                next_line = lines[i + 4]
                                if next_line.strip() == "- Long Form":
                                    is_long_form = True
                                    
                            if is_long_form:
                                logger.info(f"✅ Found arraignment case via text: {case_number}")
                                self.stats['arraignment_cases_found'] += 1
                                
                                # Try to find and click the case link
                                try:
                                    case_links = self.driver.find_elements(By.PARTIAL_LINK_TEXT, case_number)
                                    if case_links:
                                        logger.info(f"   Clicking case number {case_number}...")
                                        case_links[0].click()
                                        time.sleep(5)
                                        
                                        # Extract case history data
                                        case_details = self.extract_all_case_history_data()
                                        case_details['case_number'] = case_number
                                        arraignment_cases.append(case_details)
                                        self.stats['case_histories_accessed'] += 1
                                        
                                        # Go back to calendar
                                        self.driver.back()
                                        time.sleep(3)
                                except Exception as e:
                                    logger.error(f"Error clicking case {case_number}: {e}")
            
            # Also log some sample content to understand what we're looking at
            elif tables:
                first_table = tables[0]
                sample_rows = first_table.find_elements(By.TAG_NAME, "tr")[:3]
                logger.info("Sample rows from first table:")
                for idx, row in enumerate(sample_rows):
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if cells:
                        cell_texts = [cell.text.strip()[:50] for cell in cells]
                        logger.info(f"  Row {idx}: {' | '.join(cell_texts)}")
            
            for table in tables:
                rows = table.find_elements(By.TAG_NAME, "tr")
                logger.info(f"Checking table with {len(rows)} rows...")
                
                for row in rows:
                    try:
                        # Get all cells in the row
                        cells = row.find_elements(By.TAG_NAME, "td")
                        if not cells:
                            continue
                        
                        # Get cell texts
                        cell_texts = [cell.text.strip() for cell in cells]
                        
                        # Check if this row contains "Arraignment Hearing - Long Form"
                        row_text = ' '.join(cell_texts)
                        
                        # Also check for just "Arraignment" to see what we have
                        if "Arraignment" in row_text or "arraignment" in row_text.lower():
                            logger.info(f"Found row with 'Arraignment': {row_text[:200]}")
                        
                        if "Arraignment Hearing - Long Form" not in row_text:
                            continue
                        
                        logger.info(f"✅ Found arraignment case in row: {row_text[:100]}...")
                        
                        # Find the case number link in this row
                        case_links = row.find_elements(By.TAG_NAME, "a")
                        case_number_link = None
                        case_number = None
                        
                        for link in case_links:
                            link_text = link.text.strip()
                            # Case numbers usually match pattern like CR2025-xxxxxx
                            if link_text and (link_text.startswith('CR') or link_text.startswith('TR')):
                                case_number_link = link
                                case_number = link_text
                                logger.info(f"   Found case number link: {case_number}")
                                break
                        
                        if not case_number_link:
                            logger.warning("   No case number link found in arraignment row")
                            continue
                        
                        # Click on the case number to navigate to Case History page
                        logger.info(f"   Clicking on case {case_number} to access Case History page...")
                        
                        # Store the calendar data first
                        calendar_data = {
                            'case_number': case_number,
                            'calendar_row_data': cell_texts,
                            'hearing_type': 'Arraignment Hearing - Long Form'
                        }
                        
                        # Click the link to go to Case History
                        case_number_link.click()
                        
                        # Wait for Case History page to load
                        WebDriverWait(self.driver, 10).until(
                            EC.presence_of_element_located((By.TAG_NAME, "body"))
                        )
                        
                        # Extract ALL information from Case History page
                        case_details = self.extract_all_case_history_data()
                        
                        # Combine calendar and case history data
                        full_case_data = {**calendar_data, **case_details}
                        full_case_data['scraped_at'] = datetime.now().isoformat()
                        
                        arraignment_cases.append(full_case_data)
                        self.stats['case_histories_accessed'] += 1
                        
                        logger.info(f"   Successfully extracted full case data for {case_number}")
                        
                        # Navigate back to calendar
                        self.driver.back()
                        
                        # Wait for calendar to reload
                        WebDriverWait(self.driver, 10).until(
                            EC.presence_of_element_located((By.TAG_NAME, "table"))
                        )
                        
                    except Exception as e:
                        logger.error(f"Error processing row: {e}")
                        self.stats['errors'] += 1
                        continue
            
            self.stats['arraignment_cases_found'] = len(arraignment_cases)
            logger.info(f"Found {len(arraignment_cases)} arraignment cases in Agua Fria court")
            
        except Exception as e:
            logger.error(f"Error scraping Agua Fria court: {e}")
            self.stats['errors'] += 1
        
        return arraignment_cases
    
    def extract_all_case_history_data(self) -> Dict[str, Any]:
        """
        Extract ALL information from the Case History page
        """
        logger.info("   Extracting all data from Case History page...")
        
        case_data = {}
        
        try:
            # Get the entire page source
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # Extract page title/header
            page_title = soup.find('h1') or soup.find('h2') or soup.find('title')
            if page_title:
                case_data['page_title'] = page_title.text.strip()
            
            # Extract ALL tables and their data
            tables = soup.find_all('table')
            case_data['tables'] = []
            
            for idx, table in enumerate(tables):
                table_data = {
                    'table_index': idx,
                    'headers': [],
                    'rows': []
                }
                
                # Get headers
                headers = table.find_all('th')
                table_data['headers'] = [h.text.strip() for h in headers]
                
                # Get all rows
                rows = table.find_all('tr')
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if cells:
                        row_data = [cell.text.strip() for cell in cells]
                        table_data['rows'].append(row_data)
                
                case_data['tables'].append(table_data)
            
            # Extract all labeled fields (looking for patterns like "Label: Value")
            labeled_fields = {}
            
            # Common patterns in court pages
            patterns = [
                r'([A-Za-z\s]+):\s*([^\n]+)',  # Label: Value
                r'([A-Za-z\s]+)\s+:\s+([^\n]+)',  # Label : Value
            ]
            
            text_content = soup.get_text()
            lines = text_content.split('\n')
            
            for line in lines:
                line = line.strip()
                if ':' in line:
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        label = parts[0].strip()
                        value = parts[1].strip()
                        if label and value and len(label) < 50:  # Reasonable label length
                            labeled_fields[label] = value
            
            case_data['labeled_fields'] = labeled_fields
            
            # Extract all divs with specific classes or IDs
            important_divs = soup.find_all('div', class_=True)
            case_data['div_contents'] = []
            
            for div in important_divs:
                div_class = div.get('class', [])
                if div_class:
                    div_data = {
                        'class': ' '.join(div_class),
                        'content': div.text.strip()
                    }
                    if div_data['content']:  # Only include non-empty divs
                        case_data['div_contents'].append(div_data)
            
            # Extract all links (might contain important references)
            links = soup.find_all('a', href=True)
            case_data['links'] = []
            
            for link in links:
                link_data = {
                    'text': link.text.strip(),
                    'href': link['href']
                }
                if link_data['text']:  # Only include links with text
                    case_data['links'].append(link_data)
            
            # Extract any lists (ul/ol)
            lists = soup.find_all(['ul', 'ol'])
            case_data['lists'] = []
            
            for list_elem in lists:
                items = list_elem.find_all('li')
                list_data = [item.text.strip() for item in items]
                if list_data:
                    case_data['lists'].append(list_data)
            
            # Get the full text content for reference
            case_data['full_text'] = soup.get_text(separator='\n', strip=True)
            
            # Get any specific case information sections
            # Look for common court case sections
            sections_to_find = [
                'case information', 'party information', 'charge information',
                'docket', 'events', 'documents', 'financial', 'sentencing',
                'probation', 'warrants', 'bonds', 'judgments'
            ]
            
            case_data['sections'] = {}
            
            for section_name in sections_to_find:
                # Try to find sections by headers
                section_headers = soup.find_all(text=lambda text: text and section_name.lower() in text.lower())
                
                for header in section_headers:
                    parent = header.parent
                    if parent:
                        # Try to get the next sibling or parent's content
                        section_content = ""
                        next_elem = parent.find_next_sibling()
                        
                        if next_elem:
                            section_content = next_elem.text.strip()
                        else:
                            section_content = parent.parent.text.strip() if parent.parent else parent.text.strip()
                        
                        if section_content:
                            case_data['sections'][section_name] = section_content
            
            logger.info(f"   Extracted {len(case_data.get('tables', []))} tables, "
                       f"{len(case_data.get('labeled_fields', {}))} labeled fields, "
                       f"{len(case_data.get('sections', {}))} sections")
            
        except Exception as e:
            logger.error(f"Error extracting case history data: {e}")
            case_data['extraction_error'] = str(e)
        
        return case_data
    
    def run(self) -> Dict[str, Any]:
        """
        Main execution method - targets Agua Fria court specifically
        """
        logger.info("=" * 50)
        logger.info("Starting Arraignment Full Scraper")
        logger.info("Target: Agua Fria Justice Court")
        logger.info("Filter: Arraignment Hearing - Long Form cases")
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
            
            # Scrape Agua Fria court specifically
            arraignment_cases = self.scrape_agua_fria_arraignments()
            
            result['arraignment_cases'] = arraignment_cases
            result['status'] = 'success'
            result['stats'] = self.stats
            
            logger.info("=" * 50)
            logger.info("Scraping Complete!")
            logger.info(f"Arraignment cases found: {self.stats['arraignment_cases_found']}")
            logger.info(f"Case histories accessed: {self.stats['case_histories_accessed']}")
            logger.info(f"Errors encountered: {self.stats['errors']}")
            logger.info("=" * 50)
            
        except Exception as e:
            logger.error(f"Fatal error during scraping: {e}")
            result['status'] = 'error'
            result['error'] = str(e)
        
        finally:
            if self.driver:
                self.driver.quit()
        
        return result

if __name__ == "__main__":
    try:
        # Get config if provided
        config = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        
        # Run the scraper
        scraper = ArraignmentFullScraper(config)
        result = scraper.run()
        
        # Output result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)