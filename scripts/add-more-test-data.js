import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMoreTestData() {
  console.log('Adding more test cases...');
  
  // Add more test cases with specific dates
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .insert([
      // 3 cases for Jan 30
      {
        case_number: 'CR2025-001240',
        case_title: 'STATE OF ARIZONA vs MICHAEL JOHNSON',
        case_type: 'Criminal',
        court_name: 'Agua Fria Justice Court',
        filing_date: '2025-01-18',
        status: 'Active',
        judge: 'Judge Smith',
        location: 'Courtroom 2',
        next_hearing: '2025-01-30T09:00:00',
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'CR2025-001241',
        case_title: 'STATE OF ARIZONA vs SARAH WILLIAMS',
        case_type: 'Criminal',
        court_name: 'Desert Ridge Justice Court',
        filing_date: '2025-01-19',
        status: 'Active',
        judge: 'Judge Johnson',
        location: 'Courtroom 1',
        next_hearing: '2025-01-30T10:30:00',
        scraped_at: new Date().toISOString()
      },
      {
        case_number: 'TR2025-005680',
        case_title: 'STATE OF ARIZONA vs JAMES BROWN',
        case_type: 'Traffic',
        court_name: 'North Valley Justice Court',
        filing_date: '2025-01-18',
        status: 'Active',
        judge: 'Judge Williams',
        location: 'Courtroom 3',
        next_hearing: '2025-01-30T14:00:00',
        scraped_at: new Date().toISOString()
      },
      // 1 more case for Jan 25
      {
        case_number: 'CR2025-001242',
        case_title: 'STATE OF ARIZONA vs LISA MARTINEZ',
        case_type: 'Criminal',
        court_name: 'Desert Ridge Justice Court',
        filing_date: '2025-01-14',
        status: 'Active',
        judge: 'Judge Johnson',
        location: 'Courtroom 2',
        next_hearing: '2025-01-25T09:30:00',
        scraped_at: new Date().toISOString()
      },
      // 1 more case for Jan 20
      {
        case_number: 'CR2025-001243',
        case_title: 'STATE OF ARIZONA vs KEVIN ANDERSON',
        case_type: 'Criminal',
        court_name: 'North Valley Justice Court',
        filing_date: '2025-01-13',
        status: 'Active',
        judge: 'Judge Brown',
        location: 'Courtroom 4',
        next_hearing: '2025-01-20T15:00:00',
        scraped_at: new Date().toISOString()
      }
    ])
    .select();

  if (casesError) {
    console.error('Error inserting cases:', casesError);
    return;
  }

  console.log(`Inserted ${cases.length} additional test cases`);

  // Insert parties for the new cases
  const partyInserts = [];
  
  for (const caseRecord of cases) {
    // Add plaintiff (State of Arizona for criminal/traffic cases)
    if (caseRecord.case_type === 'Criminal' || caseRecord.case_type === 'Traffic') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Plaintiff',
        party_name: 'STATE OF ARIZONA',
        attorney: 'District Attorney Office'
      });
    }

    // Add specific defendants
    if (caseRecord.case_number === 'CR2025-001240') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'MICHAEL JOHNSON',
        attorney: 'Attorney Davis'
      });
    } else if (caseRecord.case_number === 'CR2025-001241') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'SARAH WILLIAMS',
        attorney: null
      });
    } else if (caseRecord.case_number === 'TR2025-005680') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'JAMES BROWN',
        attorney: 'Traffic Attorney LLC'
      });
    } else if (caseRecord.case_number === 'CR2025-001242') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'LISA MARTINEZ',
        attorney: 'Public Defender Wilson'
      });
    } else if (caseRecord.case_number === 'CR2025-001243') {
      partyInserts.push({
        case_id: caseRecord.id,
        party_type: 'Defendant',
        party_name: 'KEVIN ANDERSON',
        attorney: 'Defense Attorney Group'
      });
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

  // Insert charges for the new criminal cases
  const chargeInserts = [];
  
  for (const caseRecord of cases) {
    if (caseRecord.case_number === 'CR2025-001240') {
      chargeInserts.push({
        case_id: caseRecord.id,
        charge_description: 'BURGLARY',
        statute: 'ARS 13-1507',
        severity: 'Felony'
      });
    } else if (caseRecord.case_number === 'CR2025-001241') {
      chargeInserts.push(
        {
          case_id: caseRecord.id,
          charge_description: 'POSSESSION OF CONTROLLED SUBSTANCE',
          statute: 'ARS 13-3407',
          severity: 'Felony'
        },
        {
          case_id: caseRecord.id,
          charge_description: 'DRUG PARAPHERNALIA',
          statute: 'ARS 13-3415',
          severity: 'Misdemeanor'
        }
      );
    } else if (caseRecord.case_number === 'TR2025-005680') {
      chargeInserts.push({
        case_id: caseRecord.id,
        charge_description: 'RECKLESS DRIVING',
        statute: 'ARS 28-693',
        severity: 'Criminal Traffic'
      });
    } else if (caseRecord.case_number === 'CR2025-001242') {
      chargeInserts.push({
        case_id: caseRecord.id,
        charge_description: 'SHOPLIFTING',
        statute: 'ARS 13-1805',
        severity: 'Misdemeanor'
      });
    } else if (caseRecord.case_number === 'CR2025-001243') {
      chargeInserts.push(
        {
          case_id: caseRecord.id,
          charge_description: 'AGGRAVATED ASSAULT',
          statute: 'ARS 13-1204',
          severity: 'Felony'
        },
        {
          case_id: caseRecord.id,
          charge_description: 'CRIMINAL DAMAGE',
          statute: 'ARS 13-1602',
          severity: 'Misdemeanor'
        }
      );
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

  // Insert calendar events for the new cases
  const calendarInserts = [];
  
  for (const caseRecord of cases) {
    if (caseRecord.case_number === 'CR2025-001240') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Arraignment Hearing',
        event_date: '2025-01-30T09:00:00',
        location: 'Courtroom 2',
        notes: 'Burglary charges - bail review'
      });
    } else if (caseRecord.case_number === 'CR2025-001241') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Arraignment Hearing',
        event_date: '2025-01-30T10:30:00',
        location: 'Courtroom 1',
        notes: 'Drug possession charges'
      });
    } else if (caseRecord.case_number === 'TR2025-005680') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Traffic Court',
        event_date: '2025-01-30T14:00:00',
        location: 'Courtroom 3',
        notes: 'Reckless driving hearing'
      });
    } else if (caseRecord.case_number === 'CR2025-001242') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Arraignment Hearing',
        event_date: '2025-01-25T09:30:00',
        location: 'Courtroom 2',
        notes: 'Shoplifting case - plea expected'
      });
    } else if (caseRecord.case_number === 'CR2025-001243') {
      calendarInserts.push({
        case_id: caseRecord.id,
        event_type: 'Arraignment Hearing',
        event_date: '2025-01-20T15:00:00',
        location: 'Courtroom 4',
        notes: 'Aggravated assault - preliminary hearing'
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

  console.log('\n✅ Additional test data inserted successfully!');
  console.log('\nNew cases added:');
  console.log('- Jan 20: 2 cases total (1 existing + 1 new)');
  console.log('- Jan 25: 2 cases total (1 existing + 1 new)');
  console.log('- Jan 30: 5 cases total (2 existing + 3 new)');
  console.log('\nRefresh your browser to see the new cases in the dashboard.');
  process.exit(0);
}

addMoreTestData().catch(console.error);