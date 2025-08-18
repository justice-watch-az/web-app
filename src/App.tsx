import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CasesDashboardV3 from './components/CasesDashboardV3';
import ScrapeStatus from './components/ScrapeStatus';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="app-nav">
          <h1>Justice Watch v3</h1>
          <div className="nav-links">
            <a href="/cases">Cases</a>
            <a href="/status">Scrape Status</a>
          </div>
        </nav>
        <main className="app-main">
          <Routes>
            <Route path="/cases" element={<CasesDashboardV3 />} />
            <Route path="/status" element={<ScrapeStatus />} />
            <Route path="/" element={<Navigate to="/cases" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;