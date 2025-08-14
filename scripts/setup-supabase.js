#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: '.env.production' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.production');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile() {
  try {
    console.log('📋 Reading SQL file...');
    const sqlContent = await fs.readFile(
      path.join(__dirname, '..', 'database', 'supabase_ready.sql'),
      'utf8'
    );

    console.log('🚀 Executing SQL in Supabase...');
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        // Use raw SQL execution through Supabase RPC
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (error) {
          console.error(`❌ Error executing: ${statement.substring(0, 50)}...`);
          console.error(error.message);
          errorCount++;
        } else {
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Results: ${successCount} successful, ${errorCount} errors`);
    
    // Test the tables
    console.log('\n🧪 Testing table access...');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (usersError) {
      console.log('❌ Users table not accessible:', usersError.message);
      console.log('\n⚠️  Tables may not exist yet. Please run the SQL manually in Supabase dashboard:');
      console.log('1. Go to: https://supabase.com/dashboard/project/tsgvxobkmmvsbjzxvuas/sql/new');
      console.log('2. Copy contents of database/supabase_ready.sql');
      console.log('3. Paste and click "Run"');
    } else {
      console.log('✅ Users table accessible');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

executeSQLFile();