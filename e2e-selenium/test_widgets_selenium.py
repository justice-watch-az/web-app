#!/usr/bin/env python3
"""
Selenium E2E tests for Justice Watch widget system
"""

import unittest
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import os


class WidgetE2ETests(unittest.TestCase):
    """E2E tests for widget system using Selenium."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test fixtures."""
        cls.base_url = "http://localhost:3001"
        cls.setup_driver()
    
    @classmethod
    def setup_driver(cls, browser="firefox", headless=True):
        """Initialize WebDriver - defaults to Firefox for better Fedora compatibility."""
        if browser.lower() == "chrome":
            options = ChromeOptions()
            if headless:
                options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--window-size=1920,1080")
            cls.driver = webdriver.Chrome(options=options)
        elif browser.lower() == "firefox":
            options = FirefoxOptions()
            if headless:
                options.add_argument("--headless")
            options.add_argument("--width=1920")
            options.add_argument("--height=1080")
            
            # Use the installed geckodriver
            geckodriver_path = os.path.expanduser("~/.wdm/drivers/geckodriver/linux64/v0.36.0/geckodriver")
            if os.path.exists(geckodriver_path):
                service = FirefoxService(executable_path=geckodriver_path)
                cls.driver = webdriver.Firefox(service=service, options=options)
            else:
                # Fallback to system geckodriver or auto-download
                cls.driver = webdriver.Firefox(options=options)
        else:
            raise ValueError(f"Unsupported browser: {browser}")
        
        cls.driver.implicitly_wait(10)
        cls.wait = WebDriverWait(cls.driver, 10)
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after tests."""
        if hasattr(cls, 'driver'):
            cls.driver.quit()
    
    def setUp(self):
        """Set up each test."""
        # Clear cookies before each test
        self.driver.delete_all_cookies()
        # Note: localStorage/sessionStorage can only be cleared after navigating to a page
        # We'll skip clearing them in setUp to avoid security errors
    
    def test_stats_widget_loads(self):
        """Test that stats widget loads successfully."""
        self.driver.get(f"{self.base_url}/widgets/stats")
        
        # Wait for widget container
        widget = self.wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "widget-container"))
        )
        
        self.assertTrue(widget.is_displayed())
        
        # Check for widget header
        header = self.driver.find_element(By.CLASS_NAME, "widget-header")
        self.assertTrue(header.is_displayed())
    
    def test_stats_widget_with_theme(self):
        """Test stats widget with dark theme."""
        self.driver.get(f"{self.base_url}/widgets/stats?theme=dark")
        
        widget = self.wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "widget-container"))
        )
        
        # Check theme class
        classes = widget.get_attribute("class")
        self.assertIn("theme-dark", classes)
    
    def test_stats_widget_with_size(self):
        """Test stats widget with card size."""
        self.driver.get(f"{self.base_url}/widgets/stats?size=card")
        
        widget = self.wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "widget-container"))
        )
        
        # Check size class
        classes = widget.get_attribute("class")
        self.assertIn("size-card", classes)
    
    def test_arraignments_widget_loads(self):
        """Test arraignments widget loads with parameters."""
        self.driver.get(f"{self.base_url}/widgets/arraignments?court=all&date=today")
        
        widget = self.wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "widget-container"))
        )
        
        self.assertTrue(widget.is_displayed())
        
        # Check for data container
        try:
            data_container = self.driver.find_element(
                By.CSS_SELECTOR, ".arraignments-list, .arraignments-grid"
            )
            self.assertTrue(data_container.is_displayed())
        except NoSuchElementException:
            # Widget might show empty state
            empty_state = self.driver.find_element(By.CLASS_NAME, "empty-state")
            self.assertTrue(empty_state.is_displayed())
    
    def test_widget_gallery(self):
        """Test widget gallery page."""
        self.driver.get(f"{self.base_url}/widgets/gallery")
        
        gallery = self.wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "widget-gallery"))
        )
        
        self.assertTrue(gallery.is_displayed())
        
        # Check for configurator
        configurator = self.driver.find_element(By.CLASS_NAME, "widget-configurator")
        self.assertTrue(configurator.is_displayed())
        
        # Check for embed code section
        embed_code = self.driver.find_element(By.CLASS_NAME, "embed-code")
        self.assertTrue(embed_code.is_displayed())
    
    def test_widget_api_config(self):
        """Test widget configuration API."""
        self.driver.get(f"{self.base_url}/api/widgets/config")
        
        # Wait for JSON response
        time.sleep(1)
        
        # Get page source (should be JSON)
        body_text = self.driver.find_element(By.TAG_NAME, "body").text
        data = json.loads(body_text)
        
        self.assertTrue(data["success"])
        self.assertIn("availableWidgets", data["data"])
    
    def test_widget_api_arraignments(self):
        """Test arraignments data API."""
        self.driver.get(f"{self.base_url}/api/widgets/data/arraignments")
        
        time.sleep(1)
        
        body_text = self.driver.find_element(By.TAG_NAME, "body").text
        data = json.loads(body_text)
        
        self.assertTrue(data["success"])
        self.assertIsInstance(data["data"], list)
    
    def test_widget_api_stats(self):
        """Test stats data API."""
        self.driver.get(f"{self.base_url}/api/widgets/data/stats")
        
        time.sleep(1)
        
        body_text = self.driver.find_element(By.TAG_NAME, "body").text
        data = json.loads(body_text)
        
        self.assertTrue(data["success"])
        self.assertIn("data", data)
    
    def test_widget_iframe_embedding(self):
        """Test widget works in iframe."""
        # Navigate to a blank page
        self.driver.get("about:blank")
        
        # Create an iframe with widget
        self.driver.execute_script("""
            document.body.innerHTML = `
                <iframe 
                    id="test-widget" 
                    src="http://localhost:3001/widgets/stats" 
                    width="600" 
                    height="400">
                </iframe>
            `;
        """)
        
        # Wait for iframe to load
        time.sleep(2)
        
        # Switch to iframe
        iframe = self.driver.find_element(By.ID, "test-widget")
        self.driver.switch_to.frame(iframe)
        
        # Check widget loads in iframe
        try:
            widget = self.wait.until(
                EC.presence_of_element_located((By.CLASS_NAME, "widget-container"))
            )
            self.assertTrue(widget.is_displayed())
        finally:
            # Always switch back to default content
            self.driver.switch_to.default_content()
    
    def test_widget_responsiveness_mobile(self):
        """Test widget on mobile viewport."""
        self.driver.set_window_size(375, 667)  # iPhone size
        self.driver.get(f"{self.base_url}/widgets/stats?size=card")
        
        widget = self.wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "widget-container"))
        )
        
        # Check widget fits in viewport
        size = widget.size
        self.assertLessEqual(size['width'], 375)
    
    def test_widget_responsiveness_tablet(self):
        """Test widget on tablet viewport."""
        self.driver.set_window_size(768, 1024)  # iPad size
        self.driver.get(f"{self.base_url}/widgets/stats")
        
        widget = self.wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "widget-container"))
        )
        
        self.assertTrue(widget.is_displayed())
    
    def test_widget_responsiveness_desktop(self):
        """Test widget on desktop viewport."""
        self.driver.set_window_size(1920, 1080)  # Desktop size
        self.driver.get(f"{self.base_url}/widgets/stats?size=dashboard")
        
        widget = self.wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "widget-container"))
        )
        
        self.assertTrue(widget.is_displayed())
    
    def test_cors_headers(self):
        """Test CORS headers are set correctly."""
        # Use JavaScript to check CORS
        self.driver.get(f"{self.base_url}/widgets/stats")
        
        result = self.driver.execute_script("""
            return fetch('/api/widgets/config', {
                headers: {
                    'Origin': 'http://example.com'
                }
            }).then(response => ({
                status: response.status,
                corsHeader: response.headers.get('Access-Control-Allow-Origin')
            }));
        """)
        
        # Wait for promise to resolve
        time.sleep(1)
        
        # Execute async script
        result = self.driver.execute_async_script("""
            const callback = arguments[arguments.length - 1];
            fetch('/api/widgets/config', {
                headers: {
                    'Origin': 'http://example.com'
                }
            }).then(response => {
                callback({
                    status: response.status,
                    corsHeader: response.headers.get('Access-Control-Allow-Origin')
                });
            });
        """)
        
        self.assertEqual(result['status'], 200)
        self.assertIsNotNone(result['corsHeader'])
    
    def test_postmessage_communication(self):
        """Test widget sends postMessage events."""
        self.driver.get(f"{self.base_url}/widgets/stats")
        
        # Set up message listener
        self.driver.execute_script("""
            window.capturedMessages = [];
            window.addEventListener('message', function(event) {
                window.capturedMessages.push(event.data);
            });
        """)
        
        # Wait for widget to load and send messages
        time.sleep(2)
        
        # Check captured messages
        messages = self.driver.execute_script("return window.capturedMessages;")
        
        # Find WIDGET_LOADED message
        widget_loaded = any(
            msg.get('type') == 'WIDGET_LOADED' 
            for msg in messages 
            if isinstance(msg, dict)
        )
        
        self.assertTrue(widget_loaded, "Widget should send WIDGET_LOADED message")


def run_tests(browser="chrome", headless=True):
    """Run the test suite with specified browser."""
    # Set browser for test class
    WidgetE2ETests.browser = browser
    WidgetE2ETests.headless = headless
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(WidgetE2ETests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run Selenium E2E tests")
    parser.add_argument(
        "--browser", 
        choices=["chrome", "firefox"], 
        default="chrome",
        help="Browser to use for testing"
    )
    parser.add_argument(
        "--headed", 
        action="store_true",
        help="Run browser in headed mode (not headless)"
    )
    
    args = parser.parse_args()
    
    success = run_tests(browser=args.browser, headless=not args.headed)
    exit(0 if success else 1)