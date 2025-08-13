const express = require('express');
const { getQueue } = require('../queue');
const { pool } = require('../database');
const logger = require('../utils/logger');

const router = express.Router();

// Start scraping job
router.post('/start', async (req, res) => {
  try {
    const queue = getQueue();
    const { config } = req.body;
    
    // Create job record in database
    const jobResult = await pool.query(
      `INSERT INTO scraping_jobs (user_id, status, config, started_at) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.userId, 'running', JSON.stringify(config), new Date()]
    );
    
    const jobId = jobResult.rows[0].id;
    
    // Add to queue
    const job = await queue.add({
      jobId,
      config,
      userId: req.userId
    });
    
    res.json({
      message: 'Scraping job started',
      jobId: job.id,
      status: 'running'
    });
  } catch (error) {
    logger.error('Error starting scraping job:', error);
    res.status(500).json({ error: 'Failed to start scraping' });
  }
});

// Stop scraping job
router.post('/stop', async (req, res) => {
  try {
    const queue = getQueue();
    
    // Get active jobs for user
    const jobs = await queue.getActive();
    const userJob = jobs.find(j => j.data.userId === req.userId);
    
    if (userJob) {
      await userJob.remove();
      
      // Update database
      await pool.query(
        `UPDATE scraping_jobs 
         SET status = 'stopped', completed_at = $1 
         WHERE user_id = $2 AND status = 'running'`,
        [new Date(), req.userId]
      );
      
      res.json({ message: 'Scraping job stopped' });
    } else {
      res.status(404).json({ error: 'No active job found' });
    }
  } catch (error) {
    logger.error('Error stopping scraping job:', error);
    res.status(500).json({ error: 'Failed to stop scraping' });
  }
});

// Get scraping status
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM scraping_jobs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ status: 'idle' });
    }
    
    const job = result.rows[0];
    res.json({
      status: job.status,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      casesFound: job.cases_found,
      error: job.error
    });
  } catch (error) {
    logger.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Get scraping job history
router.get('/jobs', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await pool.query(
      `SELECT * FROM scraping_jobs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [req.userId, limit]
    );
    
    res.json({ jobs: result.rows });
  } catch (error) {
    logger.error('Error fetching job history:', error);
    res.status(500).json({ error: 'Failed to fetch job history' });
  }
});

// Start arraignment-only scraping job
// This endpoint specifically scrapes ONLY "Arraignment Hearing - Long Form" cases
// as required by the user - filtering happens at scraper level
router.post('/arraignments', async (req, res) => {
  try {
    const queue = getQueue();
    const { courtId, dateRangeDays } = req.body;
    
    logger.info('Starting arraignment-only scraping: Arraignment Hearing - Long Form cases ONLY');
    
    // Create job record in database
    const jobResult = await pool.query(
      `INSERT INTO scraping_jobs (user_id, status, config, started_at, job_type) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        req.userId || null,  // Allow null userId
        'running', 
        JSON.stringify({ 
          courtId: courtId || 'all',
          dateRangeDays: dateRangeDays || 30,
          filter: 'arraignment_long_form_only' 
        }), 
        new Date(),
        'arraignments'
      ]
    );
    
    const jobId = jobResult.rows[0].id;
    
    // Add to queue with specific job name for arraignment scraping
    const job = await queue.add('scrape-arraignments', {
      jobId,
      courtId: courtId || 'all',
      dateRangeDays: dateRangeDays || 30,
      userId: req.userId || null
    });
    
    res.json({
      message: 'Arraignment scraping started - ONLY collecting "Arraignment Hearing - Long Form" cases',
      jobId: job.id,
      dbJobId: jobId,
      status: 'running',
      filter: 'arraignment_long_form_only'
    });
  } catch (error) {
    logger.error('Error starting arraignment scraping job:', error);
    res.status(500).json({ error: 'Failed to start arraignment scraping' });
  }
});

module.exports = router;