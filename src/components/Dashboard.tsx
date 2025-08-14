import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { courtCaseService, scrapingService } from '../services/api';
import { io, Socket } from 'socket.io-client';
import './Dashboard.css';

interface Case {
  id: number;
  case_number: string;
  case_title: string;
  case_type: string;
  filing_date: string;
  status: string;
  judge: string;
}

interface Statistics {
  total_cases: number;
  total_judges: number;
  open_cases: number;
  closed_cases: number;
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [scrapingStatus, setScrapingStatus] = useState('idle');
  const [scrapingProgress, setScrapingProgress] = useState<string>('');
  const [courtsProcessed, setCourtsProcessed] = useState(0);
  const [totalCourts, setTotalCourts] = useState(0);
  const [casesFound, setCasesFound] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    loadData();
    
    // Connect to WebSocket
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
    });
    
    newSocket.on('scraping-progress', (data) => {
      console.log('Progress update:', data);
      
      if (data.type === 'started') {
        setTotalCourts(data.totalCourts || 0);
        setScrapingProgress(data.message);
      } else if (data.type === 'court') {
        setCourtsProcessed(prev => prev + 1);
        setScrapingProgress(data.message);
      } else if (data.type === 'case_found') {
        setCasesFound(prev => prev + 1);
        setScrapingProgress(`Found: ${data.caseNumber} at ${data.court}`);
      } else if (data.type === 'case_saved') {
        setScrapingProgress(`Saved: ${data.caseNumber}`);
      } else if (data.type === 'completed') {
        setScrapingStatus('idle');
        setScrapingProgress(data.message);
        setTimeout(() => {
          loadData();
          setScrapingProgress('');
          setCourtsProcessed(0);
          setTotalCourts(0);
          setCasesFound(0);
        }, 3000);
      } else if (data.type === 'error') {
        setScrapingStatus('error');
        setScrapingProgress(`Error: ${data.message}`);
      } else {
        setScrapingProgress(data.message);
      }
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);

  const loadData = async () => {
    try {
      const [casesRes, statsRes] = await Promise.all([
        courtCaseService.getCases(),
        courtCaseService.getStatistics()
      ]);
      setCases(casesRes.data.cases || []);
      setStatistics(statsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      loadData();
      return;
    }
    setLoading(true);
    try {
      const res = await courtCaseService.searchCases(searchTerm);
      setCases(res.data.cases || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartArraignmentScraping = async () => {
    try {
      setScrapingStatus('running');
      // This calls the endpoint that ONLY scrapes "Arraignment Hearing - Long Form" cases
      const response = await fetch('/api/scraping/arraignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          courtId: 'all',  // Scrape all courts
          dateRangeDays: 30  // Look ahead 30 days
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Arraignment scraping started:', data.message);
        // Don't reset status here - wait for WebSocket completion
        setCourtsProcessed(0);
        setTotalCourts(0);
        setCasesFound(0);
        setScrapingProgress('Starting scraper...');
      } else {
        setScrapingStatus('error');
        setScrapingProgress('Failed to start scraping');
      }
    } catch (error) {
      console.error('Arraignment scraping error:', error);
      setScrapingStatus('error');
    }
  };

  const handleStopScraping = async () => {
    try {
      await scrapingService.stop();
      setScrapingStatus('idle');
    } catch (error) {
      console.error('Stop scraping error:', error);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await courtCaseService.exportCSV(cases);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'court_cases.csv';
      a.click();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Justice Watch - Arraignment Monitor</h1>
        <div className="header-actions">
          <span>Welcome, {user?.name || user?.email}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      {statistics && (
        <div className="statistics">
          <div className="stat-card">
            <h3>Total Cases</h3>
            <p>{statistics.total_cases}</p>
          </div>
          <div className="stat-card">
            <h3>Open Cases</h3>
            <p>{statistics.open_cases}</p>
          </div>
          <div className="stat-card">
            <h3>Closed Cases</h3>
            <p>{statistics.closed_cases}</p>
          </div>
          <div className="stat-card">
            <h3>Total Judges</h3>
            <p>{statistics.total_judges}</p>
          </div>
        </div>
      )}

      <div className="controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search cases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>Search</button>
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={handleStartArraignmentScraping} 
            disabled={scrapingStatus === 'running'}
            className="primary-btn arraignment-btn"
            title="Scrapes ONLY 'Arraignment Hearing - Long Form' cases from all Maricopa County Justice Courts"
          >
            {scrapingStatus === 'running' ? 'Scraping Arraignments...' : 'Start Scraping'}
          </button>
          {scrapingStatus === 'running' && (
            <button 
              onClick={handleStopScraping}
              className="stop-btn"
            >
              Stop Scraping
            </button>
          )}
          <button onClick={handleExportCSV}>Export CSV</button>
        </div>
        
        {/* Progress Display */}
        {scrapingProgress && (
          <div className="scraping-progress">
            <div className="progress-text">{scrapingProgress}</div>
            {totalCourts > 0 && (
              <div className="progress-stats">
                Courts: {courtsProcessed}/{totalCourts} | Cases Found: {casesFound}
              </div>
            )}
            {scrapingStatus === 'running' && (
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${totalCourts > 0 ? (courtsProcessed / totalCourts) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cases-table">
        <table>
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Title</th>
              <th>Type</th>
              <th>Filing Date</th>
              <th>Status</th>
              <th>Judge</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-data">No cases found</td>
              </tr>
            ) : (
              cases.map((case_) => (
                <tr key={case_.id}>
                  <td>{case_.case_number}</td>
                  <td>{case_.case_title}</td>
                  <td>{case_.case_type}</td>
                  <td>{new Date(case_.filing_date).toLocaleDateString()}</td>
                  <td>{case_.status}</td>
                  <td>{case_.judge}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;