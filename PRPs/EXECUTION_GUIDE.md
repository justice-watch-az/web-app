# Justice Watch v3.0 Migration - EXECUTION GUIDE

## How to Execute the Migration Plan

This guide provides the exact commands and steps to execute each PRP from the transformation plan.

---

## Week 1: Foundation (Days 1-5)

### ✅ PRP-001: System Architecture Planning
**Status**: COMPLETED
```bash
# Already executed as:
/prp-planning-create "Justice Watch v3.0 Serverless Migration"

# Output: /PRPs/justice-watch-v3/planning/01-architecture-complete.md
```

### PRP-002: Migration Prerequisites
**Status**: PENDING
```bash
# Execute prerequisites setup
/prp-task-execute "Migration Prerequisites" --tasks "
- Create Supabase project (cloud)
- Setup Netlify account
- Configure GitHub secrets
- Install CLI tools
- Create feature branches
"

# Or run manually:
# 1. Supabase Cloud Setup
open https://supabase.com
# Create new project: justice-watch-v3

# 2. Netlify Setup
npm install -g netlify-cli
netlify login
netlify init

# 3. GitHub Secrets
gh secret set SUPABASE_URL --body "https://[PROJECT_ID].supabase.co"
gh secret set SUPABASE_SERVICE_KEY --body "eyJ..."
gh secret set NETLIFY_AUTH_TOKEN --body "[token]"

# 4. Install Tools
npm install -g supabase netlify-cli
brew install gh  # GitHub CLI
pip install supabase  # Python client
```

### ✅ PRP-003: Supabase Database Setup
**Status**: COMPLETED (Local)
```bash
# Already executed locally:
npx supabase start
npx supabase db reset

# For cloud execution:
/prp-spec-execute "Database Schema Migration" --target production

# Or run manually in Supabase Dashboard SQL Editor:
cat supabase/migrations/20250117_justice_watch_schema.sql | pbcopy
# Paste and run in Supabase SQL Editor
```

### ✅ PRP-004: Data Migration Pipeline
**Status**: COMPLETED (Script created)
```bash
# Execute the migration
/prp-base-execute "Data Migration Pipeline"

# Or run the scripts directly:
# 1. Create exports directory
mkdir -p exports

# 2. Dry run first
python scripts/run_migration.py \
  --source-db $DATABASE_URL \
  --dry-run

# 3. Production migration
python scripts/run_migration.py \
  --source-db $DATABASE_URL

# 4. Validate
python scripts/validate_migration.py
```

---

## Week 2: Frontend Transformation (Days 6-10)

### PRP-005: Supabase Client Integration
**Status**: PENDING
```bash
# Execute frontend integration
/prp-base-execute "Frontend API Layer Refactoring"

# Or implement manually:
# 1. Install Supabase client
npm install @supabase/supabase-js

# 2. Create service layer
cat > src/services/supabase.ts << 'EOF'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
EOF

# 3. Update components
npm run dev  # Test locally
```

### PRP-006: Real-time Features
**Status**: PENDING
```bash
# Execute real-time implementation
/prp-task-execute "Implement Supabase Real-time Subscriptions"

# Manual implementation:
# Add to React components:
useEffect(() => {
  const subscription = supabase
    .channel('cases_channel')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'cases' },
      handleNewCase
    )
    .subscribe()
    
  return () => subscription.unsubscribe()
}, [])
```

### PRP-007: Authentication Migration
**Status**: PENDING
```bash
# Execute auth migration
/prp-spec-execute "Migrate Auth to Supabase Auth"

# Manual steps:
# 1. Export users from current system
python scripts/export_users.py

# 2. Import to Supabase Auth
python scripts/import_users_to_supabase.py

# 3. Update login components
npm run test:auth
```

---

## Week 3: Scraper Evolution (Days 11-15)

### PRP-008: Scraper Supabase Integration
**Status**: PENDING
```bash
# Execute scraper refactoring
/prp-base-execute "Python Scraper Direct Database Writes"

# Manual implementation:
# 1. Update scraper dependencies
pip install supabase

# 2. Modify scraper
python scripts/refactor_scraper.py \
  --input scrapers/maricopa_arraignment_scraper.py \
  --output scrapers/maricopa_scraper_supabase.py

# 3. Test scraper
python scrapers/test_scraper_supabase.py
```

### PRP-009: GitHub Actions Automation
**Status**: PENDING
```bash
# Execute GitHub Actions setup
/prp-spec-execute "Scraper Automation with GitHub Actions"

# Manual setup:
# 1. Create workflow file
mkdir -p .github/workflows
cat > .github/workflows/scrape-courts.yml << 'EOF'
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
    - name: Run scraper
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
      run: python scrapers/maricopa_scraper_supabase.py
EOF

# 2. Test workflow
gh workflow run scrape-courts.yml
```

---

## Week 4: Infrastructure Sunset (Days 16-21)

### PRP-010: Backend Decommission
**Status**: PENDING
```bash
# Execute backend removal
/prp-task-execute "Remove Legacy Infrastructure"

# Manual cleanup:
# 1. Archive old code
git mv server/ _archived/server/
git mv docker-compose.yml _archived/

# 2. Update package.json
npm uninstall express apollo-server bull redis

# 3. Commit changes
git add -A
git commit -m "Archive legacy backend infrastructure"
```

### PRP-011: Netlify Deployment
**Status**: PENDING
```bash
# Execute deployment
/prp-task-execute "Deploy Frontend to Netlify"

# Manual deployment:
# 1. Configure Netlify
cat > netlify.toml << 'EOF'
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
EOF

# 2. Deploy
npm run build
netlify deploy --dir=dist --prod

# 3. Verify
open https://justice-watch.netlify.app
```

---

## Monitoring & Validation Commands

### Continuous Monitoring During Migration
```bash
# Monitor dual-write status
watch -n 5 'python scripts/check_dual_write_status.py'

# Check sync lag
python scripts/measure_sync_lag.py --continuous

# Monitor Supabase
npx supabase status

# Check GitHub Actions
gh run list --workflow=scrape-courts.yml
```

### Final Validation
```bash
# Complete system check
/prp-validate-all

# Or run individual checks:
npm run test           # Frontend tests
npm run test:e2e       # End-to-end tests
python test_scraper.py # Scraper tests
curl https://justice-watch.netlify.app/health  # Production check
```

---

## Quick Command Reference

```bash
# PRP Framework Commands (if using Claude Code)
/prp-base-create "[name]"     # Create implementation PRP
/prp-base-execute "[name]"    # Execute implementation PRP
/prp-task-create "[name]"     # Create task PRP
/prp-task-execute "[name]"    # Execute task PRP
/prp-spec-create "[name]"     # Create specification PRP
/prp-spec-execute "[name]"    # Execute specification PRP
/prp-planning-create "[name]" # Create planning PRP
/prp-validate-all             # Validate all PRPs

# Direct Script Execution
python scripts/run_migration.py --source-db $DATABASE_URL
python scripts/validate_migration.py
python scrapers/maricopa_scraper_supabase.py
npm run build && netlify deploy --prod

# Git Commands
git checkout -b feature/v3-serverless-migration
git add -A
git commit -m "feat: implement v3 serverless architecture"
git push origin feature/v3-serverless-migration
gh pr create --title "v3.0 Serverless Migration" --body "..."
```

---

## Environment Variables Required

```bash
# Development (.env.local)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://...

# Production (GitHub Secrets)
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_KEY=eyJ...
NETLIFY_AUTH_TOKEN=...
```

---

## Rollback Commands

If any step fails:

```bash
# Rollback database migration
python scripts/rollback_migration.py

# Disable dual-write
export DUAL_WRITE_ENABLED=false

# Revert to previous commit
git reset --hard HEAD~1

# Rollback Netlify deployment
netlify rollback

# Stop GitHub Actions
gh workflow disable scrape-courts.yml
```

---

## Success Checklist

- [ ] All PRPs executed successfully
- [ ] Data migration validated
- [ ] Frontend deployed to Netlify
- [ ] Scraper running on GitHub Actions
- [ ] Real-time updates working
- [ ] Old infrastructure archived
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] $0/month hosting achieved

---

*This execution guide provides step-by-step commands to implement the entire Justice Watch v3.0 serverless transformation.*