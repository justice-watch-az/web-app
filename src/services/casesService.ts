import { supabase } from './supabase';
import type { 
  CaseWithRelations, 
  CaseSummary, 
  Statistics 
} from '../types/database';

/**
 * Cases Service - Handles all case-related data operations
 */

// Get cases with related data
export const getCases = async (
  limit = 100, 
  offset = 0
): Promise<CaseWithRelations[]> => {
  const { data, error } = await supabase
    .from('cases')
    .select(`
      *,
      case_parties (*),
      case_charges (*),
      case_calendar (*)
    `)
    .order('scraped_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching cases:', error);
    throw error;
  }

  return data || [];
};

// Search cases by various criteria
export const searchCases = async (
  searchTerm: string
): Promise<CaseWithRelations[]> => {
  const { data, error } = await supabase
    .from('cases')
    .select(`
      *,
      case_parties (*),
      case_charges (*),
      case_calendar (*)
    `)
    .or(`
      case_number.ilike.%${searchTerm}%,
      case_title.ilike.%${searchTerm}%,
      court_name.ilike.%${searchTerm}%,
      judge.ilike.%${searchTerm}%
    `)
    .order('scraped_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error searching cases:', error);
    throw error;
  }

  return data || [];
};

// Get cases by court
export const getCasesByCourt = async (
  courtName: string
): Promise<CaseWithRelations[]> => {
  const { data, error } = await supabase
    .from('cases')
    .select(`
      *,
      case_parties (*),
      case_charges (*),
      case_calendar (*)
    `)
    .eq('court_name', courtName)
    .order('next_hearing', { ascending: true });

  if (error) {
    console.error('Error fetching cases by court:', error);
    throw error;
  }

  return data || [];
};

// Get cases with upcoming hearings
export const getUpcomingHearings = async (
  days = 7
): Promise<CaseWithRelations[]> => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  const { data, error } = await supabase
    .from('cases')
    .select(`
      *,
      case_parties (*),
      case_charges (*),
      case_calendar (*)
    `)
    .gte('next_hearing', new Date().toISOString())
    .lte('next_hearing', futureDate.toISOString())
    .order('next_hearing', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming hearings:', error);
    throw error;
  }

  return data || [];
};

// Get statistics for dashboard
export const getStatistics = async (): Promise<Statistics> => {
  try {
    // Get total cases count
    const { count: totalCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true });

    // Get cases by court
    const { data: courtData } = await supabase
      .from('cases')
      .select('court_name')
      .not('court_name', 'is', null);

    const casesByCourt: Record<string, number> = {};
    courtData?.forEach(row => {
      const court = row.court_name || 'Unknown';
      casesByCourt[court] = (casesByCourt[court] || 0) + 1;
    });

    // Get cases by type
    const { data: typeData } = await supabase
      .from('cases')
      .select('case_type')
      .not('case_type', 'is', null);

    const casesByType: Record<string, number> = {};
    typeData?.forEach(row => {
      const type = row.case_type || 'Unknown';
      casesByType[type] = (casesByType[type] || 0) + 1;
    });

    // Get charges breakdown
    const { data: chargesData } = await supabase
      .from('case_charges')
      .select('description')
      .not('description', 'is', null);

    const chargesBreakdown: Record<string, number> = {};
    chargesData?.forEach(row => {
      // Clean up and categorize the charge description
      let charge = row.description || 'Unknown';
      
      // Simplify common charge patterns
      if (charge.toLowerCase().includes('dui') || charge.toLowerCase().includes('driving under')) {
        charge = 'DUI/Impaired Driving';
      } else if (charge.toLowerCase().includes('speed') || charge.toLowerCase().includes('speeding')) {
        charge = 'Speeding';
      } else if (charge.toLowerCase().includes('assault')) {
        charge = 'Assault';
      } else if (charge.toLowerCase().includes('theft') || charge.toLowerCase().includes('shoplifting')) {
        charge = 'Theft/Shoplifting';
      } else if (charge.toLowerCase().includes('drug') || charge.toLowerCase().includes('narcotic')) {
        charge = 'Drug Related';
      } else if (charge.toLowerCase().includes('criminal damage')) {
        charge = 'Criminal Damage';
      } else if (charge.toLowerCase().includes('disorderly')) {
        charge = 'Disorderly Conduct';
      } else if (charge.toLowerCase().includes('trespass')) {
        charge = 'Trespassing';
      } else if (charge.toLowerCase().includes('license') || charge.toLowerCase().includes('registration')) {
        charge = 'License/Registration';
      } else if (charge.toLowerCase().includes('domestic')) {
        charge = 'Domestic Violence';
      } else if (charge.length > 50) {
        // Truncate very long descriptions
        charge = charge.substring(0, 50) + '...';
      }
      
      chargesBreakdown[charge] = (chargesBreakdown[charge] || 0) + 1;
    });

    // Get recent cases (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: recentCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .gte('scraped_at', sevenDaysAgo.toISOString());

    // Get upcoming hearings count
    const { count: upcomingHearings } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .gte('next_hearing', new Date().toISOString());

    return {
      total_cases: totalCases || 0,
      cases_by_court: casesByCourt,
      cases_by_type: casesByType,
      charges_breakdown: chargesBreakdown,
      recent_cases: recentCases || 0,
      upcoming_hearings: upcomingHearings || 0
    };
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return {
      total_cases: 0,
      cases_by_court: {},
      cases_by_type: {},
      charges_breakdown: {},
      recent_cases: 0,
      upcoming_hearings: 0
    };
  }
};

// Get last scrape information (prefers scrape_logs when present)
export const getLastScrapeInfo = async () => {
  const { data: log, error: logError } = await supabase
    .from('scrape_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!logError && log) {
    return log;
  }

  // Fallback: derive from cases.scraped_at if scrape_logs missing/empty
  const { data, error } = await supabase
    .from('cases')
    .select('scraped_at, case_number')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching last scrape info:', error);
  }

  return data
    ? {
        id: 'derived',
        scrape_type: 'cases',
        status: 'completed',
        courts_processed: null,
        cases_found: null,
        error_message: null,
        started_at: data.scraped_at,
        completed_at: data.scraped_at,
        created_at: data.scraped_at,
        last_scraped_at: data.scraped_at,
        last_case_number: data.case_number,
      }
    : null;
};

// Subscribe to new cases (real-time)
export const subscribeToCaseUpdates = (
  callback: (payload: any) => void
) => {
  const channel = supabase
    .channel('case-updates')
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'cases' 
      },
      callback
    )
    .subscribe();

  // Return cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
};

// Transform case data for legacy component compatibility
export const transformToLegacyFormat = (
  cases: CaseWithRelations[]
): CaseSummary[] => {
  return cases.map(caseData => {
    // Format parties as JSON string (legacy format)
    const parties = {
      plaintiff: caseData.case_parties?.find(p => p.party_type === 'plaintiff'),
      defendant: caseData.case_parties?.find(p => p.party_type === 'defendant')
    };

    // Format docket entries as JSON string (legacy format)
    const docketEntries = caseData.case_charges?.map(charge => ({
      type: 'charge',
      ars_code: charge.ars_code,
      description: charge.description,
      date: charge.crime_date
    })) || [];

    return {
      case_number: caseData.case_number,
      court_name: caseData.court_name || '',
      case_title: caseData.case_title || '',
      case_type: caseData.case_type || '',
      status: caseData.status || '',
      filing_date: caseData.filing_date || '',
      judge: caseData.judge || '',
      location: caseData.location || '',
      next_hearing: caseData.next_hearing,
      parties: JSON.stringify(parties),
      docket_entries: JSON.stringify(docketEntries)
    };
  });
};