#!/usr/bin/env node
// Script to create admin user directly in Supabase

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://tsgvxobkmmvsbjzxvuas.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZ3Z4b2JrbW12c2Jqenh2dWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwNjAxMCwiZXhwIjoyMDcwNjgyMDEwfQ.8HVnQhpnLHFWKPDaX7AnlydJ_dVu7mErl1YBs43Rl4k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
  try {
    const email = 'admin@justice.com';
    const password = 'JusticeWatch2025!';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      console.log('❌ Admin user already exists');
      
      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password: hashedPassword,
          name: 'Admin'
        })
        .eq('email', email);
      
      if (updateError) {
        console.error('Failed to update user:', updateError);
      } else {
        console.log('✅ Admin password updated');
      }
    } else {
      // Create new user
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: email,
          password: hashedPassword,
          name: 'Admin'
        })
        .select();

      if (error) {
        console.error('Failed to create user:', error);
      } else {
        console.log('✅ Admin user created successfully');
      }
    }

    console.log('\n📧 Email: admin@justice.com');
    console.log('🔑 Password: JusticeWatch2025!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

createAdminUser();