const express = require('express');
const { pool } = require('../database');
const logger = require('../utils/logger');

const router = express.Router();

// Get all cases with summary information
router.get('/all', async (req, res) => {
  try {
    // Simple query for Supabase single table structure
    const query = `
      SELECT 
        id,
        case_number,
        court_id,
        court_name,
        case_title,
        case_type,
        case_status AS status,
        filing_date,
        judge,
        location,
        case_url,
        scraped_at,
        updated_at,
        next_hearing
      FROM cases
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 100
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Get single case with all details
router.get('/:caseNumber', async (req, res) => {
  try {
    const { caseNumber } = req.params;
    
    // For Supabase, all data is in the single cases table
    const caseQuery = await pool.query(
      'SELECT * FROM cases WHERE case_number = $1',
      [caseNumber]
    );
    
    if (caseQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const caseData = caseQuery.rows[0];
    
    // The case data already contains parties, docket_entries, events, and documents as JSON columns
    res.json(caseData);
  } catch (error) {
    logger.error('Error fetching case details:', error);
    res.status(500).json({ error: 'Failed to fetch case details' });
  }
});

// Get upcoming hearings across all cases
router.get('/hearings/upcoming', async (req, res) => {
  try {
    // For Supabase, parse the next_hearing field and return cases with upcoming hearings
    const query = `
      SELECT 
        case_number,
        case_title,
        court_name,
        judge,
        next_hearing,
        location
      FROM cases
      WHERE next_hearing IS NOT NULL 
        AND next_hearing >= CURRENT_DATE
      ORDER BY next_hearing
      LIMIT 50
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching upcoming hearings:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming hearings' });
  }
});

// Get statistics
router.get('/stats/summary', async (req, res) => {
  try {
    // For Supabase single table structure
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_cases,
        COUNT(DISTINCT court_name) as total_courts,
        COUNT(CASE WHEN next_hearing >= CURRENT_DATE THEN 1 END) as upcoming_hearings
      FROM cases
    `);
    
    // Get court distribution
    const courtDistribution = await pool.query(`
      SELECT 
        court_name,
        COUNT(*) as case_count
      FROM cases
      GROUP BY court_name
      ORDER BY case_count DESC
    `);
    
    // For charge data, we'd need to parse the JSON columns
    // Since charges are stored in JSON, we'll provide simplified stats
    const summary = {
      ...stats.rows[0],
      total_charges: 0,  // Would need to parse JSON to count
      unique_charge_types: 0,  // Would need to parse JSON to count
      pending_charges: 0  // Would need to parse JSON to count
    };
    
    res.json({
      summary: summary,
      topCharges: [],  // Would need JSON parsing for detailed breakdown
      courtDistribution: courtDistribution.rows
    });
  } catch (error) {
    logger.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;