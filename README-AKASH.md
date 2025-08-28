# Akash Deployment Guide for Justice Watch Scraper

## Overview

This guide explains how to deploy the Justice Watch arraignment scraper to the Akash Network, a decentralized cloud computing marketplace.

## Docker Images

The scraper runs in a Docker container. Current production image:
- `arealicehole/justice-watch-scraper:A1-7`

This image includes:
- Python 3.10 with all scraper dependencies
- Chrome/Chromium for Selenium web scraping
- Supabase client v2.10.0 (fixes proxy parameter issues)
- Automated scheduling capabilities

## Deployment Configuration

### 1. Prepare Your Deployment File

Copy the template and add your credentials:
```bash
cp akash-deploy-template.yml akash-deploy.yml
```

Edit `akash-deploy.yml` and replace:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your service role key (for writing to database)

**IMPORTANT**: Never commit `akash-deploy.yml` to version control as it contains secrets!

### 2. Resource Requirements

The deployment uses minimal resources:
- **CPU**: 0.5 units (half a CPU core)
- **Memory**: 1 GB RAM
- **Storage**: 512 MB disk space
- **Cost**: ~1000 uakt per month (approximately $3-5 USD)

### 3. Deploy to Akash

Using Akash CLI:
```bash
# Create deployment
akash tx deployment create akash-deploy.yml --from your-wallet --node https://rpc.akash.forbole.com:443 --chain-id akashnet-2

# Query bids
akash query market bid list --owner your-address --node https://rpc.akash.forbole.com:443

# Accept a bid
akash tx market lease create --dseq DEPLOYMENT_SEQ --from your-wallet --provider PROVIDER_ADDRESS --node https://rpc.akash.forbole.com:443 --chain-id akashnet-2
```

Using Akash Console (Web UI):
1. Go to https://console.akash.network/
2. Connect your Keplr wallet
3. Click "Deploy" and upload your `akash-deploy.yml`
4. Select a provider from the bid list
5. Accept the lease

### 4. Environment Variables

The container accepts these environment variables:

- `SUPABASE_URL`: Your Supabase project URL (required)
- `SUPABASE_SERVICE_KEY`: Service role key for database writes (required)
- `SUPABASE_ANON_KEY`: Alternative anon key (optional, falls back to service key)
- `SCHEDULE_ENABLED`: Set to `true` to run scraper on schedule
- `RUN_ON_STARTUP`: Set to `true` to run immediately on container start
- `CHROME_HEADLESS`: Set to `true` for headless Chrome (required in container)

### 5. Monitoring

The scraper logs all activity. You can view logs through:

Akash CLI:
```bash
akash provider service-logs --dseq DEPLOYMENT_SEQ --provider PROVIDER_ADDRESS --service web
```

Akash Console:
- Navigate to your deployment
- Click on "Logs" tab

## Building New Docker Images

If you need to update the scraper:

1. Make your code changes
2. Update version in `requirements.txt` if needed
3. Build new image:
```bash
docker build -t arealicehole/justice-watch-scraper:A1-8 -f Dockerfile.akash .
```

4. Test locally:
```bash
docker run --rm \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_SERVICE_KEY=your_key \
  arealicehole/justice-watch-scraper:A1-8 \
  python3 /app/scrapers/maricopa_arraignment_scraper.py '{"headless": true}'
```

5. Push to Docker Hub:
```bash
docker push arealicehole/justice-watch-scraper:A1-8
```

6. Update `akash-deploy.yml` with new image tag

## Troubleshooting

### Container won't start
- Check logs for Python import errors
- Verify all environment variables are set
- Ensure Docker image was pushed successfully

### Scraper finds cases but database writes fail
- Verify `SUPABASE_SERVICE_KEY` has write permissions
- Check Supabase table schema matches expected fields
- Look for connection timeout errors in logs

### Chrome/Selenium errors
- Ensure `CHROME_HEADLESS=true` is set
- Container uses Chrome in headless mode only
- Check for navigation timeout errors (court site may be slow)

### Proxy parameter errors
- Use Docker image A1-7 or later
- These versions have supabase==2.10.0 which fixes the proxy issue
- Earlier versions (A1-5, A1-6) have a gotrue dependency bug

## Current Production Setup

As of August 2025:
- **Image**: `arealicehole/justice-watch-scraper:A1-7`
- **Schedule**: Runs every 4 hours
- **Courts**: Scans all 26 Maricopa County Justice Courts
- **Target**: Arraignment Hearing - Long Form cases only
- **Database**: Writes to Supabase `cases`, `case_charges`, and `case_calendar` tables

## Security Notes

1. **Never commit secrets**: The `akash-deploy.yml` file contains database credentials
2. **Use service keys carefully**: Service role keys bypass Row Level Security
3. **Monitor usage**: Check Supabase dashboard for unexpected database activity
4. **Rotate keys periodically**: Generate new service keys every few months

## Support

For issues with:
- **Scraper code**: Check `/scrapers/maricopa_arraignment_scraper.py`
- **Database writes**: Check `/scrapers/supabase_writer_fixed.py`
- **Docker build**: Check `Dockerfile.akash`
- **Akash deployment**: Consult Akash Discord or documentation