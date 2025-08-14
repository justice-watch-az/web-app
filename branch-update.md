# Branch Update: cleanup-superfluous-files

## Date: 2025-08-14
## Branch: cleanup-superfluous-files (from akash-deployment)

## Overview
Major cleanup and refactoring to streamline the codebase and remove authentication system entirely. The application now focuses purely on displaying court case data without any login requirements.

## Changes Made

### 1. Superfluous Files Removed (34 files)

#### Test/Development Files:
- `test-api.js`
- `test-display.html`
- `test-supabase-direct.js`
- `check-supabase-schema.js`
- `scrapers/test_arraignment_scraper.py`
- `scripts/create-local-test-user.js`
- `scripts/create-test-user.js`
- `docker-compose.test.yml`

#### Redundant Docker/Deployment Configs:
- `Dockerfile` 
- `Dockerfile.production`
- `Dockerfile.akash`
- `docker-compose.yml`
- `docker-compose.local.yml`
- `docker-compose.production.yml`
- `docker-compose.akash.yml`
- `deploy.yaml`
- `deploy-simple.yaml`
- `deploy-akash.yaml`
- `deploy-akash.sdl`

**Kept only:** `Dockerfile.akash-aio` and `deploy-aio.yaml` (matching AIO.23 Docker image on Akash)

#### Migration/Setup Scripts:
- `database/add_missing_columns.sql`
- `database/complete_supabase_schema.sql`
- `database/new_schema.sql`
- `database/supabase_migration.sql`
- `scripts/migrate-to-supabase.js`
- `scripts/setup-supabase.js`
- `scripts/setup_supabase_tables.py`
- `scripts/create-supabase-tables.js`

#### Unused Scrapers:
- `scrapers/arraignment_full_scraper.py`
- `scrapers/court_scraper.py`
- `scrapers/maricopa_court_scraper.py`

**Kept only:** `scrapers/maricopa_arraignment_scraper.py` (the active scraper)

#### Local Development Scripts:
- `run-local.sh`
- `launch.sh`
- `scripts/start-selenium-mcp.sh`
- `schema.sql`

### 2. Authentication System Removed

#### Backend Changes:
- Removed routes: `server/routes/auth.js`
- Removed middleware: `server/middleware/auth.js`
- Removed utilities: `server/utils/init-admin.js`, `server/lib/supabase-auth.js`
- Removed admin creation script: `scripts/create-admin.js`
- Updated `server/index.js`:
  - Removed session configuration
  - Removed auth routes
  - Removed admin user initialization
  - Removed JWT/session imports

#### Frontend Changes:
- Removed components:
  - `src/components/Login.tsx`
  - `src/components/Login.css`
  - `src/components/Auth.tsx`
  - `src/components/Dashboard.tsx`
  - `src/contexts/AuthContext.tsx`
- Updated `src/App.tsx`:
  - Simplified to directly render `CasesDashboard`
  - Removed all auth checks and private routes
  - Removed loading states for auth
- Updated `src/components/CasesDashboard.tsx`:
  - Removed user/logout from header
  - Removed scraping button
  - Updated header to "Justice Watch AZ - Maricopa County Arraignment Monitor"
- Updated `src/services/api.ts`:
  - Removed auth interceptors
  - Removed token management
  - Removed 401 redirect logic

#### Database Changes:
- Created `database/schema_no_auth.sql` without user tables
- Schema now focuses only on `court_cases` table with JSONB fields

#### Package Dependencies Removed:
- `bcryptjs`
- `express-session`
- `jsonwebtoken`
- `@types/bcryptjs`
- `@types/express-session`
- `@types/jsonwebtoken`

## Current Application State

### What Remains:
- **Core application** for displaying court case data
- **Single production Docker config** optimized for Akash deployment
- **Active scraper** still functional via API endpoints
- **Clean frontend** that loads directly to cases dashboard
- **Export functionality** (CSV and PDF)
- **Real-time updates** via Socket.io
- **Supabase integration** for database

### Application Flow:
1. User visits site → Directly loads `CasesDashboard`
2. Dashboard automatically fetches all cases and statistics
3. Cases displayed organized by hearing date
4. Users can:
   - View case details in modal
   - Export data as CSV/PDF
   - Toggle hiding old cases
   - Refresh data

### Scraping Capability:
- Scraper remains fully functional in backend
- Can be triggered via API: `POST /api/scraping/arraignments`
- No UI button (removed), but functionality preserved
- Could be triggered via cron job or external automation

## Deployment Status
The codebase now matches what's deployed in the AIO.23 Docker image on Akash at:
https://62rghvg5jdda554sf4bcke2nao.ingress.akash.win

## Future Considerations for Frontend Redesign

To maximize data display on the front page:

1. **Search & Filtering**
   - Add search bar for case numbers, names, courts
   - Filter by case type, status, judge
   - Date range picker for hearings

2. **Data Visualizations**
   - Chart showing cases by court
   - Timeline view of upcoming hearings
   - Statistics graphs (case types, trends over time)

3. **Enhanced Information Display**
   - Compact/expanded view toggle
   - Table view option alongside card view
   - Color coding for case urgency/type

4. **Real-time Features**
   - Live updates when new cases scraped
   - Notification badges for new arraignments
   - Auto-refresh timer

5. **Additional Statistics**
   - Judge assignment distribution
   - Average case processing times
   - Court efficiency metrics
   - Case outcome statistics

## Commit History
1. Commit 803e893: Remove superfluous files - keep only production essentials
2. Commit 2124ff2: Remove authentication system completely

## Testing Notes
- Application compiles and runs without authentication
- All API endpoints accessible without auth tokens
- Frontend loads directly to dashboard
- Case data displays correctly
- Export functionality works

## Migration Notes for Existing Deployments
1. Database: Run `schema_no_auth.sql` to ensure proper table structure
2. Environment: Remove JWT_SECRET and SESSION_SECRET variables
3. Docker: Use only `Dockerfile.akash-aio` for builds
4. API: Update any external integrations to remove auth headers