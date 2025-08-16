import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ArraignmentsWidget } from '../components/widgets/ArraignmentsWidget';
import { StatsWidget } from '../components/widgets/StatsWidget';
import { WidgetGallery } from '../components/widgets/WidgetGallery';

// Placeholder components for other widgets
const CaseSearchWidget: React.FC = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3>Case Search Widget</h3>
      <p>Coming soon...</p>
    </div>
  );
};

const CalendarWidget: React.FC = () => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3>Court Calendar Widget</h3>
      <p>Coming soon...</p>
    </div>
  );
};

export const WidgetRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/arraignments" element={<ArraignmentsWidget />} />
      <Route path="/stats" element={<StatsWidget />} />
      <Route path="/search" element={<CaseSearchWidget />} />
      <Route path="/calendar" element={<CalendarWidget />} />
      <Route path="/gallery" element={<WidgetGallery />} />
    </Routes>
  );
};