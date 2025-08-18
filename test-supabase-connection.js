import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl);
  
  try {
    // Test 1: Insert a test case
    console.log('\n1. Inserting test case...');
    const { data: insertedCase, error: insertError } = await supabase
      .from('cases')
      .insert({
        case_number: 'TEST2025000001',
        court_name: 'Agua Fria Justice Court',
        case_title: 'State vs Test Defendant',
        case_type: 'Criminal',
        status: 'Open',
        filing_date: '2025-01-17',
        judge: 'Judge Test',
        location: 'Courtroom 1',
        next_hearing: '2025-01-20T09:00:00',
        raw_data: { test: true }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return;
    }
    console.log('✅ Case inserted:', insertedCase.case_number);

    // Test 2: Query the case
    console.log('\n2. Querying cases...');
    const { data: cases, error: queryError } = await supabase
      .from('cases')
      .select('*')
      .eq('case_number', 'TEST2025000001');

    if (queryError) {
      console.error('Query error:', queryError);
      return;
    }
    console.log('✅ Found', cases.length, 'case(s)');

    // Test 3: Call the stats function
    console.log('\n3. Getting case statistics...');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_case_stats');

    if (statsError) {
      console.error('Stats error:', statsError);
      return;
    }
    console.log('✅ Stats:', JSON.stringify(stats, null, 2));

    // Test 4: Clean up - delete test case
    console.log('\n4. Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('cases')
      .delete()
      .eq('case_number', 'TEST2025000001');

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return;
    }
    console.log('✅ Test case deleted');

    console.log('\n🎉 All tests passed! Supabase is properly configured.');
    console.log('\nYou can access Supabase Studio at: http://127.0.0.1:54323');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testConnection();