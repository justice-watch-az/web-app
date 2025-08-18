#!/usr/bin/env python3
"""
Simple test scraper for Docker environment
"""

import json
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def test_scraping():
    """Test scraping with Docker Chrome"""
    
    # Configure Chrome options
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.binary_location = '/usr/bin/google-chrome'  # Explicit Chrome path
    
    # Set up ChromeDriver service
    service = Service('/usr/local/bin/chromedriver')  # Explicit ChromeDriver path
    
    print("Starting Chrome WebDriver...")
    driver = webdriver.Chrome(service=service, options=options)
    
    try:
        print("Navigating to court website...")
        driver.get("https://justicecourts.maricopa.gov/app/courtrecords/CourtCalendars")
        
        # Wait for page to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
        )
        
        print("Finding court links...")
        court_links = driver.find_elements(By.CSS_SELECTOR, "td.court-link a")
        
        courts_found = []
        for link in court_links[:3]:  # Just check first 3 courts
            court_name = link.text
            courts_found.append(court_name)
            print(f"  Found: {court_name}")
        
        result = {
            "status": "success",
            "courts_found": courts_found,
            "count": len(court_links),
            "message": f"Successfully accessed court website and found {len(court_links)} courts"
        }
        
    except Exception as e:
        result = {
            "status": "error",
            "error": str(e)
        }
        print(f"Error: {e}")
    
    finally:
        driver.quit()
    
    print(json.dumps(result, indent=2))
    return result

if __name__ == "__main__":
    test_scraping()