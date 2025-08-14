const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tsgvxobkmmvsbjzxvuas.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZ3Z4b2JrbW12c2Jqenh2dWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwNjAxMCwiZXhwIjoyMDcwNjgyMDEwfQ.8HVnQhpnLHFWKPDaX7AnlydJ_dVu7mErl1YBs43Rl4k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking Supabase schema...\n');
  
  // Try a minimal insert with only basic fields
  const minimalCase = {
    case_number: 'SCHEMA-TEST-' + Date.now(),
    case_title: 'Schema Test',
    case_type: 'Test',
    filing_date: '2025-01-01',
    status: 'Active'
  };
  
  console.log('Trying minimal insert with:', Object.keys(minimalCase).join(', '));
  
  const { data, error } = await supabase
    .from('cases')
    .insert(minimalCase)
    .select();
  
  if (error) {
    console.error('Minimal insert failed:', error.message);
    
    // Try even more minimal
    const superMinimal = {
      case_number: 'MINIMAL-' + Date.now()
    };
    
    console.log('\nTrying super minimal with just case_number...');
    const { data: minData, error: minError } = await supabase
      .from('cases')
      .insert(superMinimal)
      .select();
    
    if (minError) {
      console.error('Super minimal failed:', minError.message);
    } else {
      console.log('Super minimal succeeded!');
      console.log('Returned columns:', Object.keys(minData[0]));
    }
  } else {
    console.log('Minimal insert succeeded!');
    console.log('Returned columns:', Object.keys(data[0]));
  }
  
  // Try to get existing cases to see structure
  console.log('\nFetching existing cases to see structure...');
  const { data: existingCases, error: fetchError } = await supabase
    .from('cases')
    .select('*')
    .limit(1);
  
  if (!fetchError && existingCases?.length > 0) {
    console.log('Existing case columns:', Object.keys(existingCases[0]));
    console.log('Sample values:', existingCases[0]);
  } else if (fetchError) {
    console.error('Fetch error:', fetchError.message);
  } else {
    console.log('No existing cases found');
  }
}

checkSchema().catch(console.error);