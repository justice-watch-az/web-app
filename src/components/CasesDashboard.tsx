import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { matchSorter } from 'match-sorter';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import './Dashboard.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

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
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseSummary | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideOldCases, setHideOldCases] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({start: null, end: null});
  const [showCourtDropdown, setShowCourtDropdown] = useState(false);

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

  // Enhanced filtering logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const getFilteredCases = () => {
    let filtered = cases;
    
    // Apply search
    if (searchQuery) {
      filtered = matchSorter(filtered, searchQuery, {
        keys: ['case_number', 'case_title', 'judge', 'court_name']
      });
    }
    
    // Apply court filter
    if (selectedCourts.length > 0) {
      filtered = filtered.filter(c => selectedCourts.includes(c.court_name));
    }
    
    // Apply status filter
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(c => selectedStatus.includes(c.case_status));
    }
    
    // Apply date range
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(c => {
        if (!c.next_hearing) return false;
        const hearingDate = new Date(c.next_hearing);
        if (dateRange.start && hearingDate < dateRange.start) return false;
        if (dateRange.end && hearingDate > dateRange.end) return false;
        return true;
      });
    }
    
    // Apply existing hideOldCases filter
    if (hideOldCases) {
      filtered = filtered.filter(case_ => {
        if (!case_.next_hearing) return true;
        const hearingDate = new Date(case_.next_hearing);
        return hearingDate >= today;
      });
    }
    
    return filtered;
  };
  
  const filteredCases = getFilteredCases();

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
    autoTable(doc, {
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

  // Prepare chart data
  const courtChartData = {
    labels: statistics?.courtDistribution.slice(0, 10).map(c => c.court_name.replace(' Justice Court', '')) || [],
    datasets: [{
      label: 'Cases by Court',
      data: statistics?.courtDistribution.slice(0, 10).map(c => parseInt(c.case_count)) || [],
      backgroundColor: 'rgba(99, 102, 241, 0.5)',
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 1
    }]
  };
  
  // Timeline chart data (next 30 days)
  const getTimelineData = () => {
    const dates = new Map<string, number>();
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);
    
    filteredCases.forEach(case_ => {
      if (case_.next_hearing) {
        const hearingDate = new Date(case_.next_hearing);
        if (hearingDate <= next30Days && hearingDate >= today) {
          const dateStr = hearingDate.toISOString().split('T')[0];
          dates.set(dateStr, (dates.get(dateStr) || 0) + 1);
        }
      }
    });
    
    const sortedDates = Array.from(dates.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    return {
      labels: sortedDates.map(([date]) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [{
        label: 'Hearings',
        data: sortedDates.map(([, count]) => count),
        borderColor: 'rgb(118, 75, 162)',
        backgroundColor: 'rgba(118, 75, 162, 0.5)',
        tension: 0.1
      }]
    };
  };
  
  // Status distribution
  const statusChartData = {
    labels: ['Active', 'Closed', 'Pending', 'Other'],
    datasets: [{
      data: [
        filteredCases.filter(c => c.case_status === 'Active').length,
        filteredCases.filter(c => c.case_status === 'Closed').length,
        filteredCases.filter(c => c.case_status === 'Pending').length,
        filteredCases.filter(c => !['Active', 'Closed', 'Pending'].includes(c.case_status)).length
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.5)',
        'rgba(239, 68, 68, 0.5)',
        'rgba(251, 191, 36, 0.5)',
        'rgba(156, 163, 175, 0.5)'
      ],
      borderColor: [
        'rgba(34, 197, 94, 1)',
        'rgba(239, 68, 68, 1)',
        'rgba(251, 191, 36, 1)',
        'rgba(156, 163, 175, 1)'
      ],
      borderWidth: 1
    }]
  };

  // Get unique courts for filter dropdown
  const uniqueCourts = Array.from(new Set(cases.map(c => c.court_name))).sort();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Justice Watch AZ - Maricopa County Arraignment Monitor</h1>
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

      {/* Search and Filter Section */}
      <div className="search-filter-section">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search cases, titles, judges, courts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-results">
            Showing {filteredCases.length} of {cases.length} cases
          </span>
        </div>
        
        <div className="filter-container">
          {/* Court Filter */}
          <div className="filter-group">
            <label>Courts</label>
            <div className="filter-dropdown">
              <button 
                className="filter-button"
                onClick={() => setShowCourtDropdown(!showCourtDropdown)}
              >
                {selectedCourts.length > 0 
                  ? `${selectedCourts.length} selected` 
                  : 'All Courts'}
              </button>
              {showCourtDropdown && (
                <div className="filter-dropdown-content">
                  {uniqueCourts.map(court => (
                    <label key={court}>
                      <input
                        type="checkbox"
                        checked={selectedCourts.includes(court)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCourts([...selectedCourts, court]);
                          } else {
                            setSelectedCourts(selectedCourts.filter(c => c !== court));
                          }
                        }}
                      />
                      <span>{court}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="filter-group">
            <label>Status</label>
            <div className="filter-buttons">
              {['Active', 'Closed', 'Pending'].map(status => (
                <button
                  key={status}
                  className={`filter-pill ${selectedStatus.includes(status) ? 'active' : ''}`}
                  onClick={() => {
                    if (selectedStatus.includes(status)) {
                      setSelectedStatus(selectedStatus.filter(s => s !== status));
                    } else {
                      setSelectedStatus([...selectedStatus, status]);
                    }
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          
          {/* Clear Filters */}
          {(searchQuery || selectedCourts.length > 0 || selectedStatus.length > 0) && (
            <button 
              className="clear-filters-btn"
              onClick={() => {
                setSearchQuery('');
                setSelectedCourts([]);
                setSelectedStatus([]);
                setDateRange({start: null, end: null});
              }}
            >
              Clear Filters ({
                (searchQuery ? 1 : 0) + 
                selectedCourts.length + 
                selectedStatus.length
              })
            </button>
          )}
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>Cases by Court</h3>
          <Bar 
            data={courtChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                title: { display: false }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }}
            height={250}
          />
        </div>
        
        <div className="chart-container">
          <h3>Upcoming Hearings (Next 30 Days)</h3>
          <Line 
            data={getTimelineData()}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }}
            height={250}
          />
        </div>
        
        <div className="chart-container">
          <h3>Case Status Distribution</h3>
          <Doughnut 
            data={statusChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' as const }
              }
            }}
            height={250}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="action-bar">
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