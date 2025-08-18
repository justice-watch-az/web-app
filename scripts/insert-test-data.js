import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertTestData() {
  console.log('Inserting test cases...');
  
  // Insert test cases
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .insert([
      {
        case_number: 'CR2025-001234',
        case_title: 'STATE OF ARIZONA vs JOHN DOE',
        case_type: 'Criminal',
        court_name: 'Agua Fria Justice Court',
        filing_date: '2025-01-15',
        status: 'Active',
        judge: 'Judge Smith',
        location: 'Courtroom 1',
        next_hearing: '2025-01-20T09:00:00',
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'CR2025-001235',
        case_title: 'STATE OF ARIZONA vs JANE SMITH',
        case_type: 'Criminal',
        court_name: 'Desert Ridge Justice Court',
        filing_date: '2025-01-16',
        status: 'Active',
        judge: 'Judge Johnson',
        location: 'Courtroom 2',
        next_hearing: '2025-01-21T10:00:00',
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'CR2025-001236',
        case_title: 'STATE OF ARIZONA vs ROBERT JONES',
        case_type: 'Criminal',
        court_name: 'North Valley Justice Court',
        filing_date: '2025-01-17',
        status: 'Active',
        judge: 'Judge Williams',
        location: 'Courtroom 3',
        next_hearing: '2025-01-22T14:00:00',
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'TR2025-005678',
        case_title: 'STATE OF ARIZONA vs MARIA GARCIA',
        case_type: 'Traffic',
        court_name: 'Agua Fria Justice Court',
        filing_date: '2025-01-10',
        status: 'Active',
        judge: 'Judge Smith',
        location: 'Courtroom 1',
        next_hearing: '2025-01-25T11:00:00',
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'TR2025-005679',
        case_title: 'STATE OF ARIZONA vs DAVID LEE',
        case_type: 'Traffic',
        court_name: 'Desert Ridge Justice Court',
        filing_date: '2025-01-12',
        status: 'Closed',
        judge: 'Judge Johnson',
        location: 'Courtroom 2',
        next_hearing: null,
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'CV2025-002345',
        case_title: 'LANDLORD LLC vs TENANT SMITH',
        case_type: 'Civil',
        court_name: 'North Valley Justice Court',
        filing_date: '2025-01-05',
        status: 'Active',
        judge: 'Judge Brown',
        location: 'Courtroom 4',
        next_hearing: '2025-01-28T13:00:00',
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'CV2025-002346',
        case_title: 'CREDITOR CORP vs DEBTOR DOE',
        case_type: 'Civil',
        court_name: 'Agua Fria Justice Court',
        filing_date: '2025-01-08',
        status: 'Active',
        judge: 'Judge Davis',
        location: 'Courtroom 1',
        next_hearing: '2025-01-30T15:00:00',
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'CR2024-009999',
        case_title: 'STATE OF ARIZONA vs OLD DEFENDANT',
        case_type: 'Criminal',
        court_name: 'Desert Ridge Justice Court',
        filing_date: '2024-11-15',
        status: 'Closed',
        judge: 'Judge Wilson',
        location: 'Courtroom 2',
        next_hearing: null,
        scraped_at: '2024-11-20T00:00:00'
      },
      {
        case_number: 'TR2024-008888',
        case_title: 'STATE OF ARIZONA vs PAST DRIVER',
        case_type: 'Traffic',
        court_name: 'North Valley Justice Court',
        filing_date: '2024-10-20',
        status: 'Closed',
        judge: 'Judge Taylor',
        location: 'Courtroom 3',
        next_hearing: null,
        scraped_at: '2024-10-25T00:00:00'
      }
    ])
    .select();

  if (casesError) {
    console.error('Error inserting cases:', casesError);
    return;
  }

  console.log(`Inserted ${cases.length} test cases`);

  // Insert parties for the cases
  const partyInserts = [];
  
  for (const caseRecord of cases) {
    if (caseRecord.case_type === 'Criminal' || caseRecord.case_type === 'Traffic') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Plaintiff',
        party_name: 'STATE OF ARIZONA',
        attorney: 'District Attorney Office'
      });
    }

    // Add specific defendants
    if (caseRecord.case_number === 'CR2025-001234') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'JOHN DOE',
        attorney: 'Public Defender Smith'
      });
    } else if (caseRecord.case_number === 'CR2025-001235') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'JANE SMITH',
        attorney: 'Attorney Johnson'
      });
    } else if (caseRecord.case_number === 'CR2025-001236') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'ROBERT JONES',
        attorney: null
      });
    } else if (caseRecord.case_number === 'TR2025-005678') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'MARIA GARCIA',
        attorney: null
      });
    } else if (caseRecord.case_number === 'TR2025-005679') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'DAVID LEE',
        attorney: 'Attorney Brown'
      });
    } else if (caseRecord.case_number === 'CV2025-002345') {
      partyInserts.push(
        {
          case_id: caseRecord.id,
          party_type: 'Plaintiff',
          party_name: 'LANDLORD LLC',
          attorney: 'Property Law Firm'
        },
        {
          case_id: caseRecord.id,
          party_type: 'Defendant',
          party_name: 'TENANT SMITH',
          attorney: null
        }
      );
    } else if (caseRecord.case_number === 'CV2025-002346') {
      partyInserts.push(
        {
          case_id: caseRecord.id,
          party_type: 'Plaintiff',
          party_name: 'CREDITOR CORP',
          attorney: 'Collections Attorney'
        },
        {
          case_id: caseRecord.id,
          party_type: 'Defendant',
          party_name: 'DEBTOR DOE',
          attorney: null
        }
      );
    }
  }

  const { data: parties, error: partiesError } = await supabase
    .from('case_parties')
    .insert(partyInserts);

  if (partiesError) {
    console.error('Error inserting parties:', partiesError);
  } else {
    console.log(`Inserted ${partyInserts.length} parties`);
  }

  // Insert charges for criminal cases
  const chargeInserts = [];
  
  for (const caseRecord of cases) {
    if (caseRecord.case_number === 'CR2025-001234') {
      chargeInserts.push(
        {
          case_id: caseRecord.id,
          charge_description: 'ASSAULT',
          statute: 'ARS 13-1203',
          severity: 'Misdemeanor'
        },
        {
          case_id: caseRecord.id,
          charge_description: 'DISORDERLY CONDUCT',
          statute: 'ARS 13-2904',
          severity: 'Misdemeanor'
        }
      );
    } else if (caseRecord.case_number === 'CR2025-001235') {
      chargeInserts.push({
        case_id: caseRecord.id,
        charge_description: 'THEFT',
        statute: 'ARS 13-1802',
        severity: 'Felony'
      });
    } else if (caseRecord.case_number === 'CR2025-001236') {
      chargeInserts.push({
        case_id: caseRecord.id,
        charge_description: 'DUI',
        statute: 'ARS 28-1381',
        severity: 'Misdemeanor'
      });
    } else if (caseRecord.case_number === 'TR2025-005678') {
      chargeInserts.push({
        case_id: caseRecord.id,
        charge_description: 'SPEEDING',
        statute: 'ARS 28-701',
        severity: 'Civil Traffic'
      });
    } else if (caseRecord.case_number === 'TR2025-005679') {
      chargeInserts.push({
        case_id: caseRecord.id,
        charge_description: 'RED LIGHT VIOLATION',
        statute: 'ARS 28-645',
        severity: 'Civil Traffic'
      });
    }
  }

  const { data: charges, error: chargesError } = await supabase
    .from('case_charges')
    .insert(chargeInserts);

  if (chargesError) {
    console.error('Error inserting charges:', chargesError);
  } else {
    console.log(`Inserted ${chargeInserts.length} charges`);
  }

  // Insert calendar events
  const calendarInserts = [];
  
  for (const caseRecord of cases) {
    if (caseRecord.case_number === 'CR2025-001234') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Arraignment Hearing',
        event_date: '2025-01-20T09:00:00',
        location: 'Courtroom 1',
        notes: 'Initial appearance'
      });
    } else if (caseRecord.case_number === 'CR2025-001235') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Arraignment Hearing',
        event_date: '2025-01-21T10:00:00',
        location: 'Courtroom 2',
        notes: 'Plea entry expected'
      });
    } else if (caseRecord.case_number === 'CR2025-001236') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Arraignment Hearing',
        event_date: '2025-01-22T14:00:00',
        location: 'Courtroom 3',
        notes: 'Bail hearing included'
      });
    } else if (caseRecord.case_number === 'TR2025-005678') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Traffic Court',
        event_date: '2025-01-25T11:00:00',
        location: 'Courtroom 1',
        notes: 'Citation hearing'
      });
    } else if (caseRecord.case_number === 'CV2025-002345') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Eviction Hearing',
        event_date: '2025-01-28T13:00:00',
        location: 'Courtroom 4',
        notes: 'Forcible detainer'
      });
    } else if (caseRecord.case_number === 'CV2025-002346') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Judgment Hearing',
        event_date: '2025-01-30T15:00:00',
        location: 'Courtroom 1',
        notes: 'Default judgment motion'
      });
    }
  }

  const { data: calendar, error: calendarError } = await supabase
    .from('case_calendar')
    .insert(calendarInserts);

  if (calendarError) {
    console.error('Error inserting calendar events:', calendarError);
  } else {
    console.log(`Inserted ${calendarInserts.length} calendar events`);
  }

  // Insert a scrape log entry
  const { data: scrapeLog, error: scrapeLogError } = await supabase
    .from('scrape_logs')
    .insert({
      scrape_type: 'scheduled',
      status: 'completed',
      started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      cases_found: 9,
      cases_processed: 9,
      error_message: null
    });

  if (scrapeLogError) {
    console.error('Error inserting scrape log:', scrapeLogError);
  } else {
    console.log('Inserted scrape log entry');
  }

  console.log('\n✅ Test data inserted successfully!');
  console.log('Refresh your browser to see the test cases in the dashboard.');
  process.exit(0);
}

insertTestData().catch(console.error);