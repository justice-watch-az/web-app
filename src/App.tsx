import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import CasesDashboardV3 from './components/CasesDashboardV3';
import ScrapeStatus from './components/ScrapeStatus';
import BookingsDashboard from './components/BookingsDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="app-nav">
          <h1>Justice Watch v3.4.1</h1>
          <div className="nav-links">
            <NavLink to="/cases" className={({ isActive }) => (isActive ? 'active' : undefined)}>
              Cases
            </NavLink>
            <NavLink to="/bookings" className={({ isActive }) => (isActive ? 'active' : undefined)}>
              Bookings
            </NavLink>
            <NavLink to="/status" className={({ isActive }) => (isActive ? 'active' : undefined)}>
              Scrape Status
            </NavLink>
          </div>
        </nav>
        <main className="app-main">
          <Routes>
            <Route path="/cases" element={<CasesDashboardV3 />} />
            <Route path="/bookings" element={<BookingsDashboard />} />
            <Route path="/status" element={<ScrapeStatus />} />
            <Route path="/" element={<Navigate to="/cases" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
