# Justice Watch Scraper - Akash Deployment Checklist

## Pre-Deployment
- [ ] Docker image built successfully (current version: A1-2)
- [ ] Container tested locally with TEST_MODE
- [ ] Supabase production credentials ready
- [ ] Docker Hub account created
- [ ] Akash wallet funded with AKT tokens

## Docker Hub Push
```bash
# 1. Login to Docker Hub
docker login

# 2. Tag the image (replace 'yourusername')
docker tag justice-watch-scraper:A1-2 yourusername/justice-watch-scraper:A1-2

# 3. Push to Docker Hub
docker push yourusername/justice-watch-scraper:A1-2
```

## SDL Configuration
- [ ] Update `akash-deploy.sdl` with your Docker Hub username
- [ ] Verify image tag matches pushed version (A1-2)

## Akash Deployment
- [ ] Go to [Akash Console](https://console.akash.network/)
- [ ] Connect wallet (Keplr)
- [ ] Upload `akash-deploy.sdl`
- [ ] Set environment variables:
  - [ ] `SUPABASE_URL` = production URL
  - [ ] `SUPABASE_SERVICE_KEY` = production service key  
  - [ ] `SCHEDULE_ENABLED` = true (for scheduled runs)
  - [ ] `RUN_ON_STARTUP` = false (unless you want immediate test)
  - [ ] `TEST_MODE` = false
- [ ] Select provider
- [ ] Deploy

## Post-Deployment Verification
- [ ] Check container logs in Akash Console
- [ ] Verify "Starting scheduler" message appears
- [ ] Monitor first scheduled run (9 AM MST, Mon-Fri)
- [ ] Check Supabase for new data after run

## GitHub Actions Cleanup
- [ ] Go to https://github.com/arealicehole/justice-watch-app
- [ ] Navigate to Settings → Actions
- [ ] Disable scraper workflow OR
- [ ] Delete `.github/workflows/scraper-schedule.yml`

## Troubleshooting Commands

### Test container locally before pushing:
```bash
# Test mode - just verify it works
docker run --rm -e TEST_MODE=true justice-watch-scraper:A1-2

# Run scraper once (needs Supabase creds)
docker run --rm \
  -e SUPABASE_URL="your_url" \
  -e SUPABASE_SERVICE_KEY="your_key" \
  -e SCHEDULE_ENABLED=false \
  -e RUN_ON_STARTUP=true \
  justice-watch-scraper:A1-2
```

### Version History
- **A1-0**: Initial version
- **A1-1**: Fixed ChromeDriver installation
- **A1-2**: Added TEST_MODE, fixed entrypoint logic

## Notes
- Container uses 0.5 vCPU, 1GB RAM, 512MB storage
- Scheduler runs at 9 AM MST (4 PM UTC) Monday-Friday
- Each scrape takes ~5-10 minutes
- Logs are available in Akash Console