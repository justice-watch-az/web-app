"""Unit tests for the scraper modules."""

import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add scrapers to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from scrapers.database_handler import DatabaseHandler

# Mock ScraperConfig if needed
class ScraperConfig:
    def __init__(self, **kwargs):
        self.headless = kwargs.get('headless', True)
        self.timeout = kwargs.get('timeout', 30)
        self.max_retries = kwargs.get('max_retries', 3)
        self.wait_time = kwargs.get('wait_time', 2)
    
    @classmethod
    def from_dict(cls, config_dict):
        return cls(**config_dict)
    
    def to_dict(self):
        return {
            'headless': self.headless,
            'timeout': self.timeout,
            'max_retries': self.max_retries,
            'wait_time': self.wait_time
        }


class TestDatabaseHandler:
    """Test database handler functionality."""
    
    @pytest.fixture
    def db_handler(self):
        """Create a database handler instance."""
        with patch('scrapers.database_handler.psycopg2'):
            handler = DatabaseHandler()
            handler.connection = Mock()
            handler.cursor = Mock()
            return handler
    
    def test_init_connection(self, db_handler):
        """Test database connection initialization."""
        assert db_handler.connection is not None
        assert db_handler.cursor is not None
    
    def test_save_case(self, db_handler):
        """Test saving a case to the database."""
        case_data = {
            'case_number': 'TEST-001',
            'case_title': 'Test Case',
            'court_name': 'Test Court',
            'status': 'Active'
        }
        
        db_handler.save_case(case_data)
        db_handler.cursor.execute.assert_called_once()
        db_handler.connection.commit.assert_called_once()
    
    def test_case_exists(self, db_handler):
        """Test checking if a case exists."""
        db_handler.cursor.fetchone = Mock(return_value=(1,))
        
        exists = db_handler.case_exists('TEST-001')
        assert exists is True
        db_handler.cursor.execute.assert_called_once()
    
    def test_update_case(self, db_handler):
        """Test updating a case."""
        case_data = {
            'case_number': 'TEST-001',
            'status': 'Closed'
        }
        
        db_handler.update_case('TEST-001', case_data)
        db_handler.cursor.execute.assert_called_once()
        db_handler.connection.commit.assert_called_once()


class TestScraperConfig:
    """Test scraper configuration."""
    
    def test_config_defaults(self):
        """Test default configuration values."""
        config = ScraperConfig()
        
        assert config.headless is True
        assert config.timeout == 30
        assert config.max_retries == 3
        assert config.wait_time == 2
    
    def test_config_from_dict(self):
        """Test configuration from dictionary."""
        config_dict = {
            'headless': False,
            'timeout': 60,
            'max_retries': 5
        }
        
        config = ScraperConfig.from_dict(config_dict)
        
        assert config.headless is False
        assert config.timeout == 60
        assert config.max_retries == 5
    
    def test_config_to_dict(self):
        """Test configuration to dictionary conversion."""
        config = ScraperConfig()
        config_dict = config.to_dict()
        
        assert isinstance(config_dict, dict)
        assert 'headless' in config_dict
        assert 'timeout' in config_dict


class TestMaricopaScraper:
    """Test Maricopa scraper functionality."""
    
    @pytest.fixture
    def mock_driver(self):
        """Create a mock Selenium driver."""
        driver = Mock()
        driver.find_elements = Mock(return_value=[])
        driver.find_element = Mock()
        driver.get = Mock()
        driver.quit = Mock()
        return driver
    
    @patch('scrapers.maricopa_arraignment_scraper.webdriver.Chrome')
    def test_scraper_init(self, mock_chrome, mock_driver):
        """Test scraper initialization."""
        mock_chrome.return_value = mock_driver
        
        from scrapers.maricopa_arraignment_scraper import MaricopaArraignmentScraper
        
        scraper = MaricopaArraignmentScraper({'headless': True})
        assert scraper.driver is not None
        mock_chrome.assert_called_once()
    
    @patch('scrapers.maricopa_arraignment_scraper.webdriver.Chrome')
    def test_scrape_court_calendar(self, mock_chrome, mock_driver):
        """Test scraping court calendar."""
        mock_chrome.return_value = mock_driver
        mock_element = Mock()
        mock_driver.find_element.return_value = mock_element
        
        from scrapers.maricopa_arraignment_scraper import MaricopaArraignmentScraper
        
        scraper = MaricopaArraignmentScraper({'headless': True})
        court = {'name': 'Test Court', 'url': 'http://test.com'}
        result = scraper.scrape_court_calendar(court)
        
        assert isinstance(result, list)
    
    @patch('scrapers.maricopa_arraignment_scraper.webdriver.Chrome')
    def test_extract_case_details(self, mock_chrome, mock_driver):
        """Test case details extraction."""
        mock_chrome.return_value = mock_driver
        
        # Mock page elements
        mock_case_number = Mock()
        mock_case_number.text = 'TEST-001'
        mock_case_title = Mock()
        mock_case_title.text = 'State v. Test'
        
        mock_driver.find_element.side_effect = [
            mock_case_number,
            mock_case_title
        ]
        
        from scrapers.maricopa_arraignment_scraper import MaricopaArraignmentScraper
        
        scraper = MaricopaArraignmentScraper({'headless': True})
        case_data = scraper.extract_case_details()
        
        assert isinstance(case_data, dict)