const { Pool } = require('pg');
const logger = require('../utils/logger');

// Force Supabase SDK usage when Supabase is configured
let pool;
if (process.env.SUPABASE_URL || process.env.DATABASE_URL?.includes('supabase')) {
  logger.info('Using Supabase SDK for database connection');
  const supabaseClient = require('./supabase-client');
  pool = supabaseClient.pool;
} else {
  // Local PostgreSQL only
  const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'justice_watch',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  pool = new Pool(poolConfig);
}

async function initDatabase() {
  try {
    // Test connection first
    await pool.query('SELECT NOW()');
    logger.info('Database connected successfully');

    // Create all required tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS court_cases (
        id SERIAL PRIMARY KEY,
        case_number VARCHAR(100) NOT NULL,
        case_title TEXT,
        case_type VARCHAR(100),
        filing_date DATE,
        status VARCHAR(50),
        judge VARCHAR(255),
        court_name VARCHAR(255),
        next_hearing DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(case_number)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scraping_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        config JSONB,
        job_type VARCHAR(50),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        cases_found INTEGER DEFAULT 0,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    logger.info('Ensured all required tables exist');

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initDatabase };