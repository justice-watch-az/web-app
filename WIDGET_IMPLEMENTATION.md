# Justice Watch Embeddable Widgets Implementation

## Overview
Successfully implemented a comprehensive embeddable widget system for the Justice Watch application, allowing third-party websites to integrate court data displays via iframes.

## Implementation Summary

### 1. Server-Side Configuration (✅ Completed)

#### CORS & CSP Headers
- **File**: `server/index.js`
- Enhanced CORS configuration with domain-specific handling
- CSP headers with `frame-ancestors` directive for iframe embedding
- Widget-specific rate limiting based on referer domain
- Custom headers including `X-Widget-Version`

#### Widget API Routes
- **File**: `server/routes/widgets.js`
- `/api/widgets/data/arraignments` - Arraignment data endpoint
- `/api/widgets/data/stats` - Statistics data endpoint
- `/api/widgets/data/calendar` - Calendar data endpoint
- `/api/widgets/config` - Widget configuration endpoint

### 2. React Widget Components (✅ Completed)

#### Base Widget Component
- **File**: `src/components/widgets/WidgetBase.tsx`
- PostMessage API for parent-frame communication
- Error boundaries for graceful failure handling
- ResizeObserver for dynamic sizing
- Theme switching support
- Loading states and error handling

#### Widget Implementations
- **ArraignmentsWidget** (`src/components/widgets/ArraignmentsWidget.tsx`)
  - URL parameter parsing for customization
  - Three size variants: compact, standard, full
  - Auto-refresh capability
  - Court and date filtering

- **StatsWidget** (`src/components/widgets/StatsWidget.tsx`)
  - Card and dashboard views
  - Daily activity charts
  - Period-based filtering

#### Widget Gallery
- **File**: `src/components/widgets/WidgetGallery.tsx`
- Interactive widget configurator
- Live preview
- Embed code generator
- Comprehensive documentation

### 3. Styling (✅ Completed)

#### Widget Styles
- **File**: `src/components/widgets/widget-styles.css`
- Theme variants (light, dark, auto)
- Size variants (compact, standard, full)
- Responsive design
- Print-friendly styles
- Accessibility features

#### Gallery Styles
- **File**: `src/components/widgets/widget-gallery.css`
- Professional gallery layout
- Configuration interface
- Code display formatting

### 4. Routing (✅ Completed)

- **File**: `src/routes/WidgetRoutes.tsx`
- Widget-specific routes under `/widgets/*`
- Integration with main app routing

### 5. Testing (✅ Completed)

- **File**: `test-widgets.html`
- Comprehensive widget embedding test page
- CORS validation
- PostMessage communication testing
- Auto-resize functionality testing

## Key Features Implemented

### Security
- ✅ CORS headers with domain whitelisting
- ✅ CSP frame-ancestors for controlled embedding
- ✅ Domain-based rate limiting
- ✅ Sandbox attributes on iframes
- ✅ Origin validation for postMessage

### Customization
- ✅ URL parameter parsing
- ✅ Multiple size options (compact, standard, full, card, dashboard)
- ✅ Theme support (light, dark, auto)
- ✅ Court filtering
- ✅ Date/period selection
- ✅ Auto-refresh intervals
- ✅ Header visibility toggle

### Communication
- ✅ PostMessage API for parent-child communication
- ✅ Widget loaded notifications
- ✅ Dynamic height adjustments
- ✅ Theme updates via messages
- ✅ Refresh commands

### Developer Experience
- ✅ Widget gallery with live preview
- ✅ Embed code generator
- ✅ Copy to clipboard functionality
- ✅ Comprehensive documentation
- ✅ URL parameter reference
- ✅ Integration guide

## Usage Examples

### Basic Embed
```html
<iframe
  src="https://justicewatch.org/widgets/arraignments?size=compact&theme=light"
  width="300"
  height="400"
  frameborder="0"
  title="Justice Watch Arraignments"
></iframe>
```

### With Auto-Resize
```html
<iframe id="jw-widget" src="..."></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.origin !== 'https://justicewatch.org') return;
  if (e.data.type === 'WIDGET_RESIZED') {
    document.getElementById('jw-widget').style.height = e.data.height + 'px';
  }
});
</script>
```

### URL Parameters
- `size`: compact, standard, full
- `theme`: light, dark, auto
- `court`: all, maricopa, pima, coconino
- `date`: today, tomorrow, YYYY-MM-DD
- `limit`: 1-50
- `refresh`: milliseconds (0 = disabled)
- `hideHeader`: true/false

## File Structure
```
justice-watch-app/
├── server/
│   ├── index.js                    # CORS & CSP configuration
│   └── routes/
│       └── widgets.js               # Widget API endpoints
├── src/
│   ├── components/
│   │   └── widgets/
│   │       ├── WidgetBase.tsx      # Base widget component
│   │       ├── ArraignmentsWidget.tsx
│   │       ├── StatsWidget.tsx
│   │       ├── WidgetGallery.tsx
│   │       ├── widget-styles.css
│   │       └── widget-gallery.css
│   └── routes/
│       └── WidgetRoutes.tsx        # Widget routing
└── test-widgets.html                # Testing page
```

## Environment Variables

Add to `.env`:
```bash
# Widget Configuration
WIDGET_ALLOWED_ORIGINS=https://example.com,https://news-site.com
WIDGET_ALLOWED_PATTERNS=*.trusted-domain.com
FRAME_ANCESTORS='self' https://*.example.com
REACT_APP_WIDGET_URL=https://widgets.justicewatch.org
REACT_APP_MAIN_URL=https://justicewatch.org
```

## Next Steps

1. **Additional Widgets**
   - Case Search Widget
   - Court Calendar Widget
   - Judge Schedule Widget

2. **Enhanced Features**
   - Widget analytics tracking
   - Custom branding options
   - API key authentication for premium features
   - Webhook notifications

3. **Performance**
   - CDN distribution
   - Widget bundle optimization
   - Caching strategies

4. **Documentation**
   - API documentation
   - Integration tutorials
   - Example implementations

## Testing Checklist

- [x] CORS headers properly configured
- [x] CSP frame-ancestors allows embedding
- [x] Widgets load in iframes
- [x] PostMessage communication works
- [x] Auto-resize functionality
- [x] Theme switching
- [x] URL parameter parsing
- [x] Rate limiting per domain
- [x] Error boundaries handle failures
- [x] Responsive design works

## Deployment Notes

1. Update environment variables for production domains
2. Configure CDN for widget static assets
3. Set up monitoring for widget usage
4. Enable analytics tracking
5. Configure rate limits based on expected traffic

## Support

For integration support or issues:
- Documentation: `/widgets/gallery`
- API Status: `/api/widgets/config`
- Test Page: `test-widgets.html`