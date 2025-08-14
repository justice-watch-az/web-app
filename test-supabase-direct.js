const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tsgvxobkmmvsbjzxvuas.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZ3Z4b2JrbW12c2Jqenh2dWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwNjAxMCwiZXhwIjoyMDcwNjgyMDEwfQ.8HVnQhpnLHFWKPDaX7AnlydJ_dVu7mErl1YBs43Rl4k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Testing Supabase direct insert...');
  
  // Test case data
  const testCase = {
    case_number: 'TEST-' + Date.now(),
    court_id: 'test_court',
    court_name: 'Test Justice Court',
    case_title: 'Test Case',
    case_type: 'Criminal',
    case_status: 'Active',
    filing_date: '2025-01-01',
    judge: 'Test Judge',
    location: 'Test Location',
    case_url: 'http://test.com',
    user_id: null,
    parties: JSON.stringify([{name: 'Test Party'}]),
    charges: JSON.stringify([{description: 'Test Charge'}]),
    calendar: JSON.stringify([]),
    documents: JSON.stringify([]),
    events: JSON.stringify([]),
    judgments: JSON.stringify([]),
    raw_data: JSON.stringify({test: true})
  };
  
  console.log('Inserting test case:', testCase.case_number);
  
  const { data, error } = await supabase
    .from('cases')
    .insert(testCase)
    .select();
  
  if (error) {
    console.error('ERROR inserting:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS! Inserted:', data);
  }
  
  // Try to read it back
  console.log('\nReading back the case...');
  const { data: readData, error: readError } = await supabase
    .from('cases')
    .select('*')
    .eq('case_number', testCase.case_number);
  
  if (readError) {
    console.error('ERROR reading:', readError);
  } else {
    console.log('Found cases:', readData?.length || 0);
    if (readData?.length > 0) {
      console.log('Case verified in Supabase!');
    }
  }
}

testInsert().catch(console.error);