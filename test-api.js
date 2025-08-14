const fetch = require('node-fetch');

async function testAPI() {
  console.log('Testing API endpoints...\n');
  
  // First, let's test if we can connect to the API
  try {
    // Test /api/cases endpoint
    console.log('Testing /api/cases...');
    const casesRes = await fetch('http://localhost:3001/api/cases', {
      headers: {
        'Authorization': 'Bearer test' // Just testing if endpoint responds
      }
    });
    
    if (casesRes.ok) {
      const data = await casesRes.json();
      console.log('✓ /api/cases responded');
      console.log('  Cases returned:', data.cases?.length || 0);
      if (data.cases?.length > 0) {
        console.log('  Sample case:', data.cases[0]);
      }
    } else {
      console.log('✗ /api/cases error:', casesRes.status, casesRes.statusText);
    }
    
    // Test /api/cases/statistics endpoint
    console.log('\nTesting /api/cases/statistics...');
    const statsRes = await fetch('http://localhost:3001/api/cases/statistics', {
      headers: {
        'Authorization': 'Bearer test'
      }
    });
    
    if (statsRes.ok) {
      const stats = await statsRes.json();
      console.log('✓ /api/cases/statistics responded');
      console.log('  Stats:', stats);
    } else {
      console.log('✗ /api/cases/statistics error:', statsRes.status, statsRes.statusText);
    }
    
  } catch (error) {
    console.error('Connection error:', error.message);
    console.log('\nMake sure the server is running on port 3001');
  }
}

// Also test direct Supabase connection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tsgvxobkmmvsbjzxvuas.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZ3Z4b2JrbW12c2Jqenh2dWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwNjAxMCwiZXhwIjoyMDcwNjgyMDEwfQ.8HVnQhpnLHFWKPDaX7AnlydJ_dVu7mErl1YBs43Rl4k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseDirect() {
  console.log('\n\nTesting direct Supabase connection...\n');
  
  const { data, error, count } = await supabase
    .from('cases')
    .select('*', { count: 'exact' })
    .limit(5);
  
  if (error) {
    console.error('Supabase error:', error);
  } else {
    console.log('✓ Direct Supabase query succeeded!');
    console.log('  Total cases in database:', count);
    console.log('  Sample cases:', data?.length || 0);
    if (data?.length > 0) {
      console.log('\n  First case:');
      console.log('    - Case #:', data[0].case_number);
      console.log('    - Court:', data[0].court_name);
      console.log('    - Title:', data[0].case_title);
      console.log('    - Status:', data[0].status);
    }
  }
}

testAPI().then(() => testSupabaseDirect());