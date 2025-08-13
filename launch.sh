#!/bin/bash

echo "========================================="
echo "   Justice Watch Application Launcher    "
echo "========================================="
echo ""

# Check if containers are running
if docker ps | grep -q justice-watch-final; then
    echo "✅ Application is already running!"
else
    echo "Starting application..."
    docker run -d --name justice-watch-final \
        --network justice-watch-app_default \
        -p 3001:3001 \
        -e NODE_ENV=production \
        -e DB_HOST=postgres \
        -e DB_NAME=justice_watch \
        -e DB_USER=postgres \
        -e DB_PASSWORD=postgres \
        -e REDIS_HOST=redis \
        justice-watch-app:v3.0
    
    sleep 3
    echo "✅ Application started!"
fi

echo ""
echo "========================================="
echo "         ACCESS YOUR APPLICATION         "
echo "========================================="
echo ""
echo "🌐 Main Application:"
echo "   http://localhost:3001"
echo ""
echo "📊 Direct Cases Dashboard:"
echo "   http://localhost:3001/cases"
echo ""
echo "========================================="
echo "            QUICK ACTIONS                "
echo "========================================="
echo ""
echo "View logs:"
echo "  docker logs -f justice-watch-final"
echo ""
echo "Stop application:"
echo "  docker stop justice-watch-final && docker rm justice-watch-final"
echo ""
echo "Run scraper manually:"
echo "  docker exec justice-watch-final python3 /app/scrapers/maricopa_arraignment_scraper.py"
echo ""
echo "========================================="

# Open browser if available
if command -v xdg-open > /dev/null; then
    echo ""
    echo "Opening browser..."
    xdg-open http://localhost:3001 2>/dev/null &
elif command -v open > /dev/null; then
    echo ""
    echo "Opening browser..."
    open http://localhost:3001 2>/dev/null &
fi

echo ""
echo "✅ Application is ready for testing!"
echo ""