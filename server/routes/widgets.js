const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { pool } = require('../database');

// CORS headers for widget endpoints
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Widget-Version');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Widget data endpoint for arraignments
router.get('/data/arraignments', async (req, res) => {
  try {
    const { court, date, limit = 10 } = req.query;
    
    // Build query
    let query = `
      SELECT 
        cc.case_number,
        cc.case_title,
        cc.case_type,
        cc.court_name,
        cc.status,
        cc.judge,
        cc.filing_date,
        cc.next_hearing,
        cc.created_at
      FROM court_cases cc
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Add filters
    if (court && court !== 'all') {
      query += ` AND LOWER(cc.court_name) LIKE $${paramIndex}`;
      params.push(`%${court.toLowerCase()}%`);
      paramIndex++;
    }
    
    if (date) {
      let targetDate;
      if (date === 'today') {
        targetDate = new Date().toISOString().split('T')[0];
      } else if (date === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        targetDate = tomorrow.toISOString().split('T')[0];
      } else {
        targetDate = date;
      }
      
      query += ` AND DATE(cc.next_hearing) = $${paramIndex}`;
      params.push(targetDate);
      paramIndex++;
    }
    
    // Order and limit
    query += ` ORDER BY cc.next_hearing, cc.case_number LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    
    // Format response
    const arraignments = result.rows.map(row => ({
      id: row.case_number,
      caseNumber: row.case_number,
      defendantName: row.case_title ? row.case_title.split(' v. ')[1] || 'Unknown' : 'Unknown',
      caseTitle: row.case_title,
      court: row.court_name,
      judge: row.judge,
      caseType: row.case_type,
      scheduledDate: row.next_hearing,
      filingDate: row.filing_date,
      status: row.status,
      createdAt: row.created_at
    }));
    
    res.json({
      success: true,
      data: arraignments,
      count: arraignments.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching widget arraignment data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch arraignment data'
    });
  }
});

// Widget data endpoint for statistics
router.get('/data/stats', async (req, res) => {
  try {
    const { court, period = '7d' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // Build stats query
    let statsQuery = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(DISTINCT court_name) as total_courts,
        COUNT(DISTINCT case_title) as unique_cases,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_cases,
        COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closed_cases
      FROM court_cases
      WHERE created_at >= $1 AND created_at <= $2
    `;
    
    const params = [startDate.toISOString(), endDate.toISOString()];
    
    if (court && court !== 'all') {
      statsQuery += ` AND LOWER(court_name) LIKE $3`;
      params.push(`%${court.toLowerCase()}%`);
    }
    
    const statsResult = await pool.query(statsQuery, params);
    
    // Get daily breakdown
    let dailyQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM court_cases
      WHERE created_at >= $1 AND created_at <= $2
    `;
    
    if (court && court !== 'all') {
      dailyQuery += ` AND LOWER(court_name) LIKE $3`;
    }
    
    dailyQuery += ` GROUP BY DATE(created_at) ORDER BY date`;
    
    const dailyResult = await pool.query(dailyQuery, params);
    
    res.json({
      success: true,
      data: {
        summary: statsResult.rows[0],
        daily: dailyResult.rows,
        period,
        court: court || 'all'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching widget stats data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics data'
    });
  }
});

// Widget data endpoint for court calendar
router.get('/data/calendar', async (req, res) => {
  try {
    const { court, startDate, endDate, view = 'week' } = req.query;
    
    // Calculate date range based on view
    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const today = new Date();
      start = new Date(today);
      end = new Date(today);
      
      if (view === 'week') {
        // Get current week
        const day = start.getDay();
        start.setDate(start.getDate() - day);
        end.setDate(end.getDate() + (6 - day));
      } else if (view === 'month') {
        // Get current month
        start.setDate(1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      }
    }
    
    // Build calendar query
    let query = `
      SELECT 
        cc.case_number,
        cc.defendant_name,
        cc.court_name,
        cc.next_hearing_date,
        cc.next_hearing_time,
        cc.hearing_type,
        cc.judge
      FROM court_cases cc
      WHERE cc.next_hearing_date >= $1 
        AND cc.next_hearing_date <= $2
    `;
    
    const params = [start.toISOString(), end.toISOString()];
    let paramIndex = 3;
    
    if (court && court !== 'all') {
      query += ` AND LOWER(cc.court_name) LIKE $${paramIndex}`;
      params.push(`%${court.toLowerCase()}%`);
    }
    
    query += ` ORDER BY cc.next_hearing_date, cc.next_hearing_time`;
    
    const result = await pool.query(query, params);
    
    // Group by date for calendar view
    const calendar = {};
    result.rows.forEach(row => {
      const dateKey = row.next_hearing_date ? 
        new Date(row.next_hearing_date).toISOString().split('T')[0] : null;
      
      if (dateKey) {
        if (!calendar[dateKey]) {
          calendar[dateKey] = [];
        }
        
        calendar[dateKey].push({
          caseNumber: row.case_number,
          defendantName: row.defendant_name,
          court: row.court_name,
          time: row.next_hearing_time,
          type: row.hearing_type || 'Hearing',
          judge: row.judge
        });
      }
    });
    
    res.json({
      success: true,
      data: {
        calendar,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        view,
        totalEvents: result.rows.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching widget calendar data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar data'
    });
  }
});

// Widget configuration endpoint
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      availableWidgets: [
        {
          id: 'arraignments',
          name: 'Daily Arraignments',
          description: 'Shows upcoming arraignment hearings',
          sizes: ['compact', 'standard', 'full'],
          parameters: ['court', 'date', 'limit', 'theme', 'refresh']
        },
        {
          id: 'stats',
          name: 'Statistics Dashboard',
          description: 'Displays case statistics and trends',
          sizes: ['card', 'dashboard'],
          parameters: ['court', 'period', 'theme']
        },
        {
          id: 'calendar',
          name: 'Court Calendar',
          description: 'Weekly or monthly court calendar view',
          sizes: ['mini', 'standard'],
          parameters: ['court', 'view', 'startDate', 'endDate', 'theme']
        },
        {
          id: 'search',
          name: 'Case Search',
          description: 'Embedded case search functionality',
          sizes: ['inline', 'modal'],
          parameters: ['theme', 'placeholder']
        }
      ],
      courts: [
        { id: 'all', name: 'All Courts' },
        { id: 'maricopa', name: 'Maricopa County' },
        { id: 'pima', name: 'Pima County' },
        { id: 'coconino', name: 'Coconino County' }
      ],
      themes: ['light', 'dark', 'auto'],
      version: '1.0.0'
    }
  });
});

module.exports = router;