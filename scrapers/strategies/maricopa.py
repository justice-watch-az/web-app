"""
Maricopa County Superior Court Scraper Strategy
"""
from typing import Dict, List, Optional
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

from .base import BaseScraperStrategy, ScraperConfig


class MaricopaScraperStrategy(BaseScraperStrategy):
    """Maricopa County Superior Court scraper implementation"""
    
    def __init__(self, config: ScraperConfig):
        super().__init__(config)
        self.search_url = f"{config.base_url}/PublicAccess/CaseSearch.aspx"
        self.case_detail_url = f"{config.base_url}/PublicAccess/CaseDetail.aspx"
        
    def search_cases(self, search_params: Dict) -> List[Dict]:
        """
        Search for cases in Maricopa County court system
        
        Args:
            search_params: Dictionary with search criteria
                - search_type: 'arraignment', 'date_range', 'case_number'
                - start_date: Start date for searches
                - end_date: End date for searches
                - case_number: Specific case number to search
                
        Returns:
            List of case summaries
        """
        cases = []
        
        try:
            # Navigate to search page
            self.driver.get(self.search_url)
            time.sleep(2)  # Allow page to load
            
            search_type = search_params.get('search_type', 'arraignment')
            
            if search_type == 'arraignment':
                cases = self._search_arraignments(search_params)
            elif search_type == 'date_range':
                cases = self._search_by_date_range(search_params)
            elif search_type == 'case_number':
                cases = self._search_by_case_number(search_params)
            else:
                self.logger.warning(f"Unknown search type: {search_type}")
            
        except Exception as e:
            self.logger.error(f"Error during case search: {e}")
            raise
        
        return cases
    
    def _search_arraignments(self, params: Dict) -> List[Dict]:
        """Search for arraignment cases"""
        cases = []
        
        try:
            # Click on Criminal/Traffic tab
            criminal_tab = self.wait.until(
                EC.element_to_be_clickable((By.LINK_TEXT, "Criminal/Traffic"))
            )
            criminal_tab.click()
            time.sleep(1)
            
            # Select arraignment court
            court_select = self.driver.find_element(By.ID, "Court")
            for option in court_select.find_elements(By.TAG_NAME, "option"):
                if "Arraignment" in option.text:
                    option.click()
                    break
            
            # Set date range (default to today)
            from datetime import datetime
            today = datetime.now().strftime("%m/%d/%Y")
            
            date_from = self.driver.find_element(By.ID, "DateFrom")
            date_from.clear()
            date_from.send_keys(params.get('start_date', today))
            
            date_to = self.driver.find_element(By.ID, "DateTo")
            date_to.clear()
            date_to.send_keys(params.get('end_date', today))
            
            # Click search
            search_btn = self.driver.find_element(By.ID, "SearchSubmit")
            search_btn.click()
            
            # Wait for results
            time.sleep(3)
            
            # Parse results
            cases = self._parse_search_results()
            
        except Exception as e:
            self.logger.error(f"Error searching arraignments: {e}")
        
        return cases
    
    def _search_by_date_range(self, params: Dict) -> List[Dict]:
        """Search cases by date range"""
        cases = []
        
        try:
            # Select date range search
            date_filed_radio = self.driver.find_element(By.ID, "DateFiled")
            date_filed_radio.click()
            
            # Enter dates
            date_from = self.driver.find_element(By.ID, "DateFiledFrom")
            date_from.clear()
            date_from.send_keys(params.get('start_date', ''))
            
            date_to = self.driver.find_element(By.ID, "DateFiledTo")
            date_to.clear()
            date_to.send_keys(params.get('end_date', ''))
            
            # Submit search
            search_btn = self.driver.find_element(By.ID, "SearchSubmit")
            search_btn.click()
            
            # Wait and parse results
            time.sleep(3)
            cases = self._parse_search_results()
            
        except Exception as e:
            self.logger.error(f"Error in date range search: {e}")
        
        return cases
    
    def _search_by_case_number(self, params: Dict) -> List[Dict]:
        """Search for specific case number"""
        cases = []
        
        try:
            case_number = params.get('case_number', '')
            if not case_number:
                return cases
            
            # Enter case number
            case_input = self.driver.find_element(By.ID, "CaseNumber")
            case_input.clear()
            case_input.send_keys(case_number)
            
            # Submit search
            search_btn = self.driver.find_element(By.ID, "SearchSubmit")
            search_btn.click()
            
            # Wait for results
            time.sleep(2)
            
            # Check if we got direct case detail or search results
            if "CaseDetail" in self.driver.current_url:
                # Direct to case detail
                cases.append({'case_number': case_number, 'case_id': case_number})
            else:
                # Parse search results
                cases = self._parse_search_results()
            
        except Exception as e:
            self.logger.error(f"Error searching case number: {e}")
        
        return cases
    
    def _parse_search_results(self) -> List[Dict]:
        """Parse search results table"""
        cases = []
        
        try:
            # Find results table
            results_table = self.driver.find_element(By.CLASS_NAME, "SearchResults")
            rows = results_table.find_elements(By.TAG_NAME, "tr")[1:]  # Skip header
            
            for row in rows:
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if len(cells) >= 4:
                        case = {
                            'case_number': cells[0].text.strip(),
                            'case_id': cells[0].text.strip(),
                            'case_title': cells[1].text.strip(),
                            'filing_date': cells[2].text.strip(),
                            'case_status': cells[3].text.strip() if len(cells) > 3 else '',
                        }
                        
                        # Get case detail link if available
                        link = cells[0].find_element(By.TAG_NAME, "a")
                        if link:
                            case['case_url'] = link.get_attribute('href')
                        
                        cases.append(case)
                        
                except Exception as e:
                    self.logger.debug(f"Error parsing row: {e}")
                    continue
            
        except NoSuchElementException:
            self.logger.info("No search results found")
        except Exception as e:
            self.logger.error(f"Error parsing search results: {e}")
        
        return cases
    
    def scrape_case_details(self, case_id: str) -> Dict:
        """
        Scrape detailed information for a specific case
        
        Args:
            case_id: Case number/identifier
            
        Returns:
            Dictionary with full case details
        """
        details = {'case_number': case_id}
        
        try:
            # Navigate to case detail page
            if not self.driver.current_url.endswith(f"CaseNumber={case_id}"):
                url = f"{self.case_detail_url}?CaseNumber={case_id}"
                self.driver.get(url)
                time.sleep(2)
            
            # Extract basic case information
            details.update(self._extract_case_info())
            
            # Extract parties
            details['parties'] = self.parse_parties(self.driver)
            
            # Extract charges
            details['charges'] = self.parse_charges(self.driver)
            
            # Extract events/calendar
            details['events'] = self.parse_events(self.driver)
            
            # Extract documents if available
            details['documents'] = self._extract_documents()
            
            # Get case URL
            details['case_url'] = self.driver.current_url
            
        except Exception as e:
            self.logger.error(f"Error scraping case {case_id}: {e}")
        
        return details
    
    def _extract_case_info(self) -> Dict:
        """Extract basic case information from detail page"""
        info = {}
        
        try:
            # Case header information
            header = self.driver.find_element(By.CLASS_NAME, "CaseHeader")
            
            info['case_title'] = self._extract_text(header, ".CaseTitle", "")
            info['case_type'] = self._extract_text(header, ".CaseType", "")
            info['filing_date'] = self._extract_text(header, ".FilingDate", "")
            info['judge'] = self._extract_text(header, ".Judge", "")
            info['location'] = self._extract_text(header, ".Location", "")
            
            # Case status
            status_elem = self.driver.find_element(By.CLASS_NAME, "CaseStatus")
            info['case_status'] = status_elem.text.strip()
            
            # Next hearing date
            try:
                next_hearing = self.driver.find_element(By.CLASS_NAME, "NextHearing")
                info['next_hearing'] = next_hearing.text.strip()
            except:
                info['next_hearing'] = None
            
        except Exception as e:
            self.logger.debug(f"Error extracting case info: {e}")
        
        return info
    
    def parse_parties(self, element) -> List[Dict]:
        """Parse party information from Maricopa court page"""
        parties = []
        
        try:
            # Find party table
            party_section = self.driver.find_element(By.ID, "PartySection")
            party_rows = party_section.find_elements(By.CLASS_NAME, "PartyRow")
            
            for row in party_rows:
                try:
                    party = {
                        'party_name': self._extract_text(row, ".PartyName", ""),
                        'party_type': self._extract_text(row, ".PartyType", ""),
                        'sex': self._extract_text(row, ".Sex", ""),
                        'attorney': self._extract_text(row, ".Attorney", "")[:10],  # Truncate for DB
                    }
                    
                    # Clean up attorney name to fit constraint
                    if party['attorney'] and len(party['attorney']) > 10:
                        # Use initials
                        parts = party['attorney'].split()
                        if len(parts) >= 2:
                            party['attorney'] = f"{parts[0][0]}. {parts[-1][:8]}"
                        else:
                            party['attorney'] = party['attorney'][:10]
                    
                    parties.append(party)
                    
                except Exception as e:
                    self.logger.debug(f"Error parsing party row: {e}")
                    continue
            
        except NoSuchElementException:
            self.logger.debug("No party section found")
        except Exception as e:
            self.logger.error(f"Error parsing parties: {e}")
        
        return parties
    
    def parse_charges(self, element) -> List[Dict]:
        """Parse charge information from Maricopa court page"""
        charges = []
        
        try:
            # Find charges table
            charge_section = self.driver.find_element(By.ID, "ChargeSection")
            charge_rows = charge_section.find_elements(By.CLASS_NAME, "ChargeRow")
            
            for row in charge_rows:
                try:
                    charge = {
                        'ars_code': self._extract_text(row, ".Statute", ""),
                        'description': self._extract_text(row, ".ChargeDescription", ""),
                        'severity': self._extract_text(row, ".Severity", "")[:1],  # F/M/I
                        'crime_date': self._extract_text(row, ".OffenseDate", ""),
                        'disposition': self._extract_text(row, ".Disposition", ""),
                    }
                    
                    # Standardize severity
                    if charge['severity']:
                        sev = charge['severity'].upper()
                        if 'FELONY' in sev or sev.startswith('F'):
                            charge['severity'] = 'F'
                        elif 'MISDEMEANOR' in sev or sev.startswith('M'):
                            charge['severity'] = 'M'
                        else:
                            charge['severity'] = 'I'
                    
                    charges.append(charge)
                    
                except Exception as e:
                    self.logger.debug(f"Error parsing charge row: {e}")
                    continue
            
        except NoSuchElementException:
            self.logger.debug("No charge section found")
        except Exception as e:
            self.logger.error(f"Error parsing charges: {e}")
        
        return charges
    
    def parse_events(self, element) -> List[Dict]:
        """Parse event/calendar information from Maricopa court page"""
        events = []
        
        try:
            # Find events/calendar table
            event_section = self.driver.find_element(By.ID, "EventSection")
            event_rows = event_section.find_elements(By.CLASS_NAME, "EventRow")
            
            for row in event_rows:
                try:
                    event = {
                        'event_date': self._extract_text(row, ".EventDate", ""),
                        'event_type': self._extract_text(row, ".EventType", ""),
                        'event_description': self._extract_text(row, ".EventDescription", ""),
                        'time': self._extract_text(row, ".EventTime", ""),
                        'result': self._extract_text(row, ".EventResult", ""),
                    }
                    events.append(event)
                    
                except Exception as e:
                    self.logger.debug(f"Error parsing event row: {e}")
                    continue
            
        except NoSuchElementException:
            self.logger.debug("No event section found")
        except Exception as e:
            self.logger.error(f"Error parsing events: {e}")
        
        return events
    
    def _extract_documents(self) -> List[Dict]:
        """Extract document information if available"""
        documents = []
        
        try:
            # Find documents table
            doc_section = self.driver.find_element(By.ID, "DocumentSection")
            doc_rows = doc_section.find_elements(By.CLASS_NAME, "DocumentRow")
            
            for row in doc_rows:
                try:
                    doc = {
                        'document_name': self._extract_text(row, ".DocName", ""),
                        'document_type': self._extract_text(row, ".DocType", ""),
                        'filed_date': self._extract_text(row, ".FiledDate", ""),
                        'filed_by': self._extract_text(row, ".FiledBy", ""),
                    }
                    documents.append(doc)
                    
                except Exception as e:
                    self.logger.debug(f"Error parsing document row: {e}")
                    continue
            
        except NoSuchElementException:
            self.logger.debug("No document section found")
        except Exception as e:
            self.logger.debug(f"Error extracting documents: {e}")
        
        return documents