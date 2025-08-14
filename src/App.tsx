import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CasesDashboard from './components/CasesDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/cases" element={<CasesDashboard />} />
        <Route path="/" element={<Navigate to="/cases" />} />
      </Routes>
    </Router>
  );
}

export default App;