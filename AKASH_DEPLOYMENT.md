# Akash Network Deployment Guide

## Overview
Justice Watch AZ - Court monitoring application ready for Akash deployment with Supabase backend.

## Pre-Deployment Setup

### 1. Supabase Configuration
Create a Supabase project at https://supabase.com and get:
- `SUPABASE_URL`: Your project URL
- `SUPABASE_SERVICE_KEY`: Service role key (Settings > API)

### 2. Environment Variables
Copy `.env.akash.example` to `.env.production` and fill in:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
DATABASE_URL=your_supabase_connection_string
JWT_SECRET=generate_a_secure_secret
SESSION_SECRET=generate_another_secure_secret
```

### 3. Docker Image
The production image is ready at `justice-watch:production`

To push to Docker Hub:
```bash
docker tag justice-watch:production yourdockerhub/justice-watch:latest
docker push yourdockerhub/justice-watch:latest
```

## Akash Deployment

### 1. Update deploy.yaml
Edit `deploy.yaml` and set your Docker image:
```yaml
image: yourdockerhub/justice-watch:latest
```

### 2. Deploy to Akash
```bash
# Install Akash CLI if needed
curl -sSfL https://raw.githubusercontent.com/akash-network/provider/main/install.sh | sh

# Deploy
akash tx deployment create deploy.yaml --from your-wallet --node https://rpc.akash.forbole.com:443

# Get deployment info
akash query deployment list --owner your-address

# Get provider bids
akash query market bid list --owner your-address --dseq your-dseq

# Accept a bid
akash tx market lease create --dseq your-dseq --from your-wallet --provider provider-address
```

### 3. Access Your App
Once deployed, you'll get an Akash URL like:
```
https://your-deployment.provider-domain.akash.host
```

## Features
- ✅ Supabase cloud database (no local storage needed)
- ✅ Court case scraping with Selenium
- ✅ Multi-user authentication
- ✅ Real-time WebSocket updates
- ✅ Redis queue management
- ✅ Production-ready Docker image

## Default Login
After deployment, create an admin user:
```bash
# SSH into your Akash deployment or use kubectl
kubectl exec -it your-pod -- node -e "
const bcrypt = require('bcryptjs');
// ... create user script
"
```

## Monitoring
- Check logs: `akash provider service-logs --dseq your-dseq`
- Health endpoint: `https://your-url.akash.host/health`

## Support
- Supabase data persists in cloud
- No local database needed
- Scales horizontally on Akash