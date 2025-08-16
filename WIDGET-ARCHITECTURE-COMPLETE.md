# Complete Widget Architecture Documentation
## Justice Watch App - Embeddable Widgets System

**Version:** 1.0.0  
**Created:** 2025-08-16  
**Purpose:** Enable third-party websites to embed Justice Watch data visualizations

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Component Structure](#3-component-structure)
4. [Integration with Existing System](#4-integration-with-existing-system)
5. [Widget Types & Features](#5-widget-types--features)
6. [Technical Implementation](#6-technical-implementation)
7. [Security & Performance](#7-security--performance)
8. [Usage & Embedding](#8-usage--embedding)
9. [API Endpoints](#9-api-endpoints)
10. [Build & Deployment](#10-build--deployment)

---

## 1. Executive Summary

### 1.1 Purpose
The Widget Architecture enables external websites to embed Justice Watch data visualizations without requiring direct database access or API keys. This democratizes access to court data by allowing news organizations, civic groups, and government websites to display real-time arraignment information, case statistics, and court calendars.

### 1.2 Core Features
- **Standalone Rendering**: Widgets work independently of the main application
- **Iframe Embedding**: Secure cross-origin embedding with PostMessage communication
- **Responsive Design**: Adapts to container size (mobile, tablet, desktop)
- **Real-time Updates**: Optional auto-refresh for live data
- **Themeable**: Light, dark, and auto themes
- **CORS-Enabled**: Proper cross-origin resource sharing

### 1.3 Business Value
- **Increased Reach**: Data accessible on partner websites
- **Public Transparency**: Court information more widely available
- **Zero Integration Cost**: Simple HTML embed code
- **Brand Awareness**: "Powered by Justice Watch" attribution

---

## 2. Architecture Overview

### 2.1 High-Level Design
```
┌─────────────────────────────────────────────────────────┐
│                    External Website                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  <iframe src="justicwatch.org/widgets/stats">   │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │         Widget Container                 │   │   │
│  │  │  ┌───────────────────────────────┐      │   │   │
│  │  │  │    React Widget Component     │      │   │   │
│  │  │  │  ┌─────────────────────┐     │      │   │   │
│  │  │  │  │   Data from API     │     │      │   │   │
│  │  │  │  └─────────────────────┘     │      │   │   │
│  │  │  └───────────────────────────────┘      │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            ↕
                    PostMessage Events
                            ↕
┌─────────────────────────────────────────────────────────┐
│                 Justice Watch Server                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Widget Routes│  │  Widget API  │  │  Database   │  │
│  │  /widgets/*  │→ │ /api/widgets │→ │  PostgreSQL │  │
│  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Dual Bundle Strategy
The application uses Vite to create two separate JavaScript bundles:

1. **Main Bundle** (`main.js` - 618KB)
   - Full application with routing
   - Dashboard, analytics, admin features
   - Served at root domain

2. **Widget Bundle** (`widget.js` - 1KB)
   - Minimal React runtime
   - Widget components only
   - No routing dependencies
   - Served at `/widgets/*` paths

### 2.3 Request Flow
```
1. External site embeds: <iframe src="https://justicwatch.org/widgets/stats">
2. Server receives GET /widgets/stats
3. Server serves widget.html template with placeholders
4. Browser loads widget.js bundle
5. Widget component mounts and fetches data from API
6. Widget sends PostMessage to parent frame when loaded
7. Parent can communicate back via PostMessage
```

---

## 3. Component Structure

### 3.1 File Organization
```
justice-watch-app/
├── src/
│   ├── components/
│   │   └── widgets/
│   │       ├── WidgetBase.tsx          # Base container component
│   │       ├── StatsWidget.tsx         # Statistics dashboard widget
│   │       ├── ArraignmentsWidget.tsx  # Arraignments list widget
│   │       ├── widget-styles.css       # Widget-specific styles
│   │       └── __tests__/
│   │           └── WidgetBase.test.tsx # Jest unit tests
│   ├── widget-entry.tsx                # Standalone entry point
│   └── main.tsx                        # Main app entry point
├── server/
│   ├── routes/
│   │   └── widgets.js                  # Widget API routes
│   └── index.js                        # Express server with widget routes
├── widget.html                         # Widget HTML template
├── e2e-selenium/
│   └── test_widgets_selenium.py        # E2E widget tests
└── vite.config.ts                      # Dual bundle configuration
```

### 3.2 Component Hierarchy
```typescript
// Widget Component Tree
<WidgetBase>                    // Container with header/footer
  ├── <WidgetHeader />          // Title and expand button
  ├── <WidgetContent>           // Main content area
  │   ├── <StatsWidget />       // OR
  │   ├── <ArraignmentsWidget /> // OR
  │   └── <CalendarWidget />    // Based on widget type
  └── <WidgetFooter />          // Attribution link
```

### 3.3 Core Components

#### WidgetBase.tsx
```typescript
interface WidgetBaseProps {
  children: React.ReactNode;
  title?: string;
  size?: 'compact' | 'standard' | 'full' | 'card' | 'dashboard';
  theme?: 'light' | 'dark' | 'auto';
  hideHeader?: boolean;
  className?: string;
  onError?: (error: Error) => void;
}

// Features:
- Error boundary for fault isolation
- PostMessage communication
- Responsive sizing
- Theme application
- Loading states
- Resize observer for dynamic sizing
```

#### StatsWidget.tsx
```typescript
// Displays case statistics
- Total cases
- Active cases  
- Closed cases
- Today's hearings
- Bar charts for trends
- Configurable time periods
```

#### ArraignmentsWidget.tsx
```typescript
// Shows upcoming arraignments
- Case numbers
- Defendant names
- Scheduled times
- Court locations
- Judge assignments
- Filterable by court/date
```

---

## 4. Integration with Existing System

### 4.1 Server Integration

#### Express Routes (`server/index.js`)
```javascript
// Widget standalone routes - MUST be before static handler
app.get('/widgets/:widgetType', (req, res) => {
  const { widgetType } = req.params;
  
  // Read widget.html template
  let widgetHtml = fs.readFileSync(
    path.join(__dirname, '../widget.html'), 
    'utf8'
  );
  
  // Replace placeholders with actual values
  widgetHtml = widgetHtml
    .replace(/{{WIDGET_TYPE}}/g, widgetType)
    .replace('{{WIDGET_PARAMS}}', JSON.stringify(req.query))
    .replace('{{WIDGET_PARAMS_JSON}}', JSON.stringify(req.query));
  
  res.send(widgetHtml);
});

// Widget API routes
app.use('/api/widgets', widgetRoutes);
```

#### CORS Configuration
```javascript
// Widget-specific CORS headers
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

### 4.2 Database Integration

Widgets access the same PostgreSQL database but through restricted API endpoints:

```javascript
// Widget data endpoint
router.get('/data/arraignments', async (req, res) => {
  const { court, date, limit = 10 } = req.query;
  
  const query = `
    SELECT 
      cc.case_number,
      cc.case_title,
      cc.court_name,
      cc.next_hearing
    FROM court_cases cc
    WHERE next_hearing >= $1
    LIMIT $2
  `;
  
  const result = await pool.query(query, [date, limit]);
  res.json({ success: true, data: result.rows });
});
```

### 4.3 Build System Integration

#### Vite Configuration (`vite.config.ts`)
```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html',        // Main app entry
        widget: './src/widget-entry.tsx'  // Widget entry
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
      }
    }
  }
});
```

This creates two separate bundles:
- `dist/assets/main.js` - Full application
- `dist/assets/widget.js` - Widget-only bundle

---

## 5. Widget Types & Features

### 5.1 Available Widgets

| Widget Type | Purpose | Sizes | Parameters |
|------------|---------|-------|------------|
| `stats` | Display case statistics | card, dashboard | court, period, theme |
| `arraignments` | List upcoming arraignments | compact, standard, full | court, date, limit, theme, refresh |
| `calendar` | Court calendar view | mini, standard | court, view, startDate, endDate, theme |
| `search` | Embedded case search | inline, modal | theme, placeholder |

### 5.2 Common Parameters

All widgets accept these URL parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `theme` | string | 'light' | Visual theme: light/dark/auto |
| `size` | string | 'standard' | Widget size preset |
| `hideHeader` | boolean | false | Hide widget header |
| `refresh` | number | 0 | Auto-refresh interval (ms) |
| `title` | string | (varies) | Custom widget title |

### 5.3 Widget Capabilities

#### Responsive Sizing
```css
.widget-compact {
  max-width: 300px;
  max-height: 400px;
}

.widget-standard {
  max-width: 600px;
  max-height: 500px;
}

.widget-full {
  max-width: 100%;
  max-height: 600px;
}

.size-card {
  max-width: 350px;
  min-height: 200px;
}

.size-dashboard {
  max-width: 100%;
  min-height: 400px;
}
```

#### Theme Support
```css
.theme-light {
  --widget-bg: #ffffff;
  --widget-text: #1a1a1a;
  --widget-border: #e5e5e5;
}

.theme-dark {
  --widget-bg: #1a1a1a;
  --widget-text: #ffffff;
  --widget-border: #333333;
}

.theme-auto {
  /* Responds to prefers-color-scheme */
}
```

---

## 6. Technical Implementation

### 6.1 Widget Entry Point (`widget-entry.tsx`)
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { StatsWidget } from './components/widgets/StatsWidget';
import { ArraignmentsWidget } from './components/widgets/ArraignmentsWidget';

const root = document.getElementById('widget-root');
const widgetType = root?.getAttribute('data-widget');
const params = JSON.parse(root?.getAttribute('data-params') || '{}');

const renderWidget = () => {
  switch(widgetType) {
    case 'stats':
      return <StatsWidget {...params} />;
    case 'arraignments':
      return <ArraignmentsWidget {...params} />;
    default:
      return <div>Unknown widget type: {widgetType}</div>;
  }
};

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {renderWidget()}
    </React.StrictMode>
  );
}
```

### 6.2 PostMessage Communication

#### Widget to Parent
```typescript
useEffect(() => {
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
  }, 100);
  
  return () => clearTimeout(timer);
}, []);
```

#### Parent to Widget
```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    switch (event.data.type) {
      case 'WIDGET_RESIZE':
        // Handle resize request
        break;
      case 'WIDGET_REFRESH':
        // Trigger data refresh
        break;
      case 'WIDGET_GET_HEIGHT':
        // Send current height
        break;
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### 6.3 Router Context Handling

Widgets must work outside React Router context:

```typescript
// Safe hook for URL parameters
const useQueryParams = () => {
  try {
    const [searchParams] = useSearchParams();
    return searchParams;
  } catch {
    // Fallback for non-router context
    return new URLSearchParams(window.location.search);
  }
};
```

### 6.4 Data Fetching

```typescript
const fetchData = async () => {
  try {
    setLoading(true);
    const params = new URLSearchParams({
      court: config.court,
      date: getDate(),
      limit: config.limit.toString()
    });

    const response = await fetch(`/api/widgets/data/arraignments?${params}`, {
      headers: {
        'Accept': 'application/json',
        'X-Widget-Version': '1.0.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    setData(result.data);
  } catch (err) {
    setError('Failed to load data');
  } finally {
    setLoading(false);
  }
};
```

---

## 7. Security & Performance

### 7.1 Security Measures

#### Content Security Policy
```javascript
app.use('/widgets', (req, res, next) => {
  // Allow framing from specific origins
  const frameAncestors = process.env.FRAME_ANCESTORS || 
    "'self' http://localhost:* https://*.example.com";
  res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
  
  // Remove X-Frame-Options for widget routes
  res.removeHeader('X-Frame-Options');
  
  next();
});
```

#### Rate Limiting
```javascript
const widgetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each domain to 100 requests
  keyGenerator: (req) => {
    // Use referer domain as key
    const referer = req.get('referer');
    if (referer) {
      try {
        const url = new URL(referer);
        return url.hostname;
      } catch (e) {
        return req.ip;
      }
    }
    return req.ip;
  }
});

app.use('/api/widgets', widgetRateLimiter);
```

#### Data Sanitization
- No user input directly in SQL queries
- Parameterized queries prevent SQL injection
- HTML content escaped to prevent XSS
- Limited data exposure (no sensitive fields)

### 7.2 Performance Optimizations

#### Bundle Size
- Widget bundle: ~1KB (minimal overhead)
- Lazy loading of chart libraries
- Tree shaking removes unused code
- CSS-in-JS avoided for smaller size

#### Caching Strategy
```javascript
// API Response caching
res.set({
  'Cache-Control': 'public, max-age=300', // 5 minutes
  'ETag': generateETag(data)
});

// Browser caching for static assets
app.use('/assets', express.static('dist/assets', {
  maxAge: '1y',
  immutable: true
}));
```

#### Resource Loading
```html
<!-- Preload critical resources -->
<link rel="modulepreload" href="/assets/vendor.js">
<link rel="modulepreload" href="/assets/StatsWidget.js">

<!-- Async loading for non-critical -->
<script type="module" src="/assets/widget.js" async></script>
```

---

## 8. Usage & Embedding

### 8.1 Basic Embedding

#### Simple iframe
```html
<!-- Embed stats widget -->
<iframe 
  src="https://justicwatch.org/widgets/stats"
  width="600" 
  height="400"
  frameborder="0">
</iframe>
```

#### With Parameters
```html
<!-- Arraignments widget with options -->
<iframe 
  src="https://justicwatch.org/widgets/arraignments?court=maricopa&theme=dark&limit=5"
  width="100%" 
  height="500"
  frameborder="0">
</iframe>
```

### 8.2 Advanced Integration

#### Responsive Container
```html
<div class="widget-container" style="position: relative; padding-bottom: 56.25%; height: 0;">
  <iframe 
    src="https://justicwatch.org/widgets/stats?size=dashboard"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    frameborder="0">
  </iframe>
</div>
```

#### With PostMessage Handling
```javascript
// Parent page JavaScript
const iframe = document.querySelector('#justice-widget');

// Listen for widget messages
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://justicwatch.org') return;
  
  if (event.data.type === 'WIDGET_LOADED') {
    console.log('Widget loaded:', event.data.widgetId);
    
    // Adjust iframe height
    iframe.style.height = event.data.height + 'px';
  }
  
  if (event.data.type === 'WIDGET_RESIZED') {
    iframe.style.height = event.data.height + 'px';
  }
});

// Send messages to widget
function refreshWidget() {
  iframe.contentWindow.postMessage({
    type: 'WIDGET_REFRESH'
  }, 'https://justicwatch.org');
}
```

### 8.3 Widget Gallery

A showcase page demonstrates all widgets:

```typescript
// WidgetGallery.tsx
const WidgetGallery = () => {
  const [selectedWidget, setSelectedWidget] = useState('stats');
  const [config, setConfig] = useState({
    size: 'standard',
    theme: 'light',
    court: 'all'
  });
  
  const embedCode = `<iframe 
  src="${BASE_URL}/widgets/${selectedWidget}?${queryString}"
  width="600" height="400" frameborder="0">
</iframe>`;
  
  return (
    <div className="widget-gallery">
      <Configurator onConfigChange={setConfig} />
      <Preview widget={selectedWidget} config={config} />
      <CodeDisplay code={embedCode} />
    </div>
  );
};
```

---

## 9. API Endpoints

### 9.1 Widget Configuration
```
GET /api/widgets/config
```
Returns available widgets and their configurations:
```json
{
  "success": true,
  "data": {
    "availableWidgets": [
      {
        "id": "arraignments",
        "name": "Daily Arraignments",
        "description": "Shows upcoming arraignment hearings",
        "sizes": ["compact", "standard", "full"],
        "parameters": ["court", "date", "limit", "theme", "refresh"]
      }
    ],
    "courts": ["all", "maricopa", "pima", "coconino"],
    "themes": ["light", "dark", "auto"],
    "version": "1.0.0"
  }
}
```

### 9.2 Data Endpoints

#### Arraignments Data
```
GET /api/widgets/data/arraignments?court=maricopa&date=today&limit=10
```
Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "arr-001",
      "caseNumber": "CR-2024-001234",
      "defendantName": "John Doe",
      "court": "Maricopa Superior Court",
      "scheduledTime": "09:00 AM",
      "judge": "Smith, J."
    }
  ],
  "count": 10,
  "timestamp": "2025-08-16T18:00:00Z"
}
```

#### Statistics Data
```
GET /api/widgets/data/stats?court=all&period=week
```
Response:
```json
{
  "success": true,
  "data": {
    "totalCases": 1234,
    "activeCases": 456,
    "closedCases": 778,
    "todayHearings": 23,
    "trend": {
      "labels": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "values": [45, 52, 48, 61, 43]
    }
  }
}
```

### 9.3 Error Responses
```json
{
  "success": false,
  "error": "Invalid court parameter",
  "code": "INVALID_PARAM",
  "details": {
    "param": "court",
    "received": "invalid",
    "expected": ["all", "maricopa", "pima", "coconino"]
  }
}
```

---

## 10. Build & Deployment

### 10.1 Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access widgets locally
http://localhost:3001/widgets/stats
http://localhost:3001/widgets/arraignments
```

### 10.2 Production Build

```bash
# Build both bundles
npm run build

# Output structure
dist/
├── index.html              # Main app
├── widget.html            # Widget template
└── assets/
    ├── main.js            # Main app bundle (618KB)
    ├── widget.js          # Widget bundle (1KB)
    └── *.css              # Styles
```

### 10.3 Deployment Configuration

#### Environment Variables
```env
# Widget Configuration
WIDGET_ALLOWED_ORIGINS=https://news.example.com,https://gov.example.org
WIDGET_ALLOWED_PATTERNS=https://*.example.com
FRAME_ANCESTORS='self' https://*.trusted-site.com
WIDGET_RATE_LIMIT=100
WIDGET_CACHE_TTL=300

# API Configuration
API_BASE_URL=https://api.justicwatch.org
DATABASE_URL=postgresql://user:pass@localhost/justice_watch
```

#### Nginx Configuration
```nginx
# Widget routes
location /widgets/ {
    proxy_pass http://localhost:3001;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    
    # Allow framing for widgets
    add_header X-Frame-Options "";
    add_header Content-Security-Policy "frame-ancestors *;";
}

# Widget API with caching
location /api/widgets/ {
    proxy_pass http://localhost:3001;
    proxy_cache widget_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$request_uri$is_args$args";
    
    # CORS headers
    add_header Access-Control-Allow-Origin *;
}
```

### 10.4 Monitoring & Analytics

#### Widget Usage Tracking
```javascript
// Track widget loads
router.get('/widgets/:widgetType', (req, res) => {
  // Log widget access
  logger.info('Widget accessed', {
    type: req.params.widgetType,
    referer: req.get('referer'),
    params: req.query,
    ip: req.ip
  });
  
  // Increment metrics
  metrics.increment('widgets.loads', {
    widget: req.params.widgetType,
    domain: extractDomain(req.get('referer'))
  });
});
```

#### Performance Monitoring
```javascript
// Track API response times
router.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.histogram('api.response_time', duration, {
      endpoint: req.path,
      status: res.statusCode
    });
  });
  
  next();
});
```

### 10.5 Testing Strategy

#### Unit Tests (Jest)
```bash
npm run test
# Tests widget components in isolation
```

#### E2E Tests (Selenium)
```bash
python e2e-selenium/test_widgets_selenium.py
# Tests full widget embedding flow
```

#### Load Testing
```bash
# Test widget endpoint performance
ab -n 1000 -c 10 https://justicwatch.org/widgets/stats

# Test API endpoint
ab -n 1000 -c 10 https://justicwatch.org/api/widgets/data/stats
```

---

## 11. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Widget not loading | CORS blocking | Check Access-Control headers |
| No data displayed | API timeout | Increase timeout, check server logs |
| Styling broken | CSS not loaded | Verify widget.css is included |
| PostMessage not working | Origin mismatch | Check origin validation |
| Widget too large | No size constraint | Use size parameter |

### Debug Mode
```javascript
// Enable debug logging
const DEBUG = new URLSearchParams(window.location.search).has('debug');

if (DEBUG) {
  console.log('Widget config:', config);
  console.log('API response:', data);
  console.log('PostMessage sent:', message);
}
```

---

## 12. Future Enhancements

### Planned Features
1. **Authentication**: Optional API key for premium features
2. **Customization**: CSS variables for brand colors
3. **Webhooks**: Real-time updates via WebSocket
4. **Analytics Dashboard**: Widget usage statistics
5. **Widget Builder**: Visual configuration tool
6. **Mobile SDK**: Native mobile widget support
7. **Data Export**: CSV/PDF download options
8. **Localization**: Multi-language support

### API v2 Considerations
- GraphQL endpoint for flexible queries
- Batch data fetching
- Subscription support
- Field-level permissions
- Response compression

---

## Appendix A: Widget HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Justice Watch Widget</title>
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
    }
  </style>
</head>
<body>
  <div id="widget-root" 
       data-widget="{{WIDGET_TYPE}}" 
       data-params='{{WIDGET_PARAMS}}'>
  </div>
  <script>
    window.widgetConfig = {
      type: '{{WIDGET_TYPE}}',
      params: {{WIDGET_PARAMS_JSON}}
    };
  </script>
  <script type="module" src="/assets/widget.js"></script>
</body>
</html>
```

---

## Appendix B: Sample Embed Codes

### News Website Integration
```html
<!-- Breaking: Today's Arraignments -->
<div class="article-widget">
  <h3>Live Court Updates</h3>
  <iframe 
    src="https://justicwatch.org/widgets/arraignments?court=maricopa&limit=5&theme=auto"
    width="100%" 
    height="400"
    frameborder="0"
    title="Today's Arraignments">
  </iframe>
  <p class="caption">
    Data provided by Justice Watch. 
    <a href="https://justicwatch.org">View full details</a>
  </p>
</div>
```

### Government Portal
```html
<!-- Court Statistics Dashboard -->
<section class="court-stats">
  <iframe 
    src="https://justicwatch.org/widgets/stats?size=dashboard&period=month"
    width="100%" 
    height="600"
    frameborder="0"
    sandbox="allow-scripts allow-same-origin"
    title="Court Statistics">
  </iframe>
</section>
```

### Mobile App WebView
```javascript
// React Native WebView
<WebView
  source={{ uri: 'https://justicwatch.org/widgets/stats?size=card' }}
  style={{ height: 400 }}
  onMessage={(event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'WIDGET_LOADED') {
      console.log('Widget ready');
    }
  }}
/>
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-08-16  
**Maintainer:** Justice Watch Development Team  
**License:** MIT

---

END OF DOCUMENTATION