#!/usr/bin/env python3
"""
Test accessing the Maricopa court website
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os

def test_access():
    print("Setting up Chrome driver...")
    
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36')
    
    # Set Chrome binary location
    if os.path.exists('/usr/bin/google-chrome'):
        options.binary_location = '/usr/bin/google-chrome'
        print(f"Using Chrome at: {options.binary_location}")
    
    # Set ChromeDriver path
    chromedriver_path = '/usr/local/bin/chromedriver'
    if os.path.exists(chromedriver_path):
        print(f"Using ChromeDriver at: {chromedriver_path}")
        service = Service(chromedriver_path)
    else:
        print("Using default ChromeDriver")
        service = Service()
    
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(60)
    
    try:
        print("\n1. Testing basic connectivity...")
        driver.get("https://www.google.com")
        print("✅ Can access Google")
        
        print("\n2. Testing court website homepage...")
        driver.get("https://justicecourts.maricopa.gov")
        time.sleep(2)
        print(f"✅ Can access main site - Title: {driver.title}")
        
        print("\n3. Testing court calendar page...")
        url = "https://justicecourts.maricopa.gov/app/courtrecords/CourtCalendars"
        print(f"Navigating to: {url}")
        driver.get(url)
        
        # Wait for page with different strategies
        print("Waiting for page to load...")
        
        # Try multiple selectors
        selectors = [
            ("zebratable", By.CLASS_NAME),
            ("court-link", By.CLASS_NAME),
            ("//table", By.XPATH),
            ("a", By.TAG_NAME)
        ]
        
        found = False
        for selector_text, selector_type in selectors:
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((selector_type, selector_text))
                )
                elements = driver.find_elements(selector_type, selector_text)
                print(f"✅ Found {len(elements)} elements with selector: {selector_text}")
                found = True
                break
            except:
                print(f"❌ Timeout with selector: {selector_text}")
        
        if found:
            # Try to find court links
            print("\n4. Looking for court links...")
            
            # Get page source for debugging
            page_source = driver.page_source
            print(f"Page source length: {len(page_source)} characters")
            
            # Check if we're on an error page
            if "error" in page_source.lower() or "not found" in page_source.lower():
                print("⚠️ Possible error page detected")
                print(page_source[:500])
            
            # Try different link patterns
            link_patterns = [
                "//td[@class='court-link']/a",
                "//a[contains(@href, 'courtrecords')]",
                "//a[contains(text(), 'Justice Court')]",
                "//table//a"
            ]
            
            for pattern in link_patterns:
                links = driver.find_elements(By.XPATH, pattern)
                if links:
                    print(f"✅ Found {len(links)} links with pattern: {pattern}")
                    for i, link in enumerate(links[:3]):
                        print(f"   Link {i+1}: {link.text}")
                    break
            else:
                print("❌ No court links found")
                
        print("\n5. Taking screenshot...")
        driver.save_screenshot("/app/test-results/court-access-test.png")
        print("✅ Screenshot saved to /app/test-results/court-access-test.png")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        driver.quit()
        print("\n✅ Test complete")

if __name__ == "__main__":
    test_access()