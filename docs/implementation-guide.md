# Justice Watch Implementation Guide: Start to Finish

## Prerequisites Check

```bash
# Check you're in the right place
pwd
# Should show: /home/ice/PRPs-agentic-eng

# Verify justice-watch-app is nested
ls justice-watch-app/
# Should show: src, server, scrapers, etc.

# Verify PRP commands available
ls .claude/commands/
# Should show: prp-commands, development, etc.
```

## Phase 0: Initial Setup (30 minutes)

### Step 1: Load Project Context
```bash
cd /home/ice/PRPs-agentic-eng
```

In Claude Code, run:
```
/prime-core
```

### Step 2: Create Project PRP Directory
```bash
mkdir -p PRPs/justice-watch
mkdir -p PRPs/justice-watch/sprint-1
mkdir -p PRPs/justice-watch/sprint-2
mkdir -p PRPs/justice-watch/sprint-3
```

### Step 3: Verify Current Application Works
```bash
cd justice-watch-app
npm install
npm run build
cd ..
```

### Step 4: Test Scraper Baseline
```bash
cd justice-watch-app
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
# Note the current performance for comparison
cd ..
```

---

## Sprint 1: Quick Value (Days 1-5)

### Day 1-2: Frontend Enhancement

#### Step 1: Create UI Enhancement PRP
In Claude Code:
```
/prp-task-create "Add search, filters, and charts to justice-watch-app dashboard"
```

When prompted, provide:
- **Goal**: Add search bar, court filters, and data visualization charts
- **Context**: Reference `justice-watch-app/src/components/CasesDashboard.tsx`
- **Libraries**: Use existing recharts, add match-sorter for search

#### Step 2: Save the PRP
Save as: `PRPs/justice-watch/sprint-1/ui-enhancements.md`

#### Step 3: Execute the PRP
```
/prp-task-execute PRPs/justice-watch/sprint-1/ui-enhancements.md
```

#### Step 4: Validate Changes
```bash
cd justice-watch-app
npm run build
npm run dev
# Open browser to http://localhost:5173
# Test: Search functionality, charts display, mobile view
cd ..
```

#### Expected Results:
- ✅ Search bar filters cases in real-time
- ✅ Bar chart shows cases by court
- ✅ Timeline shows upcoming hearings
- ✅ Mobile responsive layout

---

### Day 3: Scraper Performance Fix

#### Step 1: Create Performance PRP
```
/prp-task-create "Optimize justice-watch-app scraper - replace sleeps with WebDriverWait"
```

When prompted, provide:
- **Goal**: 5-10x speed improvement
- **Target**: `justice-watch-app/scrapers/maricopa_arraignment_scraper.py`
- **Changes**: Replace all `time.sleep()` with `WebDriverWait`, add retry logic

#### Step 2: Save and Execute
Save as: `PRPs/justice-watch/sprint-1/scraper-performance.md`
```
/prp-task-execute PRPs/justice-watch/sprint-1/scraper-performance.md
```

#### Step 3: Test Performance
```bash
cd justice-watch-app
python scrapers/maricopa_arraignment_scraper.py --test-mode --courts 1
# Compare timing with baseline from Phase 0
cd ..
```

#### Expected Results:
- ✅ Scraping time reduced from ~30s to ~5s per case
- ✅ No hardcoded sleep() calls remain
- ✅ Retry logic handles transient failures

---

### Day 4-5: Add Cron Scheduling

#### Step 1: Create Scheduler PRP
```
/prp-base-create "Add cron scheduler to justice-watch-app for automatic scraping"
```

When prompted, provide:
- **Feature**: Automatic scraping every 6 hours
- **Integration Point**: `justice-watch-app/server/index.js`
- **Package**: node-cron
- **Endpoint**: Reuse `/api/scraping/arraignments`

#### Step 2: Research Integration
The PRP command will spawn research agents to:
- Find node-cron documentation
- Analyze existing scraping routes
- Identify integration patterns

#### Step 3: Execute
Save as: `PRPs/justice-watch/sprint-1/cron-scheduler.md`
```
/prp-base-execute PRPs/justice-watch/sprint-1/cron-scheduler.md
```

#### Step 4: Validate
```bash
cd justice-watch-app
npm install node-cron
npm run dev
# Check logs for: "Cron job scheduled: */6 * * *"
# Manually trigger: curl -X POST http://localhost:3001/api/scraping/test-cron
cd ..
```

#### Expected Results:
- ✅ Cron job registered on server start
- ✅ Scraper runs every 6 hours automatically
- ✅ Last updated timestamp updates in database

---

## Sprint 1 Checkpoint

### Validation Checklist:
```bash
# Run all validations
cd justice-watch-app

# Frontend
npm run lint
npm run typecheck
npm run build

# Backend
npm test

# Scraper
python -m pytest scrapers/test_performance.py

# Integration
npm run dev &
curl http://localhost:3001/api/health
curl http://localhost:3001/api/cases/stats/summary
```

### Commit Sprint 1:
```bash
git add -A
git commit -m "Sprint 1: UI enhancements, scraper optimization, cron scheduling"
```

---

## Sprint 2: Data Enrichment (Days 6-10)

### Day 6-8: Enhanced Data Capture

#### Step 1: Create Comprehensive Data PRP
```
/prp-base-create "Enhance justice-watch-app scraper to capture charges, parties, documents"
```

This is a complex PRP - let the research agents work:
- They'll analyze court HTML structures
- Find patterns for charge extraction
- Identify party information locations
- Map document references

#### Step 2: Review and Enhance PRP
The generated PRP should include:
- New data model with charges[], parties{}, documents[]
- Extraction methods for each data type
- Backward compatibility approach
- Validation for data completeness

Save as: `PRPs/justice-watch/sprint-2/enhanced-data-model.md`

#### Step 3: Execute with Monitoring
```
/prp-base-execute PRPs/justice-watch/sprint-2/enhanced-data-model.md
```

Monitor for:
- Schema migrations applying correctly
- New extraction methods working
- Data quality scores >90%

#### Step 4: Validate Data Quality
```bash
cd justice-watch-app
# Run enhanced scraper on test case
python scrapers/maricopa_arraignment_scraper.py --test-case "TR2024001234"
# Check database for new fields
cd ..
```

---

### Day 9-10: API Enhancement

#### Step 1: Create API Layer PRP
```
/prp-base-create "Add GraphQL and caching to justice-watch-app API"
```

Provide context:
- Keep existing REST endpoints
- Add Apollo Server Express
- Implement Redis caching
- Reference: `justice-watch-app/server/routes/cases.js`

#### Step 2: Execute
Save as: `PRPs/justice-watch/sprint-2/api-enhancement.md`
```
/prp-base-execute PRPs/justice-watch/sprint-2/api-enhancement.md
```

#### Step 3: Test New Endpoints
```bash
cd justice-watch-app
# Start Redis locally
docker run -d -p 6379:6379 redis

# Test GraphQL
npm run dev
# Open: http://localhost:3001/graphql

# Test query:
# query { 
#   cases(limit: 10) { 
#     case_number 
#     charges { description ars_code }
#   }
# }
cd ..
```

---

## Sprint 2 Checkpoint

### Data Completeness Check:
```sql
-- Run in Supabase console
SELECT 
  COUNT(*) as total,
  COUNT(charges) as with_charges,
  COUNT(parties) as with_parties,
  COUNT(documents) as with_docs
FROM court_cases
WHERE scraped_at > NOW() - INTERVAL '1 day';
```

Should show >90% completion for new fields.

---

## Sprint 3: Scale & Polish (Days 11-15)

### Day 11-13: Scraper Modularization

#### Step 1: Create Refactoring PRP
```
/prp-planning-create "Modularize justice-watch-app scraper with strategy pattern"
```

This creates an architectural plan. Review it carefully.

#### Step 2: Execute Refactoring
Save as: `PRPs/justice-watch/sprint-3/scraper-refactor.md`
```
/prp-base-execute PRPs/justice-watch/sprint-3/scraper-refactor.md
```

Then use the refactoring command:
```
/refactor-simple justice-watch-app/scrapers/maricopa_arraignment_scraper.py
```

#### Step 3: Validate Modular Structure
```bash
cd justice-watch-app/scrapers
# Should see new structure:
ls -la
# core/
# strategies/
# maricopa_scraper.py

# Test parallel execution
python maricopa_scraper.py --parallel --courts all
cd ../..
```

---

### Day 14-15: Embeddable Widgets

#### Step 1: Create Widget PRP
```
/prp-base-create "Create embeddable widgets for justice-watch-app"
```

Specify:
- iframe-friendly components
- CORS headers in Express
- Multiple widget sizes
- Customization via URL params

#### Step 2: Execute
Save as: `PRPs/justice-watch/sprint-3/embeddable-widgets.md`
```
/prp-base-execute PRPs/justice-watch/sprint-3/embeddable-widgets.md
```

#### Step 3: Test Embedding
Create test HTML file:
```html
<!DOCTYPE html>
<html>
<body>
  <h1>Widget Test</h1>
  <iframe 
    src="http://localhost:3001/embed/stats?theme=light"
    width="400" 
    height="300">
  </iframe>
</body>
</html>
```

---

## Final Validation & Deployment

### Complete Test Suite
```bash
cd justice-watch-app

# Full validation
npm run lint
npm run typecheck
npm run test
npm run build

# Python tests
python -m pytest

# E2E test
npm run e2e

# Performance benchmark
time python scrapers/maricopa_scraper.py --benchmark
```

### Deployment Checklist

#### 1. Update Docker Image
```bash
cd justice-watch-app
docker build -f Dockerfile.akash-aio -t justice-watch:v2.0 .
docker tag justice-watch:v2.0 arealicehole/justice-watch:v2.0
docker push arealicehole/justice-watch:v2.0
```

#### 2. Update Akash Deployment
Edit `deploy-aio.yaml`:
```yaml
services:
  web:
    image: arealicehole/justice-watch:v2.0
    env:
      - CRON_SCHEDULE=0 */6 * * *
      - ENABLE_CACHE=true
      - PARALLEL_SCRAPING=true
```

#### 3. Deploy to Akash
```bash
akash tx deployment create deploy-aio.yaml --from wallet
```

---

## Success Metrics Validation

### Performance
- [ ] Scraper: <5s per case (was 30s)
- [ ] API: <200ms response time
- [ ] Parallel: 26 courts in <5 minutes

### Data Quality
- [ ] Field completion: >90%
- [ ] Validation pass rate: >95%
- [ ] Error rate: <5%

### Features
- [ ] Search/filter working
- [ ] Charts displaying
- [ ] Cron running
- [ ] GraphQL operational
- [ ] Widgets embeddable

---

## Troubleshooting Guide

### Issue: PRP command not found
```bash
# Ensure you're in PRP framework root
cd /home/ice/PRPs-agentic-eng
# Commands should work now
```

### Issue: Scraper still slow
```bash
# Check all sleep() removed
grep -r "time.sleep" justice-watch-app/scrapers/
# Should return nothing
```

### Issue: Build fails
```bash
cd justice-watch-app
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Database schema mismatch
```bash
# Run migration
cd justice-watch-app
npm run migrate:latest
```

### Issue: Cron not running
```bash
# Check logs
docker logs <container-id> | grep -i cron
# Manually trigger
curl -X POST http://localhost:3001/api/scraping/trigger-cron
```

---

## Post-Implementation

### Documentation Update
```bash
cd justice-watch-app
# Update README with new features
echo "## New Features (v2.0)
- Real-time search and filtering
- Data visualization charts  
- Automatic scraping every 6 hours
- GraphQL API with caching
- Embeddable widgets
- 10x performance improvement" >> README.md
```

### Create Monitoring Dashboard
- Set up Grafana for metrics
- Configure alerts for scraping failures
- Monitor data completeness trends

### Next Iterations
- Add ML predictions for case outcomes
- Implement notification system
- Create mobile app
- Add more court systems

---

## Summary Timeline

| Day | Task | PRP Type | Validation |
|-----|------|----------|------------|
| 0 | Setup | - | Environment ready |
| 1-2 | UI Enhancement | Task | Search, charts work |
| 3 | Scraper Speed | Task | 5-10x faster |
| 4-5 | Cron Setup | Base | Auto-scraping active |
| 6-8 | Data Model | Base | 90% field completion |
| 9-10 | API Layer | Base | GraphQL working |
| 11-13 | Refactor | Planning | Modular structure |
| 14-15 | Widgets | Base | Embeddable |

Total: 15 days from start to production-ready v2.0

## Ready to Start?

Begin with:
```bash
cd /home/ice/PRPs-agentic-eng
/prime-core
```

Then create your first PRP:
```
/prp-task-create "Add search, filters, and charts to justice-watch-app dashboard"
```

Follow this guide step-by-step, validating at each checkpoint. The PRP framework ensures each step has complete context for success.