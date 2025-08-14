#!/bin/sh
# Startup script for Akash deployment
# Installs and starts Redis, then starts the app

echo "Starting Justice Watch on Akash..."

# Install Redis if not present
if ! command -v redis-server &> /dev/null; then
    echo "Installing Redis..."
    apk add --no-cache redis
fi

# Start Redis in background
echo "Starting Redis..."
redis-server --daemonize yes --bind 127.0.0.1 --port 6379

# Wait for Redis to be ready
sleep 2

# Start the application
echo "Starting Justice Watch app..."
exec node server/index.js