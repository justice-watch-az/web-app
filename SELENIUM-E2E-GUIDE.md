# Selenium E2E Testing Guide

## 🎯 Selenium Tests (Replacement for Playwright)

Since Playwright doesn't work well on your system, I've created comprehensive Selenium-based E2E tests with both Python and JavaScript options.

## Setup

### 1. Install Dependencies

```bash
# Python dependencies
pip install selenium webdriver-manager pytest-selenium

# Or use the setup script
chmod +x e2e-selenium/setup.sh
./e2e-selenium/setup.sh
```

### 2. Install Browser Drivers

The setup script automatically installs drivers, but you can also do it manually:

```python
# Chrome driver
from webdriver_manager.chrome import ChromeDriverManager
ChromeDriverManager().install()

# Firefox driver
from webdriver_manager.firefox import GeckoDriverManager
GeckoDriverManager().install()
```

## Running Tests

### Python Selenium Tests (Recommended)

```bash
# Run all tests with Chrome (headless)
npm run e2e

# Run with specific browser
npm run e2e:chrome      # Chrome browser
npm run e2e:firefox     # Firefox browser

# Run with visible browser (not headless)
npm run e2e:headed

# Run directly with Python
python e2e-selenium/test_widgets_selenium.py
python e2e-selenium/test_widgets_selenium.py --browser firefox
python e2e-selenium/test_widgets_selenium.py --headed
```

### WebdriverIO Tests (Alternative)

```bash
# Install WebdriverIO dependencies first
npm install --save-dev @wdio/cli @wdio/local-runner @wdio/mocha-framework

# Run tests
npm run e2e:wdio
npx wdio run e2e-selenium/wdio.conf.js
```

## Test Coverage

The Selenium tests cover:

### ✅ Widget Loading
- Stats widget loads successfully
- Arraignments widget loads with parameters
- Widget gallery displays correctly

### ✅ Widget Parameters
- Theme parameter (light/dark)
- Size parameter (card/standard/dashboard)
- Court filtering
- Date filtering

### ✅ API Endpoints
- `/api/widgets/config` returns valid data
- `/api/widgets/data/arraignments` returns array
- `/api/widgets/data/stats` returns statistics

### ✅ iframe Embedding
- Widgets work inside iframes
- PostMessage communication
- Cross-origin support

### ✅ Responsive Design
- Mobile viewport (375x667)
- Tablet viewport (768x1024)
- Desktop viewport (1920x1080)

### ✅ Security Headers
- CORS headers present
- CSP headers configured
- Cross-origin requests handled

## Writing New Tests

### Python Example

```python
def test_new_feature(self):
    """Test description."""
    # Navigate to page
    self.driver.get(f"{self.base_url}/widgets/new")
    
    # Wait for element
    element = self.wait.until(
        EC.presence_of_element_located((By.CLASS_NAME, "my-element"))
    )
    
    # Assert element is displayed
    self.assertTrue(element.is_displayed())
    
    # Interact with element
    element.click()
    
    # Check result
    result = self.driver.find_element(By.ID, "result")
    self.assertEqual(result.text, "Expected Text")
```

### JavaScript Example (WebdriverIO)

```javascript
it('should test new feature', async () => {
    // Navigate to page
    await browser.url('/widgets/new');
    
    // Wait for element
    const element = await $('.my-element');
    await element.waitForExist({ timeout: 10000 });
    
    // Assert element is displayed
    expect(await element.isDisplayed()).toBe(true);
    
    // Interact with element
    await element.click();
    
    // Check result
    const result = await $('#result');
    expect(await result.getText()).toBe('Expected Text');
});
```

## Common Selenium Commands

### Navigation
```python
driver.get(url)                    # Navigate to URL
driver.back()                       # Go back
driver.forward()                    # Go forward
driver.refresh()                    # Refresh page
```

### Finding Elements
```python
driver.find_element(By.ID, "id")
driver.find_element(By.CLASS_NAME, "class")
driver.find_element(By.CSS_SELECTOR, ".class #id")
driver.find_element(By.XPATH, "//div[@class='test']")
```

### Waiting
```python
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

wait = WebDriverWait(driver, 10)
element = wait.until(
    EC.presence_of_element_located((By.ID, "myId"))
)
```

### Actions
```python
element.click()                    # Click element
element.send_keys("text")          # Type text
element.clear()                    # Clear input
element.submit()                   # Submit form
```

### JavaScript Execution
```python
driver.execute_script("return document.title;")
driver.execute_async_script("""
    const callback = arguments[arguments.length - 1];
    setTimeout(() => callback('done'), 1000);
""")
```

## Troubleshooting

### Chrome Driver Issues
```bash
# Update Chrome driver
pip install --upgrade webdriver-manager

# Specify Chrome binary location
options.binary_location = "/path/to/chrome"
```

### Firefox Driver Issues
```bash
# Install geckodriver manually
wget https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz
tar -xvzf geckodriver-v0.33.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
```

### Headless Mode Issues
```python
# Add more options for stability
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
```

### Timeout Issues
```python
# Increase timeout
driver.implicitly_wait(20)  # Implicit wait
wait = WebDriverWait(driver, 20)  # Explicit wait
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Selenium E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    services:
      app:
        image: node:18
        ports:
          - 3001:3001
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements-test.txt
          pip install selenium webdriver-manager
      
      - name: Setup Chrome
        uses: browser-actions/setup-chrome@latest
      
      - name: Start application
        run: |
          npm ci
          npm start &
          sleep 10
      
      - name: Run Selenium tests
        run: python e2e-selenium/test_widgets_selenium.py
```

## Advantages of Selenium over Playwright

1. **Better system compatibility** - Works on more systems
2. **Multiple language support** - Python, JavaScript, Java, etc.
3. **Mature ecosystem** - Extensive documentation and community
4. **WebDriver standard** - W3C standard implementation
5. **IDE support** - Selenium IDE for recording tests

## Summary

The Selenium E2E tests provide comprehensive coverage of the widget system with:
- ✅ Python-based tests for simplicity
- ✅ JavaScript-based tests with WebdriverIO
- ✅ Support for Chrome and Firefox
- ✅ Headless and headed modes
- ✅ Responsive testing
- ✅ API testing
- ✅ iframe testing
- ✅ Security header validation

Run `npm run e2e` to execute the tests!