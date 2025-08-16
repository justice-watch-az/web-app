# Test Suite Documentation - Justice Watch App
## Testing Implementation & Results Report

**Date:** 2025-08-16  
**Context:** Embeddable Widgets Feature Testing & Fixes  
**Previous Work:** Converted from Playwright to Selenium due to system compatibility (Fedora 42)

---

## 1. Test Suite Overview

### 1.1 Test Framework Stack
- **Frontend Unit Tests:** Jest + React Testing Library
- **E2E Tests:** Selenium WebDriver (Firefox/geckodriver)
- **Backend Tests:** Python pytest
- **Build System:** Vite (dual bundle: main app + widget)
- **Server:** Express.js with nodemon

### 1.2 Test Categories
1. **Jest Unit Tests** - Component-level testing for widgets
2. **Selenium E2E Tests** - Full integration testing for widget embedding
3. **Python Unit Tests** - Backend scraper and database testing

---

## 2. Implementation Changes Made

### 2.1 High Priority Fixes (Blocking Widget Functionality)

#### Fix #1: ArraignmentsWidget Router Dependency
**File:** `src/components/widgets/ArraignmentsWidget.tsx`
```typescript
// Added safe hook for non-Router contexts
const useQueryParams = () => {
  try {
    const [searchParams] = useSearchParams();
    return searchParams;
  } catch {
    // Fallback for standalone widget
    return new URLSearchParams(window.location.search);
  }
};
```
**Status:** ✅ Implemented

#### Fix #2: Widget.js Bundle/Script Reference
**File:** `server/index.js`
```javascript
// Moved widget routes before static handler
app.get('/widgets/:widgetType', (req, res) => {
  // Serves widget.html template with proper placeholders
});

// Modified static handler to exclude /widgets path
app.use((req, res, next) => {
  if (req.path.startsWith('/widgets/')) {
    return next();
  }
  express.static('dist')(req, res, next);
});
```
**Status:** ✅ Implemented - Server logs confirm "Serving widget HTML for type: [widgetType]"

#### Fix #3: API Test URLs
**Files:** `e2e-selenium/test_widgets_selenium.py`
- Tests already using absolute URLs with `self.base_url`
- API endpoints confirmed working: `/api/widgets/config` returns valid JSON
**Status:** ✅ No changes needed - APIs working correctly

### 2.2 Medium Priority Fixes (Test Accuracy)

#### Fix #4: CORS Header Application
**File:** `server/routes/widgets.js`
```javascript
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Widget-Version');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```
**Verification:** `curl -I -H "Origin: http://example.com" http://localhost:3001/api/widgets/config`
**Status:** ✅ Headers confirmed present

#### Fix #5: PostMessage Timing
**File:** `src/components/widgets/WidgetBase.tsx`
```typescript
useEffect(() => {
  // Added 100ms delay for listener attachment
  const timer = setTimeout(() => {
    const message = {
      type: 'WIDGET_LOADED',
      widgetId: `widget-${Date.now()}`,
      height: containerRef.current?.scrollHeight,
      width: containerRef.current?.scrollWidth
    };
    
    window.postMessage(message, '*');
    
    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
    
    setIsLoaded(true);
  }, 100);

  return () => clearTimeout(timer);
}, []);
```
**Status:** ✅ Implemented

#### Fix #6: Size-card Class Mapping
**File:** `src/components/widgets/StatsWidget.tsx`
```typescript
// Changed from mapping to direct pass-through
size={config.size as any} // Pass card/dashboard directly
```
**File:** `src/components/widgets/WidgetBase.tsx`
- Already supports: `${size === 'card' ? 'size-card' : ''}`
**Status:** ✅ Implemented

### 2.3 Low Priority Fixes (Test Suite Completeness)

#### Fix #7: DatabaseHandler Methods
**File:** `scrapers/database_handler.py`
```python
def case_exists(self, case_number: str) -> bool:
    """Check if a case exists in the database."""
    
def update_case(self, case_number: str, updates: Dict[str, Any]) -> bool:
    """Update an existing case."""
    
def delete_case(self, case_number: str) -> bool:
    """Delete a case and all related data."""
```
**Status:** ✅ All three methods implemented

#### Fix #8: ScraperConfig Mock
**File:** `tests/test_scrapers.py`
```python
class ScraperConfig:
    def __init__(self, **kwargs):
        self.headless = kwargs.get('headless', True)
        self.timeout = kwargs.get('timeout', 30)
        self.max_retries = kwargs.get('max_retries', 3)
        self.wait_time = kwargs.get('wait_time', 2)
    
    @classmethod
    def from_dict(cls, config_dict):
        return cls(**config_dict)
    
    def to_dict(self):
        return {...}
```
**Status:** ✅ Implemented

#### Fix #9: Scraper Test Method Names
**File:** `tests/test_scrapers.py`
- Changed `test_navigate_to_court` → `test_scrape_court_calendar`
- Changed `test_extract_case_data` → `test_extract_case_details`
**Status:** ✅ Implemented

---

## 3. Test Results Summary

### 3.1 Build Process
```bash
npm run build
```
**Result:** ✅ SUCCESS
- Built in 9.14s
- Generated dual bundles:
  - `dist/assets/main.js` (618.31 kB)
  - `dist/assets/widget.js` (1.05 kB)
- Widget HTML template properly configured

### 3.2 Jest Unit Tests
```bash
npm run test
```
**Result:** ⚠️ PARTIAL (2/5 passing)

| Test | Status | Issue |
|------|--------|-------|
| applies correct theme class | ✅ PASS | - |
| applies correct size class | ✅ PASS | - |
| renders with default props | ❌ FAIL | Looking for "Widget Content" but shows loader |
| sends WIDGET_LOADED message | ❌ FAIL | postMessage not called (0 calls) |
| handles error boundary | ❌ FAIL | Error boundary not triggering |

### 3.3 Selenium E2E Tests
```bash
python e2e-selenium/test_widgets_selenium.py
```
**Result:** ⚠️ PARTIAL (1/14 passing)

| Test | Status | Issue |
|------|--------|-------|
| test_cors_headers | ✅ PASS | Headers correctly set |
| test_postmessage_communication | ❌ FAIL | Message not captured |
| test_stats_widget_loads | ❌ ERROR | TimeoutException - widget-container not found |
| test_stats_widget_with_size | ❌ ERROR | TimeoutException - widget-container not found |
| test_stats_widget_with_theme | ❌ ERROR | TimeoutException - widget-container not found |
| test_arraignments_widget_loads | ❌ ERROR | No arraignments-list or arraignments-grid |
| test_widget_gallery | ❌ ERROR | TimeoutException - widget-gallery not found |
| test_widget_api_config | ❌ ERROR | JSONDecodeError - getting HTML instead of JSON |
| test_widget_api_arraignments | ❌ ERROR | JSONDecodeError - getting HTML instead of JSON |
| test_widget_api_stats | ❌ ERROR | JSONDecodeError - getting HTML instead of JSON |
| test_widget_iframe_embedding | ❌ ERROR | TimeoutException in iframe |
| test_widget_responsiveness_mobile | ❌ ERROR | TimeoutException - widget-container not found |
| test_widget_responsiveness_tablet | ❌ ERROR | TimeoutException - widget-container not found |
| test_widget_responsiveness_desktop | ❌ ERROR | TimeoutException - widget-container not found |

**Server Logs Confirm:** Widget HTML is being served (multiple entries of "Serving widget HTML for type: stats")

### 3.4 Python Unit Tests
```bash
python -m pytest tests/test_scrapers.py -v
```
**Result:** ✅ MOSTLY PASSING (8/10 passing)

| Test Class | Passing | Failing | Notes |
|------------|---------|---------|-------|
| TestDatabaseHandler | 3/4 | 1 | test_save_case fails on mock |
| TestScraperConfig | 3/3 | 0 | All passing |
| TestMaricopaScraper | 2/3 | 1 | test_scraper_init fails |

---

## 4. Root Cause Analysis

### 4.1 Primary Issues Identified

1. **Widget Rendering Issue**
   - Server correctly serves widget HTML (confirmed in logs)
   - Widget JavaScript bundle exists and is referenced
   - But widgets not rendering when accessed via Selenium
   - Possible causes:
     - JavaScript execution timing
     - Module loading issues
     - React hydration problems

2. **API Test Issues**
   - When Selenium navigates to API endpoints, getting HTML instead of JSON
   - Likely browser is wrapping JSON response in HTML
   - Direct curl tests work perfectly

3. **PostMessage Timing**
   - Despite 100ms delay, message still not captured
   - Test might be attaching listener after message sent
   - Or message format doesn't match expectation

### 4.2 What's Working
- ✅ Build system (Vite dual bundle)
- ✅ Server routing (widget routes before static)
- ✅ CORS headers (verified with curl)
- ✅ API endpoints (return JSON correctly)
- ✅ Database handler methods
- ✅ Python test infrastructure

### 4.3 What Needs Investigation
- ❌ Widget component mounting/rendering
- ❌ JavaScript module loading in standalone context
- ❌ Selenium WebDriver interaction with SPA
- ❌ PostMessage event capture timing

---

## 5. Testing Commands Reference

### Quick Test Commands
```bash
# Build the application
npm run build

# Run Jest tests
npm run test

# Run Selenium E2E tests
python e2e-selenium/test_widgets_selenium.py

# Run Python unit tests
python -m pytest tests/test_scrapers.py -v

# Test CORS headers directly
curl -I http://localhost:3001/api/widgets/config | grep -i access-control

# Test widget HTML serves correctly
curl http://localhost:3001/widgets/stats | grep widget-root

# Test API returns JSON
curl http://localhost:3001/api/widgets/data/stats | jq .

# Run specific Selenium test
python e2e-selenium/test_widgets_selenium.py WidgetE2ETests.test_cors_headers
```

### Development Server
```bash
# Start development server (with auto-reload)
npm run dev:server

# Check server logs
tail -f /tmp/server.log

# Restart server manually
pkill -f "node server/index.js" && npm run dev:server &
```

---

## 6. Success Metrics

### Current State
- [x] 100% Build success
- [x] 40% Jest tests passing (2/5)
- [x] 7% Selenium E2E tests passing (1/14) 
- [x] 80% Python tests passing (8/10)
- [x] CORS headers present on all API responses
- [x] Widget routes serving correct HTML template
- [ ] Widgets rendering in standalone mode
- [ ] Widgets working in iframe mode
- [ ] PostMessage communication working

### Target State
- [ ] 14/14 Selenium E2E tests passing
- [ ] 10/10 Python tests passing
- [ ] 5/5 Jest tests passing
- [ ] All widgets rendering correctly
- [ ] Full iframe embedding support
- [ ] Complete PostMessage communication

---

## 7. Known Issues & Workarounds

### Issue: "2" Appended to Commands
Some npm/vite commands mysteriously append "2" to arguments. 
**Workaround:** Clean package.json scripts with sed

### Issue: Selenium WebDriver with Chrome on Fedora 42
Chrome WebDriver installation times out.
**Solution:** Use Firefox with geckodriver instead

### Issue: Widget Not Rendering
Widgets serve HTML but don't render components.
**Investigation Needed:** Check React hydration and module loading

### Issue: API Tests Getting HTML
Selenium navigation to API endpoints returns HTML-wrapped JSON.
**Potential Solution:** Use fetch within page context instead of navigation

---

## 8. Next Steps Recommendations

1. **Investigate Widget Rendering**
   - Add console logging to widget-entry.tsx
   - Check browser console for JavaScript errors
   - Verify React component mounting

2. **Fix PostMessage Capture**
   - Increase delay or use different approach
   - Add debug logging to verify message sending
   - Consider using MutationObserver for load detection

3. **Improve API Testing**
   - Use execute_script with fetch instead of navigation
   - Parse response within browser context
   - Add retry logic for timing issues

4. **Enhance Test Stability**
   - Add explicit waits for widget loading
   - Use presence_of_element_located with custom conditions
   - Add screenshot capture on failure for debugging

---

## 9. Appendix: File Changes Summary

### Modified Files
- `/server/index.js` - Widget route handling
- `/server/routes/widgets.js` - CORS headers
- `/src/components/widgets/WidgetBase.tsx` - PostMessage timing
- `/src/components/widgets/ArraignmentsWidget.tsx` - Router safety
- `/src/components/widgets/StatsWidget.tsx` - Size mapping
- `/scrapers/database_handler.py` - New methods
- `/tests/test_scrapers.py` - Mock improvements
- `/e2e-selenium/test_widgets_selenium.py` - Test structure

### Created Files
- `/widget.html` - Widget template
- `/src/widget-entry.tsx` - Widget entry point
- `/REMAINING-FAILURES-ANALYSIS.md` - Failure analysis
- `/TEST-SUITE-DOCUMENTATION.md` - This document

---

**Document Version:** 1.0  
**Last Updated:** 2025-08-16  
**Author:** Claude Code Assistant  
**Status:** Testing In Progress