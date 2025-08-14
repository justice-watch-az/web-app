const express = require('express');
const { getQueue } = require('../queue');
const { pool } = require('../database');
const logger = require('../utils/logger');

const router = express.Router();

// Test Python environment
router.get('/test-python', async (req, res) => {
  const { spawn } = require('child_process');
  const path = require('path');
  
  try {
    // Test if Python is available
    const pythonTest = spawn('python3', ['--version']);
    let pythonVersion = '';
    
    pythonTest.stdout.on('data', (data) => {
      pythonVersion += data.toString();
    });
    
    pythonTest.stderr.on('data', (data) => {
      pythonVersion += data.toString();
    });
    
    pythonTest.on('close', (code) => {
      // Check if scraper file exists
      const fs = require('fs');
      const scraperPath = path.join(__dirname, '../../scrapers/maricopa_arraignment_scraper.py');
      const scraperExists = fs.existsSync(scraperPath);
      
      res.json({
        pythonAvailable: code === 0,
        pythonVersion: pythonVersion.trim(),
        scraperPath: scraperPath,
        scraperExists: scraperExists,
        workingDir: process.cwd()
      });
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to test Python environment',
      message: error.message 
    });
  }
});

// Start scraping job
router.post('/start', async (req, res) => {
  try {
    const queue = getQueue();
    const { config } = req.body;
    
    // Skip database record for now - table doesn't exist yet
    const jobId = Date.now(); // Use timestamp as job ID
    
    // Add to queue
    const job = await queue.add('scrape-arraignments', {
      jobId,
      config: config || {},
      userId: req.userId || 'anonymous'
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
    // First check if there's an active job in the queue
    const queue = getQueue();
    if (queue) {
      const jobs = await queue.getActive();
      if (jobs.length > 0) {
        // There's an active job running
        return res.json({ 
          status: 'running',
          queueStatus: 'active',
          activeJobs: jobs.length
        });
      }
    }
    
    // Check database for last job status
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

// Start arraignment scraping job (simplified endpoint for frontend)
router.post('/arraignments', async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    
    // Check if scraper exists
    const scraperPath = path.join(__dirname, '../../scrapers/maricopa_arraignment_scraper.py');
    if (!fs.existsSync(scraperPath)) {
      logger.error('Scraper file not found:', scraperPath);
      return res.status(500).json({ 
        error: 'Scraper not found',
        path: scraperPath 
      });
    }
    
    // Create job record in database
    const jobResult = await pool.query(
      `INSERT INTO scraping_jobs (user_id, status, started_at) 
       VALUES ($1, 'running', NOW()) 
       RETURNING id`,
      [req.userId || 'anonymous']
    );
    const jobId = jobResult.rows[0].id;
    
    // Run scraper directly (bypass queue for now)
    const scraperConfig = {
      court_id: req.body.courtId || 'all',
      scrape_calendar: true,
      date_range_days: req.body.dateRangeDays || 30,
      headless: true
    };
    
    logger.info(`Starting arraignment scraper with config:`, scraperConfig);
    
    const pythonProcess = spawn('python3', [
      scraperPath,
      JSON.stringify(scraperConfig)
    ]);
    
    let output = '';
    let error = '';
    let casesFound = 0;
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      logger.info('Scraper output:', data.toString());
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const log = data.toString();
      error += log;
      logger.info('Scraper log:', log);
      
      // Count cases as they're found
      if (log.includes('Found arraignment case:')) {
        casesFound++;
      }
    });
    
    pythonProcess.on('close', async (code) => {
      logger.info(`Scraper process exited with code ${code}`);
      
      if (code !== 0) {
        await pool.query(
          `UPDATE scraping_jobs 
           SET status = 'failed', completed_at = NOW(), error = $1 
           WHERE id = $2`,
          [error || 'Process exited with code ' + code, jobId]
        );
        
        // Still return success to frontend but with error info
        res.json({
          message: 'Scraping job completed with errors',
          jobId,
          status: 'failed',
          error: error || 'Process exited with code ' + code
        });
      } else {
        // Try to parse output
        let result = null;
        try {
          result = JSON.parse(output);
          casesFound = result.arraignment_cases?.length || 0;
        } catch (e) {
          logger.warn('Could not parse scraper output as JSON');
        }
        
        await pool.query(
          `UPDATE scraping_jobs 
           SET status = 'completed', completed_at = NOW(), cases_found = $1 
           WHERE id = $2`,
          [casesFound, jobId]
        );
        
        res.json({
          message: 'Scraping job completed',
          jobId,
          status: 'completed',
          casesFound
        });
      }
    });
    
    pythonProcess.on('error', async (err) => {
      logger.error('Failed to start scraper process:', err);
      
      await pool.query(
        `UPDATE scraping_jobs 
         SET status = 'failed', completed_at = NOW(), error = $1 
         WHERE id = $2`,
        [err.message, jobId]
      );
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to start scraper',
          message: err.message
        });
      }
    });
    
  } catch (error) {
    logger.error('Error starting arraignment scraping:', error);
    res.status(500).json({ 
      error: 'Failed to start scraping',
      message: error.message 
    });
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
    
    // If no queue (Redis not available), run directly but asynchronously
    if (!queue) {
      logger.info('No Redis queue available, running scraper directly in background');
      
      // Send immediate response
      res.json({
        message: 'Arraignment scraping started - ONLY collecting "Arraignment Hearing - Long Form" cases',
        status: 'running',
        filter: 'arraignment_long_form_only',
        mode: 'direct'
      });
      
      // Run the scraper in the background (don't await)
      setImmediate(() => {
        const { spawn } = require('child_process');
        const path = require('path');
        
        const scraperConfig = {
          court_id: courtId || 'all',
          scrape_calendar: true,
          date_range_days: dateRangeDays || 30,
          headless: true
        };
        
        // Use the new Maricopa court scraper that only gets arraignment cases
        const pythonProcess = spawn('python3', [
          path.join(__dirname, '../../scrapers/maricopa_arraignment_scraper.py'),
          JSON.stringify(scraperConfig)
        ], {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
          const log = data.toString();
          error += log;
          logger.info(`Arraignment scraper: ${log}`);
        });
        
        pythonProcess.on('close', async (code) => {
          if (code !== 0) {
            logger.error(`Arraignment scraping failed: ${error}`);
          } else {
            try {
              const result = JSON.parse(output);
              const { saveCaseToDatabase } = require('../queue/db-handler-simple');
              
              // Save each arraignment case to database using new schema
              if (result.arraignment_cases && result.arraignment_cases.length > 0) {
                for (const caseData of result.arraignment_cases) {
                  try {
                    await saveCaseToDatabase(caseData, pool, req.userId);
                    logger.info(`Saved case ${caseData.case_number} to database`);
                  } catch (error) {
                    logger.error(`Failed to save case ${caseData.case_number}:`, error);
                  }
                }
              }
              
              logger.info(`Scraping completed. Found ${result.arraignment_cases?.length || 0} cases`);
            } catch (parseError) {
              logger.error('Error parsing arraignment data:', parseError);
            }
          }
        });
        
        pythonProcess.unref();
      });
      
      return; // Already sent response
    }
    
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