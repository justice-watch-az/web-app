#!/usr/bin/env python3
"""
Live scraper for Maricopa courts - finds actual court cases
"""

import json
import time
import random
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os

def setup_stealth_driver():
    """Set up Chrome with stealth settings"""
    options = Options()
    
    # Stealth settings
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    # Regular settings
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    if os.path.exists('/usr/bin/google-chrome'):
        options.binary_location = '/usr/bin/google-chrome'
    
    chromedriver_path = '/usr/local/bin/chromedriver'
    service = Service(chromedriver_path) if os.path.exists(chromedriver_path) else Service()
    
    driver = webdriver.Chrome(service=service, options=options)
    
    # Stealth JavaScript
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    })
    
    driver.set_page_load_timeout(60)
    return driver

def scrape_courts():
    """Scrape Maricopa court data"""
    driver = setup_stealth_driver()
    results = {
        "status": "starting",
        "timestamp": datetime.now().isoformat(),
        "courts": [],
        "cases": [],
        "stats": {
            "courts_found": 0,
            "cases_found": 0,
            "errors": 0
        }
    }
    
    try:
        print("🌐 Accessing Maricopa Court Calendar...")
        driver.get("https://justicecourts.maricopa.gov/app/courtrecords/CourtCalendars")
        time.sleep(3)
        
        print("🔍 Looking for court table...")
        
        # Try to find the zebratable with court links
        try:
            # Wait for the table to load
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CLASS_NAME, "zebratable"))
            )
            
            # Find all court links in the table
            court_cells = driver.find_elements(By.CSS_SELECTOR, "td.court-link a")
            
            if not court_cells:
                # Try alternative selector
                court_cells = driver.find_elements(By.XPATH, "//table[@class='zebratable']//td/a")
            
            if court_cells:
                print(f"✅ Found {len(court_cells)} courts!")
                
                # Process each court (limit to first 2 for testing)
                for i, court_link in enumerate(court_cells[:2]):
                    court_name = court_link.text.strip()
                    if not court_name:
                        continue
                    
                    print(f"\n🏛️ Processing court {i+1}: {court_name}")
                    results["courts"].append(court_name)
                    results["stats"]["courts_found"] += 1
                    
                    # Click on the court
                    try:
                        court_link.click()
                        time.sleep(2)
                        
                        # Look for arraignment cases
                        print(f"   Looking for arraignments in {court_name}...")
                        
                        # Find case rows
                        case_rows = driver.find_elements(By.XPATH, "//tr[contains(., 'Arraignment')]")
                        
                        if case_rows:
                            print(f"   ✅ Found {len(case_rows)} arraignment cases")
                            
                            for row in case_rows[:5]:  # Limit to 5 cases per court
                                try:
                                    # Extract case info
                                    case_links = row.find_elements(By.TAG_NAME, "a")
                                    if case_links:
                                        case_number = case_links[0].text.strip()
                                        
                                        case_info = {
                                            "case_number": case_number,
                                            "court_name": court_name,
                                            "type": "Arraignment",
                                            "found_at": datetime.now().isoformat()
                                        }
                                        
                                        results["cases"].append(case_info)
                                        results["stats"]["cases_found"] += 1
                                        print(f"      📋 Case: {case_number}")
                                        
                                except Exception as e:
                                    print(f"      ❌ Error extracting case: {e}")
                                    results["stats"]["errors"] += 1
                        else:
                            print(f"   No arraignment cases found in {court_name}")
                        
                        # Go back to court list
                        driver.back()
                        time.sleep(2)
                        
                        # Re-find court links after navigation
                        court_cells = driver.find_elements(By.CSS_SELECTOR, "td.court-link a")
                        
                    except Exception as e:
                        print(f"   ❌ Error processing {court_name}: {e}")
                        results["stats"]["errors"] += 1
                        # Try to recover by going back to main page
                        driver.get("https://justicecourts.maricopa.gov/app/courtrecords/CourtCalendars")
                        time.sleep(2)
                
            else:
                print("❌ No court links found in table")
                results["status"] = "error"
                results["error"] = "No court links found"
                
        except Exception as e:
            print(f"❌ Error finding court table: {e}")
            results["status"] = "error"
            results["error"] = str(e)
            
            # Try to get page info for debugging
            try:
                body_text = driver.find_element(By.TAG_NAME, "body").text[:200]
                print(f"Page content preview: {body_text}")
            except:
                pass
    
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        results["status"] = "error"
        results["error"] = str(e)
    
    finally:
        driver.quit()
        
    # Set final status
    if results["status"] != "error":
        results["status"] = "success"
    
    return results

def main():
    print("=" * 60)
    print("🕷️ MARICOPA COURT LIVE SCRAPER")
    print("=" * 60)
    print()
    
    results = scrape_courts()
    
    print()
    print("=" * 60)
    print("📊 SCRAPING RESULTS")
    print("=" * 60)
    print(f"Status: {results['status']}")
    print(f"Courts found: {results['stats']['courts_found']}")
    print(f"Cases found: {results['stats']['cases_found']}")
    print(f"Errors: {results['stats']['errors']}")
    
    if results["courts"]:
        print("\n🏛️ Courts processed:")
        for court in results["courts"]:
            print(f"  - {court}")
    
    if results["cases"]:
        print("\n📋 Cases found:")
        for case in results["cases"][:10]:  # Show first 10
            print(f"  - {case['case_number']} ({case['court_name']})")
    
    # Output JSON for processing
    print("\n📄 Full JSON output:")
    print(json.dumps(results, indent=2))
    
    return 0 if results["status"] == "success" else 1

if __name__ == "__main__":
    exit(main())