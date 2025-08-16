# Remaining Test Failures Analysis - Justice Watch App

## Executive Summary
After implementing the initial fixes, we have:
- ✅ Jest Tests: 5/5 passing
- ⚠️ Selenium E2E: 6/14 passing (8 failures)
- ❌ Python Tests: 1/10 passing (9 failures)

This document analyzes each remaining failure with root causes and solutions.

---

## 🔴 Critical Failures (Blocking Widget Functionality)

### 1. CORS Headers Still Not Working
**Test:** `test_cors_headers`
**Status:** FAIL
**Error:** `AssertionError: unexpectedly None`

#### What's Wrong:
- The test fetches `/api/widgets/config` from the widget page context
- JavaScript code checks for `Access-Control-Allow-Origin` header
- The header is returning `null` or undefined

#### Root Cause:
The CORS middleware was added to the Express router, but it may not be applying to all routes or the header isn't being read correctly by the browser.

#### Investigation Needed:
```bash
# Direct test to verify headers
curl -I http://localhost:3001/api/widgets/config
# Should show: Access-Control-Allow-Origin: *
```

#### Solution:
```javascript
// In server/index.js - Add CORS at the app level, not just router
app.use('/api/widgets', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Widget-Version');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use('/api/widgets', widgetRoutes);
```

---

### 2. PostMessage Not Being Captured
**Test:** `test_postmessage_communication`
**Status:** FAIL
**Error:** `Widget should send WIDGET_LOADED message`

#### What's Wrong:
- Widget loads but the test doesn't capture the postMessage event
- The message is sent but timing might be off

#### Root Cause:
The postMessage is sent immediately on mount, but the test listener might be attached after the message is already sent.

#### Solution:
```typescript
// In WidgetBase.tsx - Delay the message slightly
useEffect(() => {
  // Give parent time to attach listener
  setTimeout(() => {
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
  }, 100); // Small delay
  
  setIsLoaded(true);
}, []);
```

---

### 3. Arraignments Widget Not Rendering Content
**Test:** `test_arraignments_widget_loads`
**Status:** ERROR
**Error:** `Unable to locate element: .arraignments-list, .arraignments-grid`

#### What's Wrong:
- Widget loads but doesn't render the arraignments list or grid
- Also can't find the empty-state element
- This means the widget is likely showing a loading state indefinitely or erroring

#### Root Cause:
The ArraignmentsWidget uses React Router's `useSearchParams` but when loaded as a standalone widget, there's no Router context.

#### Investigation:
```javascript
// The error is likely: "useSearchParams() may only be used in the context of a <Router> component"
```

#### Solution:
```typescript
// In ArraignmentsWidget.tsx - Make router-safe
import { useSearchParams } from 'react-router-dom';

// Replace with a safe version
const useQueryParams = () => {
  try {
    const [searchParams] = useSearchParams();
    return searchParams;
  } catch {
    // Fallback for non-router context
    return new URLSearchParams(window.location.search);
  }
};

// Then use: const searchParams = useQueryParams();
```

---

### 4. Widget API Returns HTML Instead of JSON
**Tests:** `test_widget_api_config`, `test_widget_api_arraignments`, `test_widget_api_stats`
**Status:** ERROR
**Error:** `JSONDecodeError: Expecting value: line 1 column 1 (char 0)`

#### What's Wrong:
- API endpoints are returning HTML (probably the React app) instead of JSON
- The API routes aren't being matched, falling through to the catch-all route

#### Root Cause:
The test is navigating to the widget page first, then trying to fetch from the API. The fetch might be relative and getting the wrong URL, or the API routes aren't properly mounted.

#### Investigation:
```python
# In test, check what URL is actually being fetched
print(f"Fetching: {self.driver.current_url}/api/widgets/config")
# Might be: http://localhost:3001/widgets/stats/api/widgets/config (wrong!)
```

#### Solution:
```python
# In test_widgets_selenium.py - Use absolute URLs
def test_widget_api_config(self):
    # Don't navigate to widget first, or use absolute URL
    self.driver.get("http://localhost:3001/api/widgets/config")
    # OR fix the JavaScript fetch to use absolute URL
    result = self.driver.execute_script("""
        return fetch('http://localhost:3001/api/widgets/config')
            .then(r => r.json())
    """)
```

---

### 5. iframe Widget Not Loading
**Test:** `test_widget_iframe_embedding`
**Status:** ERROR
**Error:** `TimeoutException: Unable to locate element: .widget-container`

#### What's Wrong:
- Widget doesn't load when embedded in an iframe
- The widget HTML might not be loading the correct JavaScript

#### Root Cause:
The widget.html template references `/assets/widget.js` but this file might not exist or might not be built correctly.

#### Investigation:
```bash
# Check if widget.js exists
ls -la dist/assets/widget.js
# Check what's in widget.html when served
curl http://localhost:3001/widgets/stats | grep "script"
```

#### Solution:
1. Ensure widget.js is built:
```javascript
// vite.config.ts already has this, but verify it's working
rollupOptions: {
  input: {
    main: './index.html',
    widget: './src/widget-entry.tsx'
  }
}
```

2. Fix the widget.html script reference:
```html
<!-- If widget.js doesn't exist, use the main bundle -->
<script type="module" src="/assets/main.js"></script>
```

---

### 6. CSS Class "size-card" Not Applied
**Test:** `test_stats_widget_with_size`
**Status:** FAIL
**Error:** `'size-card' not found in 'widget-container widget-compact theme-light stats-widget  '`

#### What's Wrong:
- The size="card" parameter is passed but the class isn't applied
- The widget is using 'widget-compact' instead of adding 'size-card'

#### Root Cause:
The StatsWidget component maps size="card" to size="compact" when passing to WidgetBase:
```typescript
// In StatsWidget.tsx line 159
size={config.size === 'card' ? 'compact' : 'full'}
```

#### Solution:
Pass the size directly without mapping:
```typescript
// In StatsWidget.tsx
<WidgetBase
  title={config.title}
  size={config.size} // Don't map, just pass through
  theme={config.theme}
  hideHeader={config.hideHeader}
  className="stats-widget"
>
```

---

## 🟡 Python Test Failures (Non-Critical)

### 7. Database Handler Missing Methods
**Tests:** `test_case_exists`, `test_update_case`
**Error:** `AttributeError: 'DatabaseHandler' object has no attribute 'case_exists'`

#### What's Wrong:
The tests expect methods that don't exist in DatabaseHandler:
- `case_exists()`
- `update_case()`
- `delete_case()`

#### Solution:
Either update the tests to use existing methods or add the missing methods:

```python
# In scrapers/database_handler.py
def case_exists(self, case_number: str) -> bool:
    """Check if a case exists in the database."""
    try:
        self.cursor.execute(
            "SELECT COUNT(*) FROM court_cases WHERE case_number = %s",
            (case_number,)
        )
        return self.cursor.fetchone()[0] > 0
    except Exception as e:
        logger.error(f"Error checking case existence: {e}")
        return False

def update_case(self, case_number: str, updates: Dict[str, Any]) -> bool:
    """Update an existing case."""
    try:
        set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
        values = list(updates.values()) + [case_number]
        self.cursor.execute(
            f"UPDATE court_cases SET {set_clause} WHERE case_number = %s",
            values
        )
        self.connection.commit()
        return True
    except Exception as e:
        logger.error(f"Error updating case: {e}")
        return False
```

### 8. ScraperConfig Mock Too Simple
**Tests:** All ScraperConfig tests
**Error:** Various AttributeErrors for missing methods/properties

#### What's Wrong:
The mock ScraperConfig is too simple and doesn't match what tests expect.

#### Solution:
Create a more complete mock:

```python
# In tests/test_scrapers.py
class ScraperConfig:
    def __init__(self, **kwargs):
        self.headless = kwargs.get('headless', True)
        self.timeout = kwargs.get('timeout', 30)
        self.max_retries = kwargs.get('max_retries', 3)
    
    @classmethod
    def from_dict(cls, config_dict):
        return cls(**config_dict)
    
    def to_dict(self):
        return {
            'headless': self.headless,
            'timeout': self.timeout,
            'max_retries': self.max_retries
        }
```

### 9. MaricopaScraper Missing Methods
**Tests:** `test_navigate_to_court`, `test_extract_case_data`
**Error:** `AttributeError: object has no attribute 'navigate_to_court'`

#### What's Wrong:
Tests expect methods that don't exist or have different names.

#### Solution:
Update tests to use actual method names:
```python
# Instead of navigate_to_court, use actual method
# Instead of extract_case_data, use extract_case_details
```

---

## Priority Fix Order

### 🔥 High Priority (Blocking Widget Functionality)
1. Fix ArraignmentsWidget Router dependency (#3)
2. Fix widget.js bundle/script reference (#5)
3. Fix API test URLs to use absolute paths (#4)

### 🟠 Medium Priority (Test Accuracy)
4. Fix CORS header application (#1)
5. Fix PostMessage timing (#2)
6. Fix size-card class mapping (#6)

### 🟢 Low Priority (Test Suite Completeness)
7. Add missing DatabaseHandler methods (#7)
8. Fix ScraperConfig mock (#8)
9. Update scraper test method names (#9)

---

## Quick Test Commands

After applying fixes, test each area:

```bash
# Test CORS headers directly
curl -I http://localhost:3001/api/widgets/config | grep -i access-control

# Test widget HTML serves correctly
curl http://localhost:3001/widgets/stats | grep widget-root

# Test API returns JSON
curl http://localhost:3001/api/widgets/data/stats | jq .

# Run specific failing test
python e2e-selenium/test_widgets_selenium.py WidgetE2ETests.test_arraignments_widget_loads

# Run Jest tests
npm run test

# Run Python tests
python -m pytest tests/test_scrapers.py -v
```

---

## Success Metrics

After all fixes:
- [ ] 14/14 Selenium E2E tests passing
- [ ] 10/10 Python tests passing  
- [ ] 5/5 Jest tests passing (already complete)
- [ ] CORS headers present on all API responses
- [ ] Widgets load in both standalone and iframe modes
- [ ] All API endpoints return proper JSON