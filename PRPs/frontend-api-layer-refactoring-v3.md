# Frontend API Layer Refactoring - Justice Watch v3 Migration

## Goal

**Feature Goal**: Refactor Justice Watch frontend to use Supabase client directly instead of Express/GraphQL backend, completing the v3 serverless migration while maintaining all existing functionality.

**Deliverable**: 
- Refactored CasesDashboard to use Supabase directly
- Removed/simplified ScheduleManager and ScrapingProgress (scraping automated via GitHub Actions)
- New Supabase service layer replacing Express API calls
- Updated data types and state management for direct database access
- Simplified UI focused on viewing/searching cases only

**Success Definition**: 
- Dashboard loads and displays cases without Express backend
- Search/filter functionality works with client-side logic
- Export features (CSV, PDF) work with client-side data processing
- Scheduling/scraping controls removed (automated via GitHub Actions)
- Simplified, read-only interface for case viewing

## User Persona

**Target User**: Court monitoring specialists, legal researchers, and administrators

**Use Case**: 
- View court case data and analytics
- Search and filter existing cases
- View detailed case information
- Export case data for analysis (CSV/PDF)

**User Journey**: 
1. Access dashboard → see current cases organized by hearing dates
2. Filter/search cases → get instant filtered results
3. View case details → see complete case information in modal
4. Export data → download CSV/PDF reports
5. View last update timestamp → know when data was last refreshed (automated daily)

**Pain Points Addressed**: 
- Remove Express backend dependency and maintenance overhead
- Eliminate GraphQL complexity for simple CRUD operations
- Reduce infrastructure costs by going serverless
- Improve performance with direct database access

## Why

- **Migration Requirement**: Phase 1 Foundation complete - need to remove Express backend dependency
- **Serverless Transformation**: Align with v3 architecture using Supabase as single backend
- **Cost Optimization**: Eliminate server hosting costs while maintaining functionality
- **Performance**: Direct database access with client-side filtering
- **Maintainability**: Simpler architecture with fewer moving parts
- **Automation**: Scraping now handled by GitHub Actions (not user-triggered)

## What

### Current Architecture (to be replaced)
```
React Frontend → Express/GraphQL API → PostgreSQL
                     ↓
              Socket.io for real-time
```

### Target Architecture
```
React Frontend → Supabase Client → PostgreSQL (Supabase)
                     ↓
              Supabase Realtime for real-time
```

### User-Visible Behavior (SIMPLIFIED)
- Dashboard shows cases grouped by hearing dates
- Search and filtering work identically  
- Case detail modals show same information
- Export functionality works identically (CSV/PDF)
- Last update timestamp shows when data was refreshed
- NOTE: Schedule management and scraping controls REMOVED (automated via GitHub Actions)

### Technical Requirements
- Replace all Express API calls with Supabase queries
- Implement Supabase Realtime for live updates
- Maintain existing React component interfaces
- Preserve all data transformations and business logic
- Keep existing UI/UX exactly the same

### Success Criteria

- [ ] CasesDashboard loads and displays cases from Supabase
- [ ] Search and filtering work with client-side logic
- [ ] Case detail modals show complete information
- [ ] CSV/PDF exports work with client-side data
- [ ] Last update timestamp displayed (from latest scrape_log entry)
- [ ] ScheduleManager component REMOVED or simplified to read-only status
- [ ] ScrapingProgress component REMOVED or shows last run status only
- [ ] No Express backend required for frontend operation

## All Needed Context

### Context Completeness Check

_This PRP contains all context needed for an AI agent to successfully refactor the Justice Watch frontend from Express API to Supabase client, including exact API mappings, data transformations, and integration patterns._

### Documentation & References

```yaml
- url: https://supabase.com/docs/reference/javascript/introduction
  why: Primary Supabase JavaScript client documentation for queries, real-time, auth
  critical: Query filtering, ordering, real-time subscriptions, error handling patterns

- url: https://supabase.com/docs/guides/realtime
  why: Real-time subscriptions for scraping progress updates
  critical: Channel subscriptions, event handling, cleanup patterns

- url: https://supabase.com/docs/reference/javascript/select
  why: Query patterns for dashboard data fetching
  critical: Joins, filtering, ordering, pagination patterns

- file: /home/ice/PRPs-agentic-eng/justice-watch-app/src/services/api.ts
  why: Current API service layer to understand existing patterns
  pattern: courtCaseService and scrapingService method signatures to preserve
  gotcha: Error handling and response formatting must be maintained

- file: /home/ice/PRPs-agentic-eng/justice-watch-app/src/components/CasesDashboard.tsx
  why: Main component requiring refactoring - complex data fetching and transformation
  pattern: Data loading, filtering, modal management, export functionality
  gotcha: JSON parsing of parties/docket_entries, date grouping logic, chart data

- file: /home/ice/PRPs-agentic-eng/justice-watch-app/src/components/ScheduleManager.tsx
  why: Schedule management component using Express API and Socket.io
  pattern: CRUD operations, real-time updates, form handling
  gotcha: Socket.io events must be replaced with Supabase Realtime

- file: /home/ice/PRPs-agentic-eng/justice-watch-app/src/components/ScrapingProgress.tsx
  why: Real-time progress tracking component
  pattern: Socket.io event handling, progress state management
  gotcha: Complex court progress tracking logic, event aggregation

- file: /home/ice/PRPs-agentic-eng/justice-watch-app/database/supabase_ready.sql
  why: Database schema structure for understanding table relationships
  pattern: Table structure, relationships, views for upcoming_hearings
  gotcha: Normalized schema vs flat JSON in current components

- file: /home/ice/PRPs-agentic-eng/justice-watch-app/server/lib/supabase.js
  why: Existing Supabase configuration pattern
  pattern: Client initialization with service key
  gotcha: Frontend will use anon key, not service key
```

### Current Codebase Structure

```bash
justice-watch-app/
├── src/
│   ├── components/
│   │   ├── CasesDashboard.tsx      # Main dashboard (REFACTOR)
│   │   ├── ScheduleManager.tsx     # Schedule CRUD (REFACTOR)  
│   │   ├── ScrapingProgress.tsx    # Real-time progress (REFACTOR)
│   │   └── *.css                   # Styling (NO CHANGE)
│   ├── services/
│   │   └── api.ts                  # Express API service (REPLACE)
│   └── types/
│       └── jspdf-autotable.d.ts   # Type definitions (NO CHANGE)
├── database/
│   └── supabase_ready.sql          # Target schema
├── server/                         # Backend to be removed
└── package.json                    # Dependencies (UPDATE)
```

### Target Codebase Structure

```bash
justice-watch-app/
├── src/
│   ├── components/
│   │   ├── CasesDashboard.tsx      # Refactored for Supabase
│   │   ├── ScheduleManager.tsx     # Refactored for Supabase
│   │   ├── ScrapingProgress.tsx    # Refactored for Supabase Realtime
│   │   └── *.css                   # Unchanged
│   ├── services/
│   │   ├── supabase.ts            # NEW: Supabase client setup
│   │   ├── casesService.ts        # NEW: Cases CRUD operations
│   │   ├── schedulesService.ts    # NEW: Schedules CRUD operations
│   │   └── realtimeService.ts     # NEW: Real-time subscriptions
│   ├── types/
│   │   ├── database.ts            # NEW: Database type definitions
│   │   ├── cases.ts               # NEW: Cases type definitions
│   │   └── schedules.ts           # NEW: Schedules type definitions
│   └── utils/
│       ├── dataTransforms.ts     # NEW: Data transformation utilities
│       └── exportUtils.ts        # NEW: CSV/PDF export utilities
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Supabase filtering requires exact column names from database schema
// Current components use flat JSON fields - need to join related tables

// GOTCHA: Cases table has normalized structure but components expect flat JSON
// Need to use .select() with joins to recreate current data structure

// CRITICAL: Socket.io events need mapping to Supabase Realtime
// Socket.io: socket.on('scraping-progress', handler)
// Supabase: supabase.channel('scraping').on('postgres_changes', handler)

// GOTCHA: Date handling - PostgreSQL dates vs JavaScript Date objects
// Use date-fns for consistent date formatting as in current components

// CRITICAL: Export functions use client-side data processing
// Papa.parse for CSV, jsPDF for PDF - no changes needed to export logic

// GOTCHA: Real-time requires proper channel cleanup on component unmount
// Must unsubscribe from channels to prevent memory leaks

// CRITICAL: Error handling patterns must match existing UX
// Current: try/catch with console.error, continue showing UI
// Maintain same error behavior, don't break UI on API errors
```

### Database Schema Mapping

```typescript
// Current flat structure (from Express API)
interface CaseSummary {
  id: number;
  case_number: string;
  court_name: string;
  parties: any;          // JSON string with plaintiff/defendant
  docket_entries: any;   // JSON string with charges/hearings
  // ... other fields
}

// Target Supabase structure (normalized)
interface DatabaseCase {
  id: number;
  case_number: string;
  court_name: string;
  case_parties: Array<{party_type: string, party_name: string, attorney: string}>;
  case_charges: Array<{ars_code: string, description: string}>;
  case_calendar: Array<{hearing_date: string, event_type: string}>;
  // ... other fields
}

// TRANSFORMATION REQUIRED: Join normalized tables to recreate flat structure
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// src/types/database.ts - Generate from Supabase schema
export interface Database {
  public: {
    Tables: {
      cases: {
        Row: {
          id: number;
          case_number: string;
          court_id: string;
          court_name: string;
          case_title: string;
          case_type: string;
          case_status: string;
          filing_date: string;
          judge: string;
          location: string;
          case_url: string;
          scraped_at: string;
          updated_at: string;
        };
        Insert: Omit<Row, 'id' | 'scraped_at' | 'updated_at'>;
        Update: Partial<Insert>;
      };
      case_parties: {
        Row: {
          id: number;
          case_id: number;
          party_type: string;
          party_name: string;
          attorney: string;
        };
      };
      case_charges: {
        Row: {
          id: number;
          case_id: number;
          ars_code: string;
          description: string;
          party_name: string;
        };
      };
      case_calendar: {
        Row: {
          id: number;
          case_id: number;
          hearing_date: string;
          hearing_time: string;
          event_type: string;
        };
      };
      // Add other tables...
    };
  };
}

// src/types/cases.ts - Component-level types
export interface CaseSummary {
  id: number;
  case_number: string;
  court_id: string;
  court_name: string;
  case_title: string;
  case_type: string;
  case_status: string;
  filing_date: string;
  judge: string;
  location: string;
  case_url: string;
  scraped_at: string;
  updated_at: string;
  next_hearing: string;
  parties: any;
  docket_entries: any;
  events: any;
  documents: any;
}
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE src/services/supabase.ts
  - IMPLEMENT: Supabase client initialization with environment variables
  - FOLLOW pattern: server/lib/supabase.js (but use anon key for frontend)
  - NAMING: supabase client instance export
  - DEPENDENCIES: @supabase/supabase-js package
  - PLACEMENT: Core service layer

Task 2: CREATE src/types/database.ts
  - IMPLEMENT: Database type definitions from Supabase schema
  - FOLLOW pattern: TypeScript interfaces matching database schema
  - NAMING: Database interface with Tables structure
  - DEPENDENCIES: None
  - PLACEMENT: Type definitions

Task 3: CREATE src/services/casesService.ts
  - IMPLEMENT: Cases CRUD operations replacing Express API calls
  - FOLLOW pattern: src/services/api.ts (courtCaseService methods)
  - NAMING: getCases, searchCases, getStatistics methods
  - DEPENDENCIES: Supabase client, Database types
  - CRITICAL: Join queries to recreate flat JSON structure

Task 4: REMOVE/SIMPLIFY Schedule Management
  - REMOVE: All schedule CRUD operations (automated via GitHub Actions)
  - OPTION 1: Delete ScheduleManager component entirely
  - OPTION 2: Convert to read-only status display showing:
    - Last scrape timestamp from scrape_logs table
    - Static schedule info: "Automated daily at 9 AM MST"
    - No user controls for scheduling

Task 5: SIMPLIFY Real-time Features
  - REMOVE: Real-time scraping progress (scraping happens in GitHub Actions)
  - KEEP: Real-time case updates when new data arrives
  - IMPLEMENT: Subscribe to cases table INSERT/UPDATE events only
  - NAMING: subscribeToCaseUpdates
  - DEPENDENCIES: Supabase client

Task 6: CREATE src/utils/dataTransforms.ts
  - IMPLEMENT: Transform normalized DB data to component format
  - FOLLOW pattern: JSON parsing logic in CasesDashboard.tsx
  - NAMING: transformCaseData, groupCasesByDate, parseParties
  - DEPENDENCIES: date-fns, Database types
  - CRITICAL: Preserve existing data transformation logic

Task 7: MODIFY src/components/CasesDashboard.tsx
  - REFACTOR: Replace fetch() calls with casesService methods
  - PRESERVE: All UI logic, filtering, modal behavior, export functions
  - UPDATE: Data loading with Supabase queries
  - DEPENDENCIES: casesService, dataTransforms
  - CRITICAL: Maintain exact same user experience

Task 8: REMOVE/SIMPLIFY src/components/ScheduleManager.tsx
  - OPTION 1: Delete component and remove from dashboard
  - OPTION 2: Convert to StatusDisplay component showing:
    - "Scraping: Automated (GitHub Actions)"
    - "Schedule: Monday-Friday 9 AM MST"
    - Last successful scrape timestamp
  - REMOVE: All CRUD forms, schedule creation, manual triggers

Task 9: REMOVE/SIMPLIFY src/components/ScrapingProgress.tsx
  - OPTION 1: Delete component entirely (no live scraping to monitor)
  - OPTION 2: Convert to LastScrapeStatus component showing:
    - Last scrape run time and status
    - Number of cases found in last run
    - Static message: "Next run scheduled for 9 AM MST"
  - REMOVE: All real-time progress tracking, Socket.io connections

Task 10: UPDATE package.json
  - REMOVE: express, axios, socket.io-client dependencies
  - KEEP: @supabase/supabase-js (already installed)
  - ADD: Any additional type packages if needed
  - PRESERVE: All UI/export dependencies (chart.js, jspdf, etc.)
```

### Implementation Patterns & Key Details

```typescript
// Supabase client setup pattern
// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// CRITICAL: Use anon key for frontend, not service key

// Cases service pattern with joins
// src/services/casesService.ts
export const getCases = async (limit = 100, offset = 0) => {
  const { data, error } = await supabase
    .from('cases')
    .select(`
      *,
      case_parties (party_type, party_name, attorney),
      case_charges (ars_code, description, party_name),
      case_calendar (hearing_date, hearing_time, event_type)
    `)
    .range(offset, offset + limit - 1)
    .order('filing_date', { ascending: false });

  if (error) throw error;
  
  // TRANSFORM: Normalize joined data to match component expectations
  return data.map(transformCaseData);
};

// Real-time subscription pattern
// src/services/realtimeService.ts
export const subscribeToProgress = (callback: (event: ProgressEvent) => void) => {
  const channel = supabase
    .channel('scraping-progress')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'scraping_progress' },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Data transformation pattern
// src/utils/dataTransforms.ts
export const transformCaseData = (dbCase: DatabaseCase): CaseSummary => {
  // PRESERVE: Existing JSON structure expected by components
  const parties = {
    plaintiff: dbCase.case_parties.find(p => p.party_type === 'plaintiff'),
    defendant: dbCase.case_parties.find(p => p.party_type === 'defendant')
  };

  const docket_entries = dbCase.case_charges.map(charge => ({
    type: 'charge',
    ars_code: charge.ars_code,
    description: charge.description
  }));

  // CRITICAL: Maintain exact same data structure as before
  return {
    ...dbCase,
    parties: JSON.stringify(parties),
    docket_entries: JSON.stringify(docket_entries),
    next_hearing: getNextHearing(dbCase.case_calendar)
  };
};

// Component refactoring pattern
// Preserve existing UI logic, only change data source
const loadData = async () => {
  try {
    setLoading(true);
    
    // OLD: const [casesRes, statsRes] = await Promise.all([fetch(), fetch()]);
    // NEW: Direct service calls
    const [casesData, statsData] = await Promise.all([
      casesService.getCases(),
      casesService.getStatistics()
    ]);
    
    setCases(casesData);
    setStatistics(statsData);
  } catch (error) {
    console.error('Error loading data:', error);
    // PRESERVE: Same error handling - don't break UI
  } finally {
    setLoading(false);
  }
};
```

### Integration Points

```yaml
ENVIRONMENT:
  - add to: .env
  - variables: "VITE_SUPABASE_URL=your_supabase_url"
  - variables: "VITE_SUPABASE_ANON_KEY=your_anon_key"

COMPONENTS:
  - preserve: All existing UI/UX behavior
  - update: Only data fetching and real-time logic
  - maintain: Export functions, filtering, search, modals

DEPENDENCIES:
  - remove: express, axios, socket.io-client
  - keep: @supabase/supabase-js, react, chart.js, jspdf
  - preserve: All UI and utility libraries

REAL_TIME:
  - replace: Socket.io channels with Supabase channels
  - maintain: Same event structure and handling logic
  - add: Proper channel cleanup on unmount
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file creation - fix before proceeding
npm run type-check                   # TypeScript compilation check
npm run lint                         # ESLint validation  
npm run format                       # Prettier formatting

# Expected: Zero errors. If errors exist, READ output and fix before proceeding.
```

### Level 2: Component Testing (UI Validation)

```bash
# Test each component as refactored
npm run dev                          # Start development server

# Dashboard testing
# Open http://localhost:5173
# Verify cases load and display properly
# Test search and filtering functionality
# Test case detail modals
# Test export functions (CSV/PDF)

# Schedule Manager testing  
# Navigate to schedule management
# Test creating new schedules
# Test editing existing schedules
# Test real-time updates

# Scraping Progress testing
# Trigger a scraping job (if available)
# Verify real-time progress updates
# Check court grid updates
# Verify activity log

# Expected: All UI functionality works identically to before
```

### Level 3: Integration Testing (System Validation)

```bash
# Supabase connection validation
node -e "
import { supabase } from './src/services/supabase.js';
const test = async () => {
  const { data, error } = await supabase.from('cases').select('count');
  console.log('Supabase connection:', error ? 'FAILED' : 'SUCCESS');
};
test();
"

# Cases service validation
curl -f http://localhost:5173/api/health || echo "Frontend health check"

# Database query validation
node -e "
import { getCases } from './src/services/casesService.js';
getCases(10, 0).then(cases => {
  console.log('Cases loaded:', cases.length);
  console.log('Sample case:', cases[0]?.case_number);
}).catch(err => console.error('Cases query failed:', err));
"

# Real-time validation
node -e "
import { subscribeToProgress } from './src/services/realtimeService.js';
const unsub = subscribeToProgress(event => {
  console.log('Real-time event received:', event.eventType);
});
setTimeout(() => { unsub(); console.log('Subscription cleaned up'); }, 5000);
"

# Expected: All services connect, data loads, real-time works
```

### Level 4: End-to-End Validation

```bash
# Full user journey testing
# 1. Dashboard loads with cases grouped by date
# 2. Search filters cases correctly
# 3. Case details show in modal with all information
# 4. Schedule creation/editing works
# 5. Real-time progress updates during scraping
# 6. Export functions generate proper CSV/PDF

# Performance validation
# Check dashboard load time < 3 seconds
# Verify search/filter response < 500ms
# Confirm real-time updates < 1 second latency

# Data integrity validation
# Compare exported data with database
# Verify all case fields correctly displayed
# Check date formatting consistency
# Validate chart data accuracy

# Browser compatibility
# Test in Chrome, Firefox, Safari
# Verify mobile responsiveness maintained
# Check console for errors/warnings

# Expected: Full functionality preserved, performance maintained
```

## Final Validation Checklist

### Technical Validation

- [ ] All components compile without TypeScript errors
- [ ] No ESLint warnings or errors
- [ ] Supabase client connects successfully
- [ ] All service methods return expected data structures
- [ ] Real-time subscriptions work and clean up properly

### Feature Validation

- [ ] Dashboard shows cases grouped by hearing dates (identical to before)
- [ ] Search and filtering work with same behavior
- [ ] Case detail modals show complete information
- [ ] Schedule CRUD operations work without Express backend
- [ ] Real-time scraping progress updates function
- [ ] CSV/PDF exports generate identical files
- [ ] All error cases handled gracefully

### User Experience Validation

- [ ] Zero visual changes to UI
- [ ] Same loading states and error messages
- [ ] Identical search/filter behavior
- [ ] Same modal interactions and data display
- [ ] Export functions work identically
- [ ] Performance matches or exceeds previous version

### Migration Validation

- [ ] No Express backend required for frontend operation
- [ ] All data comes from Supabase database
- [ ] Real-time features work via Supabase Realtime
- [ ] Environment variables properly configured
- [ ] Package dependencies cleaned up (Express/Socket.io removed)

---

## Anti-Patterns to Avoid

- ❌ Don't change UI/UX during refactoring - preserve exact user experience
- ❌ Don't break existing data transformations - maintain component expectations  
- ❌ Don't skip real-time subscription cleanup - causes memory leaks
- ❌ Don't use service key in frontend - security vulnerability
- ❌ Don't change export logic - CSV/PDF functions work correctly as-is
- ❌ Don't modify database schema during frontend refactor
- ❌ Don't remove error handling - maintain graceful degradation
- ❌ Don't forget to test all user workflows end-to-end