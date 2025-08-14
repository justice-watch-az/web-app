# Justice Watch App - Akash Deployment Guide

## Prerequisites
- Docker Hub account
- Akash wallet with AKT tokens
- Akash CLI or Cloudmos Deploy installed
- Supabase project (free tier works)

## Step 1: Prepare Supabase

1. Create a Supabase project at https://supabase.com
2. Run the migration script in SQL Editor:
   ```sql
   -- Copy contents from database/complete_supabase_schema.sql
   ```
3. Get your connection details:
   - Go to Settings → Database
   - Use "Session mode" pooler connection string
   - Copy the connection string

## Step 2: Build and Push Docker Image

```bash
# Build the production image
docker build -f Dockerfile.akash -t yourdockerhub/justice-watch:latest .

# Test locally first
docker run -p 3001:3001 -p 5173:5173 \
  --env-file .env.akash \
  yourdockerhub/justice-watch:latest

# Push to Docker Hub
docker push yourdockerhub/justice-watch:latest
```

## Step 3: Configure Deployment

1. Copy `.env.akash.example` to `.env.akash`
2. Fill in your Supabase credentials
3. Generate secure secrets:
   ```bash
   # Generate SESSION_SECRET
   openssl rand -base64 48
   
   # Generate JWT_SECRET
   openssl rand -base64 48
   ```
4. Update `deploy-akash.yaml`:
   - Replace Docker image name
   - Update environment variables
   - Set your domain in CLIENT_URL

## Step 4: Deploy to Akash

### Using Cloudmos Deploy (Recommended)

1. Open https://deploy.cloudmos.io
2. Connect your Keplr wallet
3. Click "Deploy"
4. Upload `deploy-akash.yaml`
5. Review and submit deployment
6. Wait for bids
7. Accept a bid (usually $15-20/month)
8. Your app will be deployed!

### Using Akash CLI

```bash
# Create deployment
akash tx deployment create deploy-akash.yaml --from wallet

# Query bids
akash query market bid list --owner [your-address]

# Accept a bid
akash tx market lease create --bid-id [bid-id] --from wallet

# Get your deployment URL
akash query market lease status --bid-id [bid-id]
```

## Step 5: Verify Deployment

1. Visit your deployment URL
2. Create a user account
3. Login and test scraping
4. Check Supabase dashboard for scraped data

## Architecture on Akash

```
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  Justice Watch  │────▶│     Redis       │
│   App Container │     │   Container     │
│                 │     │                 │
└────────┬────────┘     └─────────────────┘
         │
         │ Pooler Connection
         ▼
┌─────────────────┐
│                 │
│    Supabase     │
│   (External)    │
│                 │
└─────────────────┘
```

## Cost Breakdown

- **Akash**: ~$15-20/month for app + Redis
- **Supabase**: Free tier (up to 500MB database)
- **Total**: ~$15-20/month

## Monitoring

Check logs:
```bash
# Via Cloudmos
# Click on your deployment → Logs

# Via CLI
akash provider service-logs --service [service-name] --provider [provider]
```

## Troubleshooting

### Database Connection Issues
- Ensure you're using the Session pooler URL
- Check that password doesn't have special characters that need escaping
- Verify Supabase project is active

### Scraping Not Working
- Check Redis is running: `curl http://your-app/health`
- Verify Chrome is installed in container
- Check logs for Puppeteer errors

### High Memory Usage
- Increase memory in `deploy-akash.yaml`
- Enable headless mode in scraper config
- Reduce concurrent scraping jobs

## Security Checklist

- [ ] Changed SESSION_SECRET from default
- [ ] Changed JWT_SECRET from default  
- [ ] Using HTTPS (Akash provides this)
- [ ] Supabase RLS policies configured
- [ ] Rate limiting enabled
- [ ] No sensitive data in logs

## Support

- Akash Discord: https://discord.gg/akash
- Supabase Discord: https://discord.gg/supabase
- Issues: https://github.com/yourusername/justice-watch/issues