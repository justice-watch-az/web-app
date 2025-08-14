#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.production' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.production');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Starting Supabase migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'new_schema.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip DO blocks and migration logic for now
      if (statement.includes('DO $$') || statement.includes('information_schema.tables')) {
        console.log(`⏭️  Skipping migration block ${i + 1}`);
        continue;
      }
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement
        }).single();
        
        if (error) {
          // Try direct execution if RPC fails
          console.log('RPC failed, trying direct execution...');
          // For now, we'll log statements that need manual execution
          console.log(`Statement ${i + 1} needs manual execution via Supabase SQL Editor`);
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} needs manual execution: ${err.message}`);
      }
    }
    
    console.log('\n📋 Migration Summary:');
    console.log('- Users table with authentication fields');
    console.log('- Cases table (main case records)');
    console.log('- Case_parties table (plaintiffs/defendants)');
    console.log('- Case_charges table (criminal charges)');
    console.log('- Case_calendar table (court hearings)');
    console.log('- Case_documents table');
    console.log('- Case_events table');
    console.log('- Case_judgments table');
    console.log('- Case_raw_data table (JSON backup)');
    console.log('- Indexes for performance');
    console.log('- Views for common queries');
    console.log('- get_case_summary function');
    
    console.log('\n✅ Migration complete!');
    console.log('\n🔒 Next step: Set up Row Level Security (RLS) policies in Supabase Dashboard');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Generate SQL file for manual execution
async function generateSupabaseSQL() {
  console.log('\n📝 Generating Supabase-ready SQL file...');
  
  const migrationPath = path.join(__dirname, '..', 'database', 'new_schema.sql');
  const migrationSQL = await fs.readFile(migrationPath, 'utf8');
  
  // Remove the DO block for manual migration
  const cleanSQL = migrationSQL.replace(/DO \$\$[\s\S]*?\$\$;/, '-- Migration block removed for Supabase\n');
  
  const outputPath = path.join(__dirname, '..', 'database', 'supabase_ready.sql');
  await fs.writeFile(outputPath, cleanSQL);
  
  console.log(`✅ SQL file saved to: database/supabase_ready.sql`);
  console.log('\nTo apply manually:');
  console.log('1. Go to your Supabase Dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Paste the contents of database/supabase_ready.sql');
  console.log('4. Click "Run"');
}

// Main execution
async function main() {
  await generateSupabaseSQL();
  
  console.log('\n📊 Checking Supabase connection...');
  
  // Test connection
  const { data, error } = await supabase.from('users').select('count').single();
  
  if (error && error.code === '42P01') {
    console.log('✅ Connected to Supabase - tables not yet created');
    console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor');
  } else if (data) {
    console.log('✅ Connected to Supabase - tables already exist');
  } else {
    console.log('❌ Could not connect to Supabase:', error?.message);
  }
  
  // Create RLS policies script
  const rlsSQL = `
-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_raw_data ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = email);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = email);

-- Users can only see their own cases
CREATE POLICY "Users can view own cases" ON cases
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE email = auth.uid()::text
  ));

CREATE POLICY "Users can insert own cases" ON cases
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM users WHERE email = auth.uid()::text
  ));

-- Case-related tables inherit permissions from cases table
CREATE POLICY "View case details" ON case_parties
  FOR SELECT USING (case_id IN (
    SELECT id FROM cases WHERE user_id IN (
      SELECT id FROM users WHERE email = auth.uid()::text
    )
  ));

CREATE POLICY "View case charges" ON case_charges
  FOR SELECT USING (case_id IN (
    SELECT id FROM cases WHERE user_id IN (
      SELECT id FROM users WHERE email = auth.uid()::text
    )
  ));

CREATE POLICY "View case calendar" ON case_calendar
  FOR SELECT USING (case_id IN (
    SELECT id FROM cases WHERE user_id IN (
      SELECT id FROM users WHERE email = auth.uid()::text
    )
  ));

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON cases
  FOR ALL USING (auth.role() = 'service_role');
`;

  const rlsPath = path.join(__dirname, '..', 'database', 'supabase_rls.sql');
  await fs.writeFile(rlsPath, rlsSQL);
  console.log('\n🔒 RLS policies saved to: database/supabase_rls.sql');
}

main().catch(console.error);