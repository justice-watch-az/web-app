# GitHub Actions Setup for Automated Scraping

## Overview

This setup enables automatic scraping of Maricopa County court data every 6 hours using GitHub Actions on Mac hardware (free tier). The scraper runs on real Mac hardware with real Chrome, avoiding bot detection.

## Setup Instructions

### 1. Enable GitHub Actions

1. Go to your GitHub repository
2. Click on "Actions" tab
3. Enable workflows if not already enabled

### 2. Add Repository Secrets

Go to **Settings → Secrets and variables → Actions** and add these secrets:

#### Required Secrets:

```bash
# Supabase Database URL
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

# Supabase API URL
SUPABASE_URL=https://[project-id].supabase.co

# Supabase Service Key (for server-side access)
SUPABASE_SERVICE_KEY=eyJ[...]
```

#### How to Get These Values:

1. **DATABASE_URL**: 
   - Go to Supabase Dashboard → Settings → Database
   - Copy the "Connection string" (URI format)
   - Replace `[YOUR-PASSWORD]` with your database password

2. **SUPABASE_URL**:
   - Go to Supabase Dashboard → Settings → API
   - Copy the "Project URL"

3. **SUPABASE_SERVICE_KEY**:
   - Go to Supabase Dashboard → Settings → API
   - Copy the "service_role key" (NOT the anon key)
   - ⚠️ Keep this secret! It has full database access

### 3. Deploy the Workflow

1. Commit the workflow file to your repository:
   ```bash
   git add .github/workflows/scrape-courts-mac.yml
   git commit -m "Add automated court scraping workflow"
   git push
   ```

2. The workflow will now run:
   - **Automatically**: Every 6 hours
   - **Manually**: Go to Actions → "Scrape Maricopa Courts (Mac)" → "Run workflow"

### 4. Monitor Scraping

#### View Run History:
- Go to Actions tab → "Scrape Maricopa Courts (Mac)"
- Click on any run to see details
- Download artifacts (scraping results, logs, screenshots)

#### Check Database:
```sql
-- View recently scraped cases
SELECT * FROM cases 
WHERE scraped_at > NOW() - INTERVAL '24 hours'
ORDER BY scraped_at DESC;

-- Check scraping job history
SELECT * FROM scraping_jobs
ORDER BY completed_at DESC
LIMIT 10;
```

## Workflow Features

### Automatic Scheduling
- Runs **Monday-Friday only** (business days)
- **9:00 AM MST/PDT (UTC-7)** - Daily morning court update
- Skips weekends when courts are closed
- Can be manually triggered anytime for urgent updates

### Smart Caching
- Caches pip packages between runs
- Reuses Chrome installation
- Faster subsequent runs

### Error Handling
- 30-minute timeout to prevent hanging
- Uploads results even if scraping fails
- Logs all errors for debugging

### Database Integration
- Writes directly to Supabase
- Updates scraping_jobs table with status
- No intermediate storage needed

## Testing the Setup

### 1. Manual Test Run:
1. Go to Actions tab
2. Select "Scrape Maricopa Courts (Mac)"
3. Click "Run workflow"
4. Set parameters:
   - `court_limit`: 2 (for testing)
   - `test_mode`: true
5. Click "Run workflow" (green button)

### 2. Verify Data:
```javascript
// Check from your app
fetch('/api/cases/recent')
  .then(res => res.json())
  .then(cases => console.log('Recent cases:', cases));
```

### 3. Check Logs:
- Click on the workflow run
- Expand "Run scraper" step
- View real-time scraping output

## Cost & Limits

### GitHub Actions Free Tier:
- **2,000 minutes/month** for private repos
- **Unlimited** for public repos
- Mac runners use **10x minutes** (1 min = 10 min counted)
- Each scrape takes ~5-10 real minutes = 50-100 counted minutes
- **Your schedule**: 1 run × 5 days × 4 weeks = ~20 runs/month
- **Monthly usage**: ~20 runs × 75 min = 1,500 minutes ✅ (fits in free tier!)

### Optimization Tips:
1. **Reduce frequency** if hitting limits:
   ```yaml
   # Run once daily instead
   - cron: '0 2 * * *'
   ```

2. **Limit courts** for faster runs:
   ```yaml
   court_limit: '5'  # Only scrape 5 courts
   ```

3. **Make repo public** for unlimited minutes

## Troubleshooting

### Scraper Times Out
- Reduce `court_limit` in workflow inputs
- Check if court website is down
- Review logs for specific court causing issues

### Database Not Updating
- Verify secrets are correctly set
- Check Supabase connection string
- Ensure service key has write permissions

### Chrome/ChromeDriver Issues
- Workflow automatically matches versions
- Check logs for version mismatch
- Clear cache and retry

### Bot Detection
- Mac hardware usually bypasses detection
- Add random delays if needed
- Reduce scraping frequency

## Security Notes

1. **Never commit secrets** to the repository
2. **Use service_role key** only in GitHub Actions
3. **Rotate keys** periodically
4. **Monitor usage** in Supabase dashboard

## Support

- Check workflow run logs for errors
- View artifacts for detailed scraping results
- Database logs in Supabase Dashboard → Logs
- GitHub Actions status: https://www.githubstatus.com/