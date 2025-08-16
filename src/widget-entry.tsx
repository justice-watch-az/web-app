import React from 'react';
import ReactDOM from 'react-dom/client';
import { StatsWidget } from './components/widgets/StatsWidget';
import { ArraignmentsWidget } from './components/widgets/ArraignmentsWidget';
import './components/widgets/widget-styles.css';

// Get widget configuration
const root = document.getElementById('widget-root');
const widgetType = root?.getAttribute('data-widget');
const params = JSON.parse(root?.getAttribute('data-params') || '{}');

// Render the appropriate widget
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

// Mount the widget
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {renderWidget()}
    </React.StrictMode>
  );
}