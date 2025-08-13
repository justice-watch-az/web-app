const express = require('express');
const { pool } = require('../database');
const logger = require('../utils/logger');

const router = express.Router();

// Get all cases with summary information
router.get('/all', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id,
        c.case_number,
        c.court_name,
        c.case_title,
        c.case_type,
        c.case_status,
        c.filing_date,
        c.judge,
        c.scraped_at,
        COUNT(DISTINCT ch.id) as charge_count,
        COUNT(DISTINCT cp.id) as party_count,
        MIN(cal.hearing_date) FILTER (WHERE cal.hearing_date >= CURRENT_DATE) as next_hearing_date,
        MIN(cal.event_type) FILTER (WHERE cal.hearing_date >= CURRENT_DATE) as next_hearing_type
      FROM cases c
      LEFT JOIN case_charges ch ON c.id = ch.case_id
      LEFT JOIN case_parties cp ON c.id = cp.case_id
      LEFT JOIN case_calendar cal ON c.id = cal.case_id
      GROUP BY c.id
      ORDER BY c.scraped_at DESC
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
    
    // Get main case info
    const caseQuery = await pool.query(
      'SELECT * FROM cases WHERE case_number = $1',
      [caseNumber]
    );
    
    if (caseQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const caseData = caseQuery.rows[0];
    const caseId = caseData.id;
    
    // Get all related data
    const [parties, charges, calendar, documents, events, judgments] = await Promise.all([
      pool.query('SELECT * FROM case_parties WHERE case_id = $1', [caseId]),
      pool.query('SELECT * FROM case_charges WHERE case_id = $1 ORDER BY ars_code', [caseId]),
      pool.query('SELECT * FROM case_calendar WHERE case_id = $1 ORDER BY hearing_date, hearing_time', [caseId]),
      pool.query('SELECT * FROM case_documents WHERE case_id = $1 ORDER BY filed_date DESC', [caseId]),
      pool.query('SELECT * FROM case_events WHERE case_id = $1 ORDER BY event_date DESC', [caseId]),
      pool.query('SELECT * FROM case_judgments WHERE case_id = $1 ORDER BY judgment_date DESC', [caseId])
    ]);
    
    res.json({
      ...caseData,
      parties: parties.rows,
      charges: charges.rows,
      calendar: calendar.rows,
      documents: documents.rows,
      events: events.rows,
      judgments: judgments.rows
    });
  } catch (error) {
    logger.error('Error fetching case details:', error);
    res.status(500).json({ error: 'Failed to fetch case details' });
  }
});

// Get upcoming hearings across all cases
router.get('/hearings/upcoming', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.case_number,
        c.case_title,
        c.court_name,
        c.judge,
        cal.hearing_date,
        cal.hearing_time,
        cal.event_type,
        cal.location
      FROM case_calendar cal
      JOIN cases c ON cal.case_id = c.id
      WHERE cal.hearing_date >= CURRENT_DATE
      ORDER BY cal.hearing_date, cal.hearing_time
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
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM cases) as total_cases,
        (SELECT COUNT(*) FROM case_charges) as total_charges,
        (SELECT COUNT(*) FROM case_calendar WHERE hearing_date >= CURRENT_DATE) as upcoming_hearings,
        (SELECT COUNT(DISTINCT court_name) FROM cases) as total_courts,
        (SELECT COUNT(DISTINCT ars_code) FROM case_charges) as unique_charge_types,
        (SELECT COUNT(*) FROM case_charges WHERE disposition IS NULL) as pending_charges
    `);
    
    // Get charge breakdown
    const chargeBreakdown = await pool.query(`
      SELECT 
        description,
        COUNT(*) as count,
        ars_code
      FROM case_charges
      GROUP BY description, ars_code
      ORDER BY count DESC
      LIMIT 10
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
    
    res.json({
      summary: stats.rows[0],
      topCharges: chargeBreakdown.rows,
      courtDistribution: courtDistribution.rows
    });
  } catch (error) {
    logger.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;