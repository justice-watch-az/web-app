import React, { useState, useEffect } from 'react';
import ScrapingProgress from './ScrapingProgress';
import './Dashboard.css';

interface CaseSummary {
  id: number;
  case_number: string;
  court_name: string;
  case_title: string;
  case_type: string;
  case_status: string;
  filing_date: string;
  judge: string;
  charge_count: number;
  party_count: number;
  next_hearing_date: string | null;
  next_hearing_type: string | null;
  scraped_at: string;
}

interface CaseDetail {
  id: number;
  case_number: string;
  court_name: string;
  case_title: string;
  case_type: string;
  case_status: string;
  filing_date: string;
  judge: string;
  parties: Party[];
  charges: Charge[];
  calendar: CalendarEntry[];
  documents: Document[];
  events: Event[];
  judgments: Judgment[];
}

interface Party {
  id: number;
  party_type: string;
  party_name: string;
  relationship: string;
  sex: string;
  attorney: string;
}

interface Charge {
  id: number;
  party_name: string;
  ars_code: string;
  description: string;
  crime_date: string;
  disposition_code: string | null;
  disposition_date: string | null;
  disposition: string | null;
  severity: string;
}

interface CalendarEntry {
  id: number;
  hearing_date: string;
  hearing_time: string;
  event_type: string;
  result: string;
  location: string;
}

interface Document {
  id: number;
  document_name: string;
  document_type: string;
  filed_date: string;
  filed_by: string;
}

interface Event {
  id: number;
  event_date: string;
  event_type: string;
  event_description: string;
}

interface Judgment {
  id: number;
  judgment_date: string;
  judgment_type: string;
  judgment_description: string;
}

interface Statistics {
  summary: {
    total_cases: string;
    total_charges: string;
    upcoming_hearings: string;
    total_courts: string;
    unique_charge_types: string;
    pending_charges: string;
  };
  topCharges: Array<{
    description: string;
    count: string;
    ars_code: string;
  }>;
  courtDistribution: Array<{
    court_name: string;
    case_count: string;
  }>;
}

function CasesDashboard() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [upcomingHearings, setUpcomingHearings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'hearings' | 'statistics'>('overview');
  const [scrapingStatus, setScrapingStatus] = useState('idle');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [casesRes, statsRes, hearingsRes] = await Promise.all([
        fetch('/api/cases/all'),
        fetch('/api/cases/stats/summary'),
        fetch('/api/cases/hearings/upcoming')
      ]);
      
      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData);
      }
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData);
      }
      
      if (hearingsRes.ok) {
        const hearingsData = await hearingsRes.json();
        setUpcomingHearings(hearingsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCaseDetails = async (caseNumber: string) => {
    try {
      const response = await fetch(`/api/cases/${caseNumber}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedCase(data);
      }
    } catch (error) {
      console.error('Error loading case details:', error);
    }
  };

  const handleStartScraping = async () => {
    try {
      setScrapingStatus('running');
      
      const response = await fetch('/api/scraping/arraignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courtId: 'all',
          dateRangeDays: 30
        })
      });
      
      if (response.ok) {
        console.log('Scraping started');
        // Reload data after 10 seconds
        setTimeout(() => {
          loadData();
          setScrapingStatus('idle');
        }, 10000);
      } else {
        setScrapingStatus('error');
        console.error('Scraping failed:', response.status);
      }
    } catch (error) {
      console.error('Scraping error:', error);
      setScrapingStatus('error');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5); // HH:MM
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>⚖️ Justice Watch - Court Case Monitor</h1>
        <div className="header-actions">
          <button 
            onClick={handleStartScraping}
            disabled={scrapingStatus === 'running'}
            className={`scrape-btn ${scrapingStatus === 'running' ? 'scraping' : ''}`}
          >
            {scrapingStatus === 'running' ? (
              <>
                <span className="spinner"></span>
                <span>Scraping Courts...</span>
              </>
            ) : (
              <>
                <span className="pulse-dot"></span>
                <span className="btn-icon">🔍</span>
                <span className="btn-text">
                  <span className="btn-main">SCRAPE ARRAIGNMENTS</span>
                  <span className="btn-sub">26 Justice Courts</span>
                </span>
              </>
            )}
          </button>
          <button onClick={loadData} className="refresh-btn">↻ Refresh</button>
        </div>
      </header>

      <ScrapingProgress />

      <div className="tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''} 
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'cases' ? 'active' : ''} 
          onClick={() => setActiveTab('cases')}
        >
          Cases ({cases.length})
        </button>
        <button 
          className={activeTab === 'hearings' ? 'active' : ''} 
          onClick={() => setActiveTab('hearings')}
        >
          Upcoming Hearings ({upcomingHearings.length})
        </button>
        <button 
          className={activeTab === 'statistics' ? 'active' : ''} 
          onClick={() => setActiveTab('statistics')}
        >
          Statistics
        </button>
      </div>

      {activeTab === 'overview' && statistics && (
        <div className="overview-section">
          <div className="statistics">
            <div className="stat-card">
              <h3>Total Cases</h3>
              <p className="stat-number">{statistics.summary.total_cases}</p>
            </div>
            <div className="stat-card">
              <h3>Total Charges</h3>
              <p className="stat-number">{statistics.summary.total_charges}</p>
            </div>
            <div className="stat-card">
              <h3>Upcoming Hearings</h3>
              <p className="stat-number">{statistics.summary.upcoming_hearings}</p>
            </div>
            <div className="stat-card">
              <h3>Courts Active</h3>
              <p className="stat-number">{statistics.summary.total_courts}</p>
            </div>
            <div className="stat-card">
              <h3>Charge Types</h3>
              <p className="stat-number">{statistics.summary.unique_charge_types}</p>
            </div>
            <div className="stat-card">
              <h3>Pending Charges</h3>
              <p className="stat-number">{statistics.summary.pending_charges}</p>
            </div>
          </div>

          <div className="charges-overview">
            <h3>Most Common Charges</h3>
            <div className="charges-grid">
              {statistics.topCharges.map((charge, idx) => (
                <div key={idx} className="charge-card">
                  <div className="charge-count">{charge.count}</div>
                  <div className="charge-details">
                    <div className="charge-code">{charge.ars_code}</div>
                    <div className="charge-desc">{charge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cases' && (
        <div className="cases-section">
          <div className="cases-table">
            <table>
              <thead>
                <tr>
                  <th>Case Number</th>
                  <th>Court</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Judge</th>
                  <th>Charges</th>
                  <th>Next Hearing</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((case_) => (
                  <tr key={case_.id}>
                    <td className="case-number">{case_.case_number}</td>
                    <td>{case_.court_name}</td>
                    <td className="case-title">{case_.case_title}</td>
                    <td>{case_.case_type}</td>
                    <td>{case_.case_status}</td>
                    <td>{case_.judge}</td>
                    <td className="center">{case_.charge_count}</td>
                    <td>
                      {case_.next_hearing_date ? (
                        <>
                          {formatDate(case_.next_hearing_date)}<br/>
                          <small>{case_.next_hearing_type}</small>
                        </>
                      ) : 'None scheduled'}
                    </td>
                    <td>
                      <button 
                        onClick={() => loadCaseDetails(case_.case_number)}
                        className="view-btn"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'hearings' && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Split hearings into upcoming and past
        const upcoming = upcomingHearings.filter(h => new Date(h.hearing_date) >= today)
          .sort((a, b) => new Date(a.hearing_date).getTime() - new Date(b.hearing_date).getTime());
        
        const past = upcomingHearings.filter(h => new Date(h.hearing_date) < today)
          .sort((a, b) => new Date(b.hearing_date).getTime() - new Date(a.hearing_date).getTime());
        
        // Group upcoming hearings by day of week
        const groupedUpcoming = upcoming.reduce((groups, hearing) => {
          const date = new Date(hearing.hearing_date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          if (!groups[dayName]) groups[dayName] = [];
          groups[dayName].push(hearing);
          return groups;
        }, {} as Record<string, any[]>);
        
        return (
          <div className="hearings-section">
            <div className="upcoming-hearings">
              <h3>📅 Upcoming Arraignment Hearings</h3>
              {Object.keys(groupedUpcoming).length === 0 ? (
                <p className="no-hearings">No upcoming hearings scheduled</p>
              ) : (
                Object.entries(groupedUpcoming).map(([day, hearings]) => (
                  <div key={day} className="day-group">
                    <h4 className="day-header">{day}</h4>
                    <div className="hearings-grid">
                      {hearings.map((hearing: any, idx: number) => (
                        <div key={idx} className="hearing-card upcoming">
                          <div className="hearing-header">
                            <span className="hearing-date">{formatDate(hearing.hearing_date)}</span>
                            <span className="hearing-time">{formatTime(hearing.hearing_time)}</span>
                          </div>
                          <div className="hearing-body">
                            <div className="hearing-case">{hearing.case_number}</div>
                            <div className="hearing-title">{hearing.case_title}</div>
                            <div className="hearing-info">
                              <div className="info-row">
                                <span className="label">Court:</span>
                                <span className="value">{hearing.court_name}</span>
                              </div>
                              <div className="info-row">
                                <span className="label">Judge:</span>
                                <span className="value">{hearing.judge}</span>
                              </div>
                              <div className="info-row">
                                <span className="label">Type:</span>
                                <span className="value">{hearing.event_type}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="past-hearings">
              <h3>📋 Past Hearings</h3>
              {past.length === 0 ? (
                <p className="no-hearings">No past hearings</p>
              ) : (
                <div className="hearings-grid">
                  {past.map((hearing, idx) => (
                    <div key={idx} className="hearing-card past">
                      <div className="hearing-header">
                        <span className="hearing-date">{formatDate(hearing.hearing_date)}</span>
                        <span className="hearing-time">{formatTime(hearing.hearing_time)}</span>
                      </div>
                      <div className="hearing-body">
                        <div className="hearing-case">{hearing.case_number}</div>
                        <div className="hearing-title">{hearing.case_title}</div>
                        <div className="hearing-info">
                          <div className="info-row">
                            <span className="label">Court:</span>
                            <span className="value">{hearing.court_name}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Judge:</span>
                            <span className="value">{hearing.judge}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Type:</span>
                            <span className="value">{hearing.event_type}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === 'statistics' && statistics && (
        <div className="statistics-section">
          <div className="stats-container">
            <div className="stats-summary">
              <h3>📊 Case Analytics</h3>
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-icon">⚖️</div>
                  <div className="summary-value">{statistics.summary.total_cases}</div>
                  <div className="summary-label">Total Cases</div>
                </div>
                <div className="summary-card">
                  <div className="summary-icon">📝</div>
                  <div className="summary-value">{statistics.summary.total_charges}</div>
                  <div className="summary-label">Total Charges</div>
                </div>
                <div className="summary-card">
                  <div className="summary-icon">📅</div>
                  <div className="summary-value">{statistics.summary.upcoming_hearings}</div>
                  <div className="summary-label">Upcoming Hearings</div>
                </div>
                <div className="summary-card">
                  <div className="summary-icon">⏳</div>
                  <div className="summary-value">{statistics.summary.pending_charges}</div>
                  <div className="summary-label">Pending Charges</div>
                </div>
              </div>
            </div>
            
            <div className="court-distribution">
              <h3>🏛️ Court Distribution</h3>
              <div className="court-bars">
                {statistics.courtDistribution.map((court, idx) => {
                  const maxCount = Math.max(...statistics.courtDistribution.map(c => parseInt(c.case_count)));
                  const percentage = (parseInt(court.case_count) / maxCount) * 100;
                  return (
                    <div key={idx} className="court-bar-row">
                      <div className="court-name">{court.court_name}</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill" 
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="bar-value">{court.case_count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Case Detail Modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={() => setSelectedCase(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedCase(null)}>
              <span>✕</span>
            </button>
            
            <div className="modal-header">
              <div className="header-top">
                <span className="case-number-large">{selectedCase.case_number}</span>
                <span className="case-type-pill">{selectedCase.case_type}</span>
              </div>
              <h3 className="case-title-large">{selectedCase.case_title}</h3>
              <div className="header-info">
                <span className="header-info-item">
                  <span className="label">Court:</span> {selectedCase.court_name}
                </span>
                <span className="divider">•</span>
                <span className="header-info-item">
                  <span className="label">Judge:</span> {selectedCase.judge}
                </span>
                <span className="divider">•</span>
                <span className="header-info-item">
                  <span className="label">Filed:</span> {formatDate(selectedCase.filing_date)}
                </span>
                <span className="divider">•</span>
                <span className="header-info-item">
                  <span className={`status-indicator ${selectedCase.case_status.toLowerCase()}`}>{selectedCase.case_status}</span>
                </span>
              </div>
            </div>

            <div className="detail-tabs">
              <div className="detail-section modern">
                <div className="section-header">
                  <span className="section-icon">👥</span>
                  <h4>Parties</h4>
                  <span className="section-count">{selectedCase.parties.length}</span>
                </div>
                <div className="parties-grid">
                  {selectedCase.parties.map((party) => (
                    <div key={party.id} className="party-card-clean">
                      <div className="party-header">
                        <span className={`party-type-tag ${party.party_type.toLowerCase()}`}>
                          {party.party_type === 'plaintiff' ? '⚖️' : '🛡️'} {party.party_type}
                        </span>
                        <span className="party-name-large">{party.party_name}</span>
                      </div>
                      {(party.relationship || party.attorney) && (
                        <div className="party-meta">
                          {party.relationship && (
                            <div className="meta-line">
                              <span className="meta-key">Relationship</span>
                              <span className="meta-value">{party.relationship}</span>
                            </div>
                          )}
                          {party.attorney && (
                            <div className="meta-line">
                              <span className="meta-key">Attorney</span>
                              <span className="meta-value">{party.attorney}</span>
                            </div>
                          )}
                          {!party.attorney && (
                            <div className="meta-line">
                              <span className="meta-key">Representation</span>
                              <span className="meta-value pro-se">Pro Se</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section modern">
                <div className="section-header">
                  <span className="section-icon">⚡</span>
                  <h4>Charges</h4>
                  <span className="section-count">{selectedCase.charges.length}</span>
                </div>
                <div className="charges-list">
                  {selectedCase.charges.map((charge) => (
                    <div key={charge.id} className="charge-card">
                      <div className="charge-header">
                        <span className="ars-badge">{charge.ars_code}</span>
                        <span className="charge-status">{charge.disposition || 'Pending'}</span>
                      </div>
                      <div className="charge-description">{charge.description}</div>
                      <div className="charge-meta">
                        <span className="meta-item">
                          <span className="meta-icon">👤</span> {charge.party_name}
                        </span>
                        <span className="meta-item">
                          <span className="meta-icon">📅</span> {formatDate(charge.crime_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section modern">
                <div className="section-header">
                  <span className="section-icon">📅</span>
                  <h4>Court Calendar</h4>
                  <span className="section-count">{selectedCase.calendar.length}</span>
                </div>
                <div className="calendar-timeline">
                  {selectedCase.calendar.map((entry) => (
                    <div key={entry.id} className="timeline-item">
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-date">{formatDate(entry.hearing_date)}</span>
                          <span className="timeline-time">{formatTime(entry.hearing_time)}</span>
                        </div>
                        <div className="timeline-event">{entry.event_type}</div>
                        <div className="timeline-result">{entry.result || 'Scheduled'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .tabs {
          display: flex;
          gap: 10px;
          margin: 20px 0;
          border-bottom: 2px solid #e0e0e0;
        }
        
        .tabs button {
          padding: 10px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #666;
          border-bottom: 3px solid transparent;
          transition: all 0.3s;
        }
        
        .tabs button.active {
          color: #2c5282;
          border-bottom-color: #2c5282;
        }
        
        .tabs button:hover {
          color: #2c5282;
        }
        
        .stat-number {
          font-size: 2em;
          font-weight: bold;
          color: #2c5282;
        }
        
        .case-number {
          font-weight: bold;
          color: #2c5282;
        }
        
        .case-title {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .center {
          text-align: center;
        }
        
        .view-btn {
          padding: 5px 10px;
          background: #2c5282;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .view-btn:hover {
          background: #1a365d;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 30px;
          max-width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
        }
        
        .close-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: none;
          border: none;
          font-size: 30px;
          cursor: pointer;
          color: #666;
        }
        
        .case-info {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        
        .case-info p {
          margin: 5px 0;
        }
        
        .detail-section {
          margin: 30px 0;
        }
        
        .detail-section h4 {
          color: #2c5282;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        
        .charges-overview {
          margin-top: 30px;
        }
        
        .charges-overview h3 {
          color: #2c5282;
          margin-bottom: 20px;
          font-size: 1.5em;
        }
        
        .charges-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
        }
        
        .charge-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s;
        }
        
        .charge-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        
        .charge-count {
          font-size: 2.5em;
          font-weight: bold;
          color: white;
          min-width: 60px;
          text-align: center;
        }
        
        .charge-details {
          flex: 1;
          color: white;
        }
        
        .charge-code {
          font-weight: bold;
          margin-bottom: 5px;
          font-size: 1.1em;
        }
        
        .charge-desc {
          font-size: 0.9em;
          opacity: 0.95;
        }
        
        .hearings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .hearing-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.3s;
        }
        
        .hearing-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateY(-2px);
        }
        
        .hearing-header {
          background: linear-gradient(135deg, #2c5282 0%, #4a6fa5 100%);
          color: white;
          padding: 12px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .hearing-date {
          font-weight: bold;
          font-size: 1.1em;
        }
        
        .hearing-time {
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 10px;
          border-radius: 4px;
        }
        
        .hearing-body {
          padding: 15px;
        }
        
        .hearing-case {
          font-size: 1.2em;
          font-weight: bold;
          color: #2c5282;
          margin-bottom: 8px;
        }
        
        .hearing-title {
          color: #666;
          margin-bottom: 15px;
          font-size: 0.95em;
        }
        
        .hearing-info {
          border-top: 1px solid #e0e0e0;
          padding-top: 10px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
        }
        
        .info-row .label {
          font-weight: 600;
          color: #888;
          font-size: 0.9em;
        }
        
        .info-row .value {
          color: #333;
          font-size: 0.9em;
        }
        
        .stats-container {
          display: grid;
          gap: 30px;
        }
        
        .stats-summary h3, .court-distribution h3 {
          color: #2c5282;
          margin-bottom: 20px;
          font-size: 1.5em;
        }
        
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }
        
        .summary-card {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          border-radius: 15px;
          padding: 25px;
          text-align: center;
          color: white;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s;
        }
        
        .summary-card:nth-child(2) {
          background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
        }
        
        .summary-card:nth-child(3) {
          background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
        }
        
        .summary-card:nth-child(4) {
          background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
        }
        
        .summary-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
        }
        
        .summary-icon {
          font-size: 2.5em;
          margin-bottom: 10px;
        }
        
        .summary-value {
          font-size: 2.8em;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .summary-label {
          font-size: 1em;
          opacity: 0.95;
        }
        
        .court-bars {
          background: #f8f9fa;
          border-radius: 10px;
          padding: 20px;
        }
        
        .court-bar-row {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 15px;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .court-name {
          font-weight: 600;
          color: #333;
          font-size: 0.9em;
        }
        
        .bar-container {
          background: #e0e0e0;
          border-radius: 10px;
          height: 30px;
          position: relative;
          overflow: hidden;
        }
        
        .bar-fill {
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          height: 100%;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 10px;
          transition: width 0.5s ease;
          min-width: 50px;
        }
        
        .bar-value {
          color: white;
          font-weight: bold;
          font-size: 0.9em;
        }
        
        .refresh-btn {
          padding: 10px 20px;
          background: #48bb78;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 10px;
        }
        
        .refresh-btn:hover {
          background: #38a169;
        }
        
        /* Enhanced Scrape Button Styles */
        .scrape-btn {
          position: relative;
          padding: 16px 32px;
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: bold;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
          box-shadow: 0 6px 20px rgba(238, 90, 36, 0.35);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          overflow: hidden;
        }
        
        .scrape-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.5s;
        }
        
        .scrape-btn:hover::before {
          left: 100%;
        }
        
        .scrape-btn:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 10px 30px rgba(238, 90, 36, 0.45);
        }
        
        .scrape-btn:active:not(:disabled) {
          transform: translateY(-1px) scale(1);
        }
        
        .scrape-btn.scraping {
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          pointer-events: none;
        }
        
        .pulse-dot {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 12px;
          height: 12px;
          background: #4cef50;
          border-radius: 50%;
          animation: pulse-live 2s infinite;
        }
        
        @keyframes pulse-live {
          0% {
            box-shadow: 0 0 0 0 rgba(76, 239, 80, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(76, 239, 80, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(76, 239, 80, 0);
          }
        }
        
        .btn-icon {
          font-size: 24px;
        }
        
        .btn-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        
        .btn-main {
          font-size: 16px;
          font-weight: 800;
        }
        
        .btn-sub {
          font-size: 11px;
          opacity: 0.9;
          font-weight: 400;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Redesigned Modal Header */
        .modal-header {
          background: white;
          padding: 25px 30px;
          border-radius: 16px 16px 0 0;
          border-bottom: 2px solid #f0f0f0;
          position: relative;
        }
        
        .header-top {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 10px;
        }
        
        .case-number-large {
          font-size: 1.8em;
          font-weight: 700;
          color: #2c5282;
        }
        
        .case-type-pill {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .case-title-large {
          font-size: 1.1em;
          color: #666;
          margin: 0 0 15px 0;
          font-weight: 400;
        }
        
        .header-info {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: #888;
          flex-wrap: wrap;
        }
        
        .header-info-item .label {
          font-weight: 600;
          color: #555;
        }
        
        .divider {
          color: #ddd;
        }
        
        .status-indicator {
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          background: #28a745;
          color: white;
        }
        
        /* Redesigned Parties Section */
        .parties-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
        }
        
        .party-card-clean {
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          padding: 15px;
          transition: all 0.2s ease;
        }
        
        .party-card-clean:hover {
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
          border-color: #d0d0d0;
        }
        
        .party-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .party-type-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
        }
        
        .party-type-tag.plaintiff {
          color: #2c5282;
        }
        
        .party-type-tag.defendant {
          color: #dc3545;
        }
        
        .party-name-large {
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }
        
        .party-meta {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .meta-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        
        .meta-key {
          color: #999;
          font-weight: 500;
        }
        
        .meta-value {
          color: #333;
          font-weight: 600;
          text-align: right;
        }
        
        .meta-value.pro-se {
          color: #ffc107;
          font-style: italic;
        }
        
        /* Charges Section Improvements */
        .charges-list {
          display: grid;
          gap: 18px; /* Good spacing between charge cards */
        }
        
        .charge-card {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          padding: 16px;
          transition: all 0.3s ease;
        }
        
        .charge-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }
        
        .charge-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .ars-badge {
          background: #e74c3c;
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .charge-status {
          font-size: 12px;
          padding: 4px 10px;
          background: #ffc107;
          color: #333;
          border-radius: 6px;
          font-weight: 600;
        }
        
        .charge-description {
          font-size: 14px;
          color: #333;
          margin-bottom: 12px;
          line-height: 1.5;
        }
        
        .charge-meta {
          display: flex;
          gap: 20px;
          font-size: 12px;
          color: #666;
        }
        
        .meta-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .meta-icon {
          font-size: 14px;
        }
        
        /* Redesigned Calendar Section */
        .calendar-events {
          display: grid;
          gap: 15px;
        }
        
        .calendar-item {
          display: flex;
          gap: 15px;
          background: white;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          padding: 15px;
          transition: all 0.2s ease;
        }
        
        .calendar-item:hover {
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
          border-color: #d0d0d0;
        }
        
        .calendar-date-box {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 8px;
          padding: 10px;
          min-width: 60px;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        
        .calendar-month {
          font-size: 11px;
          text-transform: uppercase;
          opacity: 0.9;
        }
        
        .calendar-day {
          font-size: 24px;
          font-weight: bold;
          line-height: 1;
          margin: 2px 0;
        }
        
        .calendar-year {
          font-size: 11px;
          opacity: 0.9;
        }
        
        .calendar-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
        }
        
        .calendar-event-type {
          font-size: 15px;
          font-weight: 600;
          color: #333;
        }
        
        .calendar-time-status {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .calendar-time {
          font-size: 13px;
          color: #666;
        }
        
        .calendar-result-badge {
          font-size: 11px;
          padding: 3px 8px;
          background: #28a745;
          color: white;
          border-radius: 4px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

export default CasesDashboard;