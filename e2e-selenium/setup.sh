#!/bin/bash

# Setup script for Selenium E2E tests

echo "Setting up Selenium E2E testing environment..."

# Install Python dependencies
echo "Installing Python Selenium dependencies..."
pip install selenium webdriver-manager pytest-selenium

# Install Node dependencies for WebdriverIO (optional)
echo "Installing WebdriverIO dependencies (optional)..."
npm install --save-dev @wdio/cli @wdio/local-runner @wdio/mocha-framework @wdio/spec-reporter @wdio/selenium-standalone-service wdio-chromedriver-service wdio-geckodriver-service

# Download Chrome driver
echo "Setting up Chrome driver..."
python -c "from webdriver_manager.chrome import ChromeDriverManager; ChromeDriverManager().install()"

# Download Firefox driver  
echo "Setting up Firefox driver..."
python -c "from webdriver_manager.firefox import GeckoDriverManager; GeckoDriverManager().install()"

echo "Selenium setup complete!"
echo ""
echo "To run tests:"
echo "  npm run e2e           # Run all tests with Chrome (headless)"
echo "  npm run e2e:chrome    # Run with Chrome"
echo "  npm run e2e:firefox   # Run with Firefox"
echo "  npm run e2e:headed    # Run with visible browser"
echo ""
echo "Or run directly with Python:"
echo "  python e2e-selenium/test_widgets_selenium.py"
echo "  python e2e-selenium/test_widgets_selenium.py --browser firefox"
echo "  python e2e-selenium/test_widgets_selenium.py --headed"