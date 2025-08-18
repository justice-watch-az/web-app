#!/usr/bin/env python3
"""
Simple pipeline test to verify Docker scraper functionality
"""

import subprocess
import json
import sys

def test_docker_scraper():
    """Test the scraper in Docker"""
    print("="*50)
    print("Testing Justice Watch Scraper in Docker")
    print("="*50)
    
    # Test 1: Mock scraper
    print("\n1. Testing mock scraper...")
    result = subprocess.run(
        ["docker", "run", "--rm", "justice-scraper:test", "/app/scrapers/mock_scraper.py"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        try:
            data = json.loads(result.stdout)
            if data.get("status") == "success":
                print(f"✅ Mock scraper passed - found {len(data.get('arraignment_cases', []))} cases")
            else:
                print("❌ Mock scraper returned unsuccessful status")
                return 1
        except json.JSONDecodeError:
            print(f"❌ Failed to parse mock scraper output: {result.stdout}")
            return 1
    else:
        print(f"❌ Mock scraper failed: {result.stderr}")
        return 1
    
    # Test 2: Python environment
    print("\n2. Testing Python environment...")
    result = subprocess.run(
        ["docker", "run", "--rm", "justice-scraper:test", "-c", 
         "import selenium; from selenium import webdriver; print('Selenium OK')"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0 and "Selenium OK" in result.stdout:
        print("✅ Python environment and Selenium installed correctly")
    else:
        print(f"❌ Python environment test failed: {result.stderr}")
        return 1
    
    # Test 3: Chrome binary
    print("\n3. Testing Chrome installation...")
    result = subprocess.run(
        ["docker", "run", "--rm", "justice-scraper:test", "-c",
         "import subprocess; r = subprocess.run(['google-chrome', '--version'], capture_output=True, text=True); print(r.stdout)"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0 and "Google Chrome" in result.stdout:
        print(f"✅ Chrome installed: {result.stdout.strip()}")
    else:
        print("❌ Chrome not properly installed")
        return 1
    
    # Test 4: ChromeDriver
    print("\n4. Testing ChromeDriver...")
    result = subprocess.run(
        ["docker", "run", "--rm", "justice-scraper:test", "-c",
         "import subprocess; r = subprocess.run(['chromedriver', '--version'], capture_output=True, text=True); print(r.stdout)"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0 and "ChromeDriver" in result.stdout:
        print(f"✅ ChromeDriver installed: {result.stdout.strip()}")
    else:
        print("❌ ChromeDriver not properly installed")
        return 1
    
    print("\n" + "="*50)
    print("🎉 All tests passed! Docker scraper is ready.")
    print("="*50)
    return 0

if __name__ == "__main__":
    sys.exit(test_docker_scraper())