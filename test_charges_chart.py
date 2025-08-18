#!/usr/bin/env python3
"""Test script to verify the Charges Analysis chart is working"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import sys

def test_charges_chart():
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    
    try:
        # Initialize driver
        driver = webdriver.Chrome(options=chrome_options)
        driver.set_window_size(1920, 1080)
        
        print("Opening Justice Watch Dashboard...")
        driver.get("http://localhost:8080")
        
        # Wait for the dashboard to load
        wait = WebDriverWait(driver, 10)
        
        # Click on Analytics tab
        print("Clicking on Analytics tab...")
        analytics_tab = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Analytics')]"))
        )
        analytics_tab.click()
        time.sleep(2)
        
        # Check if Charges Analysis chart is present
        print("Checking for Charges Analysis chart...")
        charts = driver.find_elements(By.TAG_NAME, "h3")
        chart_titles = [chart.text for chart in charts]
        
        print(f"Found charts: {chart_titles}")
        
        if "Charges Analysis" in chart_titles:
            print("✅ SUCCESS: Charges Analysis chart found!")
            
            # Check if canvas element for chart exists
            canvas_elements = driver.find_elements(By.TAG_NAME, "canvas")
            if len(canvas_elements) >= 2:
                print(f"✅ Found {len(canvas_elements)} chart canvases")
            else:
                print(f"⚠️ Only found {len(canvas_elements)} canvas elements")
                
        else:
            print("❌ FAILED: Charges Analysis chart not found")
            print("Available charts:", chart_titles)
            
        # Take a screenshot for verification
        driver.save_screenshot("/home/ice/PRPs-agentic-eng/justice-watch-app/test_screenshot.png")
        print("Screenshot saved to test_screenshot.png")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during test: {str(e)}")
        return False
        
    finally:
        driver.quit()

if __name__ == "__main__":
    success = test_charges_chart()
    sys.exit(0 if success else 1)