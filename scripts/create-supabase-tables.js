#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.production');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function createTables() {
  console.log('\n📋 Creating Justice Watch tables in Supabase...\n');
  
  // Since Supabase doesn't have a direct SQL execution method via JS client,
  // we'll use the REST API approach
  
  const tables = [
    {
      name: 'users',
      check: async () => {
        const { error } = await supabase.from('users').select('id').limit(1);
        return !error || error.code !== '42P01';
      }
    },
    {
      name: 'cases',
      check: async () => {
        const { error } = await supabase.from('cases').select('id').limit(1);
        return !error || error.code !== '42P01';
      }
    },
    {
      name: 'case_parties',
      check: async () => {
        const { error } = await supabase.from('case_parties').select('id').limit(1);
        return !error || error.code !== '42P01';
      }
    },
    {
      name: 'case_charges',
      check: async () => {
        const { error } = await supabase.from('case_charges').select('id').limit(1);
        return !error || error.code !== '42P01';
      }
    },
    {
      name: 'case_calendar',
      check: async () => {
        const { error } = await supabase.from('case_calendar').select('id').limit(1);
        return !error || error.code !== '42P01';
      }
    }
  ];
  
  console.log('Checking existing tables...\n');
  
  for (const table of tables) {
    const exists = await table.check();
    console.log(`${exists ? '✅' : '❌'} Table: ${table.name} ${exists ? 'exists' : 'not found'}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📝 MANUAL SETUP REQUIRED');
  console.log('='.repeat(60));
  
  console.log(`
1. Go to your Supabase Dashboard:
   ${supabaseUrl.replace('.supabase.co', '.supabase.com/project/')}
   
2. Click on "SQL Editor" in the left sidebar

3. Click "New Query"

4. Copy and paste the contents of:
   database/supabase_ready.sql

5. Click "Run" to create all tables

6. After tables are created, run another query with:
   database/supabase_rls.sql
   
7. Enable Supabase Auth:
   - Go to Authentication > Providers
   - Enable Email provider
   
8. Get your Anon Key:
   - Go to Settings > API
   - Copy the "anon" key
   - Update .env.production with SUPABASE_ANON_KEY
`);

  // Test if we can fetch from the API
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });
    
    if (response.ok) {
      console.log('✅ API connection successful\n');
    }
  } catch (error) {
    console.log('⚠️  API connection test failed:', error.message);
  }
  
  // Save project URL for easy access
  const fs = require('fs');
  const projectUrl = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  
  console.log('Your Supabase project ID:', projectUrl);
  console.log('Dashboard URL:', `https://supabase.com/dashboard/project/${projectUrl}`);
}

createTables().catch(console.error);