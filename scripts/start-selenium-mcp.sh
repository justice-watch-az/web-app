#!/bin/bash

# Selenium MCP Startup Script
# Ensures Selenium starts successfully every time

echo "Starting Selenium MCP for Justice Watch testing..."

# Clean up any existing Chrome processes
pkill -f "chrome.*--user-data-dir=/tmp/selenium" 2>/dev/null || true

# Remove old temp directories
rm -rf /tmp/selenium-chrome-* 2>/dev/null || true

# Set environment variable for Claude Code
export CLAUDE_CODE=true

# Chrome configuration that works every time
CHROME_ARGS=(
  "--user-data-dir=/tmp/selenium-chrome-$$"  # Use PID for uniqueness
  "--no-sandbox"                              # Required for Docker
  "--disable-dev-shm-usage"                   # Prevent memory issues
  "--disable-gpu"                             # Better compatibility
  "--window-size=1920,1080"                   # Consistent viewport
  "--disable-blink-features=AutomationControlled"
  "--disable-extensions"
  "--disable-default-apps"
  "--disable-sync"
  "--no-first-run"
  "--mute-audio"
  "--disable-background-timer-throttling"
  "--disable-backgrounding-occluded-windows"
  "--disable-renderer-backgrounding"
  "--disable-features=TranslateUI"
  "--disable-ipc-flooding-protection"
)

echo "Chrome arguments configured:"
printf '%s\n' "${CHROME_ARGS[@]}"

# Export for use by Claude Code
export SELENIUM_CHROME_ARGS="${CHROME_ARGS[*]}"

echo ""
echo "To use in Claude Code:"
echo "1. Start Chrome with: mcp__selenium__start_browser"
echo "2. Use browser: 'chrome'"
echo "3. Include these options:"
echo "   - headless: true (or false to see browser)"
echo "   - arguments: (will use SELENIUM_CHROME_ARGS)"
echo ""
echo "The unique user-data-dir ensures no conflicts: /tmp/selenium-chrome-$$"
echo ""
echo "Ready for Selenium MCP!"