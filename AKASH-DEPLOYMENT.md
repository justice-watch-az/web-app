# Akash Deployment Instructions for Justice Watch Scraper

## Overview
This guide explains how to deploy the Justice Watch scraper to Akash Network, replacing the current GitHub Actions setup.

## Prerequisites
- Docker installed locally for building the image
- Docker Hub account (or other container registry)
- Akash wallet with AKT tokens
- Access to production Supabase credentials

## Step 1: Build and Push Docker Image

### 1.1 Build the Docker image locally
```bash
# From the project root directory
docker build -t justice-watch-scraper:latest .
```

### 1.2 Test the image locally (optional)
```bash
# Test with environment variables
docker run --rm \
  -e SUPABASE_URL="your_supabase_url" \
  -e SUPABASE_SERVICE_KEY="your_service_key" \
  -e SCHEDULE_ENABLED=false \
  -e RUN_ON_STARTUP=true \
  justice-watch-scraper:latest
```

### 1.3 Tag and push to Docker Hub
```bash
# Login to Docker Hub
docker login

# Tag the image (replace 'yourusername' with your Docker Hub username)
docker tag justice-watch-scraper:latest yourusername/justice-watch-scraper:latest

# Push to Docker Hub
docker push yourusername/justice-watch-scraper:latest
```

## Step 2: Prepare SDL Configuration

1. Open `akash-deploy.yml` file
2. Update the following fields:
   - `image:` - Replace with your Docker Hub image path
   - Leave environment variables as placeholders (you'll set them in Akash Console)

## Step 3: Deploy via Akash Console

### 3.1 Access Akash Console
1. Go to [Akash Console](https://console.akash.network/)
2. Connect your wallet (Keplr recommended)

### 3.2 Create New Deployment
1. Click "Deploy" or "New Deployment"
2. Choose "Upload SDL" option
3. Upload the `akash-deploy.yml` file

### 3.3 Configure Environment Variables
When prompted, set the following environment variables:
- `SUPABASE_URL`: Your production Supabase URL
- `SUPABASE_SERVICE_KEY`: Your production Supabase service key
- `SCHEDULE_ENABLED`: Set to `true` for scheduled runs (9 AM MST, Mon-Fri)
- `RUN_ON_STARTUP`: Set to `true` if you want to run immediately on deployment
- `CHROME_HEADLESS`: Keep as `true`

### 3.4 Select Provider
1. Review the available providers
2. Choose one with good uptime and reasonable pricing
3. Accept the bid

### 3.5 Deploy
1. Confirm the deployment
2. Wait for the container to start
3. Check logs to verify successful deployment

## Step 4: Monitor Deployment

### Check Logs
In Akash Console:
1. Go to your deployments
2. Click on the scraper deployment
3. View logs to ensure it's running correctly

### Expected Log Output
```
Justice Watch Scraper Container Started
Current time: [timestamp]
Environment:
  SUPABASE_URL: https://...
  SCHEDULE_ENABLED: true
  RUN_ON_STARTUP: false
Starting scheduler (9 AM MST, Mon-Fri)...
```

## Step 5: Remove GitHub Actions

Once Akash deployment is verified:

### 5.1 Disable GitHub Actions Workflow
1. Go to the OLD repository: https://github.com/arealicehole/justice-watch-app
2. Navigate to `.github/workflows/`
3. Find the scraper workflow file
4. Either:
   - Delete the workflow file, OR
   - Disable it in GitHub Actions settings

### 5.2 Update Repository Secrets (Optional)
Remove unnecessary secrets from GitHub repository:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

## Troubleshooting

### Container Exits Immediately
- Check if `SCHEDULE_ENABLED` is set correctly
- Verify environment variables are set
- Check logs for error messages

### Scraper Can't Connect to Supabase
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- Ensure service key has necessary permissions

### Chrome/Selenium Issues
- The Docker image includes Chrome and ChromeDriver
- Ensure `CHROME_HEADLESS=true` is set
- Check logs for specific Selenium errors

## Scheduling Options

### Option 1: Continuous Scheduler (Recommended)
Set `SCHEDULE_ENABLED=true` to run the container continuously with scheduled scraping at 9 AM MST, Monday-Friday.

### Option 2: One-Time Runs
Set `SCHEDULE_ENABLED=false` and `RUN_ON_STARTUP=true` to run once and exit. You would need to redeploy for each run.

### Option 3: Manual Triggers
Keep container running with scheduler, but trigger additional runs manually if needed (requires custom endpoint - not implemented in current version).

## Cost Estimation

Based on current Akash pricing:
- CPU: 1.0 vCPU
- Memory: 2 GB
- Storage: 5 GB
- Estimated monthly cost: ~$5-10 USD equivalent in AKT

## Security Notes

1. **Never commit credentials** - Always use environment variables
2. **Use service keys** - Not anon keys for production
3. **Monitor usage** - Check Supabase dashboard for unusual activity
4. **Update regularly** - Keep Docker image updated with security patches

## Maintenance

### Updating the Scraper
1. Make changes to scraper code
2. Rebuild Docker image with new tag
3. Push to Docker Hub
4. Update deployment in Akash Console with new image tag

### Viewing Historical Runs
Check Supabase database for scraping history and results.

## Support

For issues:
1. Check Akash deployment logs
2. Verify Supabase connection
3. Test Docker image locally
4. Review scraper code for issues