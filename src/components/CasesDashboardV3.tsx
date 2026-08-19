import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { matchSorter } from 'match-sorter';
import './CasesDashboardV3.css';
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

// Import Supabase services
import { 
  getCases, 
  searchCases, 
  getStatistics,
  subscribeToCaseUpdates,
  transformToLegacyFormat 
} from '../services/casesService';
import {
  groupCasesByDate,
  formatDate,
  formatTime,
  parseParties,
  parseDocketEntries,
  filterCases,
  sortCases,
  generateCSV
} from '../utils/dataTransforms';
import { isUpcomingCase } from '../utils/dateHelpers';
import type { CaseWithRelations, Statistics } from '../types/database';

// Import new real-time components
import { realtimeService } from '../services/realtimeService';
import { NotificationSystem, notifyInfo, notifySuccess, notifyWarning, notifyError } from './NotificationSystem';
import { ConnectionStatus } from './ConnectionStatus';

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

function CasesDashboardV3() {
  const [cases, setCases] = useState<CaseWithRelations[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseWithRelations | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(true); // Default to true
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({start: null, end: null});
  const [showCourtDropdown, setShowCourtDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'cases' | 'analytics'>('cases');
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'court'>('date');
  const [selectedCounty, setSelectedCounty] = useState<string>(''); // '' = all counties

  // County-aware external case-history links
  const getCaseHistoryUrl = (caseItem: CaseWithRelations): string => {
    if (caseItem.case_url) return caseItem.case_url;
    if (caseItem.county === 'pima') {
      // Pima public case lookup (human-facing; has captcha) — prefill impossible, land on search
      return 'https://www.jp.pima.gov/CaseSearch/';
    }
    if (caseItem.county === 'yavapai') {
      // AZ Public Access (statewide; captcha search — no direct case URLs)
      return 'https://apps.azcourts.gov/publicaccess/caselookup.aspx';
    }
    // Maricopa default (deep link per case number)
    return `https://justicecourts.maricopa.gov/app/courtrecords/CaseInfo?casenumber=${caseItem.case_number}`;
  };
  const getCaseHistoryNote = (caseItem: CaseWithRelations): string => {
    if (caseItem.county === 'pima') {
      return 'Pima County does not publish direct case pages — their lookup requires a captcha search. Copy the case # below and paste it into their search.';
    }
    if (caseItem.county === 'yavapai') {
      return 'Yavapai cases are in the statewide Arizona Public Access lookup — it requires a captcha search. Copy the case # below and search by name or case number.';
    }
    return 'Opens official Maricopa County court records in a new tab';
  };
  const formatCounty = (county: string | null | undefined): string => {
    if (!county) return 'Maricopa';
    return county.charAt(0).toUpperCase() + county.slice(1);
  };

  useEffect(() => {
    loadData();
    
    // Setup enhanced real-time subscriptions
    const unsubscribers: (() => void)[] = [];
    
    // Subscribe to cases table
    unsubscribers.push(
      realtimeService.subscribeToTable('cases', {
        onInsert: (newCase) => {
          setCases(prev => {
            // Check if case already exists
            if (prev.find(c => c.id === newCase.id)) return prev;
            
            // Add new case with animation flag
            const caseWithRelations = { ...newCase, isNew: true } as CaseWithRelations;
            notifyInfo('New Case', `Case ${newCase.case_number} has been added`);
            
            // Remove animation flag after animation completes
            setTimeout(() => {
              setCases(prevCases => prevCases.map(c => 
                c.id === newCase.id ? { ...c, isNew: false } as CaseWithRelations : c
              ));
            }, 500);
            
            return [caseWithRelations, ...prev];
          });
          
          // Update statistics
          loadStatistics();
        },
        
        onUpdate: (updatedCase, oldCase) => {
          setCases(prev => prev.map(c => 
            c.id === updatedCase.id ? { ...updatedCase, isUpdated: true } as CaseWithRelations : c
          ));
          
          // Notify on important changes
          if (oldCase.status !== updatedCase.status) {
            notifyInfo('Status Changed', 
              `Case ${updatedCase.case_number} status: ${updatedCase.status}`);
          }
          
          if (oldCase.next_hearing !== updatedCase.next_hearing) {
            notifyWarning('Hearing Updated', 
              `Case ${updatedCase.case_number} hearing rescheduled`);
          }
          
          // Remove update flag after animation
          setTimeout(() => {
            setCases(prev => prev.map(c => 
              c.id === updatedCase.id ? { ...c, isUpdated: false } as CaseWithRelations : c
            ));
          }, 500);
        },
        
        onDelete: (deletedCase) => {
          setCases(prev => prev.filter(c => c.id !== deletedCase.id));
          notifyWarning('Case Removed', `Case ${deletedCase.case_number} has been removed`);
        },
        
        onError: (error) => {
          console.error('Real-time error:', error);
          notifyError('Connection Error', 'Real-time updates temporarily unavailable');
        }
      })
    );
    
    // Subscribe to case_parties table
    unsubscribers.push(
      realtimeService.subscribeToTable('case_parties', {
        event: '*',
        onInsert: (party) => updateCaseParties(party.case_id),
        onUpdate: (party) => updateCaseParties(party.case_id),
        onDelete: (party) => updateCaseParties(party.case_id)
      })
    );
    
    // Subscribe to case_charges table
    unsubscribers.push(
      realtimeService.subscribeToTable('case_charges', {
        event: '*',
        onInsert: (charge) => updateCaseCharges(charge.case_id),
        onUpdate: (charge) => updateCaseCharges(charge.case_id),
        onDelete: (charge) => updateCaseCharges(charge.case_id)
      })
    );
    
    // Subscribe to case_calendar table
    unsubscribers.push(
      realtimeService.subscribeToTable('case_calendar', {
        event: '*',
        onInsert: (event) => updateCaseCalendar(event.case_id),
        onUpdate: (event) => updateCaseCalendar(event.case_id),
        onDelete: (event) => updateCaseCalendar(event.case_id)
      })
    );
    
    // Subscribe to scrape_logs for system status
    unsubscribers.push(
      realtimeService.subscribeToTable('scrape_logs', {
        event: 'INSERT',
        onInsert: (log) => {
          if (log.status === 'started') {
            notifyInfo('Scraping Started', 'Fetching latest case information...');
          } else if (log.status === 'completed') {
            notifySuccess('Scraping Complete', 
              `Found ${log.cases_found} cases, processed ${log.cases_processed}`);
            // Reload data after successful scrape
            loadData();
          } else if (log.status === 'failed') {
            notifyError('Scraping Failed', log.error_message || 'Unknown error occurred');
          }
        }
      })
    );

    return () => {
      // Cleanup all subscriptions
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch cases and statistics from Supabase
      const [casesData, statsData] = await Promise.all([
        getCases(500), // Get up to 500 cases
        getStatistics()
      ]);
      
      setCases(casesData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load cases. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };
  
  const loadStatistics = async () => {
    try {
      const statsData = await getStatistics();
      setStatistics(statsData);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };
  
  // Helper functions for updating related data
  const updateCaseParties = async (caseId: string) => {
    // In a real implementation, you would fetch just the updated parties
    // For now, we'll reload the specific case
    console.log(`Updating parties for case ${caseId}`);
  };
  
  const updateCaseCharges = async (caseId: string) => {
    // In a real implementation, you would fetch just the updated charges
    console.log(`Updating charges for case ${caseId}`);
  };
  
  const updateCaseCalendar = async (caseId: string) => {
    // In a real implementation, you would fetch just the updated calendar events
    console.log(`Updating calendar for case ${caseId}`);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }

    try {
      setLoading(true);
      const results = await searchCases(searchQuery);
      setCases(results);
    } catch (error) {
      console.error('Search error:', error);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter cases based on UI selections
  const groupCasesByDate = (casesToGroup: CaseWithRelations[]) => {
    const grouped: Record<string, CaseWithRelations[]> = {};
    
    casesToGroup.forEach(caseItem => {
      const dateKey = caseItem.next_hearing 
        ? new Date(caseItem.next_hearing).toDateString()
        : 'No Date';
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(caseItem);
    });
    
    // Sort dates
    const sortedEntries = Object.entries(grouped).sort(([a], [b]) => {
      if (a === 'No Date') return 1;
      if (b === 'No Date') return -1;
      return new Date(a).getTime() - new Date(b).getTime();
    });
    
    return Object.fromEntries(sortedEntries);
  };
  
  const groupCasesByCourt = (casesToGroup: CaseWithRelations[]): Record<string, Record<string, CaseWithRelations[]>> => {
    // First group by court
    const byCourt: Record<string, CaseWithRelations[]> = {};
    casesToGroup.forEach(caseItem => {
      const courtKey = caseItem.court_name || 'Unknown Court';
      if (!byCourt[courtKey]) byCourt[courtKey] = [];
      byCourt[courtKey].push(caseItem);
    });
    
    // Then within each court, group by hearing date
    const result: Record<string, Record<string, CaseWithRelations[]>> = {};
    Object.entries(byCourt)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([courtName, courtCases]) => {
        const byDate: Record<string, CaseWithRelations[]> = {};
        courtCases.forEach(caseItem => {
          const dateKey = caseItem.next_hearing 
            ? new Date(caseItem.next_hearing).toDateString()
            : 'No Hearing Date';
          if (!byDate[dateKey]) byDate[dateKey] = [];
          byDate[dateKey].push(caseItem);
        });
        
        // Sort dates chronologically
        const sortedEntries = Object.entries(byDate).sort(([a], [b]) => {
          if (a === 'No Hearing Date') return 1;
          if (b === 'No Hearing Date') return -1;
          return new Date(a).getTime() - new Date(b).getTime();
        });
        result[courtName] = Object.fromEntries(sortedEntries);
      });
    
    return result;
  };
  
  const formatDateHeader = (dateString: string) => {
    if (dateString === 'No Date') return 'No Hearing Date';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const getFilteredCases = () => {
    let filtered = [...cases];

    // Filter by county
    if (selectedCounty) {
      filtered = filtered.filter(c => (c.county || 'maricopa') === selectedCounty);
    }
    
    // Apply search filter
    if (searchQuery) {
      filtered = filterCases(filtered, searchQuery);
    }
    
    // Filter by selected courts
    if (selectedCourts.length > 0) {
      filtered = filtered.filter(c => 
        c.court_name && selectedCourts.includes(c.court_name)
      );
    }
    
    // Filter by status
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(c => 
        c.status && selectedStatus.includes(c.status)
      );
    }
    
    // Filter by date range
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(c => {
        const caseDate = c.next_hearing || c.filing_date;
        if (!caseDate) return false;
        
        const date = new Date(caseDate);
        if (dateRange.start && date < dateRange.start) return false;
        if (dateRange.end && date > dateRange.end) return false;
        return true;
      });
    }
    
    // Show only upcoming cases if checkbox is checked
    if (showUpcomingOnly) {
      filtered = filtered.filter(c => {
        // Use next_hearing date for filtering
        return isUpcomingCase(c.next_hearing);
      });
    }
    
    // Apply sorting
    if (sortBy === 'court') {
      filtered.sort((a, b) => {
        // First sort by court name
        const courtCompare = (a.court_name || '').localeCompare(b.court_name || '');
        if (courtCompare !== 0) return courtCompare;
        
        // Then by date within each court
        const dateA = new Date(a.next_hearing || a.filing_date || 0);
        const dateB = new Date(b.next_hearing || b.filing_date || 0);
        return dateB.getTime() - dateA.getTime();
      });
    } else {
      // Default: sort by date (most recent first)
      filtered.sort((a, b) => {
        const dateA = new Date(a.next_hearing || a.filing_date || 0);
        const dateB = new Date(b.next_hearing || b.filing_date || 0);
        return dateB.getTime() - dateA.getTime();
      });
    }
    
    return filtered;
  };

  const exportToCSV = () => {
    const filteredCases = getFilteredCases();
    const csv = generateCSV(filteredCases);
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `court-cases-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToPDF = () => {
    const filteredCases = getFilteredCases();
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Court Cases Report', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    
    const tableData = filteredCases.map(c => {
      const parties = parseParties(c);
      return [
        c.case_number,
        c.court_name || '',
        c.case_title || '',
        c.case_type || '',
        formatDate(c.next_hearing),
        parties.defendant?.party_name || 'N/A'
      ];
    });
    
    autoTable(doc, {
      head: [['Case #', 'Court', 'Title', 'Type', 'Next Hearing', 'Defendant']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 }
    });
    
    doc.save(`court-cases-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const renderCaseModal = () => {
    if (!selectedCase) return null;
    
    const parties = parseParties(selectedCase);
    const charges = parseDocketEntries(selectedCase);
    // Pima stores judge + ARS codes in raw_data (no case_charges rows)
    const raw = (selectedCase.raw_data || {}) as Record<string, any>;
    const judge = selectedCase.judge || raw.judge || 'N/A';
    const rawArsCodes: string[] = Array.isArray(raw.ars_codes) ? raw.ars_codes : [];
    
    return (
      <div className="modal-overlay" onClick={() => setSelectedCase(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setSelectedCase(null)}>×</button>
          
          <h2>{selectedCase.case_number}</h2>
          <h3>{selectedCase.case_title}</h3>
          
          <div className="case-details">
            <div className="detail-section">
              <h4>Case Information</h4>
              <p><strong>Court:</strong> {selectedCase.court_name}</p>
              <p><strong>Type:</strong> {selectedCase.case_type}</p>
              <p><strong>Status:</strong> {selectedCase.status}</p>
              <p><strong>Filing Date:</strong> {formatDate(selectedCase.filing_date)}</p>
              <p><strong>Judge:</strong> {judge}</p>
              <p><strong>Location:</strong> {selectedCase.location || 'N/A'}</p>
            </div>
            
            <div className="detail-section">
              <h4>Case History</h4>
              <a 
                href={getCaseHistoryUrl(selectedCase)}
                target="_blank"
                rel="noopener noreferrer"
                className="case-history-link"
              >
                <span>View Full Case History</span>
                <svg className="external-link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
              <p className="case-history-note">
                {getCaseHistoryNote(selectedCase)}
              </p>
              {(selectedCase.county === 'pima' || selectedCase.county === 'yavapai') && (
                <button
                  className="copy-case-number-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedCase.case_number);
                    notifySuccess('Copied', `Case # ${selectedCase.case_number} copied — paste it into the Pima case search`);
                  }}
                >
                  📋 Copy Case # for Pima search
                </button>
              )}
            </div>
            
            <div className="detail-section parties-section">
              <h4>Parties</h4>
              <div className="parties-list">
                {parties.plaintiff && (
                  <div className="party-item">
                    <div className="party-label">Plaintiff</div>
                    <div className="party-name">{parties.plaintiff.party_name}</div>
                    {parties.plaintiff.attorney && (
                      <div className="party-attorney">Attorney: {parties.plaintiff.attorney}</div>
                    )}
                  </div>
                )}
                {parties.defendant && (
                  <div className="party-item">
                    <div className="party-label">Defendant</div>
                    <div className="party-name">{parties.defendant.party_name}</div>
                    {parties.defendant.attorney && (
                      <div className="party-attorney">Attorney: {parties.defendant.attorney}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {charges.length > 0 && (
              <div className="detail-section charges-section">
                <h4>Charges ({charges.length})</h4>
                {charges.map((charge, idx) => (
                  <div key={idx} className="charge-item">
                    <div className="charge-header">
                      <span className="charge-code">{charge.ars_code}</span>
                    </div>
                    <p className="charge-description">{charge.description}</p>
                    {charge.date && (
                      <p className="charge-date">
                        <strong>Crime Date:</strong> {formatDate(charge.date)}
                      </p>
                    )}
                    {charge.disposition && (
                      <div className="disposition-info">
                        <p className="disposition">
                          <strong>Disposition:</strong> {charge.disposition}
                        </p>
                        {charge.disposition_date && (
                          <p className="disposition-date">
                            <strong>Disposition Date:</strong> {formatDate(charge.disposition_date)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {charges.length === 0 && rawArsCodes.length > 0 && (
              <div className="detail-section charges-section">
                <h4>ARS Codes</h4>
                <div className="charge-item">
                  <div className="charge-header">
                    {rawArsCodes.map((code, idx) => (
                      <span key={idx} className="charge-code" style={{ marginRight: 8 }}>{code}</span>
                    ))}
                  </div>
                  <p className="charge-description">Reported on the Pima County Consolidated Justice Court calendar</p>
                </div>
              </div>
            )}

            {selectedCase.case_calendar && selectedCase.case_calendar.length > 0 && (
              <div className="detail-section">
                <h4>Upcoming Hearings</h4>
                {selectedCase.case_calendar.map((hearing, idx) => (
                  <div key={idx} className="hearing-item">
                    <p>
                      <strong>{formatDate(hearing.hearing_date)}</strong> at {formatTime(hearing.hearing_time)}
                    </p>
                    <p>{hearing.event_type} - {hearing.location}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    if (!statistics) return null;
    
    // Prepare chart data
    const courtChartData = {
      labels: Object.keys(statistics.cases_by_court).slice(0, 10),
      datasets: [{
        label: 'Cases by Court',
        data: Object.values(statistics.cases_by_court).slice(0, 10),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      }]
    };
    
    // Sort charges by count and take top 10 for cleaner display
    const sortedCharges = Object.entries(statistics.charges_breakdown || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    const chargesChartData = {
      labels: sortedCharges.map(([charge]) => charge),
      datasets: [{
        label: 'Charges Analysis',
        data: sortedCharges.map(([, count]) => count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',   // Red
          'rgba(54, 162, 235, 0.7)',   // Blue
          'rgba(255, 206, 86, 0.7)',   // Yellow
          'rgba(75, 192, 192, 0.7)',   // Teal
          'rgba(153, 102, 255, 0.7)',  // Purple
          'rgba(255, 159, 64, 0.7)',   // Orange
          'rgba(199, 199, 199, 0.7)',  // Grey
          'rgba(83, 102, 255, 0.7)',   // Indigo
          'rgba(255, 99, 255, 0.7)',   // Pink
          'rgba(99, 255, 132, 0.7)',   // Green
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 199, 199, 1)',
          'rgba(83, 102, 255, 1)',
          'rgba(255, 99, 255, 1)',
          'rgba(99, 255, 132, 1)',
        ],
        borderWidth: 1,
      }]
    };
    
    return (
      <div className="analytics-container">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Cases</h3>
            <p className="stat-number">{statistics.total_cases}</p>
          </div>
          <div className="stat-card">
            <h3>Recent Cases (7 days)</h3>
            <p className="stat-number">{statistics.recent_cases}</p>
          </div>
          <div className="stat-card">
            <h3>Upcoming Hearings</h3>
            <p className="stat-number">{statistics.upcoming_hearings}</p>
          </div>
          <div className="stat-card">
            <h3>Courts Active</h3>
            <p className="stat-number">{Object.keys(statistics.cases_by_court).length}</p>
          </div>
        </div>
        
        <div className="charts-grid">
          <div className="chart-container">
            <h3>Cases by Court</h3>
            <Bar data={courtChartData} options={{ responsive: true }} />
          </div>
          <div className="chart-container">
            <h3>Charges Analysis</h3>
            <Doughnut 
              data={chargesChartData} 
              options={{ 
                responsive: true,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: {
                      padding: 10,
                      font: {
                        size: 11
                      }
                    }
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ${value} (${percentage}%)`;
                      }
                    }
                  }
                }
              }} 
            />
          </div>
        </div>
      </div>
    );
  };

  if (loading && cases.length === 0) {
    return <div className="loading">Loading cases...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={loadData}>Retry</button>
      </div>
    );
  }

  const filteredCases = getFilteredCases();
  
  // Group cases by date or court based on sort selection
  const groupedByCourt = sortBy === 'court' ? groupCasesByCourt(filteredCases) : null;
  const groupedByDate = sortBy === 'date' ? groupCasesByDate(filteredCases) : null;
  
  // Shared case card renderer — avoids duplicating card markup
  const renderCaseCards = (casesList: CaseWithRelations[]) => (
    <div className="cases-grid">
      {casesList.map(caseItem => {
        const parties = parseParties(caseItem);
        return (
          <div 
            key={caseItem.id} 
            className="case-card"
            onClick={() => setSelectedCase(caseItem)}
          >
            <div className="case-card-header">
              <span className="case-number">{caseItem.case_number}</span>
              <span className={`county-badge county-${(caseItem.county || 'maricopa').toLowerCase()}`}>
                {formatCounty(caseItem.county)}
              </span>
              <span className="case-type-badge">{caseItem.case_type}</span>
            </div>
            <div className="case-card-body">
              <p className="case-title">{caseItem.case_title}</p>
              <p className="case-court">{caseItem.court_name}</p>
              {parties.defendant && (
                <p className="case-defendant">
                  <strong>Defendant:</strong> {parties.defendant.party_name}
                </p>
              )}
            </div>
            <div className="case-card-footer">
              {caseItem.case_calendar?.[0]?.hearing_time ? (
                <span className="hearing-time">
                  {formatTime(caseItem.case_calendar[0].hearing_time)}
                </span>
              ) : caseItem.next_hearing && (
                <span className="hearing-time">
                  {formatTime(caseItem.next_hearing)}
                </span>
              )}
              <span className={`status-indicator ${caseItem.status?.toLowerCase()}`}>
                {caseItem.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
    
  const allCourts = [...new Set(cases.map(c => c.court_name).filter(Boolean))];
  const allStatuses = [...new Set(cases.map(c => c.status).filter(Boolean))];
  const allCounties = [...new Set(cases.map(c => c.county || 'maricopa'))].sort();

  return (
    <div className="dashboard-container">
      <NotificationSystem />
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Justice Watch Dashboard</h1>
        </div>
        <div className="header-center">
          <div className="tab-switcher">
            <button 
              className={activeTab === 'cases' ? 'active' : ''} 
              onClick={() => setActiveTab('cases')}
            >
              <span className="tab-icon">📋</span>
              Cases
            </button>
            <button 
              className={activeTab === 'analytics' ? 'active' : ''} 
              onClick={() => setActiveTab('analytics')}
            >
              <span className="tab-icon">📊</span>
              Analytics
            </button>
          </div>
        </div>
        <div className="header-right">
          <ConnectionStatus />
        </div>
      </div>
      
      {activeTab === 'cases' ? (
        <>
          <div className="filters-section">
            <div className="filters-top-row">
              <div className="search-input">
                <input
                  type="text"
                  placeholder="Search cases, defendants, case numbers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-field"
                />
              </div>
              
              <div className="sort-toggle">
                <label>Sort by:</label>
                <button 
                  className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
                  onClick={() => setSortBy('date')}
                >
                  Date
                </button>
                <button 
                  className={`sort-btn ${sortBy === 'court' ? 'active' : ''}`}
                  onClick={() => setSortBy('court')}
                >
                  Court
                </button>
              </div>

              <div className="sort-toggle county-filter">
                <label>County:</label>
                <button
                  className={`sort-btn ${selectedCounty === '' ? 'active' : ''}`}
                  onClick={() => setSelectedCounty('')}
                >
                  All
                </button>
                {allCounties.map(county => (
                  <button
                    key={county}
                    className={`sort-btn ${selectedCounty === county ? 'active' : ''}`}
                    onClick={() => setSelectedCounty(county)}
                  >
                    {formatCounty(county)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="filters-bottom-row">
              <div className="filter-group">
                <label>Court</label>
                <select 
                  value={selectedCourts[0] || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedCourts([e.target.value]);
                    } else {
                      setSelectedCourts([]);
                    }
                  }}
                >
                  <option value="">All Courts</option>
                  {allCourts.map(court => (
                    <option key={court} value={court}>{court}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={selectedStatus[0] || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedStatus([e.target.value]);
                    } else {
                      setSelectedStatus([]);
                    }
                  }}
                >
                  <option value="">All Status</option>
                  {allStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              
              <label className="checkbox-filter">
                <input
                  type="checkbox"
                  checked={showUpcomingOnly}
                  onChange={(e) => setShowUpcomingOnly(e.target.checked)}
                />
                Show upcoming only
              </label>
            </div>
          </div>
          
          <div className="cases-container">
            {sortBy === 'court' && groupedByCourt ? (
              // Court grouping with date sub-headers
              Object.entries(groupedByCourt).map(([courtName, dateGroups]) => (
                <div key={courtName} className="case-group">
                  <h3 className="group-header">{courtName}</h3>
                  {Object.entries(dateGroups).map(([dateKey, dateCases]) => (
                    <div key={`${courtName}-${dateKey}`} className="date-subgroup">
                      <h4 className="date-subheader">{formatDateHeader(dateKey)}</h4>
                      {renderCaseCards(dateCases)}
                    </div>
                  ))}
                </div>
              ))
            ) : groupedByDate ? (
              // Date grouping (default)
              Object.entries(groupedByDate).map(([groupKey, groupCases]) => (
                <div key={groupKey} className="case-group">
                  <h3 className="group-header">{formatDateHeader(groupKey)}</h3>
                  {renderCaseCards(groupCases)}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <h3>No cases found</h3>
                <p>Try adjusting your filters</p>
              </div>
            )}
          </div>
        </>
      ) : (
        renderAnalytics()
      )}
      
      {renderCaseModal()}
      
      {/* Floating Export Buttons */}
      <div className="floating-export-buttons">
        <button onClick={exportToCSV} title="Export to CSV">
          <span>📊</span> CSV
        </button>
        <button onClick={exportToPDF} title="Export to PDF">
          <span>📄</span> PDF
        </button>
      </div>
    </div>
  );
}

export default CasesDashboardV3;