#!/usr/bin/env python3
"""
Integration tests for the Justice Watch scraper
"""

import time
import json
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class ScraperIntegrationTest:
    def __init__(self):
        self.setup_driver()
        self.test_results = []
        
    def setup_driver(self):
        """Configure Chrome driver with appropriate options"""
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        self.driver = webdriver.Chrome(options=options)
        
    def test_court_website_access(self):
        """Test that we can access the court website"""
        print("Testing court website access...")
        try:
            self.driver.get("https://justicecourts.maricopa.gov/app/courtrecords/CourtCalendars")
            
            # Wait for page load
            WebDriverWait(self.driver, 30).until(
                EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
            )
            
            # Take screenshot for verification
            self.driver.save_screenshot("/app/test-results/court_website.png")
            
            # Find court links
            court_links = self.driver.find_elements(By.CSS_SELECTOR, "td.court-link a")
            print(f"✓ Found {len(court_links)} court links")
            
            self.test_results.append({
                "test": "court_website_access",
                "status": "passed",
                "message": f"Found {len(court_links)} court links"
            })
            
            return True
        except Exception as e:
            print(f"✗ Failed to access court website: {e}")
            self.test_results.append({
                "test": "court_website_access",
                "status": "failed",
                "message": str(e)
            })
            return False
            
    def test_scraper_execution(self):
        """Test the actual scraper"""
        print("Testing scraper execution...")
        import subprocess
        
        try:
            result = subprocess.run(
                ["python3", "/app/scrapers/maricopa_arraignment_scraper.py", 
                 json.dumps({"headless": True, "test_mode": True, "court_limit": 1})],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                if data.get("status") == "success":
                    print(f"✓ Scraper executed successfully")
                    print(f"  - Courts discovered: {data.get('stats', {}).get('courts_discovered', 0)}")
                    print(f"  - Cases found: {data.get('stats', {}).get('arraignment_cases_found', 0)}")
                    
                    self.test_results.append({
                        "test": "scraper_execution",
                        "status": "passed",
                        "message": f"Found {data.get('stats', {}).get('arraignment_cases_found', 0)} cases"
                    })
                    return True
            
            print(f"✗ Scraper failed: {result.stderr}")
            self.test_results.append({
                "test": "scraper_execution",
                "status": "failed",
                "message": result.stderr
            })
            return False
            
        except subprocess.TimeoutExpired:
            print("✗ Scraper timed out")
            self.test_results.append({
                "test": "scraper_execution",
                "status": "failed",
                "message": "Scraper timed out after 120 seconds"
            })
            return False
        except Exception as e:
            print(f"✗ Scraper test failed: {e}")
            self.test_results.append({
                "test": "scraper_execution",
                "status": "failed",
                "message": str(e)
            })
            return False
    
    def test_selenium_navigation(self):
        """Test Selenium navigation capabilities"""
        print("Testing Selenium navigation...")
        try:
            # Test basic navigation
            self.driver.get("https://example.com")
            title = self.driver.title
            
            if "Example" in title:
                print("✓ Selenium navigation working")
                self.test_results.append({
                    "test": "selenium_navigation",
                    "status": "passed",
                    "message": "Navigation successful"
                })
                return True
            else:
                raise Exception(f"Unexpected title: {title}")
                
        except Exception as e:
            print(f"✗ Navigation test failed: {e}")
            self.test_results.append({
                "test": "selenium_navigation",
                "status": "failed",
                "message": str(e)
            })
            return False
        
    def run_all_tests(self):
        """Run all integration tests"""
        print("="*50)
        print("Running Justice Watch Scraper Integration Tests")
        print("="*50)
        
        # Run tests
        self.test_selenium_navigation()
        self.test_court_website_access()
        self.test_scraper_execution()
        
        # Clean up
        self.driver.quit()
        
        # Generate report
        print("\n" + "="*50)
        print("Test Results Summary")
        print("="*50)
        
        passed = 0
        failed = 0
        
        for result in self.test_results:
            status_icon = "✓" if result["status"] == "passed" else "✗"
            print(f"{status_icon} {result['test']}: {result['message']}")
            if result["status"] == "passed":
                passed += 1
            else:
                failed += 1
        
        print(f"\nTotal: {passed} passed, {failed} failed")
        
        # Return exit code
        return 0 if failed == 0 else 1

if __name__ == "__main__":
    tester = ScraperIntegrationTest()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)