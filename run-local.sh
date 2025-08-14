#!/bin/bash
# Run Justice Watch locally on your laptop

echo "🚀 Starting Justice Watch locally..."

# Pull the latest image
echo "📦 Pulling latest Docker image..."
docker pull arealicehole/justice-watch:aio.01

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.local.yml down

# Start the services
echo "✨ Starting services..."
docker-compose -f docker-compose.local.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Show status
echo "📊 Service status:"
docker-compose -f docker-compose.local.yml ps

echo ""
echo "✅ Justice Watch is running!"
echo "🌐 Access the app at: http://localhost:3001"
echo "👤 Login: admin@justice.com"
echo "🔑 Password: JusticeWatch2025!"
echo ""
echo "📝 To view logs: docker-compose -f docker-compose.local.yml logs -f"
echo "🛑 To stop: docker-compose -f docker-compose.local.yml down"