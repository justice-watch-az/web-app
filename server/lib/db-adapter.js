// Database adapter that works with both local PostgreSQL and Supabase
const pool = require('../db');
const database = require('./database');

// Use Supabase if configured, otherwise fallback to local PostgreSQL
const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

module.exports = useSupabase ? database : pool;