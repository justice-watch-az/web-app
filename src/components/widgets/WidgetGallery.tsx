import React, { useState } from 'react';
import './widget-gallery.css';

interface WidgetConfig {
  size: string;
  theme: string;
  court: string;
  date?: string;
  period?: string;
  limit?: string;
  refresh?: string;
  hideHeader?: boolean;
}

export const WidgetGallery: React.FC = () => {
  const [selectedWidget, setSelectedWidget] = useState('arraignments');
  const [config, setConfig] = useState<WidgetConfig>({
    size: 'standard',
    theme: 'light',
    court: 'all',
    limit: '10'
  });

  const baseUrl = process.env.REACT_APP_WIDGET_URL || window.location.origin;

  const getWidgetDimensions = () => {
    const dimensions: Record<string, { width: string | number; height: number }> = {
      compact: { width: 300, height: 400 },
      standard: { width: 600, height: 500 },
      full: { width: '100%', height: 600 },
      card: { width: 400, height: 300 },
      dashboard: { width: '100%', height: 400 },
      mini: { width: 350, height: 250 },
      inline: { width: '100%', height: 80 },
      modal: { width: 800, height: 600 }
    };
    return dimensions[config.size] || dimensions.standard;
  };

  const generateEmbedCode = () => {
    const params = new URLSearchParams();
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });
    
    const url = `${baseUrl}/widgets/${selectedWidget}?${params.toString()}`;
    const dimensions = getWidgetDimensions();
    
    return `<!-- Justice Watch ${selectedWidget} Widget -->
<iframe
  src="${url}"
  width="${dimensions.width}"
  height="${dimensions.height}"
  frameborder="0"
  title="Justice Watch ${selectedWidget}"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
></iframe>

<!-- Optional: Responsive sizing -->
<script>
  (function() {
    const iframe = document.querySelector('iframe[src*="justicewatch"]');
    window.addEventListener('message', function(e) {
      if (e.origin !== '${baseUrl}') return;
      if (e.data.type === 'WIDGET_LOADED' || e.data.type === 'WIDGET_RESIZED') {
        iframe.style.height = e.data.height + 'px';
      }
    });
  })();
</script>`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateEmbedCode());
    alert('Embed code copied to clipboard!');
  };

  return (
    <div className="widget-gallery">
      <div className="gallery-header">
        <h1>Justice Watch Embeddable Widgets</h1>
        <p>Integrate real-time court data into your website with our embeddable widgets</p>
      </div>

      <div className="gallery-content">
        <div className="configurator-section widget-configurator">
          <h2>Configure Your Widget</h2>
          
          <div className="config-group">
            <label htmlFor="widget-type">Widget Type:</label>
            <select 
              id="widget-type"
              value={selectedWidget} 
              onChange={(e) => setSelectedWidget(e.target.value)}
            >
              <option value="arraignments">Daily Arraignments</option>
              <option value="search">Case Search</option>
              <option value="calendar">Court Calendar</option>
              <option value="stats">Statistics Dashboard</option>
            </select>
          </div>

          <div className="config-group">
            <label htmlFor="widget-size">Size:</label>
            <select 
              id="widget-size"
              value={config.size} 
              onChange={(e) => setConfig({...config, size: e.target.value})}
            >
              {selectedWidget === 'arraignments' && (
                <>
                  <option value="compact">Compact (300x400)</option>
                  <option value="standard">Standard (600x500)</option>
                  <option value="full">Full Width (100%x600)</option>
                </>
              )}
              {selectedWidget === 'stats' && (
                <>
                  <option value="card">Card (400x300)</option>
                  <option value="dashboard">Dashboard (100%x400)</option>
                </>
              )}
              {selectedWidget === 'calendar' && (
                <>
                  <option value="mini">Mini (350x250)</option>
                  <option value="standard">Standard (700x500)</option>
                </>
              )}
              {selectedWidget === 'search' && (
                <>
                  <option value="inline">Inline (100%x80)</option>
                  <option value="modal">Modal (800x600)</option>
                </>
              )}
            </select>
          </div>

          <div className="config-group">
            <label htmlFor="widget-theme">Theme:</label>
            <select 
              id="widget-theme"
              value={config.theme} 
              onChange={(e) => setConfig({...config, theme: e.target.value})}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div className="config-group">
            <label htmlFor="widget-court">Court:</label>
            <select 
              id="widget-court"
              value={config.court} 
              onChange={(e) => setConfig({...config, court: e.target.value})}
            >
              <option value="all">All Courts</option>
              <option value="maricopa">Maricopa County</option>
              <option value="pima">Pima County</option>
              <option value="coconino">Coconino County</option>
            </select>
          </div>

          {selectedWidget === 'arraignments' && (
            <>
              <div className="config-group">
                <label htmlFor="widget-date">Date:</label>
                <select 
                  id="widget-date"
                  value={config.date || 'today'} 
                  onChange={(e) => setConfig({...config, date: e.target.value})}
                >
                  <option value="today">Today</option>
                  <option value="tomorrow">Tomorrow</option>
                </select>
              </div>

              <div className="config-group">
                <label htmlFor="widget-limit">Max Items:</label>
                <input 
                  id="widget-limit"
                  type="number" 
                  min="1" 
                  max="50"
                  value={config.limit} 
                  onChange={(e) => setConfig({...config, limit: e.target.value})}
                />
              </div>

              <div className="config-group">
                <label htmlFor="widget-refresh">Auto-refresh (ms):</label>
                <input 
                  id="widget-refresh"
                  type="number" 
                  min="0" 
                  step="1000"
                  placeholder="0 = disabled"
                  value={config.refresh || ''} 
                  onChange={(e) => setConfig({...config, refresh: e.target.value})}
                />
              </div>
            </>
          )}

          {selectedWidget === 'stats' && (
            <div className="config-group">
              <label htmlFor="widget-period">Period:</label>
              <select 
                id="widget-period"
                value={config.period || '7d'} 
                onChange={(e) => setConfig({...config, period: e.target.value})}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          )}

          <div className="config-group">
            <label>
              <input 
                type="checkbox" 
                checked={config.hideHeader || false}
                onChange={(e) => setConfig({...config, hideHeader: e.target.checked})}
              />
              Hide header
            </label>
          </div>
        </div>

        <div className="preview-section">
          <h2>Preview</h2>
          <div className="preview-container">
            <iframe
              src={`/widgets/${selectedWidget}?${new URLSearchParams(
                Object.entries(config).reduce((acc, [key, value]) => {
                  if (value !== undefined && value !== '') {
                    acc[key] = value.toString();
                  }
                  return acc;
                }, {} as Record<string, string>)
              )}`}
              width={getWidgetDimensions().width}
              height={getWidgetDimensions().height}
              frameBorder="0"
              title="Widget Preview"
              className="preview-iframe"
            />
          </div>
        </div>
      </div>

      <div className="embed-section">
        <h2>Embed Code</h2>
        <div className="code-container">
          <pre className="embed-code">{generateEmbedCode()}</pre>
          <button onClick={copyToClipboard} className="copy-button">
            📋 Copy to Clipboard
          </button>
        </div>
      </div>

      <div className="documentation-section">
        <h2>Integration Guide</h2>
        <ol>
          <li>Choose your widget type and configure options above</li>
          <li>Preview the widget to ensure it looks correct</li>
          <li>Copy the embed code using the button above</li>
          <li>Paste the code into your website's HTML where you want the widget to appear</li>
          <li>Optional: Include the responsive sizing script for dynamic height adjustment</li>
        </ol>

        <h3>URL Parameters Reference</h3>
        <table className="params-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Options</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>size</td>
              <td>compact, standard, full, card, dashboard, mini, inline, modal</td>
              <td>Widget dimensions (varies by widget type)</td>
            </tr>
            <tr>
              <td>theme</td>
              <td>light, dark, auto</td>
              <td>Color scheme for the widget</td>
            </tr>
            <tr>
              <td>court</td>
              <td>all, maricopa, pima, coconino</td>
              <td>Filter by specific court</td>
            </tr>
            <tr>
              <td>date</td>
              <td>today, tomorrow, YYYY-MM-DD</td>
              <td>Date filter (arraignments widget)</td>
            </tr>
            <tr>
              <td>period</td>
              <td>24h, 7d, 30d</td>
              <td>Time period (statistics widget)</td>
            </tr>
            <tr>
              <td>limit</td>
              <td>1-50</td>
              <td>Maximum number of items to display</td>
            </tr>
            <tr>
              <td>refresh</td>
              <td>milliseconds</td>
              <td>Auto-refresh interval (0 = disabled)</td>
            </tr>
            <tr>
              <td>hideHeader</td>
              <td>true, false</td>
              <td>Hide the widget header</td>
            </tr>
          </tbody>
        </table>

        <h3>Security Notes</h3>
        <ul>
          <li>Widgets are sandboxed using iframe security attributes</li>
          <li>Cross-origin communication uses postMessage API</li>
          <li>Rate limiting is applied per embedding domain</li>
          <li>CORS headers restrict widget access to allowed origins</li>
        </ul>
      </div>
    </div>
  );
};