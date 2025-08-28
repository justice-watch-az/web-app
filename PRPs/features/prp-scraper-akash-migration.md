# PRP: Migrate Scraper from GitHub Actions to Akash

## Context
Currently, the scraper runs via GitHub Actions on a schedule from the wrong repository (https://github.com/arealicehole/justice-watch-app instead of the current working repo). We need to migrate the scraper to run on Akash Network as a Docker container, while keeping the frontend (Netlify) and database (Supabase) infrastructure unchanged.

## Requirements
- Remove scraper from GitHub Actions workflow
- Create Docker image suitable for Akash deployment
- Ensure scraper can connect to production Supabase from Akash
- Provide SDL configuration for Akash deployment via web GUI
- Maintain existing scraper functionality (daily runs, Monday-Friday 9 AM MST)
- Zero disruption to frontend and database services

## Technical Details

### Current Architecture (TO BE CHANGED)
- **Scraper**: GitHub Actions (scheduled workflow)
- **Frontend**: Netlify (KEEP AS IS)
- **Database**: Supabase Cloud (KEEP AS IS)

### New Architecture
- **Scraper**: Akash Network (Docker container)
- **Frontend**: Netlify (NO CHANGE)
- **Database**: Supabase Cloud (NO CHANGE)

### Docker Image Requirements
- Base image with Python 3.9+ and Chrome/Chromium
- Selenium WebDriver support
- All scraper dependencies from requirements.txt
- Environment variables for Supabase connection
- Cron or scheduler for daily runs (9 AM MST, Mon-Fri)

### SDL Configuration
The SDL must define:
- Docker image location (Docker Hub or other registry)
- Resource requirements (CPU, memory, storage)
- Environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY)
- Persistent storage if needed for logs
- Network exposure (not needed - scraper initiates outbound only)

### Migration Steps
1. Build and test Docker image locally
2. Push Docker image to registry
3. Create SDL configuration file
4. Deploy to Akash via web GUI
5. Verify scraper runs successfully
6. Remove GitHub Actions workflow

## Success Criteria
- [ ] Docker image created with all dependencies
- [ ] Dockerfile added to repository
- [ ] Docker image successfully runs scraper locally
- [ ] Docker image pushed to public registry
- [ ] SDL configuration file created
- [ ] Scraper deployed and running on Akash
- [ ] Successful scrape verified in production Supabase
- [ ] GitHub Actions workflow removed/disabled
- [ ] Documentation updated with new deployment process

## Notes

### Important Considerations
- The scraper MUST follow the navigation rules in CLAUDE.md (click-based navigation, no URL construction)
- Environment variables must be securely passed via Akash deployment
- Consider using a lightweight scheduler like `supercronic` instead of full cron in Docker
- The Docker container should handle both one-time runs and scheduled runs
- Logging should be configured for Akash deployment monitoring

### Docker Registry Options
- Docker Hub (free tier available)
- GitHub Container Registry
- Akash-compatible registry

### Scheduler Options for Docker
1. **Supercronic**: Lightweight cron for containers
2. **Python scheduler**: Use `schedule` library or `APScheduler`
3. **External trigger**: Run container on-demand via Akash

### Environment Variables Required
```bash
SUPABASE_URL=<production_supabase_url>
SUPABASE_SERVICE_KEY=<production_service_key>
SCHEDULE_ENABLED=true  # Optional: to control if scheduler runs
SCHEDULE_TIME="09:00"  # Optional: MST time for daily run
```

### SDL Template Structure
```yaml
version: "2.0"
services:
  scraper:
    image: <registry>/justice-watch-scraper:latest
    env:
      - SUPABASE_URL=<url>
      - SUPABASE_SERVICE_KEY=<key>
    expose:
      - port: 8080  # If needed for health checks
        as: 80
        to:
          - global: false

profiles:
  compute:
    scraper:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    westcoast:
      attributes:
        region: us-west
      signedBy:
        anyOf:
          - <provider>
      pricing:
        scraper:
          denom: uakt
          amount: 100

deployment:
  scraper:
    westcoast:
      profile: scraper
      count: 1
```