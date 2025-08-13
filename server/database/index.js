const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'justice_watch',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initDatabase() {
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS court_cases (
        id SERIAL PRIMARY KEY,
        case_number VARCHAR(100) NOT NULL,
        court_id VARCHAR(100) DEFAULT 'hassayampa',
        case_title VARCHAR(500),
        case_type VARCHAR(100),
        filing_date DATE,
        status VARCHAR(100),
        judge VARCHAR(255),
        parties JSONB,
        events JSONB,
        documents JSONB,
        docket_entries JSONB,
        next_hearing DATE,
        user_id INTEGER REFERENCES users(id),
        raw_data JSONB,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(case_number, court_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS scraping_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending',
        job_type VARCHAR(50) DEFAULT 'general',
        config JSONB,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        error TEXT,
        cases_found INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add job_type column if it doesn't exist (for existing databases)
    await pool.query(`
      ALTER TABLE scraping_jobs 
      ADD COLUMN IF NOT EXISTS job_type VARCHAR(50) DEFAULT 'general'
    `).catch(() => {
      // Column might already exist, that's fine
    });

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cases_case_number ON court_cases(case_number);
      CREATE INDEX IF NOT EXISTS idx_cases_filing_date ON court_cases(filing_date);
      CREATE INDEX IF NOT EXISTS idx_cases_status ON court_cases(status);
      CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user ON scraping_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON scraping_jobs(status);
    `);

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

module.exports = { pool, initDatabase };