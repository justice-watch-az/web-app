"""
Base strategy class for court-specific scrapers
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException


@dataclass
class ScraperConfig:
    """Configuration for a court scraper"""
    court_name: str
    base_url: str
    timeout: int = 30
    retry_attempts: int = 3
    use_headless: bool = True
    wait_time: int = 10
    user_agent: Optional[str] = None
    

class BaseScraperStrategy(ABC):
    """Abstract base class for court-specific scrapers"""
    
    def __init__(self, config: ScraperConfig):
        self.config = config
        self.driver: Optional[webdriver.Chrome] = None
        self.wait: Optional[WebDriverWait] = None
        self.logger = self._setup_logger()
        
    def _setup_logger(self) -> logging.Logger:
        """Set up logger for this strategy"""
        logger = logging.getLogger(f"scraper.{self.config.court_name}")
        logger.setLevel(logging.INFO)
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        return logger
    
    def initialize_driver(self):
        """Initialize Selenium WebDriver"""
        try:
            chrome_options = Options()
            if self.config.use_headless:
                chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            
            if self.config.user_agent:
                chrome_options.add_argument(f'user-agent={self.config.user_agent}')
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.set_page_load_timeout(self.config.timeout)
            self.wait = WebDriverWait(self.driver, self.config.wait_time)
            
            self.logger.info(f"WebDriver initialized for {self.config.court_name}")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize WebDriver: {e}")
            raise
    
    def cleanup(self):
        """Clean up resources"""
        if self.driver:
            try:
                self.driver.quit()
                self.logger.info("WebDriver closed")
            except Exception as e:
                self.logger.error(f"Error closing WebDriver: {e}")
    
    def _extract_text(self, element, selector: str, default: str = "") -> str:
        """Extract text from element using CSS selector"""
        try:
            sub_element = element.find_element(By.CSS_SELECTOR, selector)
            return sub_element.text.strip()
        except NoSuchElementException:
            return default
    
    def _extract_text_xpath(self, element, xpath: str, default: str = "") -> str:
        """Extract text from element using XPath"""
        try:
            sub_element = element.find_element(By.XPATH, xpath)
            return sub_element.text.strip()
        except NoSuchElementException:
            return default
    
    @abstractmethod
    def search_cases(self, search_params: Dict) -> List[Dict]:
        """
        Search for cases based on parameters
        
        Args:
            search_params: Dictionary containing search criteria
            
        Returns:
            List of case dictionaries
        """
        pass
    
    @abstractmethod
    def scrape_case_details(self, case_id: str) -> Dict:
        """
        Scrape detailed information for a specific case
        
        Args:
            case_id: Case identifier
            
        Returns:
            Dictionary containing case details
        """
        pass
    
    @abstractmethod
    def parse_parties(self, element: Any) -> List[Dict]:
        """
        Parse party information from page element
        
        Args:
            element: Selenium WebElement containing party information
            
        Returns:
            List of party dictionaries
        """
        pass
    
    @abstractmethod
    def parse_charges(self, element: Any) -> List[Dict]:
        """
        Parse charge information from page element
        
        Args:
            element: Selenium WebElement containing charge information
            
        Returns:
            List of charge dictionaries
        """
        pass
    
    @abstractmethod
    def parse_events(self, element: Any) -> List[Dict]:
        """
        Parse event/calendar information from page element
        
        Args:
            element: Selenium WebElement containing event information
            
        Returns:
            List of event dictionaries
        """
        pass
    
    def normalize_data(self, raw_data: Dict) -> Dict:
        """
        Normalize data to common format
        
        Args:
            raw_data: Raw scraped data
            
        Returns:
            Normalized data dictionary
        """
        normalized = {
            'case_number': raw_data.get('case_number', ''),
            'court_name': self.config.court_name,
            'case_title': raw_data.get('case_title', ''),
            'case_type': raw_data.get('case_type', ''),
            'case_status': raw_data.get('case_status', ''),
            'filing_date': self._parse_date(raw_data.get('filing_date')),
            'judge': raw_data.get('judge', ''),
            'location': raw_data.get('location', ''),
            'case_url': raw_data.get('case_url', ''),
            'next_hearing': self._parse_date(raw_data.get('next_hearing')),
            'parties': raw_data.get('parties', []),
            'charges': raw_data.get('charges', []),
            'events': raw_data.get('events', []),
            'documents': raw_data.get('documents', []),
            'scraped_at': datetime.now().isoformat()
        }
        
        return normalized
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[str]:
        """Parse date string to ISO format"""
        if not date_str:
            return None
        
        # Add date parsing logic here based on court format
        # This is a placeholder
        try:
            # Try common formats
            from dateutil import parser
            parsed = parser.parse(date_str)
            return parsed.date().isoformat()
        except:
            return None
    
    def validate_data(self, data: Dict) -> bool:
        """
        Validate scraped data meets minimum requirements
        
        Args:
            data: Normalized data dictionary
            
        Returns:
            True if data is valid
        """
        # Basic validation - must have case number
        if not data.get('case_number'):
            self.logger.warning("Invalid data: missing case_number")
            return False
        
        # Must have at least one party
        if not data.get('parties'):
            self.logger.warning(f"Invalid data for {data['case_number']}: no parties")
            return False
        
        return True
    
    def execute(self, search_params: Dict) -> List[Dict]:
        """
        Execute the scraping strategy
        
        Args:
            search_params: Search parameters
            
        Returns:
            List of normalized case data
        """
        results = []
        
        try:
            self.initialize_driver()
            
            # Search for cases
            cases = self.search_cases(search_params)
            self.logger.info(f"Found {len(cases)} cases")
            
            # Get details for each case
            for case in cases:
                try:
                    case_id = case.get('case_id') or case.get('case_number')
                    if not case_id:
                        continue
                    
                    # Scrape detailed information
                    details = self.scrape_case_details(case_id)
                    
                    # Normalize the data
                    normalized = self.normalize_data(details)
                    
                    # Validate before adding
                    if self.validate_data(normalized):
                        results.append(normalized)
                    
                except Exception as e:
                    self.logger.error(f"Error processing case {case_id}: {e}")
                    continue
            
            self.logger.info(f"Successfully processed {len(results)} cases")
            
        except Exception as e:
            self.logger.error(f"Fatal error during execution: {e}")
            raise
            
        finally:
            self.cleanup()
        
        return results