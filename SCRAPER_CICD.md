# Justice Watch Scraper CI/CD Pipeline

## Overview

This document describes the CI/CD pipeline for the Justice Watch arraignment scraper, which uses Docker, Selenium, and Supabase validation to ensure reliable court data collection.

## Components

### 1. Docker Image (`Dockerfile.scraper`)
- **Base**: Python 3.11 slim
- **Includes**: Google Chrome, ChromeDriver, Selenium, and Python dependencies
- **Size**: ~1.1GB optimized
- **Health Check**: Validates Selenium availability

### 2. Test Suite (`test_scraper_integration.py`)
- **Selenium Navigation Tests**: Verifies browser automation
- **Court Website Access**: Tests connection to Maricopa courts
- **Scraper Execution**: Validates data extraction
- **Screenshot Capture**: Visual verification of scraping

### 3. CI/CD Pipeline (`cicd_pipeline.py`)
- **Build Stage**: Creates Docker image
- **Test Stage**: Runs integration tests
- **Validation Stage**: Verifies data with Supabase
- **Report Generation**: Comprehensive test results

### 4. Supabase Validation (`validate_scraped_data.py`)
- **Pre/Post Checks**: Counts cases before and after scraping
- **Data Integrity**: Validates required fields
- **Uniqueness**: Ensures no duplicate case numbers
- **Cleanup**: Removes test data

## Usage

### Local Testing

```bash
# Build the Docker image
docker build -f Dockerfile.scraper -t justice-scraper:test .

# Run mock scraper test
docker run --rm justice-scraper:test /app/scrapers/mock_scraper.py

# Run full test suite
python3 test_pipeline_simple.py

# Run CI/CD pipeline with validation
python3 cicd_pipeline.py
```

### Docker Compose Testing

```bash
# Start all services
docker-compose -f docker-compose.test.yml up

# Run tests and exit
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# View logs
docker-compose -f docker-compose.test.yml logs scraper
```

### Environment Variables

```bash
# Database connection
export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Supabase configuration
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_SERVICE_KEY="your-service-key"

# Docker Hub (for pushing images)
export DOCKER_USERNAME="your-username"
export DOCKER_PASSWORD="your-password"

# Test configuration
export USE_MOCK_SCRAPER=true  # Use mock for testing
export HEADLESS=true          # Run Chrome headless
export TEST_MODE=true         # Enable test mode
```

## GitHub Actions Workflow

The `.github/workflows/scraper-ci.yml` workflow:

1. **Triggers**:
   - Push to main/development branches
   - Pull requests
   - Daily schedule (2 AM UTC)
   - Manual dispatch

2. **Jobs**:
   - `build`: Creates Docker image
   - `test`: Runs integration tests
   - `validate-supabase`: Validates scraped data
   - `push`: Pushes image to Docker Hub
   - `deploy`: Deployment notification

3. **Required Secrets**:
   ```
   DOCKER_USERNAME
   DOCKER_PASSWORD
   SUPABASE_URL
   SUPABASE_SERVICE_KEY
   ```

## Testing Checklist

- [x] Docker image builds successfully
- [x] Chrome and ChromeDriver installed correctly
- [x] Selenium can create browser instances
- [x] Mock scraper returns valid JSON
- [x] Integration tests pass
- [x] Supabase validation works
- [x] Images push to Docker Hub
- [x] GitHub Actions workflow configured

## Monitoring

### Health Checks
- Docker container health check every 30s
- Selenium session timeouts after 300s
- Scraper execution timeout after 180s

### Logging
- All scraper output logged with timestamps
- Progress updates emitted via WebSocket
- Error tracking with stack traces

### Metrics
- Courts discovered
- Cases found
- Execution time
- Success/failure rates

## Troubleshooting

### Common Issues

1. **Chrome crashes in container**
   - Ensure `--no-sandbox` flag is set
   - Check memory limits (needs ~2GB)
   - Verify `/dev/shm` size

2. **ChromeDriver version mismatch**
   - Image automatically matches versions
   - Rebuild if Chrome updates

3. **Supabase connection fails**
   - Check service key is set
   - Verify network connectivity
   - Ensure database is accessible

4. **Scraper timeouts**
   - Increase timeout values
   - Check court website availability
   - Review network configuration

## Future Improvements

1. **Parallel Scraping**: Use Selenium Grid for multiple browsers
2. **Caching**: Cache Docker layers for faster builds
3. **Monitoring**: Add Prometheus metrics
4. **Alerting**: Integrate PagerDuty/Slack notifications
5. **Auto-scaling**: Deploy to Kubernetes for scaling
6. **Data Pipeline**: Stream to Kafka/Kinesis

## Resources

- [Selenium Documentation](https://www.selenium.dev/documentation/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Supabase Client Library](https://github.com/supabase/supabase-py)
- [GitHub Actions](https://docs.github.com/en/actions)

## Support

For issues or questions:
1. Check the logs in `/test-results/`
2. Review Docker container logs: `docker logs <container-id>`
3. Verify environment variables are set
4. Test with mock scraper first