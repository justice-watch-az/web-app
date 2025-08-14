#!/usr/bin/env python3
import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options

def setup_supabase_tables():
    # Read SQL content
    with open('database/supabase_ready.sql', 'r') as f:
        sql_content = f.read()
    
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    # Start browser
    driver = webdriver.Chrome(options=chrome_options)
    wait = WebDriverWait(driver, 30)
    
    try:
        print("📋 Opening Supabase SQL Editor...")
        driver.get("https://supabase.com/dashboard/project/tsgvxobkmmvsbjzxvuas/sql/new")
        
        print("⏳ Waiting for page to load...")
        time.sleep(5)
        
        # Check if login is required
        if "sign-in" in driver.current_url.lower() or "login" in driver.current_url.lower():
            print("❗ Login required. Please log in manually.")
            print("Press Enter after you've logged in...")
            input()
            
            # Navigate to SQL editor again after login
            driver.get("https://supabase.com/dashboard/project/tsgvxobkmmvsbjzxvuas/sql/new")
            time.sleep(5)
        
        print("🔍 Looking for SQL editor...")
        
        # Try multiple selectors for the SQL editor
        editor_selectors = [
            "textarea",
            ".monaco-editor",
            ".CodeMirror",
            "[contenteditable='true']",
            ".ace_editor",
            ".cm-editor"
        ]
        
        editor_found = False
        for selector in editor_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"✅ Found editor with selector: {selector}")
                    
                    # Click on the editor to focus
                    elements[0].click()
                    time.sleep(1)
                    
                    # Clear existing content
                    driver.execute_script("arguments[0].value = '';", elements[0])
                    
                    # Paste SQL content
                    print("📝 Pasting SQL content...")
                    driver.execute_script(f"arguments[0].value = arguments[1];", elements[0], sql_content)
                    
                    # Trigger input event
                    driver.execute_script("""
                        var event = new Event('input', { bubbles: true });
                        arguments[0].dispatchEvent(event);
                    """, elements[0])
                    
                    editor_found = True
                    break
            except Exception as e:
                continue
        
        if not editor_found:
            # Try Monaco editor specific approach
            try:
                print("🔍 Trying Monaco editor approach...")
                driver.execute_script("""
                    if (window.monaco && window.monaco.editor) {
                        const editors = window.monaco.editor.getEditors();
                        if (editors.length > 0) {
                            editors[0].setValue(arguments[0]);
                        }
                    }
                """, sql_content)
                editor_found = True
            except:
                pass
        
        if not editor_found:
            print("❌ Could not find SQL editor. Opening manual input prompt...")
            print("\n" + "="*50)
            print("MANUAL STEPS REQUIRED:")
            print("1. The browser window should be open to Supabase SQL Editor")
            print("2. Copy the SQL from: database/supabase_ready.sql")
            print("3. Paste it into the SQL editor")
            print("4. Click the 'Run' button")
            print("="*50)
            print("\nPress Enter when you've completed these steps...")
            input()
        else:
            print("✅ SQL content pasted!")
            
            # Look for Run button
            run_button_selectors = [
                "button:contains('Run')",
                "[data-testid='run-query']",
                ".btn-primary:contains('Run')",
                "button.btn:contains('Run')"
            ]
            
            run_clicked = False
            
            # Try text-based search
            buttons = driver.find_elements(By.TAG_NAME, "button")
            for button in buttons:
                if "run" in button.text.lower():
                    print(f"🎯 Found Run button: {button.text}")
                    button.click()
                    run_clicked = True
                    break
            
            if not run_clicked:
                print("❗ Could not find Run button. Please click it manually.")
                print("Press Enter after clicking Run...")
                input()
            else:
                print("✅ Run button clicked!")
            
            time.sleep(5)
            
            # Check for success/error messages
            page_text = driver.find_element(By.TAG_NAME, "body").text.lower()
            if "success" in page_text or "created" in page_text:
                print("✅ Tables appear to be created successfully!")
            elif "error" in page_text:
                print("❌ There might be errors. Check the browser window.")
            else:
                print("⚠️  Please check the browser window for results.")
        
        print("\n✅ Setup complete! You can close the browser.")
        print("Press Enter to close the browser...")
        input()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nYou may need to complete the setup manually:")
        print("1. Go to: https://supabase.com/dashboard/project/tsgvxobkmmvsbjzxvuas/sql/new")
        print("2. Copy the SQL from: database/supabase_ready.sql")
        print("3. Paste and run it")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    setup_supabase_tables()