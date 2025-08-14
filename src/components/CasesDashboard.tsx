import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
  const [hideOldCases, setHideOldCases] = useState(false);
  
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

  // Filter cases based on hideOldCases setting
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const filteredCases = hideOldCases 
    ? cases.filter(case_ => {
        if (!case_.next_hearing) return true; // Keep cases with no date
        const hearingDate = new Date(case_.next_hearing);
        return hearingDate >= today;
      })
    : cases;

  // Separate future and past cases
  const futureCases: CaseSummary[] = [];
  const pastCases: CaseSummary[] = [];
  const noDates: CaseSummary[] = [];
  
  filteredCases.forEach(case_ => {
    if (!case_.next_hearing) {
      noDates.push(case_);
    } else {
      const hearingDate = new Date(case_.next_hearing);
      if (hearingDate >= today) {
        futureCases.push(case_);
      } else {
        pastCases.push(case_);
      }
    }
  });

  // Group future cases by date
  const groupedFutureCases = futureCases.reduce((groups, case_) => {
    const date = case_.next_hearing!;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(case_);
    return groups;
  }, {} as Record<string, CaseSummary[]>);

  // Group past cases by date
  const groupedPastCases = pastCases.reduce((groups, case_) => {
    const date = case_.next_hearing!;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(case_);
    return groups;
  }, {} as Record<string, CaseSummary[]>);

  // Sort future dates chronologically
  const sortedFutureDates = Object.keys(groupedFutureCases).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  // Sort past dates reverse chronologically (most recent first)
  const sortedPastDates = Object.keys(groupedPastCases).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const handleExportCSV = () => {
    // Prepare data for CSV export
    const csvData = cases.map(case_ => {
      // Parse JSON fields safely
      let plaintiff = '';
      let defendant = '';
      let charges = '';
      
      try {
        const parties = typeof case_.parties === 'string' ? JSON.parse(case_.parties) : case_.parties;
        plaintiff = parties?.plaintiff?.party_name || '';
        defendant = parties?.defendant?.party_name || '';
      } catch (e) {
        // Silent fail
      }
      
      try {
        const docket = typeof case_.docket_entries === 'string' ? JSON.parse(case_.docket_entries) : case_.docket_entries;
        if (Array.isArray(docket)) {
          const chargeEntries = docket.filter(d => d.type === 'charge');
          charges = chargeEntries.map(c => `${c.ars_code} - ${c.description}`).join('; ');
        }
      } catch (e) {
        // Silent fail
      }
      
      return {
        'Case Number': case_.case_number,
        'Case Title': case_.case_title,
        'Court': case_.court_name,
        'Judge': case_.judge || 'N/A',
        'Case Type': case_.case_type,
        'Status': case_.case_status,
        'Filing Date': formatDate(case_.filing_date),
        'Next Hearing': formatDate(case_.next_hearing),
        'Location': case_.location || 'N/A',
        'Plaintiff': plaintiff,
        'Defendant': defendant,
        'Charges': charges,
        'Case URL': case_.case_url || ''
      };
    });
    
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `court_cases_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Add title
    doc.setFontSize(20);
    doc.text('Justice Watch - Court Cases Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Total Cases: ${cases.length}`, 14, 28);
    
    // Prepare table data
    const tableData = cases.map(case_ => {
      // Parse JSON fields safely
      let charges = '';
      
      try {
        const docket = typeof case_.docket_entries === 'string' ? JSON.parse(case_.docket_entries) : case_.docket_entries;
        if (Array.isArray(docket)) {
          const chargeEntries = docket.filter(d => d.type === 'charge');
          charges = chargeEntries.map(c => c.ars_code).join(', ');
        }
      } catch (e) {
        // Silent fail
      }
      
      return [
        case_.case_number,
        case_.case_title.length > 30 ? case_.case_title.substring(0, 30) + '...' : case_.case_title,
        case_.court_name.replace(' Justice Court', ''),
        case_.judge || 'N/A',
        case_.case_type,
        case_.case_status,
        formatDate(case_.filing_date),
        formatDate(case_.next_hearing),
        charges
      ];
    });
    
    // Add table
    (doc as any).autoTable({
      head: [['Case #', 'Title', 'Court', 'Judge', 'Type', 'Status', 'Filed', 'Next Hearing', 'Charges']],
      body: tableData,
      startY: 35,
      styles: {
        fontSize: 8,
        cellPadding: 1
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 22 },
        7: { cellWidth: 22 },
        8: { cellWidth: 30 }
      }
    });
    
    // Save the PDF
    doc.save(`court_cases_${new Date().toISOString().split('T')[0]}.pdf`);
  };

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
        <button 
          onClick={() => setHideOldCases(!hideOldCases)} 
          className={`toggle-btn ${hideOldCases ? 'active' : ''}`}
        >
          {hideOldCases ? '👁️ Show All' : '🚫 Hide Old'}
        </button>
        <button onClick={handleExportCSV} className="export-btn csv-btn" disabled={cases.length === 0}>
          📊 Export CSV
        </button>
        <button onClick={handleExportPDF} className="export-btn pdf-btn" disabled={cases.length === 0}>
          📄 Export PDF
        </button>
      </div>

      {/* Cases Grid */}
      <div className="cases-container">
        {/* Future Cases */}
        {sortedFutureDates.length > 0 && (
          <>
            {sortedFutureDates.map(date => (
              <div key={date} className="date-group">
                <h2 className="date-header">
                  {formatDateHeader(date)}
                </h2>
                <div className="cases-grid">
                  {groupedFutureCases[date].map(case_ => (
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
          </>
        )}

        {/* Past Cases Section */}
        {!hideOldCases && sortedPastDates.length > 0 && (
          <>
            <div className="date-group past-cases-section">
              <h2 className="date-header past-header">
                📅 Past Hearings
              </h2>
            </div>
            {sortedPastDates.map(date => (
              <div key={`past-${date}`} className="date-group past-group">
                <h2 className="date-header past-date">
                  {formatDateHeader(date)}
                </h2>
                <div className="cases-grid">
                  {groupedPastCases[date].map(case_ => (
                    <div key={case_.id} className="case-card past-case" onClick={() => loadCaseDetails(case_)}>
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
          </>
        )}

        {/* No Date Cases */}
        {noDates.length > 0 && (
          <div className="date-group">
            <h2 className="date-header">
              No Hearing Scheduled
            </h2>
            <div className="cases-grid">
              {noDates.map(case_ => (
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
                    </div>
                  </div>
                  <div className="case-card-footer">
                    <button className="view-details-btn">View Details →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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