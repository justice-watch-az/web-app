import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

interface CaseSummary {
  id: number;
  case_number: string;
  court_id: string;
  court_name: string;
  case_title: string;
  case_type: string;
  case_status: string;
  filing_date: string;
  judge: string;
  location: string;
  case_url: string;
  scraped_at: string;
  updated_at: string;
  next_hearing: string;
  parties: any;
  docket_entries: any;
  events: any;
  documents: any;
}

interface Statistics {
  summary: {
    total_cases: string;
    total_courts: string;
    upcoming_hearings: string;
  };
  courtDistribution: Array<{
    court_name: string;
    case_count: string;
  }>;
}

function CasesDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseSummary | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrapingStatus, setScrapingStatus] = useState('idle');
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [casesRes, statsRes] = await Promise.all([
        fetch('/api/cases/all'),
        fetch('/api/cases/stats/summary')
      ]);
      
      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData);
      }
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartScraping = async () => {
    try {
      setScrapingStatus('running');
      const response = await fetch('/api/scraping/arraignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          courtId: 'all',
          dateRangeDays: 30
        })
      });
      
      if (response.ok) {
        setTimeout(() => {
          setScrapingStatus('completed');
          loadData(); // Refresh data
          setTimeout(() => setScrapingStatus('idle'), 3000);
        }, 5000);
      } else {
        setScrapingStatus('idle');
      }
    } catch (error) {
      console.error('Error starting scraping:', error);
      setScrapingStatus('idle');
    }
  };

  const loadCaseDetails = async (caseData: CaseSummary) => {
    try {
      // For now, just show the case data we already have
      setSelectedCase(caseData);
    } catch (error) {
      console.error('Error loading case details:', error);
    }
  };

  const closeModal = () => {
    setSelectedCase(null);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateHeader = (dateStr: string) => {
    if (!dateStr) return 'No Date';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Group cases by next_hearing date
  const groupedCases = cases.reduce((groups, case_) => {
    const date = case_.next_hearing || 'no-date';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(case_);
    return groups;
  }, {} as Record<string, CaseSummary[]>);

  // Sort dates
  const sortedDates = Object.keys(groupedCases).sort((a, b) => {
    if (a === 'no-date') return 1;
    if (b === 'no-date') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Justice Watch - Arraignment Monitor</h1>
        <div className="header-actions">
          <span>Welcome, {user?.name || user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      {/* Stats Bar */}
      {statistics && (
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{statistics.summary.total_cases}</div>
            <div className="stat-label">Total Cases</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{statistics.summary.total_courts}</div>
            <div className="stat-label">Courts Active</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{statistics.summary.upcoming_hearings}</div>
            <div className="stat-label">Upcoming Hearings</div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="action-bar">
        <button 
          onClick={handleStartScraping} 
          disabled={scrapingStatus === 'running'}
          className={`scraping-btn ${scrapingStatus}`}
        >
          {scrapingStatus === 'running' ? '⏳ Scraping...' : 
           scrapingStatus === 'completed' ? '✓ Complete!' : 
           '🔍 Start Scraping'}
        </button>
        <button onClick={loadData} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {/* Cases Grid */}
      <div className="cases-container">
        {sortedDates.map(date => (
          <div key={date} className="date-group">
            <h2 className="date-header">
              {date === 'no-date' ? 'No Hearing Scheduled' : formatDateHeader(date)}
            </h2>
            <div className="cases-grid">
              {groupedCases[date].map(case_ => (
                <div key={case_.id} className="case-card" onClick={() => loadCaseDetails(case_)}>
                  <div className="case-card-header">
                    <span className="case-number">{case_.case_number}</span>
                    <span className="case-status">{case_.case_status}</span>
                  </div>
                  <div className="case-card-body">
                    <div className="case-title">{case_.case_title}</div>
                    <div className="case-info">
                      <div className="info-item">
                        <span className="label">Court:</span>
                        <span className="value">{case_.court_name}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Judge:</span>
                        <span className="value">{case_.judge || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Type:</span>
                        <span className="value">{case_.case_type}</span>
                      </div>
                      {case_.next_hearing && (
                        <div className="info-item hearing-date">
                          <span className="label">Hearing:</span>
                          <span className="value">{formatDate(case_.next_hearing)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="case-card-footer">
                    <button className="view-details-btn">View Details →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Case Details Modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>×</button>
            <h2>Case Details</h2>
            
            <div className="modal-section">
              <h3>Case Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">Case Number:</span>
                  <span className="value">{selectedCase.case_number}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Title:</span>
                  <span className="value">{selectedCase.case_title}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Type:</span>
                  <span className="value">{selectedCase.case_type}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Status:</span>
                  <span className="value">{selectedCase.case_status}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Court:</span>
                  <span className="value">{selectedCase.court_name}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Judge:</span>
                  <span className="value">{selectedCase.judge || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Filing Date:</span>
                  <span className="value">{formatDate(selectedCase.filing_date)}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Next Hearing:</span>
                  <span className="value">{formatDate(selectedCase.next_hearing)}</span>
                </div>
              </div>
            </div>

            {selectedCase.parties && (
              <div className="modal-section">
                <h3>Parties</h3>
                <div className="parties-content">
                  {(() => {
                    try {
                      const parties = typeof selectedCase.parties === 'string' 
                        ? JSON.parse(selectedCase.parties) 
                        : selectedCase.parties;
                      
                      return (
                        <div className="parties-list">
                          {parties.plaintiff && (
                            <div className="party-item">
                              <strong>Plaintiff:</strong> {parties.plaintiff.party_name}
                              {parties.plaintiff.attorney && (
                                <div className="attorney">Attorney: {parties.plaintiff.attorney}</div>
                              )}
                            </div>
                          )}
                          {parties.defendant && (
                            <div className="party-item">
                              <strong>Defendant:</strong> {parties.defendant.party_name}
                              {parties.defendant.attorney && (
                                <div className="attorney">Attorney: {parties.defendant.attorney}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    } catch (e) {
                      return <div>No party information available</div>;
                    }
                  })()}
                </div>
              </div>
            )}

            {selectedCase.docket_entries && (
              <div className="modal-section">
                <h3>Docket Entries & Charges</h3>
                <div className="docket-content">
                  {(() => {
                    try {
                      const docket = typeof selectedCase.docket_entries === 'string' 
                        ? JSON.parse(selectedCase.docket_entries) 
                        : selectedCase.docket_entries;
                      
                      if (!Array.isArray(docket)) return <div>No docket entries available</div>;
                      
                      const charges = docket.filter(d => d.type === 'charge');
                      const hearings = docket.filter(d => d.type === 'calendar');
                      
                      return (
                        <>
                          {charges.length > 0 && (
                            <div className="charges-list">
                              <h4>Charges:</h4>
                              {charges.map((charge, idx) => (
                                <div key={idx} className="charge-item">
                                  <strong>{charge.ars_code}</strong> - {charge.description}
                                </div>
                              ))}
                            </div>
                          )}
                          {hearings.length > 0 && (
                            <div className="hearings-list">
                              <h4>Scheduled Hearings:</h4>
                              {hearings.map((hearing, idx) => (
                                <div key={idx} className="hearing-item">
                                  {hearing.date} at {hearing.time} - {hearing.description}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    } catch (e) {
                      return <div>No docket information available</div>;
                    }
                  })()}
                </div>
              </div>
            )}

            {selectedCase.case_url && (
              <div className="modal-section">
                <a href={selectedCase.case_url} target="_blank" rel="noopener noreferrer" className="case-link">
                  View on Court Website →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CasesDashboard;