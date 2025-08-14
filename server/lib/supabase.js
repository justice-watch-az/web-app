const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase environment variables not set. Using local PostgreSQL.');
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

module.exports = { supabase };