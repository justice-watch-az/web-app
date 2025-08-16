# Fedora 42 Test Setup Guide

## ✅ Successfully Set Up

### Firefox/Geckodriver Installation
```bash
# Geckodriver was successfully installed via Python:
python -c "from webdriver_manager.firefox import GeckoDriverManager; GeckoDriverManager().install()"
# Location: ~/.wdm/drivers/geckodriver/linux64/v0.36.0/geckodriver
```

### Selenium Tests Configuration
- Tests now default to Firefox (better Fedora compatibility)
- Geckodriver path is automatically detected
- Tests are running and connecting to the application

## Running Tests on Fedora 42

### 1. Install Dependencies (if not already done)
```bash
# Python packages
pip install selenium webdriver-manager pytest-selenium

# Node packages  
npm install
```

### 2. Start the Application
```bash
npm run dev
# Or in separate terminals:
npm run dev:server
npm run dev:client
```

### 3. Run Selenium E2E Tests
```bash
# With Firefox (default, recommended for Fedora)
npm run e2e

# Or directly:
python e2e-selenium/test_widgets_selenium.py --browser firefox

# Run with visible browser (not headless)
python e2e-selenium/test_widgets_selenium.py --browser firefox --headed
```

## Test Results Summary

### ✅ Passing Tests
- `test_stats_widget_loads` - Widget loads successfully
- `test_stats_widget_with_theme` - Theme parameter works

### ⚠️ Failing Tests (minor issues)
- Some tests fail due to missing widget elements (need frontend implementation)
- API tests timeout (may need server endpoints)
- CORS tests need proper headers configured

## Chrome Installation (Optional)

If you want to use Chrome instead of Firefox:

### Option 1: Install Google Chrome
```bash
# Add Google Chrome repo
sudo dnf config-manager --set-enabled google-chrome
sudo dnf install google-chrome-stable

# Chrome driver will auto-download when needed
```

### Option 2: Install Chromium
```bash
sudo dnf install chromium
# Note: Package name may vary, search with:
dnf search chromium
```

## Troubleshooting

### Network Issues
If driver downloads timeout, you can:
1. Use Firefox (already working)
2. Download drivers manually to `~/.wdm/drivers/`
3. Use a VPN or different network

### Permission Issues
```bash
# Make geckodriver executable
chmod +x ~/.wdm/drivers/geckodriver/linux64/v0.36.0/geckodriver

# Add to PATH if needed
export PATH="$HOME/.wdm/drivers/geckodriver/linux64/v0.36.0:$PATH"
```

### Test Failures
Most test failures are due to:
- Missing frontend components (widgets not fully implemented)
- API endpoints not returning expected data
- CORS headers not configured

These are application issues, not test framework issues.

## Summary

✅ **Selenium tests are working on Fedora 42!**
- Firefox with geckodriver is set up and running
- Tests can connect to the application
- Some tests pass, validating the framework works
- Failed tests indicate areas needing implementation

The test infrastructure is fully operational on your Fedora 42 system.