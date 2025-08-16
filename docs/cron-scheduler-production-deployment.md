# Production Deployment Guide - Cron Scheduler for Justice Watch App

## 📋 Pre-Deployment Checklist

- [ ] Local testing completed successfully
- [ ] All dependencies installed and verified
- [ ] Database migrations tested locally
- [ ] Environment variables prepared for production
- [ ] Backup of production database taken
- [ ] Maintenance window scheduled (if needed)

## 🚀 Step-by-Step Deployment Process

### Step 1: Prepare Production Environment Variables

Create a production environment file:

```bash
# Create production env file
cat > .env.production << 'EOF'
# Cloud Supabase Configuration (Replace with your actual values)
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-PRODUCTION-ANON-KEY]
SUPABASE_SERVICE_KEY=[YOUR-PRODUCTION-SERVICE-KEY]

# Application Configuration
NODE_ENV=production
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379

# Cron Configuration
CRON_ENABLED=true
CRON_TIMEZONE=America/Phoenix
DEFAULT_SCRAPING_INTERVAL=0 */6 * * *

# Optional: Error notifications
NOTIFICATION_EMAIL=admin@yourdomain.com
SLACK_WEBHOOK_URL=[YOUR-SLACK-WEBHOOK]
EOF
```

### Step 2: Backup Production Database

```bash
# Export existing data (if any)
docker exec supabase_db_justice-watch-app pg_dump -U postgres postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Supabase CLI
supabase db dump --project-ref [YOUR-PROJECT-REF] > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 3: Deploy Database Schema to Production

```bash
# Option A: Using Supabase Dashboard
# 1. Go to https://app.supabase.com/project/[YOUR-PROJECT-REF]/sql
# 2. Paste the migration SQL and run

# Option B: Using Supabase CLI
supabase db push --project-ref [YOUR-PROJECT-REF]

# Option C: Direct connection (if allowed)
psql $SUPABASE_DB_URL < supabase/migrations/001_cron_scheduler_simple.sql
```

**Migration SQL to run:**
```sql
-- Drop existing tables if they exist (BE CAREFUL IN PRODUCTION!)
-- Comment these out if you want to preserve existing data
-- DROP TABLE IF EXISTS cron_executions CASCADE;
-- DROP TABLE IF EXISTS cron_schedules CASCADE;

-- Schedule configuration table
CREATE TABLE IF NOT EXISTS cron_schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_expression VARCHAR(100) NOT NULL,
  job_type VARCHAR(50) NOT NULL DEFAULT 'arraignments',
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  next_run TIMESTAMP,
  last_run TIMESTAMP,
  last_status VARCHAR(50),
  consecutive_failures INTEGER DEFAULT 0
);

-- Execution history table
CREATE TABLE IF NOT EXISTS cron_executions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES cron_schedules(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  scraping_job_id INTEGER,
  cases_found INTEGER DEFAULT 0,
  courts_processed INTEGER DEFAULT 0,
  error TEXT,
  execution_time_ms INTEGER,
  metadata JSONB DEFAULT '{}'
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_cron_schedules_enabled_next 
  ON cron_schedules(enabled, next_run) 
  WHERE enabled = true;
  
CREATE INDEX IF NOT EXISTS idx_cron_executions_schedule_status 
  ON cron_executions(schedule_id, status, started_at DESC);

-- Insert default schedules (modify as needed for production)
INSERT INTO cron_schedules (name, description, cron_expression, job_type, config) 
VALUES
  ('Hourly Arraignment Check', 'Check for new arraignment cases every hour during business hours', '0 8-17 * * 1-5', 'arraignments', '{"courtId": "all", "dateRangeDays": 7}'),
  ('Daily Full Scan', 'Complete scan of all courts daily at 2 AM', '0 2 * * *', 'arraignments', '{"courtId": "all", "dateRangeDays": 30}'),
  ('Weekly Deep Scan', 'Weekly comprehensive scan on Sunday', '0 3 * * 0', 'arraignments', '{"courtId": "all", "dateRangeDays": 90, "includeArchived": true}')
ON CONFLICT DO NOTHING;
```

### Step 4: Update Application Code

```bash
# Commit all changes
git add .
git commit -m "feat: add cron scheduler for automatic arraignment scraping

- Implemented SchedulerService with node-cron
- Added REST API endpoints for schedule management
- Created React admin interface at /scheduler
- Integrated with existing Bull queue
- Added health monitoring and auto-retry logic"

# Push to repository
git push origin main
```

### Step 5: Build Docker Image

Create a production Dockerfile if not exists:

```dockerfile
# Dockerfile.production
FROM node:20-alpine

WORKDIR /app

# Install Python and Chromium for scraping
RUN apk add --no-cache python3 py3-pip chromium chromium-chromedriver

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build React app
RUN npm run build

# Expose port
EXPOSE 3001

# Start command
CMD ["node", "server/index.js"]
```

Build and tag:
```bash
# Build Docker image
docker build -f Dockerfile.production -t justice-watch:cron-v1 .

# Test locally
docker run -p 3001:3001 --env-file .env.production justice-watch:cron-v1
```

### Step 6: Deploy to Akash Network

Update your Akash SDL file:

```yaml
# deploy.yaml
version: "2.0"

services:
  web:
    image: yourregistry/justice-watch:cron-v1
    expose:
      - port: 3001
        as: 80
        to:
          - global: true
    env:
      - NODE_ENV=production
      - CRON_ENABLED=true
      - CRON_TIMEZONE=America/Phoenix
      - DATABASE_URL=$SUPABASE_DB_URL
      - REDIS_HOST=localhost
      - REDIS_PORT=6379

profiles:
  compute:
    web:
      resources:
        cpu:
          units: 2
        memory:
          size: 2Gi
        storage:
          size: 10Gi

  placement:
    westcoast:
      pricing:
        web:
          denom: uakt
          amount: 100

deployment:
  web:
    westcoast:
      profile: web
      count: 1
```

Deploy:
```bash
# Deploy to Akash
akash tx deployment create deploy.yaml --from $AKASH_KEY_NAME --node $AKASH_NODE --chain-id $AKASH_CHAIN_ID

# Get deployment status
akash query deployment list --owner $AKASH_ACCOUNT_ADDRESS
```

### Step 7: Verify Deployment

```bash
# 1. Check application health
curl https://your-app.akash.win/health

# 2. Verify cron schedules
curl https://your-app.akash.win/api/cron/schedules

# 3. Check scheduler health
curl https://your-app.akash.win/api/cron/health

# 4. Monitor logs
akash provider service-logs --service web --provider $PROVIDER_ADDRESS
```

### Step 8: Post-Deployment Configuration

```bash
# 1. Adjust schedules for production load
curl -X PUT https://your-app.akash.win/api/cron/schedules/1 \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "0 */2 * * *"}' # Every 2 hours instead of hourly

# 2. Enable monitoring alerts
curl -X POST https://your-app.akash.win/api/cron/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Health Check",
    "description": "Monitor scraper health",
    "cronExpression": "*/30 * * * *",
    "jobType": "health_check",
    "config": {"alertOnFailure": true}
  }'
```

## 🔄 Rollback Plan

If issues occur, follow this rollback procedure:

```bash
# 1. Disable cron scheduler immediately
curl -X PUT https://your-app.akash.win/api/cron/schedules/1/toggle
curl -X PUT https://your-app.akash.win/api/cron/schedules/2/toggle
curl -X PUT https://your-app.akash.win/api/cron/schedules/3/toggle

# 2. Or set environment variable to disable
export CRON_ENABLED=false

# 3. Redeploy previous version
docker pull yourregistry/justice-watch:previous-version
akash tx deployment update deploy-rollback.yaml

# 4. Restore database if needed
psql $SUPABASE_DB_URL < backup_20250816_120000.sql
```

## 📊 Production Monitoring

### Set up monitoring dashboards:

```javascript
// monitoring/scheduler-health.js
const checkSchedulerHealth = async () => {
  const health = await fetch('https://your-app.akash.win/api/cron/health');
  const data = await health.json();
  
  // Alert if issues detected
  if (data.failedSchedules > 0) {
    sendAlert(`${data.failedSchedules} schedules failing`);
  }
  
  if (data.executions24h.failed > 5) {
    sendAlert(`High failure rate: ${data.executions24h.failed} failures in 24h`);
  }
};

// Run every 5 minutes
setInterval(checkSchedulerHealth, 300000);
```

### Database monitoring queries:

```sql
-- Monitor execution performance
SELECT 
  DATE_TRUNC('hour', started_at) as hour,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(execution_time_ms) as avg_duration_ms,
  MAX(execution_time_ms) as max_duration_ms
FROM cron_executions
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Check schedule health
SELECT 
  name,
  enabled,
  last_run,
  last_status,
  consecutive_failures,
  next_run
FROM cron_schedules
WHERE enabled = true
ORDER BY consecutive_failures DESC;

-- Failed executions analysis
SELECT 
  s.name,
  e.started_at,
  e.error,
  e.execution_time_ms
FROM cron_executions e
JOIN cron_schedules s ON e.schedule_id = s.id
WHERE e.status = 'failed'
  AND e.started_at > NOW() - INTERVAL '24 hours'
ORDER BY e.started_at DESC;
```

## 🛡️ Security Considerations

1. **API Authentication**: Add authentication middleware for production:
```javascript
// server/middleware/auth.js
const authenticateSchedulerAPI = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.SCHEDULER_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Apply to routes
router.use('/api/cron', authenticateSchedulerAPI);
```

2. **Rate Limiting**: Prevent schedule spam:
```javascript
const scheduleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 schedule creations per window
});

router.post('/schedules', scheduleLimiter, ...);
```

3. **Input Validation**: Already implemented with express-validator

## 🎯 Performance Optimization

1. **Database Connection Pooling**: Already configured with max: 20 connections

2. **Redis Configuration** for production:
```bash
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

3. **PM2 for Process Management**:
```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'justice-watch-scheduler',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      CRON_ENABLED: 'true'
    }
  }]
};

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## ✅ Post-Deployment Verification Checklist

- [ ] All API endpoints responding correctly
- [ ] Schedules visible in admin UI at `/scheduler`
- [ ] WebSocket connections working (check browser console)
- [ ] Cron jobs executing at correct intervals
- [ ] Execution history being recorded
- [ ] Failed jobs triggering retry logic
- [ ] Health monitoring showing "running" status
- [ ] Database indexes created successfully
- [ ] Redis queue processing jobs
- [ ] Logs showing no critical errors

## 📞 Support Contacts

- **Database Issues**: Check Supabase status page
- **Akash Deployment**: Discord community support
- **Application Errors**: Check logs with `pm2 logs`

## 🔄 CI/CD Pipeline (Optional)

GitHub Actions workflow:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Docker image
        run: docker build -t justice-watch:${{ github.sha }} .
      
      - name: Push to registry
        run: |
          docker tag justice-watch:${{ github.sha }} ${{ secrets.REGISTRY }}/justice-watch:latest
          docker push ${{ secrets.REGISTRY }}/justice-watch:latest
      
      - name: Deploy to Akash
        run: |
          akash tx deployment update deploy.yaml \
            --from ${{ secrets.AKASH_KEY }} \
            --node ${{ secrets.AKASH_NODE }}
```

## 📈 Expected Performance Metrics

After successful deployment, you should see:

| Metric | Expected Value | Alert Threshold |
|--------|---------------|-----------------|
| Schedule Success Rate | > 95% | < 90% |
| Average Execution Time | < 90 seconds | > 180 seconds |
| Queue Backlog | < 10 jobs | > 50 jobs |
| Memory Usage | < 500MB | > 1GB |
| CPU Usage | < 50% | > 80% |
| Database Connections | < 10 | > 18 |

## 🚨 Troubleshooting Common Issues

### Issue: Schedules not executing
```bash
# Check scheduler status
curl https://your-app.akash.win/api/cron/health

# Check Redis connection
docker exec justice-watch redis-cli ping

# Check logs
pm2 logs justice-watch-scheduler --lines 100
```

### Issue: High memory usage
```bash
# Restart scheduler service
pm2 restart justice-watch-scheduler

# Check for memory leaks
node --inspect server/index.js
```

### Issue: Database connection errors
```bash
# Test connection
psql $SUPABASE_DB_URL -c "SELECT 1"

# Check connection pool
SELECT count(*) FROM pg_stat_activity WHERE application_name = 'justice-watch';
```

## 📝 Final Notes

1. **Start with conservative schedules** - Begin with less frequent intervals and increase based on performance
2. **Monitor for 24-48 hours** after deployment before considering it stable
3. **Keep local Supabase running** for quick rollback testing
4. **Document any custom configurations** for future team members
5. **Set up alerts** for critical failures to catch issues early

This guide ensures a smooth, safe deployment of your cron scheduler to production with proper monitoring, rollback procedures, and optimization strategies! 🚀