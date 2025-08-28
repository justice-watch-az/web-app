# Multi-stage build for Justice Watch Scraper
# Optimized for Akash deployment

# Stage 1: Base image with Chrome and Python
FROM python:3.9-slim-bullseye

# Install system dependencies and Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    # Chrome dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libatspi2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxcb1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    libappindicator3-1 \
    libgtk-3-0 \
    libxss1 \
    lsb-release \
    xdg-utils \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install ChromeDriver (using new Chrome for Testing endpoints)
RUN CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d'.' -f1) \
    && echo "Chrome major version: $CHROME_VERSION" \
    && CHROMEDRIVER_URL=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json" \
        | python3 -c "import sys, json; data = json.load(sys.stdin); \
        versions = [v for v in data['versions'] if v['version'].startswith('$CHROME_VERSION.')]; \
        print(versions[-1]['downloads']['chromedriver'][0]['url'] if versions else '')" \
        | grep linux64 | head -1) \
    && if [ -z "$CHROMEDRIVER_URL" ]; then \
        echo "Could not find ChromeDriver for Chrome $CHROME_VERSION, using latest stable"; \
        CHROMEDRIVER_URL="https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/linux64/chromedriver-linux64.zip"; \
    fi \
    && echo "Downloading ChromeDriver from: $CHROMEDRIVER_URL" \
    && wget -q "$CHROMEDRIVER_URL" -O chromedriver.zip \
    && unzip -q chromedriver.zip \
    && mv chromedriver-linux64/chromedriver /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && rm -rf chromedriver.zip chromedriver-linux64

# Install supercronic for lightweight cron in containers
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-amd64 \
    SUPERCRONIC=supercronic-linux-amd64 \
    SUPERCRONIC_SHA1SUM=cd48d45c4b10f3f0bfdd3a57d054cd05ac96812b

RUN curl -fsSLO "$SUPERCRONIC_URL" \
    && echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
    && chmod +x "$SUPERCRONIC" \
    && mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}" \
    && ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic

# Set working directory
WORKDIR /app

# Copy scraper files
COPY scrapers/requirements.txt /app/scrapers/
COPY scrapers/*.py /app/scrapers/

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/scrapers/requirements.txt

# Create crontab file for scheduled runs (9 AM MST = 4 PM UTC, Monday-Friday)
RUN echo "0 16 * * 1-5 cd /app && python3 /app/scrapers/maricopa_arraignment_scraper.py" > /app/crontab

# Copy entrypoint script
COPY <<'EOF' /app/entrypoint.sh
#!/bin/bash
set -e

echo "Justice Watch Scraper Container Started"
echo "Current time: $(date)"
echo "Environment:"
echo "  SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo "  SCHEDULE_ENABLED: ${SCHEDULE_ENABLED:-false}"
echo "  RUN_ON_STARTUP: ${RUN_ON_STARTUP:-false}"
echo "  TEST_MODE: ${TEST_MODE:-false}"

# Test mode - just verify container works
if [ "${TEST_MODE}" = "true" ]; then
    echo "TEST MODE - Container is healthy"
    echo "Chrome version: $(google-chrome --version)"
    echo "Python version: $(python3 --version)"
    echo "ChromeDriver version: $(chromedriver --version)"
    exit 0
fi

# Run scraper immediately if requested
if [ "${RUN_ON_STARTUP}" = "true" ]; then
    echo "Running scraper on startup..."
    python3 /app/scrapers/maricopa_arraignment_scraper.py || echo "Scraper run failed"
fi

# Start scheduler if enabled
if [ "${SCHEDULE_ENABLED}" = "true" ]; then
    echo "Starting scheduler (9 AM MST, Mon-Fri)..."
    exec supercronic /app/crontab
else
    # Only run if we haven't already run on startup
    if [ "${RUN_ON_STARTUP}" != "true" ]; then
        echo "Running scraper once..."
        python3 /app/scrapers/maricopa_arraignment_scraper.py
    fi
    echo "Container work completed. Exiting."
fi
EOF

RUN chmod +x /app/entrypoint.sh

# Set Chrome to run in headless mode by default
ENV CHROME_HEADLESS=true

# Health check (optional - can be used by Akash for monitoring)
HEALTHCHECK --interval=5m --timeout=30s --start-period=30s --retries=3 \
    CMD python3 -c "import sys; sys.exit(0)"

# Run as non-root user for security
RUN useradd -m -u 1000 scraper && chown -R scraper:scraper /app
USER scraper

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]