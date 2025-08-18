# Justice Watch v3.0 Complete Migration Guide
## From Monolithic to Serverless Architecture

### Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Analysis](#architecture-analysis)
3. [Migration Strategy](#migration-strategy)
4. [PRP Implementation Plan](#prp-implementation-plan)
5. [Supabase Setup Guide](#supabase-setup-guide)
6. [Progress Tracking](#progress-tracking)
7. [Validation & Testing](#validation--testing)
8. [Quick Reference](#quick-reference)

---

## Executive Summary

**Project**: Justice Watch v3.0 Serverless Transformation  
**Objective**: Migrate from monolithic architecture to serverless infrastructure  
**Target Stack**: Netlify + Supabase + GitHub Actions  
**Cost**: $0/month (down from $15-40/month)  
**Timeline**: 4 weeks  
**Approach**: Hybrid - Refactor with Strategic Rebuilds  
**Current Progress**: 18% Complete (4/22 tasks)

---

## Architecture Analysis

### Current State (v2.0)
```
┌─────────────────────────────────────────────────┐
│           MONOLITHIC NODE.JS SERVER             │
├─────────────────────────────────────────────────┤
│ • Express + GraphQL API                         │
│ • Docker containers                             │
│ • Redis job queues                              │
│ • PostgreSQL database                           │
│ • Complex deployment                            │
│ • Monthly hosting costs ($15-40)                │
└─────────────────────────────────────────────────┘
```

### Target State (v3.0)
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

## Migration Strategy

### Why Hybrid Approach?

1. **Preserve Working Components**
   - React frontend components are solid and tested
   - Python scrapers have proven click-based navigation
   - Database schema is well-normalized

2. **Risk Mitigation**
   - Gradual migration reduces production breakage
   - Ability to rollback at each phase
   - Maintain service availability during transition

3. **Faster Delivery**
   - Reuse 70% of existing code
   - Focus effort on integration points
   - Leverage existing test coverage

4. **Knowledge Preservation**
   - Keep institutional knowledge in codebase
   - Maintain scraping patterns that work
   - Preserve UI/UX decisions

---

## PRP Implementation Plan

### Phase 1: Planning & Architecture (Week 1, Days 1-5)

#### PRP-001: System Architecture Planning
```bash
/prp-planning-create "Justice Watch v3.0 Serverless Migration"
```
**Deliverables:**
- System architecture diagram
- Data flow documentation
- Service integration map
- Risk assessment matrix
- Rollback strategy

#### PRP-002: Migration Prerequisites
```bash
/prp-task-create "Environment Setup and Tool Preparation"
```
**Tasks:**
- Create Supabase project
- Setup Netlify account
- Configure GitHub secrets
- Install CLI tools
- Create feature branches

#### PRP-003: Supabase Database Setup
```bash
/prp-spec-create "Database Schema Migration to Supabase"
```
**Implementation:**
- Export current PostgreSQL schema
- Adapt for Supabase RLS policies
- Create API views and functions
- Setup indexes for performance

#### PRP-004: Data Migration Pipeline
```bash
/prp-base-create "Zero-Downtime Data Transfer"
```
**Strategy:**
- Create data export scripts
- Build Supabase import tools
- Implement dual-write logic
- Setup sync verification

### Phase 2: Frontend Transformation (Week 2, Days 6-10)

#### PRP-005: Supabase Client Integration
```bash
/prp-base-create "Frontend API Layer Refactoring"
```
**Approach:**
- Create new `supabase.ts` service
- Parallel API implementation (old + new)
- Component-by-component migration
- Remove old API calls after validation

#### PRP-006: Real-time Features
```bash
/prp-task-create "Implement Supabase Real-time Subscriptions"
```
**Features:**
- Live case updates
- Real-time scraping status
- Instant notification on new arraignments

#### PRP-007: Authentication Migration
```bash
/prp-spec-create "Migrate Auth to Supabase Auth"
```
**Requirements:**
- Preserve existing user accounts
- Maintain role-based access
- Update protected routes
- Add password reset flow

### Phase 3: Scraper Evolution (Week 3, Days 11-15)

#### PRP-008: Scraper Supabase Integration
```bash
/prp-base-create "Python Scraper Direct Database Writes"
```
**Critical:** MAINTAIN CLICK-BASED NAVIGATION - NO URL CONSTRUCTION
**Changes:**
- Replace PostgreSQL with Supabase client
- Add error reporting to Supabase
- Implement retry logic
- Add performance metrics

#### PRP-009: GitHub Actions Automation
```bash
/prp-spec-create "Scraper Automation with GitHub Actions"
```
**Configuration:**
- Use macOS runner (anti-bot bypass)
- Run Monday-Friday at 9am MST
- Manual trigger option
- Error notifications

### Phase 4: Infrastructure Sunset (Week 4, Days 16-21)

#### PRP-010: Backend Decommission
```bash
/prp-task-create "Remove Legacy Infrastructure"
```
**Checklist:**
- Archive server/ directory
- Remove Docker files
- Clean package.json
- Update documentation

#### PRP-011: Netlify Deployment
```bash
/prp-task-create "Deploy Frontend to Netlify"
```
**Steps:**
- Configure netlify.toml
- Setup environment variables
- Configure build settings
- Enable analytics

---

## Supabase Setup Guide

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create new project (free tier)
3. **Project Name**: `justice-watch-v3`
4. **Region**: US West or US East (closest to Arizona)
5. Save credentials:

```bash
# .env.local (Frontend)
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # Settings > API > anon public

# .env (Backend/Scraper)
SUPABASE_SERVICE_KEY=eyJ...     # Settings > API > service_role
```

### Step 2: Database Schema Setup

Run in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cases table (main data)
CREATE TABLE cases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  raw_data JSONB,
  scraped_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Parties table
CREATE TABLE case_parties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  party_type VARCHAR(20) CHECK (party_type IN ('plaintiff', 'defendant')),
  party_name VARCHAR(200),
  relationship VARCHAR(100),
  sex VARCHAR(10),
  attorney VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Charges table
CREATE TABLE case_charges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  ars_code VARCHAR(50),
  description TEXT,
  crime_date DATE,
  severity VARCHAR(10),
  disposition VARCHAR(100),
  disposition_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Calendar/Hearings table
CREATE TABLE case_calendar (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  hearing_date DATE,
  hearing_time TIME,
  event_type VARCHAR(100),
  result VARCHAR(200),
  location VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_case_number ON cases(case_number);
CREATE INDEX idx_court_name ON cases(court_name);
CREATE INDEX idx_scraped_at ON cases(scraped_at DESC);
CREATE INDEX idx_next_hearing ON cases(next_hearing);

-- Enable Row Level Security
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_calendar ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public can read cases" ON cases FOR SELECT USING (true);
CREATE POLICY "Service role can write cases" ON cases FOR ALL USING (auth.role() = 'service_role');
-- Repeat for other tables...
```

### Step 3: Create API Functions

```sql
-- Statistics function
CREATE OR REPLACE FUNCTION get_case_stats()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'total_cases', (SELECT COUNT(*) FROM cases),
    'courts', (SELECT COUNT(DISTINCT court_name) FROM cases),
    'today_cases', (SELECT COUNT(*) FROM cases WHERE DATE(scraped_at) = CURRENT_DATE),
    'open_cases', (SELECT COUNT(*) FROM cases WHERE status != 'Closed'),
    'last_scrape', (SELECT MAX(scraped_at) FROM cases)
  );
END;
$$ LANGUAGE plpgsql;

-- Case details function
CREATE OR REPLACE FUNCTION get_case_details(case_num VARCHAR)
RETURNS JSON AS $$
DECLARE
  case_data JSON;
BEGIN
  SELECT json_build_object(
    'case', row_to_json(c),
    'parties', (SELECT json_agg(row_to_json(cp)) FROM case_parties cp WHERE cp.case_id = c.id),
    'charges', (SELECT json_agg(row_to_json(cc)) FROM case_charges cc WHERE cc.case_id = c.id),
    'calendar', (SELECT json_agg(row_to_json(cal)) FROM case_calendar cal WHERE cal.case_id = c.id)
  ) INTO case_data
  FROM cases c
  WHERE c.case_number = case_num;
  
  RETURN case_data;
END;
$$ LANGUAGE plpgsql;
```

### Step 4: Frontend Integration

```javascript
// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// src/services/api.ts - NEW VERSION
export const api = {
  async getCases() {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('scraped_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    return data;
  },

  async searchCases(query: string) {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .or(`case_number.ilike.%${query}%,case_title.ilike.%${query}%`)
      .limit(50);
    
    if (error) throw error;
    return data;
  },

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

### Step 5: Scraper Integration

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
                # ... other fields
            }, on_conflict='case_number').execute()
            
            print(f"✅ Saved case {case_data['case_number']}")
            return result
        except Exception as e:
            print(f"❌ Error saving case: {e}")
            return None
```

### Step 6: GitHub Actions Setup

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

### Step 7: Netlify Deployment

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[context.production.environment]
  VITE_SUPABASE_URL = "https://your-project.supabase.co"
```

```bash
# Deploy commands
npm install -g netlify-cli
netlify login
netlify init
npm run build
netlify deploy --prod --dir=dist
```

---

## Progress Tracking

### Overall Progress: 18% Complete (4/22 tasks)

### ✅ Completed Tasks
| Task | Description | Date |
|------|-------------|------|
| Project Setup | Created PRP directory structure | 2025-01-16 |
| PRP Template | Initialized 01-architecture.md | 2025-01-16 |
| Documentation | Created Supabase setup guide | 2025-01-16 |
| Version Control | Created feature branch | 2025-01-16 |

### 📋 Remaining Tasks by Week

#### Week 1 (Current)
- [ ] Set up Supabase project
- [ ] Complete architecture PRP
- [ ] Create .env.local
- [ ] PRP-001: System Architecture
- [ ] PRP-002: Prerequisites
- [ ] PRP-003: Database Setup
- [ ] PRP-004: Data Migration

#### Week 2
- [ ] PRP-005: API Integration
- [ ] PRP-006: Real-time Features
- [ ] PRP-007: Auth Migration

#### Week 3
- [ ] PRP-008: Scraper Integration
- [ ] PRP-009: GitHub Actions

#### Week 4
- [ ] PRP-010: Backend Removal
- [ ] PRP-011: Netlify Deploy
- [ ] Production validation
- [ ] Documentation update

---

## Validation & Testing

### Level 1: Foundation Check
```bash
# Syntax and types
npm run lint
npm run type-check
python -m flake8 scrapers/
python -m mypy scrapers/
```

### Level 2: Unit Testing
```bash
# Frontend
npm run test
npm run test:coverage

# Scrapers
pytest scrapers/tests/ -v
```

### Level 3: Integration Testing
```bash
# Supabase connectivity
npm run test:integration

# End-to-end
python scrapers/test_integration.py
```

### Level 4: Production Validation
```bash
# Deploy preview
netlify deploy --alias=preview

# Test scraper
gh workflow run scrape-courts.yml

# Performance testing
npm run test:load
```

---

## Quick Reference

### Commands Cheatsheet

```bash
# Project Setup
mkdir -p PRPs/justice-watch-v3/{planning,specs,tasks,completed}
git checkout -b feature/v3-serverless-migration

# Supabase
npx supabase init
npx supabase start
npx supabase db push

# Netlify
netlify init
netlify dev
netlify deploy --prod

# GitHub Actions
gh secret set SUPABASE_URL
gh secret set SUPABASE_SERVICE_KEY
gh workflow run scrape-courts.yml

# Development
npm run dev        # Start frontend
npm run build      # Build for production
npm run test       # Run tests
```

### Environment Variables

```bash
# Frontend (.env.local)
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Scraper (.env)
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# GitHub Secrets
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

### File Structure

```
justice-watch-app/
├── PRPs/
│   ├── justice-watch-v3-serverless-transformation.md
│   └── justice-watch-v3/
│       ├── planning/
│       │   └── 01-architecture.md
│       ├── specs/
│       ├── tasks/
│       └── completed/
├── src/                    # React frontend
│   └── services/
│       ├── api.ts         # TO UPDATE
│       └── supabase.ts    # TO CREATE
├── scrapers/              # Python scrapers
│   └── maricopa_scraper_supabase.py  # TO CREATE
├── .github/
│   └── workflows/
│       └── scrape-courts.yml  # TO CREATE
├── netlify.toml           # TO CREATE
├── SUPABASE_SETUP.md
├── MIGRATION_PROGRESS.md
└── JUSTICE_WATCH_V3_COMPLETE_MIGRATION_GUIDE.md  # THIS FILE
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Hybrid Refactor | Preserve working code |
| Database | Supabase | Free tier, real-time, auth |
| Frontend Host | Netlify | Free static hosting |
| Scraper Host | GitHub Actions | Free Mac runner |
| Timeline | 4 weeks | Gradual, low-risk migration |

### Success Metrics

- ✅ $0/month hosting achieved
- ✅ <2 second page loads
- ✅ 99.9% uptime
- ✅ 100% feature parity
- ✅ Automated daily scraping

### Risk Mitigation

| Risk | Mitigation | Rollback |
|------|------------|----------|
| Data loss | Dual-write period | Restore from backup |
| Scraper breaks | Keep old parallel | Switch to Docker |
| API issues | Feature flags | Toggle old API |
| Free tier limits | Monitor daily | Upgrade if needed |

---

## Next Immediate Actions

1. **Create Supabase Account**
   - Follow Step 1 in Supabase Setup Guide
   - Save credentials securely

2. **Run Database Setup**
   - Execute SQL scripts in Supabase dashboard
   - Verify tables created

3. **Update Architecture PRP**
   - Complete 01-architecture.md
   - Add specific implementation details

4. **Begin Frontend Changes**
   - Create supabase.ts service
   - Start parallel API implementation

---

## Support Resources

- [Supabase Docs](https://supabase.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [GitHub Actions Docs](https://docs.github.com/actions)
- [Project Repository](https://github.com/arealicehole/justice-watch-app)

---

*Document Version: 2.0 - Complete Migration Guide*  
*Last Updated: 2025-01-16*  
*Status: Active Migration in Progress*