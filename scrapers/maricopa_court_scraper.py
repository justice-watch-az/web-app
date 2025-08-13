#!/usr/bin/env python3
"""
Maricopa County Justice Courts Scraper - Arraignment Long Form Cases ONLY
Based on the exact implementation from the reference repository
This scraper ONLY collects "Arraignment Hearing - Long Form" cases as required
"""

import json
import logging
import time
import re
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
import sys

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
    """
    Scraper specifically for Arraignment Hearing - Long Form cases
    from Maricopa County Justice Courts
    """
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize the scraper."""
        self.config = config or {}
        self.driver: Optional[webdriver.Chrome] = None
        self.base_url = "https://justicecourts.maricopa.gov"
        
        # Stats tracking
        self.stats = {
            'courts_discovered': 0,
            'dockets_scraped': 0,
            'total_cases_checked': 0,
            'arraignment_cases_found': 0,
            'errors': 0
        }
        
        self.user_agent = "Justice Watch AZ - Arraignment Monitoring"
    
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
        options.add_argument(f'--user-agent={self.user_agent}')
        
        # Use environment variable if set (for Docker)
        import os
        if os.environ.get('CHROME_BIN'):
            options.binary_location = os.environ.get('CHROME_BIN')
        
        try:
            # Try to use ChromeDriver from environment or default location
            from selenium.webdriver.chrome.service import Service
            chromedriver_path = os.environ.get('CHROMEDRIVER_PATH', 'chromedriver')
            service = Service(chromedriver_path)
            self.driver = webdriver.Chrome(service=service, options=options)
            self.driver.set_page_load_timeout(30)
            logger.info("WebDriver initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver: {e}")
            raise
    
    def discover_courts_from_table(self) -> List[Dict[str, Any]]:
        """
        Discover courts from the table on the calendar page.
        Returns: List of court dictionaries
        """
        logger.info("🏛️ Discovering courts from calendar page...")
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
                                'location': court_name,
                                'active': True
                            }
                            courts.append(court)
                            logger.info(f"   Found court: {court_name}")
                            self.stats['courts_discovered'] += 1
                except:
                    continue
            
            logger.info(f"✅ Discovered {len(courts)} courts")
            
        except TimeoutException:
            logger.error("Timeout waiting for courts table to load")
        except Exception as e:
            logger.error(f"Error discovering courts: {e}")
            self.stats['errors'] += 1
        
        return courts
    
    def scrape_court_calendar(self, court: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Scrape calendar for a specific court by clicking on its link.
        Returns ONLY arraignment long form cases.
        """
        arraignment_cases = []
        
        try:
            logger.info(f"📅 Accessing calendar for {court['name']}...")
            
            # Navigate back to calendar page
            time.sleep(2)  # Rate limiting
            self.driver.get(court['calendar_url'])
            
            # Wait for table and find the court link
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
            )
            
            # Click on the court name
            court_link = self.driver.find_element(
                By.LINK_TEXT, court['element_text']
            )
            court_link.click()
            
            # Wait for docket page to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "table"))
            )
            
            # Parse the docket table
            tables = self.driver.find_elements(By.TAG_NAME, "table")
            
            for table in tables:
                rows = table.find_elements(By.TAG_NAME, "tr")
                
                for row in rows:
                    try:
                        cells = row.find_elements(By.TAG_NAME, "td")
                        if not cells:
                            continue
                        
                        # Extract cell texts
                        cell_texts = [cell.text.strip() for cell in cells]
                        
                        # Look for case number pattern
                        case_number = None
                        case_cell_idx = -1
                        
                        for idx, text in enumerate(cell_texts):
                            # Match case patterns like CR2024-123456
                            if re.match(r'^[A-Z]{2}\d{4}-\d+', text):
                                case_number = text
                                case_cell_idx = idx
                                break
                        
                        if case_number and case_cell_idx >= 0:
                            # Extract fields based on position
                            hearing_date = cell_texts[case_cell_idx + 1] if len(cell_texts) > case_cell_idx + 1 else None
                            hearing_time = cell_texts[case_cell_idx + 2] if len(cell_texts) > case_cell_idx + 2 else None
                            hearing_type = cell_texts[case_cell_idx + 3] if len(cell_texts) > case_cell_idx + 3 else None
                            party_name = cell_texts[case_cell_idx + 4] if len(cell_texts) > case_cell_idx + 4 else None
                            
                            # CRITICAL FILTER: Only process "Arraignment Hearing - Long Form" cases
                            # This is the exact requirement from the reference implementation
                            if hearing_type != "Arraignment Hearing - Long Form":
                                self.stats['total_cases_checked'] += 1
                                continue  # Skip ALL other hearing types
                            
                            logger.info(f"   ✅ Found Arraignment Case: {case_number}")
                            self.stats['arraignment_cases_found'] += 1
                            
                            # Get case detail URL if available
                            case_detail_url = None
                            try:
                                case_links = row.find_elements(By.TAG_NAME, "a")
                                for link in case_links:
                                    if case_number in link.text or case_number in link.get_attribute('href', ''):
                                        case_detail_url = link.get_attribute('href')
                                        break
                            except:
                                pass
                            
                            # Extract defendant name (clean up)
                            defendant_name = None
                            if party_name and party_name != 'Party Name':
                                parties = party_name.replace('  ', '\n').split('\n')
                                for party in parties:
                                    party = party.strip()
                                    if (party and 
                                        not any(skip in party.lower() for skip in ['state of arizona', 'city of', 'town of']) and
                                        len(party) > 5):
                                        defendant_name = party
                                        break
                            
                            # Build case data
                            case_data = {
                                'case_number': case_number,
                                'court_id': court['location'].lower().replace(' ', '_'),
                                'court_name': court['name'],
                                'hearing_date': hearing_date,
                                'hearing_time': hearing_time,
                                'hearing_type': hearing_type,
                                'defendant_name': defendant_name,
                                'party_name': party_name,
                                'case_url': case_detail_url or self.driver.current_url,
                                'calendar_url': court['calendar_url'],
                                'scraped_at': datetime.now().isoformat(),
                                'raw_data': ' | '.join(cell_texts)
                            }
                            
                            # Get additional details if URL is available
                            if case_detail_url:
                                additional_details = self.extract_case_details(case_detail_url)
                                case_data.update(additional_details)
                            
                            arraignment_cases.append(case_data)
                            
                    except Exception as e:
                        logger.debug(f"Error parsing row: {e}")
                        continue
            
            self.stats['dockets_scraped'] += 1
            logger.info(f"   Found {len(arraignment_cases)} arraignment cases for {court['name']}")
            
        except Exception as e:
            logger.error(f"Error scraping court {court['name']}: {e}")
            self.stats['errors'] += 1
        
        return arraignment_cases
    
    def extract_case_details(self, case_url: str) -> Dict[str, Any]:
        """
        Extract detailed case information by navigating to case URL in a new tab.
        """
        details = {}
        
        try:
            # Open new tab
            original_window = self.driver.current_window_handle
            self.driver.execute_script("window.open('');")
            self.driver.switch_to.window(self.driver.window_handles[-1])
            
            # Navigate to case detail page
            time.sleep(1)  # Rate limiting
            self.driver.get(case_url)
            
            # Wait for page to load
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Parse the page
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # Extract case information (adapt based on actual page structure)
            # Look for common patterns in court case pages
            
            # Try to find case title
            case_title = soup.find('h1') or soup.find('h2')
            if case_title:
                details['case_title'] = case_title.text.strip()
            
            # Look for filing date
            filing_date_pattern = re.compile(r'Filing Date:?\s*(\d{1,2}/\d{1,2}/\d{4})', re.IGNORECASE)
            filing_match = filing_date_pattern.search(soup.text)
            if filing_match:
                details['filing_date'] = filing_match.group(1)
            
            # Look for judge
            judge_pattern = re.compile(r'Judge:?\s*([A-Za-z\s]+)', re.IGNORECASE)
            judge_match = judge_pattern.search(soup.text)
            if judge_match:
                details['judge'] = judge_match.group(1).strip()
            
            # Look for charges
            charges = []
            charge_sections = soup.find_all(text=re.compile(r'Count \d+'))
            for charge in charge_sections:
                parent = charge.parent
                if parent:
                    charge_text = parent.text.strip()
                    if charge_text:
                        charges.append(charge_text)
            
            if charges:
                details['charges'] = charges
            
            # Look for docket entries
            docket_entries = []
            docket_table = soup.find('table', {'id': re.compile('docket', re.IGNORECASE)})
            if not docket_table:
                # Try to find any table with docket-like content
                tables = soup.find_all('table')
                for table in tables:
                    if 'docket' in str(table).lower():
                        docket_table = table
                        break
            
            if docket_table:
                rows = docket_table.find_all('tr')
                for row in rows[1:]:  # Skip header
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 2:
                        entry = {
                            'date': cells[0].text.strip(),
                            'description': cells[1].text.strip() if len(cells) > 1 else ''
                        }
                        docket_entries.append(entry)
            
            if docket_entries:
                details['docket_entries'] = docket_entries
            
            # Close the tab and switch back
            self.driver.close()
            self.driver.switch_to.window(original_window)
            
        except Exception as e:
            logger.debug(f"Error extracting case details: {e}")
            # Make sure we're back in the original window
            try:
                self.driver.switch_to.window(self.driver.window_handles[0])
            except:
                pass
        
        return details
    
    def run(self) -> Dict[str, Any]:
        """
        Main execution method.
        Returns dictionary with all arraignment cases found.
        """
        logger.info("=" * 50)
        logger.info("Starting Maricopa County Arraignment Scraper")
        logger.info("FILTER: Only collecting 'Arraignment Hearing - Long Form' cases")
        logger.info("=" * 50)
        
        all_arraignment_cases = []
        
        try:
            # Initialize driver
            self.setup_driver()
            
            # Discover courts
            courts = self.discover_courts_from_table()
            
            if not courts:
                logger.warning("No courts discovered")
                return {
                    'status': 'error',
                    'error': 'No courts found',
                    'stats': self.stats
                }
            
            # Scrape each court's calendar
            for court in courts:
                try:
                    cases = self.scrape_court_calendar(court)
                    all_arraignment_cases.extend(cases)
                    
                    # Progress update
                    logger.info(f"Progress: {self.stats['arraignment_cases_found']} arraignment cases found so far")
                    
                except Exception as e:
                    logger.error(f"Failed to scrape {court['name']}: {e}")
                    continue
            
            # Final summary
            logger.info("=" * 50)
            logger.info("Scraping Complete!")
            logger.info(f"Courts discovered: {self.stats['courts_discovered']}")
            logger.info(f"Dockets scraped: {self.stats['dockets_scraped']}")
            logger.info(f"Total cases checked: {self.stats['total_cases_checked']}")
            logger.info(f"Arraignment cases found: {self.stats['arraignment_cases_found']}")
            logger.info(f"Errors encountered: {self.stats['errors']}")
            logger.info("=" * 50)
            
            return {
                'status': 'success',
                'arraignment_cases': all_arraignment_cases,
                'stats': self.stats,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Fatal error during scraping: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'stats': self.stats
            }
        
        finally:
            # Clean up
            if self.driver:
                try:
                    self.driver.quit()
                except:
                    pass
    
    def cleanup(self):
        """Clean up resources."""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("WebDriver closed")
            except:
                pass


def main():
    """
    Main entry point for the scraper.
    Can be called from command line or imported as module.
    """
    # Parse config from command line if provided
    config = {}
    if len(sys.argv) > 1:
        try:
            config = json.loads(sys.argv[1])
        except:
            config = {}
    
    # Create and run scraper
    scraper = MaricopaArraignmentScraper(config)
    
    try:
        result = scraper.run()
        
        # Output result as JSON for integration
        print(json.dumps(result, indent=2))
        
        # Return appropriate exit code
        if result['status'] == 'success':
            sys.exit(0)
        else:
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({
            'status': 'error',
            'error': str(e)
        }), file=sys.stderr)
        sys.exit(1)
    
    finally:
        scraper.cleanup()


if __name__ == "__main__":
    main()