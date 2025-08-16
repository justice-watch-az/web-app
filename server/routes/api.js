const express = require('express');
const { pool } = require('../database');
const logger = require('../utils/logger');

const router = express.Router();

// Get only arraignment cases
router.get('/cases/arraignments', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    // Query for cases that have arraignment-related data
    const result = await pool.query(
      `SELECT * FROM cases 
       WHERE (case_type = 'Criminal' 
              AND (raw_data->>'complaint_type' = 'Long Form Criminal Complaint'
                   OR raw_data->'next_hearing'->>'type' = 'Arraignment'
                   OR case_title ILIKE '%arraignment%'
                   OR docket_entries::text ILIKE '%arraignment%'))
       ORDER BY filing_date DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    res.json({
      arraignmentCases: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    logger.error('Error fetching arraignment cases:', error);
    res.status(500).json({ error: 'Failed to fetch arraignment cases' });
  }
});

// Get court cases
router.get('/cases', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await pool.query(
      'SELECT * FROM cases ORDER BY filing_date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    res.json({
      cases: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    logger.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Search cases
router.get('/cases/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const result = await pool.query(
      `SELECT * FROM cases 
       WHERE case_number ILIKE $1 
       OR case_title ILIKE $1 
       OR judge ILIKE $1
       ORDER BY filing_date DESC`,
      [`%${q}%`]
    );
    
    res.json({
      cases: result.rows,
      query: q
    });
  } catch (error) {
    logger.error('Error searching cases:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get statistics
router.get('/cases/statistics', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_cases,
        COUNT(DISTINCT judge) as total_judges,
        COUNT(CASE WHEN case_status = 'Open' THEN 1 END) as open_cases,
        COUNT(CASE WHEN case_status = 'Closed' THEN 1 END) as closed_cases
      FROM cases
    `);
    
    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get dashboard stats (alias for compatibility)
router.get('/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_cases,
        COUNT(DISTINCT judge) as total_judges,
        COUNT(CASE WHEN case_status = 'Open' THEN 1 END) as open_cases,
        COUNT(CASE WHEN case_status = 'Closed' THEN 1 END) as closed_cases,
        COUNT(CASE WHEN filing_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_cases
      FROM cases
    `);
    
    const jobStats = await pool.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as active_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs
      FROM scraping_jobs
      WHERE user_id = $1
    `, [req.userId]);
    
    res.json({
      cases: stats.rows[0],
      jobs: jobStats.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Export to CSV
router.post('/export/csv', async (req, res) => {
  try {
    const { data } = req.body;
    
    // Simple CSV conversion
    const headers = Object.keys(data[0] || {}).join(',');
    const rows = data.map(row => 
      Object.values(row).map(v => `"${v}"`).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="court_cases.csv"');
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Export to JSON
router.post('/export/json', async (req, res) => {
  try {
    const { data } = req.body;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="court_cases.json"');
    res.json(data);
  } catch (error) {
    logger.error('Error exporting JSON:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get all data for export
router.get('/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    const result = await pool.query(
      'SELECT * FROM cases ORDER BY filing_date DESC'
    );
    
    if (format === 'csv') {
      const cases = result.rows;
      if (cases.length === 0) {
        return res.status(404).json({ error: 'No data to export' });
      }
      
      const headers = Object.keys(cases[0]).join(',');
      const rows = cases.map(row => 
        Object.values(row).map(v => {
          if (typeof v === 'object') v = JSON.stringify(v);
          return `"${String(v).replace(/"/g, '""')}"`;
        }).join(',')
      ).join('\n');
      
      const csv = `${headers}\n${rows}`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="court_cases.csv"');
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="court_cases.json"');
      res.json(result.rows);
    }
  } catch (error) {
    logger.error('Error exporting data:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;