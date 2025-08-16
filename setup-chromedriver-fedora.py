#!/usr/bin/env python3
"""
Setup Chrome driver for Fedora 42
Uses webdriver-manager to automatically download and configure the driver
"""

import os
import sys
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from webdriver_manager.chrome import ChromeDriverManager
    from webdriver_manager.core.os_manager import ChromeType
    
    print("Setting up Chrome driver for Fedora 42...")
    
    # Try to install Chrome driver
    try:
        # First try with regular Chrome
        driver_path = ChromeDriverManager().install()
        print(f"✅ Chrome driver installed at: {driver_path}")
    except Exception as e:
        print(f"Regular Chrome not found, trying Chromium: {e}")
        # Try with Chromium
        driver_path = ChromeDriverManager(chrome_type=ChromeType.CHROMIUM).install()
        print(f"✅ Chromium driver installed at: {driver_path}")
    
    # Test the driver
    print("\nTesting driver...")
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    try:
        service = Service(driver_path)
        driver = webdriver.Chrome(service=service, options=options)
        driver.get("https://www.google.com")
        print(f"✅ Driver test successful! Page title: {driver.title}")
        driver.quit()
    except Exception as e:
        print(f"❌ Driver test failed: {e}")
        sys.exit(1)
    
    # Create a symlink in local bin if it doesn't exist
    local_bin = Path.home() / ".local" / "bin"
    local_bin.mkdir(parents=True, exist_ok=True)
    
    chromedriver_link = local_bin / "chromedriver"
    if not chromedriver_link.exists():
        chromedriver_link.symlink_to(driver_path)
        print(f"✅ Created symlink at: {chromedriver_link}")
    
    # Update PATH if needed
    if str(local_bin) not in os.environ.get("PATH", ""):
        print(f"\n⚠️  Add this to your ~/.bashrc or ~/.zshrc:")
        print(f'export PATH="$HOME/.local/bin:$PATH"')
    
    print("\n✅ Chrome driver setup complete!")
    print(f"Driver location: {driver_path}")
    print("\nYou can now run Selenium tests with:")
    print("  npm run e2e")
    print("  python e2e-selenium/test_widgets_selenium.py")
    
except ImportError as e:
    print(f"❌ Missing dependencies: {e}")
    print("\nPlease install required packages:")
    print("  pip install selenium webdriver-manager")
    sys.exit(1)
except Exception as e:
    print(f"❌ Setup failed: {e}")
    sys.exit(1)