#!/bin/bash

echo "🚀 Starting Justice Watch Scraper (Interactive Mode)"
echo "=================================================="
echo ""
echo "This will run the Maricopa court scraper and save results locally."
echo ""

# Create output directory
mkdir -p scraper-output

# Run the scraper with real data
docker run --rm -it \
  --name justice-scraper-interactive \
  --network host \
  -e DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -e PYTHONUNBUFFERED=1 \
  -v $(pwd)/scrapers:/app/scrapers:ro \
  -v $(pwd)/scraper-output:/app/output \
  justice-scraper:test \
  /app/scrapers/maricopa_arraignment_scraper.py \
  '{"headless": true, "test_mode": false, "court_limit": 2, "save_to_file": true}'

echo ""
echo "✅ Scraping complete! Check scraper-output/ for results."