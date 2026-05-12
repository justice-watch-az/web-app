import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Initialize Supabase client with environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  );
}

// Create Supabase client instance
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Helper to check if Supabase is connected
export const checkConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('cases').select('count').limit(1);
    return !error;
  } catch {
    return false;
  }
};

// Export types for use in components
export type { Database };