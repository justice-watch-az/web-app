import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CasesDashboard from './components/CasesDashboard';
import { ScheduleManager } from './components/ScheduleManager';
import { ScheduleManagerDebug } from './components/ScheduleManagerDebug';
import { ScheduleManagerSimple } from './components/ScheduleManagerSimple';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/cases" element={<CasesDashboard />} />
        <Route path="/scheduler" element={<ScheduleManager />} />
        <Route path="/scheduler-debug" element={<ScheduleManagerDebug />} />
        <Route path="/scheduler-simple" element={<ScheduleManagerSimple />} />
        <Route path="/" element={<Navigate to="/cases" />} />
      </Routes>
    </Router>
  );
}

export default App;