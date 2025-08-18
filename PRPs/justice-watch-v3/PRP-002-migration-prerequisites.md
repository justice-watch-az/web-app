# PRP-002: Migration Prerequisites Setup - Task PRP

## Goal
**Feature Goal**: Setup all required accounts, tools, and configurations needed for Justice Watch v3 serverless migration  
**Deliverable**: Fully configured development environment with Supabase, Netlify, and GitHub Actions ready for migration  
**Success Definition**: All tools installed, accounts created, secrets configured, and validation tests passing

## Why
- **Business Value**: Unblocks entire v3 migration, enabling $0/month hosting and automated operations
- **User Impact**: Zero downtime during migration with proper prerequisites in place
- **Technical Necessity**: Foundation for serverless architecture must be solid before any code migration

## Critical Context

```yaml
context:
  docs:
    - url: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
      focus: Project setup and environment variables
    - url: https://docs.netlify.com/cli/get-started/
      focus: CLI installation and authentication
    - url: https://cli.github.com/manual/gh_secret_set
      focus: Setting repository secrets

  existing_files:
    - path: justice-watch-app/SUPABASE_SETUP.md
      purpose: Existing Supabase configuration reference
    - path: justice-watch-app/.env.example
      purpose: Required environment variables template
    - path: justice-watch-app/package.json
      purpose: Current dependencies to maintain compatibility

  gotchas:
    - issue: "Supabase URLs change between local and cloud"
      fix: "Use separate .env.local and .env.production files"
    - issue: "GitHub secrets need repository scope"
      fix: "Ensure gh CLI has repo permissions via gh auth refresh"
    - issue: "Netlify needs build configuration"
      fix: "Create netlify.toml before first deploy"
```

## Implementation Tasks

### Phase 1: Supabase Setup

```
TASK create_supabase_project:
  - NAVIGATE: https://supabase.com/dashboard
  - CREATE: New project "justice-watch-v3"
  - CONFIGURE:
    - Region: Select closest to users (US West recommended)
    - Database Password: Generate strong password
    - Store securely: Password manager
  - WAIT: 2-3 minutes for provisioning
  - VALIDATE: Project dashboard accessible
  - IF_FAIL: Check email for verification link

TASK extract_supabase_credentials:
  - NAVIGATE: Project Settings > API
  - COPY: Project URL (https://[PROJECT_ID].supabase.co)
  - COPY: anon/public key (eyJ...)
  - COPY: service_role key (eyJ...)
  - VALIDATE: All three values copied
  - STORE: In secure password manager temporarily
  - IF_FAIL: Refresh page, check project status

TASK setup_local_supabase:
  - RUN: npm install -g supabase
  - VALIDATE: supabase --version
  - RUN: cd justice-watch-app
  - RUN: npx supabase init (if not exists)
  - RUN: npx supabase login
  - VALIDATE: npx supabase projects list
  - IF_FAIL: Check npm permissions, use sudo if needed
```

### Phase 2: Netlify Setup

```
TASK install_netlify_cli:
  - RUN: npm install -g netlify-cli
  - VALIDATE: netlify --version
  - IF_FAIL: Clear npm cache: npm cache clean --force
  - IF_FAIL: Use npx netlify instead of global install

TASK authenticate_netlify:
  - RUN: netlify login
  - ACTION: Browser opens for authentication
  - AUTHORIZE: Grant CLI access
  - VALIDATE: netlify status
  - COPY: Personal access token from account settings
  - IF_FAIL: Try netlify login --new

TASK create_netlify_site:
  - RUN: cd justice-watch-app
  - RUN: netlify init --manual
  - SELECT: "Create & configure a new site"
  - TEAM: Select your team/personal account
  - NAME: justice-watch-v3
  - VALIDATE: netlify status shows site info
  - COPY: Site ID for later use
  - IF_FAIL: Check if name already taken, use unique suffix
```

### Phase 3: GitHub Configuration

```
TASK install_github_cli:
  - RUN_MAC: brew install gh
  - RUN_LINUX: curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  - RUN_WINDOWS: winget install --id GitHub.cli
  - VALIDATE: gh --version
  - IF_FAIL: Visit https://github.com/cli/cli#installation

TASK authenticate_github:
  - RUN: gh auth login
  - SELECT: GitHub.com
  - SELECT: HTTPS
  - AUTHENTICATE: Via browser
  - VALIDATE: gh auth status
  - IF_FAIL: gh auth refresh -s repo,workflow

TASK set_github_secrets:
  - RUN: cd justice-watch-app
  - RUN: gh secret set SUPABASE_URL --body "https://[PROJECT_ID].supabase.co"
  - RUN: gh secret set SUPABASE_SERVICE_KEY --body "eyJ..."
  - RUN: gh secret set SUPABASE_ANON_KEY --body "eyJ..."
  - RUN: gh secret set NETLIFY_AUTH_TOKEN --body "[token]"
  - RUN: gh secret set NETLIFY_SITE_ID --body "[site-id]"
  - VALIDATE: gh secret list
  - EXPECT: 5 secrets shown
  - IF_FAIL: Check repository permissions
```

### Phase 4: Environment Configuration

```
TASK create_env_files:
  - CREATE: justice-watch-app/.env.local
  - CONTENT:
    ```
    # Supabase Local
    VITE_SUPABASE_URL=http://127.0.0.1:54321
    VITE_SUPABASE_ANON_KEY=eyJ... (from local)
    SUPABASE_SERVICE_KEY=eyJ... (from local)
    
    # Legacy Database (for migration)
    DATABASE_URL=postgresql://user:pass@localhost:5432/justice_watch
    ```
  - CREATE: justice-watch-app/.env.production
  - CONTENT:
    ```
    # Supabase Production
    VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
    VITE_SUPABASE_ANON_KEY=eyJ... (from cloud)
    ```
  - VALIDATE: File exists and not in git
  - RUN: echo ".env.local" >> .gitignore
  - RUN: echo ".env.production" >> .gitignore
  - IF_FAIL: Check file permissions

TASK install_project_dependencies:
  - RUN: cd justice-watch-app
  - RUN: npm install @supabase/supabase-js
  - RUN: pip install supabase
  - RUN: pip install python-dotenv
  - VALIDATE: npm list @supabase/supabase-js
  - VALIDATE: pip show supabase
  - IF_FAIL: Clear caches and reinstall
```

### Phase 5: Feature Branch Setup

```
TASK create_migration_branch:
  - RUN: git checkout development
  - RUN: git pull origin development
  - RUN: git checkout -b feature/v3-serverless-migration
  - VALIDATE: git branch --show-current
  - EXPECT: feature/v3-serverless-migration
  - IF_FAIL: Stash changes first: git stash

TASK initial_commit:
  - RUN: git add .env.example
  - RUN: git add .gitignore
  - CREATE: justice-watch-app/MIGRATION_STATUS.md
  - CONTENT:
    ```
    # Migration Status
    - [x] Prerequisites Setup Complete
    - [ ] Database Migration
    - [ ] Frontend Integration
    - [ ] Scraper Automation
    ```
  - RUN: git add justice-watch-app/MIGRATION_STATUS.md
  - RUN: git commit -m "chore: setup v3 migration prerequisites"
  - RUN: git push -u origin feature/v3-serverless-migration
  - VALIDATE: gh pr list shows branch
  - IF_FAIL: Check remote permissions
```

## Validation Checkpoints

```
CHECKPOINT supabase_ready:
  - TEST: npx supabase status
  - EXPECT: Shows running services
  - TEST: curl http://127.0.0.1:54321
  - EXPECT: 200 response
  - TEST: echo $SUPABASE_URL | grep -q "supabase"
  - CONTINUE: Only when all pass

CHECKPOINT netlify_ready:
  - TEST: netlify status
  - EXPECT: Shows connected site
  - TEST: netlify env:list
  - EXPECT: Shows environment capability
  - CONTINUE: Only when authenticated

CHECKPOINT github_ready:
  - TEST: gh secret list | wc -l
  - EXPECT: >= 5
  - TEST: gh workflow list
  - EXPECT: Shows repository workflows
  - CONTINUE: Only when secrets set

CHECKPOINT final_validation:
  - RUN: cd justice-watch-app
  - TEST: npm run build
  - EXPECT: Build completes without errors
  - TEST: python -c "import supabase; print('✓')"
  - EXPECT: ✓
  - TEST: test -f .env.local && echo "✓"
  - EXPECT: ✓
  - SUCCESS: All prerequisites ready
```

## Debug Patterns

```
DEBUG supabase_connection_failed:
  - CHECK: Firewall blocking port 54321
  - CHECK: Docker running (if using local)
  - TRY: npx supabase stop && npx supabase start
  - TRY: Use cloud URL instead of local
  - FIX: Reset database password in dashboard

DEBUG netlify_auth_failed:
  - CHECK: Browser popup blocker
  - TRY: netlify login --new
  - TRY: Manual token via dashboard
  - FIX: Clear ~/.netlify folder and retry

DEBUG github_secrets_failed:
  - CHECK: gh auth status shows correct scopes
  - TRY: gh auth refresh -s admin:org,repo
  - CHECK: Repository exists and you have admin access
  - FIX: Use web UI as fallback: Settings > Secrets

DEBUG npm_install_failed:
  - CHECK: Node version >= 18
  - TRY: rm -rf node_modules package-lock.json
  - TRY: npm cache clean --force
  - TRY: npm install --legacy-peer-deps
  - FIX: Update npm: npm install -g npm@latest
```

## Rollback Plan

If prerequisites setup fails:
```bash
# Remove Supabase project
- Dashboard > Settings > General > Delete project

# Remove Netlify site  
- netlify sites:delete justice-watch-v3

# Clear GitHub secrets
- gh secret delete SUPABASE_URL
- gh secret delete SUPABASE_SERVICE_KEY
- gh secret delete SUPABASE_ANON_KEY
- gh secret delete NETLIFY_AUTH_TOKEN

# Reset git branch
- git checkout development
- git branch -D feature/v3-serverless-migration

# Clean local environment
- rm .env.local .env.production
- npm uninstall @supabase/supabase-js
- pip uninstall supabase
```

## Success Metrics

- ✅ All 5 GitHub secrets configured
- ✅ Supabase project accessible locally and cloud
- ✅ Netlify CLI authenticated and site created
- ✅ Feature branch created and pushed
- ✅ All validation checkpoints pass
- ✅ Team can pull branch and run locally

## Next Steps

After successful completion:
1. Execute PRP-003: Database Schema Migration
2. Execute PRP-004: Data Migration Pipeline
3. Begin Phase 2: Frontend Transformation

## Time Estimate

- Supabase Setup: 15 minutes
- Netlify Setup: 10 minutes
- GitHub Configuration: 10 minutes
- Environment Setup: 15 minutes
- Validation & Testing: 10 minutes
- **Total: ~1 hour**

## Required Credentials Checklist

Store these securely after setup:
- [ ] Supabase Project URL
- [ ] Supabase Anon Key
- [ ] Supabase Service Key
- [ ] Supabase Database Password
- [ ] Netlify Auth Token
- [ ] Netlify Site ID
- [ ] GitHub Personal Access Token (if needed)

---

*PRP-002 Created: [Current Date]*  
*Priority: CRITICAL - Blocking all other work*  
*Dependencies: None*  
*Blocks: PRP-005, PRP-006, PRP-007, PRP-009*