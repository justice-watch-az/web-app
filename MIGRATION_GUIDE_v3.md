# Justice Watch v3.0 - Free Tier Migration Guide

## Executive Summary
Migrating Justice Watch from monolithic architecture to 100% free-tier cloud services:
- **Frontend**: Netlify (static hosting + serverless)
- **Scraper**: GitHub Actions (Mac runner)
- **Database**: Supabase (PostgreSQL + Auth + APIs)
- **Cost**: $0/month

---

## CURRENT ARCHITECTURE (v2.0)
```
┌─────────────────────────────────────────────────┐
│           MONOLITHIC NODE.JS SERVER             │
├─────────────────────────────────────────────────┤
│ Problems:                                       │
│ • Requires always-on server ($5-25/month)       │
│ • Complex deployment                            │
│ • Redis dependency                              │
│ • Docker scraper gets blocked                   │
│ • Manual scaling                                │
└─────────────────────────────────────────────────┘
```

## TARGET ARCHITECTURE (v3.0)
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   NETLIFY    │────▶│   SUPABASE   │◀────│   GITHUB     │
│              │     │              │     │   ACTIONS    │
│ • React SPA  │     │ • Database   │     │ • Scraper    │
│ • Serverless │     │ • Auth       │     │ • Scheduler  │
│ • CDN        │     │ • REST API   │     │ • Mac Runner │
│              │     │ • Realtime   │     │              │
│ FREE TIER    │     │ FREE TIER    │     │ FREE TIER    │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## PHASE 1: DATABASE SETUP (Supabase)

### 1.1 Create Supabase Project
```bash
# Go to https://supabase.com
# Create new project (free)
# Save these values:
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=eyJ...  # Public key for frontend
SUPABASE_SERVICE_KEY=eyJ... # Secret key for backend
```

### 1.2 Database Schema
```sql
-- Run in Supabase SQL Editor

-- Cases table (main data)
CREATE TABLE cases (
  id SERIAL PRIMARY KEY,
  case_number VARCHAR(50) UNIQUE NOT NULL,
  court_name VARCHAR(100),
  case_title VARCHAR(200),
  case_type VARCHAR(50),
  status VARCHAR(50),
  filing_date DATE,
  judge VARCHAR(100),
  location VARCHAR(100),
  next_hearing TIMESTAMP,
  case_url TEXT,
  scraped_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public can read cases" ON cases
  FOR SELECT USING (true);

-- Only service role can write
CREATE POLICY "Service role can insert" ON cases
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_case_number ON cases(case_number);
CREATE INDEX idx_court_name ON cases(court_name);
CREATE INDEX idx_scraped_at ON cases(scraped_at DESC);
```

### 1.3 Create API Views
```sql
-- Create view for recent cases
CREATE VIEW recent_cases AS
SELECT * FROM cases
WHERE scraped_at > NOW() - INTERVAL '7 days'
ORDER BY scraped_at DESC;

-- Create function for stats
CREATE OR REPLACE FUNCTION get_case_stats()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'total_cases', (SELECT COUNT(*) FROM cases),
    'courts', (SELECT COUNT(DISTINCT court_name) FROM cases),
    'today_cases', (SELECT COUNT(*) FROM cases WHERE DATE(scraped_at) = CURRENT_DATE),
    'open_cases', (SELECT COUNT(*) FROM cases WHERE status = 'Open')
  );
END;
$$ LANGUAGE plpgsql;
```

---

## PHASE 2: FRONTEND MIGRATION (Netlify)

### 2.1 Remove Backend Dependencies
```javascript
// OLD: src/services/api.ts (Node.js backend)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// NEW: src/services/supabase.ts (Direct Supabase)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 2.2 Update API Calls
```javascript
// src/services/api.ts - NEW VERSION
import { supabase } from './supabase';

export const api = {
  // Get all cases
  async getCases() {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('scraped_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    return data;
  },

  // Search cases
  async searchCases(query: string) {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .or(`case_number.ilike.%${query}%,case_title.ilike.%${query}%`)
      .limit(50);
    
    if (error) throw error;
    return data;
  },

  // Get statistics
  async getStats() {
    const { data, error } = await supabase
      .rpc('get_case_stats');
    
    if (error) throw error;
    return data;
  },

  // Real-time updates
  subscribeToUpdates(callback: (payload: any) => void) {
    return supabase
      .channel('cases_channel')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'cases' },
        callback
      )
      .subscribe();
  }
};
```

### 2.3 Environment Configuration
```bash
# .env.local (for local development)
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

### 2.4 Build Configuration
```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && netlify deploy --prod"
  }
}
```

### 2.5 Deploy to Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
npm run build
netlify deploy --prod --dir=dist
```

---

## PHASE 3: SCRAPER MIGRATION (GitHub Actions)

### 3.1 Update Scraper for Direct Supabase
```python
# scrapers/maricopa_scraper_supabase.py
import os
from supabase import create_client, Client

class MaricopaScraperSupabase:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        self.supabase: Client = create_client(url, key)
    
    def save_case(self, case_data):
        """Save directly to Supabase"""
        try:
            result = self.supabase.table('cases').upsert({
                'case_number': case_data['case_number'],
                'court_name': case_data['court_name'],
                'case_title': case_data['case_title'],
                'case_type': case_data['case_type'],
                'status': case_data['status'],
                'filing_date': case_data['filing_date'],
                'judge': case_data['judge'],
                'location': case_data['location'],
                'next_hearing': case_data['next_hearing'],
                'case_url': case_data['case_url']
            }, on_conflict='case_number').execute()
            
            print(f"✅ Saved case {case_data['case_number']}")
            return result
        except Exception as e:
            print(f"❌ Error saving case: {e}")
            return None
```

### 3.2 GitHub Actions Workflow
```yaml
# .github/workflows/scrape-courts.yml
name: Scrape Courts Daily

on:
  schedule:
    - cron: '0 16 * * 1-5'  # 9am MST M-F
  workflow_dispatch:

jobs:
  scrape:
    runs-on: macos-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        pip install selenium beautifulsoup4 supabase
        brew install --cask google-chrome
    
    - name: Run scraper
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
      run: |
        python scrapers/maricopa_scraper_supabase.py
```

### 3.3 Add GitHub Secrets
```bash
# In GitHub repo settings → Secrets → Actions
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_SERVICE_KEY=eyJ...service-key...
```

---

## PHASE 4: REMOVE OLD INFRASTRUCTURE

### 4.1 Files to Delete
```bash
# Backend files (no longer needed)
server/            # Entire Node.js backend
Dockerfile         # Docker containers
docker-compose.yml # Docker configs
redis/            # Redis configs
.dockerignore     # Docker ignore

# Old configs
.env.production   # Old environment vars
ecosystem.config.js # PM2 config
nginx.conf        # Nginx config
```

### 4.2 Dependencies to Remove
```json
// package.json - Remove these
{
  "dependencies": {
    "express": "DELETE",
    "apollo-server-express": "DELETE", 
    "bull": "DELETE",
    "redis": "DELETE",
    "pg": "DELETE",
    "bcrypt": "DELETE",
    "jsonwebtoken": "DELETE"
  }
}
```

### 4.3 Keep Only Frontend
```
justice-watch-app/
├── src/              # React app
├── public/           # Static assets
├── scrapers/         # Python scrapers (for GitHub)
├── .github/          # GitHub Actions
├── netlify.toml      # Netlify config
├── package.json      # Frontend only
└── vite.config.js    # Vite config
```

---

## PHASE 5: TESTING & VALIDATION

### 5.1 Test Checklist
- [ ] Supabase database accessible
- [ ] Frontend loads on Netlify
- [ ] API calls work without backend
- [ ] Search functionality works
- [ ] Real-time updates work
- [ ] GitHub Action runs successfully
- [ ] Data appears in database
- [ ] Frontend shows new data

### 5.2 Monitoring
```javascript
// Add to frontend for monitoring
window.addEventListener('error', (e) => {
  console.error('App Error:', e);
  // Could send to free service like Sentry
});

// Monitor API health
async function checkHealth() {
  try {
    const { data, error } = await supabase
      .from('cases')
      .select('count')
      .limit(1);
    
    console.log('✅ Supabase connected');
  } catch (error) {
    console.error('❌ Supabase error:', error);
  }
}
```

---

## COST BREAKDOWN

### Monthly Costs: $0
- **Netlify Free**: 100GB bandwidth, 300 build minutes
- **Supabase Free**: 500MB database, 2GB bandwidth, 50K requests
- **GitHub Free**: 2000 action minutes (Mac uses 10x = 200 min)
- **Total**: $0/month

### When You'll Need to Pay
- Netlify: >100GB bandwidth/month (~100K visitors)
- Supabase: >500MB data (~50K cases)
- GitHub: >20 scrapes/month on private repo

---

## DEPLOYMENT COMMANDS

```bash
# 1. Setup Supabase (via web UI)
# Create project at supabase.com

# 2. Deploy Frontend to Netlify
npm run build
netlify deploy --prod

# 3. Setup GitHub Actions
git add .github/workflows/scrape-courts.yml
git commit -m "Add scraper workflow"
git push

# 4. Add secrets in GitHub
# Go to Settings → Secrets → Add SUPABASE_URL and SUPABASE_SERVICE_KEY

# 5. Test scraper manually
# Actions tab → Run workflow

# Done! Everything runs free!
```

---

## ROLLBACK PLAN

If anything goes wrong:
1. Frontend: Netlify keeps last 10 deploys, one-click rollback
2. Database: Supabase has point-in-time recovery (7 days free)
3. Scraper: Git revert the workflow file

---

## SUPPORT CONTACTS

- **Netlify Status**: https://www.netlifystatus.com/
- **Supabase Status**: https://status.supabase.com/
- **GitHub Status**: https://www.githubstatus.com/

---

## SUCCESS METRICS

Week 1:
- [ ] Zero hosting costs
- [ ] Scraper runs daily
- [ ] Frontend loads <2s
- [ ] 99.9% uptime

Month 1:
- [ ] 20 successful scrapes
- [ ] <500MB database usage
- [ ] <50GB bandwidth used
- [ ] Zero errors in production