# Justice Watch v3.0 Serverless Transformation - PRP Master Plan

## Executive Summary

This document outlines the complete transformation plan for migrating Justice Watch from a monolithic architecture to a serverless, zero-cost cloud infrastructure using the PRP (Product Requirement Prompt) framework methodology.

**Target Architecture**: Netlify (Frontend) + Supabase (Database/Auth) + GitHub Actions (Scraper)  
**Cost**: $0/month  
**Timeline**: 4 weeks  
**Approach**: Hybrid - Refactor with Strategic Rebuilds

---

## Current vs Target Architecture

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
│ • Monthly hosting costs ($5-25)                 │
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

## Strategic Decision: Hybrid Approach

### Why Refactor Instead of Rebuild

1. **Preserve Working Components**
   - React frontend components are solid and tested
   - Python scrapers have proven click-based navigation logic
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

## PRP Implementation Phases

### Phase 1: Planning & Architecture (Week 1)

#### PRP-001: System Architecture Planning
```yaml
name: "Justice Watch v3.0 Architecture Design"
type: /prp-planning-create
goal: "Design complete serverless architecture with data flow"
deliverables:
  - System architecture diagram
  - Data flow documentation
  - Service integration map
  - Risk assessment matrix
  - Rollback strategy
```

#### PRP-002: Migration Prerequisites
```yaml
name: "Environment Setup and Tool Preparation"
type: /prp-task-create
goal: "Setup all accounts and tools needed for migration"
tasks:
  - Create Supabase project
  - Setup Netlify account
  - Configure GitHub secrets
  - Install CLI tools
  - Create feature branches
```

---

### Phase 2: Database Migration (Week 1-2)

#### PRP-003: Supabase Database Setup
```yaml
name: "Database Schema Migration to Supabase"
type: /prp-spec-create
goal: "Migrate existing PostgreSQL schema to Supabase with RLS"
context:
  current_schema: database/SCHEMA_DOCUMENTATION.md
  tables: 8 normalized tables
  relationships: One-to-many for parties, charges, hearings
implementation:
  - Export current schema as SQL
  - Adapt for Supabase requirements
  - Add Row Level Security policies
  - Create API views and functions
  - Setup indexes for performance
validation:
  - Schema loads without errors
  - RLS policies work correctly
  - API endpoints accessible
  - Performance benchmarks pass
```

#### PRP-004: Data Migration Pipeline
```yaml
name: "Zero-Downtime Data Transfer"
type: /prp-base-create
goal: "Transfer all existing data to Supabase"
strategy: "Dual-write period with validation"
implementation:
  - Create data export scripts
  - Build Supabase import tools
  - Implement dual-write logic
  - Add data validation checks
  - Setup sync verification
validation:
  - All records transferred
  - Data integrity maintained
  - No missing relationships
  - Sync lag < 1 second
```

---

### Phase 3: Frontend Transformation (Week 2-3)

#### PRP-005: Supabase Client Integration
```yaml
name: "Frontend API Layer Refactoring"
type: /prp-base-create
goal: "Replace Express API calls with Supabase client"
approach: "Parallel implementation with feature flags"
files_to_modify:
  - src/services/api.ts
  - src/services/supabase.ts (new)
  - src/components/*.tsx
implementation:
  step1: "Create Supabase service layer"
  step2: "Implement parallel API calls"
  step3: "Add feature flags for switching"
  step4: "Component-by-component migration"
  step5: "Remove old API calls"
validation:
  - All API endpoints replaced
  - No regression in functionality
  - Performance improved or same
  - Error handling maintained
```

#### PRP-006: Real-time Features
```yaml
name: "Implement Supabase Real-time Subscriptions"
type: /prp-task-create
goal: "Add live data updates using Supabase channels"
features:
  - Live case updates
  - Real-time scraping status
  - Instant notification on new arraignments
implementation:
  - Setup PostgreSQL triggers
  - Create subscription handlers
  - Update React state management
  - Add connection status indicator
validation:
  - Updates appear within 1 second
  - Reconnection logic works
  - Memory leaks prevented
```

#### PRP-007: Authentication Migration
```yaml
name: "Migrate Auth to Supabase Auth"
type: /prp-spec-create
goal: "Replace JWT auth with Supabase Auth"
requirements:
  - Preserve existing user accounts
  - Maintain role-based access
  - Support social logins (future)
implementation:
  - Export user data (hashed passwords)
  - Setup Supabase Auth policies
  - Migrate login/signup components
  - Update protected routes
  - Add password reset flow
validation:
  - All users can login
  - Roles work correctly
  - Sessions persist properly
  - Password reset works
```

---

### Phase 4: Scraper Evolution (Week 3)

#### PRP-008: Scraper Supabase Integration
```yaml
name: "Python Scraper Direct Database Writes"
type: /prp-base-create
goal: "Refactor scrapers to write directly to Supabase"
critical: "MAINTAIN CLICK-BASED NAVIGATION - NO URL CONSTRUCTION"
files_to_modify:
  - scrapers/maricopa_arraignment_scraper.py
  - scrapers/database_handler.py
implementation:
  preserve:
    - Click-based navigation logic
    - Court discovery mechanism
    - Case extraction patterns
  change:
    - Replace PostgreSQL with Supabase client
    - Add error reporting to Supabase
    - Implement retry logic
    - Add performance metrics
validation:
  - Scraper finds all arraignments
  - Data saves to Supabase
  - Error handling works
  - No URL construction used
```

#### PRP-009: GitHub Actions Automation
```yaml
name: "Scraper Automation with GitHub Actions"
type: /prp-spec-create
goal: "Setup automated daily scraping via GitHub Actions"
requirements:
  - Use macOS runner (anti-bot bypass)
  - Run Monday-Friday at 9am MST
  - Manual trigger option
  - Error notifications
implementation:
  - Create .github/workflows/scrape-courts.yml
  - Configure cron schedule
  - Setup secrets management
  - Add status reporting
  - Implement failure alerts
validation:
  - Workflow runs on schedule
  - Mac runner bypasses bot detection
  - Data appears in database
  - Errors are reported
```

---

### Phase 5: Infrastructure Sunset (Week 4)

#### PRP-010: Backend Decommission
```yaml
name: "Remove Legacy Infrastructure"
type: /prp-task-create
goal: "Safely remove all backend code and configs"
checklist:
  - Archive server/ directory
  - Remove Docker files
  - Clean package.json
  - Delete Redis configs
  - Remove nginx configs
  - Update documentation
validation:
  - Frontend still works
  - No broken imports
  - Build succeeds
  - Tests pass
```

#### PRP-011: Netlify Deployment
```yaml
name: "Deploy Frontend to Netlify"
type: /prp-task-create
goal: "Setup production deployment on Netlify"
steps:
  - Configure netlify.toml
  - Setup environment variables
  - Configure build settings
  - Setup custom domain
  - Enable analytics
validation:
  - Site loads correctly
  - API calls work
  - Performance < 2s load
  - SSL certificate active
```

---

## Validation Gates

### Level 1: Foundation Check (Syntax & Types)
```bash
# Frontend
npm run lint
npm run type-check

# Python
python -m flake8 scrapers/
python -m mypy scrapers/
```

### Level 2: Unit Testing
```bash
# Frontend components
npm run test
npm run test:coverage

# Scraper logic
pytest scrapers/tests/ -v
```

### Level 3: Integration Testing
```bash
# Supabase connectivity
npm run test:integration

# End-to-end scraping
python scrapers/test_integration.py

# API functionality
npm run test:api
```

### Level 4: Production Validation
```bash
# Deploy preview
netlify deploy --alias=preview

# Manual scraper run
gh workflow run scrape-courts.yml

# Load testing
npm run test:load

# Monitoring check
npm run test:monitoring
```

---

## Implementation Timeline

### Week 1: Foundation
| Day | Tasks | PRPs |
|-----|-------|------|
| 1-2 | Architecture planning, diagrams | PRP-001, PRP-002 |
| 3-4 | Supabase setup, schema migration | PRP-003 |
| 5 | Data export and import scripts | PRP-004 |

### Week 2: Frontend Migration
| Day | Tasks | PRPs |
|-----|-------|------|
| 6-7 | API layer refactoring | PRP-005 |
| 8 | Real-time features | PRP-006 |
| 9-10 | Authentication migration | PRP-007 |

### Week 3: Scraper & Automation
| Day | Tasks | PRPs |
|-----|-------|------|
| 11-12 | Scraper refactoring | PRP-008 |
| 13-14 | GitHub Actions setup | PRP-009 |
| 15 | Integration testing | - |

### Week 4: Launch
| Day | Tasks | PRPs |
|-----|-------|------|
| 16-17 | Remove old infrastructure | PRP-010 |
| 18 | Netlify deployment | PRP-011 |
| 19 | Production validation | - |
| 20 | Documentation updates | - |
| 21 | Monitoring and handoff | - |

---

## Risk Mitigation Strategy

### Technical Risks
| Risk | Mitigation | Rollback |
|------|------------|----------|
| Data loss during migration | Dual-write period, backups | Restore from backup |
| Scraper breaks with changes | Keep old scraper parallel | Switch back to Docker |
| API incompatibilities | Feature flags, gradual rollout | Toggle to old API |
| Authentication issues | Export user data first | Restore auth system |

### Operational Risks
| Risk | Mitigation | Rollback |
|------|------------|----------|
| Free tier limits exceeded | Monitor usage daily | Upgrade tier or optimize |
| GitHub Actions failures | Manual trigger backup | Run locally |
| Netlify build failures | Test builds locally first | Previous deploy |
| Supabase downtime | Status page monitoring | Cached data fallback |

---

## Success Metrics

### Week 1 Targets
- ✅ Supabase project created
- ✅ Schema migrated successfully
- ✅ 50% of data transferred
- ✅ API endpoints defined

### Week 2 Targets
- ✅ Frontend talks to Supabase
- ✅ Real-time updates working
- ✅ Authentication functional
- ✅ 75% feature parity

### Week 3 Targets
- ✅ Scraper runs via GitHub Actions
- ✅ Data flowing end-to-end
- ✅ All tests passing
- ✅ 95% feature parity

### Week 4 Targets
- ✅ **$0/month hosting achieved**
- ✅ **< 2 second page loads**
- ✅ **99.9% uptime**
- ✅ **100% feature parity**
- ✅ **Automated daily scraping**

---

## Cost Analysis

### Current Costs (v2.0)
- VPS/Cloud hosting: $5-25/month
- Database hosting: $5-10/month
- Redis: $5/month
- **Total: $15-40/month**

### New Costs (v3.0)
- Netlify Free: $0 (100GB bandwidth)
- Supabase Free: $0 (500MB database)
- GitHub Free: $0 (2000 minutes)
- **Total: $0/month**

### When Upgrades Needed
- Netlify: >100K visitors/month
- Supabase: >50K cases stored
- GitHub: >20 scrapes/month on private repo

---

## Quick Start Commands

### 1. Setup Project Structure
```bash
# Create PRP directories
mkdir -p PRPs/justice-watch-v3/{planning,specs,tasks,completed}

# Copy templates
cp ../PRPs/templates/*.md PRPs/justice-watch-v3/

# Create feature branch
git checkout -b feature/v3-serverless-migration
```

### 2. Initialize Services
```bash
# Supabase
npx supabase init
npx supabase start

# Netlify
npm install -g netlify-cli
netlify init

# GitHub CLI
gh secret set SUPABASE_URL
gh secret set SUPABASE_SERVICE_KEY
```

### 3. Run Migration Scripts
```bash
# Database migration
npm run migrate:schema
npm run migrate:data

# Frontend updates
npm run refactor:api
npm run test:integration

# Deploy
npm run deploy:preview
```

---

## Documentation Requirements

Each PRP should include:
1. **Goal**: Clear, measurable outcome
2. **Context**: All necessary background
3. **Implementation**: Step-by-step plan
4. **Validation**: How to verify success
5. **Rollback**: How to undo if needed

---

## Support & Resources

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [GitHub Actions Docs](https://docs.github.com/actions)

### Status Pages
- [Netlify Status](https://www.netlifystatus.com/)
- [Supabase Status](https://status.supabase.com/)
- [GitHub Status](https://www.githubstatus.com/)

### Community
- Supabase Discord
- Netlify Forums
- GitHub Discussions

---

## Conclusion

This PRP-based transformation plan provides a structured, low-risk path to achieving zero-cost hosting while maintaining all existing functionality. The hybrid approach preserves working code while modernizing the architecture for better scalability and cost efficiency.

**Next Steps:**
1. Review and approve this plan
2. Create Supabase project
3. Initialize first PRP (PRP-001)
4. Begin Week 1 implementation

---

*Document Version: 1.0*  
*Last Updated: 2025-01-17*  
*Author: Justice Watch Development Team*