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
  court_name?: string;
  location?: string;
  parties?: string;
  docket_entries?: string;
  events?: string;
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
    
    // Poll for new data every 30 seconds when not scraping
    const pollInterval = setInterval(() => {
      if (scrapingStatus === 'idle') {
        loadData();
      }
    }, 30000);
    
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
        setScrapingStatus('completed');
        setScrapingProgress(data.message);
        // Auto-refresh data immediately when scraping completes
        loadData();
        // Show success message for 5 seconds
        setTimeout(() => {
          setScrapingStatus('idle');
          setScrapingProgress('');
          setCourtsProcessed(0);
          setTotalCourts(0);
          setCasesFound(0);
        }, 5000);
      } else if (data.type === 'error') {
        setScrapingStatus('error');
        setScrapingProgress(`Error: ${data.message}`);
      } else {
        setScrapingProgress(data.message);
      }
    });
    
    setSocket(newSocket);
    
    return () => {
      clearInterval(pollInterval);
      newSocket.close();
    };
  }, []);

  const loadData = async () => {
    try {
      const [casesRes, statsRes] = await Promise.all([
        courtCaseService.getCases(),
        courtCaseService.getStatistics()
      ]);
      // Log to debug
      console.log('Loaded cases:', casesRes.data);
      console.log('Loaded stats:', statsRes.data);
      
      setCases(casesRes.data.cases || []);
      setStatistics(statsRes.data);
      
      // If we just completed scraping and got new data, show a notification
      if (scrapingStatus === 'completed' && casesRes.data.cases?.length > 0) {
        const newCasesCount = casesRes.data.cases.length - cases.length;
        if (newCasesCount > 0) {
          setScrapingProgress(`✓ Added ${newCasesCount} new cases to database!`);
        }
      }
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
            className={`primary-btn arraignment-btn ${scrapingStatus === 'completed' ? 'success' : ''}`}
            title="Scrapes ONLY 'Arraignment Hearing - Long Form' cases from all Maricopa County Justice Courts"
          >
            {scrapingStatus === 'running' ? 'Scraping Arraignments...' : 
             scrapingStatus === 'completed' ? '✓ Scraping Complete!' : 'Start Scraping'}
          </button>
          {scrapingStatus === 'running' && (
            <button 
              onClick={handleStopScraping}
              className="stop-btn"
            >
              Stop Scraping
            </button>
          )}
          <button onClick={loadData} className="refresh-btn" title="Refresh data from database">
            🔄 Refresh
          </button>
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
              <th>Court</th>
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
                <td colSpan={7} className="no-data">
                  {scrapingStatus === 'idle' ? 'No cases found. Click "Start Scraping" to fetch arraignment cases.' : 'Loading cases...'}
                </td>
              </tr>
            ) : (
              cases.map((case_) => (
                <tr key={case_.id}>
                  <td>{case_.case_number}</td>
                  <td>{case_.court_name?.replace(' Justice Court', '') || 'Unknown'}</td>
                  <td>{case_.case_title || 'No Title'}</td>
                  <td>{case_.case_type || 'Criminal'}</td>
                  <td>{case_.filing_date ? new Date(case_.filing_date).toLocaleDateString() : 'N/A'}</td>
                  <td>{case_.status || 'Active'}</td>
                  <td>{case_.judge || 'N/A'}</td>
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