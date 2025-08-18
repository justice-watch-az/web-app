import { format, parseISO, isValid } from 'date-fns';
import type { CaseWithRelations } from '../types/database';

/**
 * Data transformation utilities for converting between database format
 * and component display format
 */

// Group cases by hearing date for dashboard display
export const groupCasesByDate = (cases: CaseWithRelations[]) => {
  const grouped: Record<string, CaseWithRelations[]> = {};
  
  cases.forEach(caseData => {
    // Use next_hearing if available, otherwise use filing_date
    const dateStr = caseData.next_hearing || caseData.filing_date;
    
    if (dateStr) {
      const date = parseISO(dateStr);
      if (isValid(date)) {
        const dateKey = format(date, 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(caseData);
      }
    } else {
      // Cases without dates go into 'No Date' group
      if (!grouped['No Date']) {
        grouped['No Date'] = [];
      }
      grouped['No Date'].push(caseData);
    }
  });
  
  // Sort each group by time
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) => {
      const timeA = a.next_hearing || a.created_at;
      const timeB = b.next_hearing || b.created_at;
      return timeA.localeCompare(timeB);
    });
  });
  
  return grouped;
};

// Format date for display
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  
  try {
    const date = parseISO(dateStr);
    if (isValid(date)) {
      return format(date, 'MMM dd, yyyy');
    }
  } catch {
    // Fallback for invalid dates
  }
  
  return dateStr;
};

// Format time for display
export const formatTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '';
  
  try {
    // Handle time-only strings (HH:mm:ss)
    if (timeStr.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    }
    
    // Handle full datetime strings
    const date = parseISO(timeStr);
    if (isValid(date)) {
      return format(date, 'h:mm a');
    }
  } catch {
    // Fallback for invalid times
  }
  
  return timeStr;
};

// Parse parties from case data
export const parseParties = (caseData: CaseWithRelations) => {
  const parties = {
    plaintiff: null as any,
    defendant: null as any
  };
  
  // First try to get from case_parties table
  if (caseData.case_parties && caseData.case_parties.length > 0) {
    parties.plaintiff = caseData.case_parties.find(p => p.party_type === 'plaintiff') || null;
    parties.defendant = caseData.case_parties.find(p => p.party_type === 'defendant') || null;
  }
  
  // If no parties in database, extract from case title (format: "State of Arizona vs DEFENDANT NAME")
  if (!parties.plaintiff && !parties.defendant && caseData.case_title) {
    const titleParts = caseData.case_title.split(' vs ');
    if (titleParts.length >= 2) {
      parties.plaintiff = {
        party_type: 'plaintiff',
        party_name: titleParts[0].trim(),
        attorney: null
      };
      parties.defendant = {
        party_type: 'defendant', 
        party_name: titleParts[1].trim(),
        attorney: null
      };
    }
  }
  
  return parties;
};

// Parse charges/docket entries
export const parseDocketEntries = (caseData: CaseWithRelations) => {
  if (!caseData.case_charges) return [];
  
  return caseData.case_charges.map(charge => ({
    type: 'charge',
    ars_code: charge.ars_code || '',
    description: charge.description || '',
    date: charge.crime_date || '',
    disposition: charge.disposition || '',
    disposition_date: charge.disposition_date || ''
  }));
};

// Get next hearing info
export const getNextHearing = (caseData: CaseWithRelations) => {
  if (!caseData.case_calendar || caseData.case_calendar.length === 0) {
    return null;
  }
  
  // Find future hearings
  const now = new Date();
  const futureHearings = caseData.case_calendar
    .filter(hearing => {
      if (!hearing.hearing_date) return false;
      const hearingDate = parseISO(hearing.hearing_date);
      return isValid(hearingDate) && hearingDate >= now;
    })
    .sort((a, b) => {
      const dateA = a.hearing_date || '';
      const dateB = b.hearing_date || '';
      return dateA.localeCompare(dateB);
    });
  
  if (futureHearings.length > 0) {
    const next = futureHearings[0];
    return {
      date: next.hearing_date,
      time: next.hearing_time,
      type: next.event_type,
      location: next.location
    };
  }
  
  return null;
};

// Filter cases by search term
export const filterCases = (
  cases: CaseWithRelations[], 
  searchTerm: string
): CaseWithRelations[] => {
  if (!searchTerm.trim()) return cases;
  
  const term = searchTerm.toLowerCase();
  
  return cases.filter(caseData => {
    // Search in main case fields
    if (caseData.case_number?.toLowerCase().includes(term)) return true;
    if (caseData.case_title?.toLowerCase().includes(term)) return true;
    if (caseData.court_name?.toLowerCase().includes(term)) return true;
    if (caseData.judge?.toLowerCase().includes(term)) return true;
    if (caseData.case_type?.toLowerCase().includes(term)) return true;
    if (caseData.status?.toLowerCase().includes(term)) return true;
    
    // Search in parties
    if (caseData.case_parties?.some(party => 
      party.party_name?.toLowerCase().includes(term) ||
      party.attorney?.toLowerCase().includes(term)
    )) return true;
    
    // Search in charges
    if (caseData.case_charges?.some(charge =>
      charge.ars_code?.toLowerCase().includes(term) ||
      charge.description?.toLowerCase().includes(term)
    )) return true;
    
    return false;
  });
};

// Sort cases by various criteria
export const sortCases = (
  cases: CaseWithRelations[],
  sortBy: 'date' | 'case_number' | 'court' | 'type'
): CaseWithRelations[] => {
  const sorted = [...cases];
  
  switch (sortBy) {
    case 'date':
      return sorted.sort((a, b) => {
        const dateA = a.next_hearing || a.filing_date || '';
        const dateB = b.next_hearing || b.filing_date || '';
        return dateB.localeCompare(dateA); // Newest first
      });
      
    case 'case_number':
      return sorted.sort((a, b) => 
        a.case_number.localeCompare(b.case_number)
      );
      
    case 'court':
      return sorted.sort((a, b) => {
        const courtA = a.court_name || '';
        const courtB = b.court_name || '';
        return courtA.localeCompare(courtB);
      });
      
    case 'type':
      return sorted.sort((a, b) => {
        const typeA = a.case_type || '';
        const typeB = b.case_type || '';
        return typeA.localeCompare(typeB);
      });
      
    default:
      return sorted;
  }
};

// Generate CSV export data
export const generateCSV = (cases: CaseWithRelations[]): string => {
  const headers = [
    'Case Number',
    'Court',
    'Title',
    'Type',
    'Status',
    'Filing Date',
    'Judge',
    'Next Hearing',
    'Plaintiff',
    'Defendant',
    'Charges'
  ];
  
  const rows = cases.map(caseData => {
    const parties = parseParties(caseData);
    const charges = parseDocketEntries(caseData);
    
    return [
      caseData.case_number,
      caseData.court_name || '',
      caseData.case_title || '',
      caseData.case_type || '',
      caseData.status || '',
      formatDate(caseData.filing_date),
      caseData.judge || '',
      formatDate(caseData.next_hearing),
      parties.plaintiff?.party_name || '',
      parties.defendant?.party_name || '',
      charges.map(c => c.description).join('; ')
    ];
  });
  
  // Build CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    )
  ].join('\n');
  
  return csvContent;
};