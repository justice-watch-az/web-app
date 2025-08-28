# CLAUDE.md - Important Instructions for Justice Watch App

## CRITICAL SCRAPING RULES

### NEVER CONSTRUCT URLs - ALWAYS CLICK

**DO NOT** manually construct URLs or use `driver.get()` to navigate to case pages. The court website requires proper navigation through clicks.

**WRONG APPROACH (NEVER DO THIS):**
```python
# NEVER DO THIS - WILL NOT WORK
case_number_padded = case_number + "0" * (14 - len(case_number))
detail_url = f"{self.base_url}/app/courtrecords/CaseInfo?casenumber={case_number_padded}"
self.driver.get(detail_url)  # THIS WILL FAIL - CASE NOT FOUND
```

**CORRECT APPROACH (ALWAYS DO THIS):**
```python
# ALWAYS CLICK ON THE ACTUAL LINKS
case_links = self.driver.find_elements(By.PARTIAL_LINK_TEXT, case_number)
if case_links:
    case_links[0].click()  # Click the actual link
    time.sleep(3)
    # Now extract data from the page
```

### Navigation Flow

1. **Start Page**: Navigate to `https://justicecourts.maricopa.gov/app/courtrecords/CourtCalendars` (ONLY URL you should ever use)
2. **Click Court Name**: Click on court names from the zebratable
3. **Click Case Numbers**: Click on case number links to get to Case History
4. **Use Browser Back**: Use `driver.back()` to return to previous pages

### Key Points

- The website generates dynamic session-based URLs
- Case numbers change weekly with new cases
- Must navigate like a real user would
- Never try to construct or guess URLs
- Always find and click actual page elements

## Testing Commands

### Run the scraper in Docker:
```bash
docker exec justice-watch-v2.2 python3 /app/scrapers/maricopa_arraignment_scraper.py '{"headless": true}'
```

### Check for lint/type errors:
```bash
npm run lint
npm run typecheck
```

## Project Structure

- `/scrapers/maricopa_arraignment_scraper.py` - Main scraper that clicks through courts to find arraignments
- `/server/queue/index.js` - Queue handler that runs the scraper
- `/src/components/Dashboard.tsx` - Single button interface for scraping

## Database

PostgreSQL with these key tables:
- `court_cases` - Main case storage
- `users` - User authentication

## Current Configuration

- Scraper targets: "Arraignment Hearing - Long Form" cases only
- Test court: Agua Fria (usually has 1 arraignment)
- All 26 Maricopa County Justice Courts are discovered automatically

## PRP System Integration

### What is the PRP System?

PRPs (Pull Request Proposals) are structured documents that define tasks before implementation. This project uses Approach 2 (Framework Import) from the PRP system.

### Project Structure with PRPs

```
web-app/                    # Your project root
├── .claude/               # Framework commands
│   └── commands/          # Custom commands (future)
├── PRPs/                  # PRP system
│   ├── templates/         # Reusable templates
│   │   ├── prp-base-template.md
│   │   ├── prp-bug-template.md
│   │   └── prp-refactor-template.md
│   └── features/          # Your project PRPs
├── src/                   # Your existing code
├── scrapers/              # Python scrapers
└── CLAUDE.md              # This file
```

### How to Use PRPs

1. **Creating a Task PRP**:
   ```bash
   # Copy a template
   cp PRPs/templates/prp-base-template.md PRPs/features/prp-feature-new-scraper.md
   
   # Edit the PRP with specifications
   # Then reference it when implementing
   ```

2. **PRP Workflow**:
   - Define the task in a PRP
   - Review and refine requirements
   - Implement based on PRP specs
   - Check off success criteria

### Benefits for Justice Watch

- **Scraper Changes**: Document each scraper modification in a PRP
- **Feature Additions**: Plan new features before coding
- **Bug Fixes**: Track and document fixes systematically
- **Team Collaboration**: Share clear specs with team

### Example PRPs for This Project

- `prp-bug-scraper-navigation.md` - Fix URL construction issues
- `prp-feature-court-filtering.md` - Add court selection features
- `prp-refactor-database-schema.md` - Optimize database structure

### Project-Specific Instructions

- Project root: ./
- Primary language: TypeScript (frontend), Python (scrapers)
- Database: Supabase (PostgreSQL)
- Testing: npm run lint && npm run typecheck
- u should do all the building and testing of docker with the docker mcp
- plz note we will use a versioning system like this: A1-0, A1-1 , A1-9, A2-0 etc