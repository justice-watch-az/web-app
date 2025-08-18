const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');
const { saveCaseToDatabase } = require('./db-handler-simple');
const cache = require('../cache');

let scrapingQueue = null;
let io = null;
let Queue = null;

// Try to load Bull, but don't fail if Redis isn't available
try {
  Queue = require('bull');
} catch (error) {
  logger.warn('Bull queue not available, will use direct execution');
}

async function initQueue(socketIo) {
  io = socketIo; // Store io instance for progress updates
  
  // Only initialize Bull queue if Redis is available
  if (Queue) {
    try {
      scrapingQueue = new Queue('scraping', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD
        }
      });
      logger.info('Redis queue initialized successfully');
    } catch (error) {
      logger.warn('Failed to connect to Redis, using direct execution mode');
      scrapingQueue = null;
    }
  } else {
    logger.warn('Running without Redis queue - scraping will execute directly');
    scrapingQueue = null;
  }
  
  // If we have a real queue, set up processors
  if (scrapingQueue) {

  // Process scrape-arraignments jobs
  scrapingQueue.process('scrape-arraignments', async (job) => {
    const { courtId, userId, dateRangeDays, jobId } = job.data;
    const { pool } = require('../database');
    
    logger.info(`Starting arraignment scraping job ${jobId} for user ${userId}`);
    
    return new Promise(async (resolve, reject) => {
      const scraperConfig = {
        court_id: courtId || 'all',
        scrape_calendar: true,
        date_range_days: dateRangeDays || 30,
        headless: true
      };
      
      // Use the new Maricopa court scraper that only gets arraignment cases
      // TEMPORARY: Using mock scraper for testing without Chrome
      const scraperScript = process.env.USE_MOCK_SCRAPER 
        ? 'mock_scraper.py' 
        : 'maricopa_arraignment_scraper.py';
      
      const pythonProcess = spawn('python3', [
        path.join(__dirname, '../../scrapers/', scraperScript),
        JSON.stringify(scraperConfig)
      ]);

      let output = '';
      let error = '';
      let currentProcessingCourt = ''; // Track current court being processed

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        const log = data.toString();
        error += log;
        logger.info(`Arraignment scraper: ${log}`);
        
        // Emit progress updates via WebSocket
        if (io) {
          // Parse log messages for progress updates
          if (log.includes('Processing')) {
            const courtMatch = log.match(/Processing (.+?) Justice Court/);
            if (courtMatch) {
              currentProcessingCourt = courtMatch[1]; // Store current court
              io.emit('scraping-progress', {
                type: 'court',
                message: `Processing ${courtMatch[1]} Justice Court`,
                court: courtMatch[1]
              });
            }
          } else if (log.includes('Found arraignment case:')) {
            const caseMatch = log.match(/Found arraignment case: (\S+)/);
            if (caseMatch) {
              io.emit('scraping-progress', {
                type: 'case_found',
                message: `Found case ${caseMatch[1]}`,
                caseNumber: caseMatch[1],
                court: currentProcessingCourt // Use the tracked court
              });
            }
          } else if (log.includes('Extracted')) {
            io.emit('scraping-progress', {
              type: 'extracting',
              message: log.trim()
            });
          } else if (log.includes('Discovered') && log.includes('courts')) {
            const courtsMatch = log.match(/Discovered (\d+) courts/);
            if (courtsMatch) {
              io.emit('scraping-progress', {
                type: 'started',
                message: `Discovered ${courtsMatch[1]} courts to process`,
                totalCourts: parseInt(courtsMatch[1])
              });
            }
          }
        }
      });

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          logger.error(`Arraignment scraping failed with code ${code}: ${error}`);
          
          // Update job status to failed if we have a jobId
          if (jobId) {
            try {
              await pool.query(
                `UPDATE scraping_jobs 
                 SET status = 'failed', 
                     completed_at = NOW(), 
                     error = $1
                 WHERE id = $2`,
                [`Python process exited with code ${code}: ${error}`, jobId]
              );
            } catch (dbError) {
              logger.error(`Failed to update job ${jobId} status:`, dbError);
            }
          }
          
          reject(new Error(`Scraping failed with exit code ${code}: ${error}`));
        } else {
          try {
            const result = JSON.parse(output);
            
            // Save each arraignment case to database using new schema
            if (result.arraignment_cases && result.arraignment_cases.length > 0) {
              for (const caseData of result.arraignment_cases) {
                try {
                  await saveCaseToDatabase(caseData, pool, userId);
                  logger.info(`Saved case ${caseData.case_number} to new schema`);
                  if (io) {
                    io.emit('scraping-progress', {
                      type: 'case_saved',
                      message: `Saved case ${caseData.case_number}`,
                      caseNumber: caseData.case_number,
                      court: caseData.court_name
                    });
                  }
                } catch (error) {
                  logger.error(`Failed to save case ${caseData.case_number}:`, error);
                  if (io) {
                    io.emit('scraping-progress', {
                      type: 'error',
                      message: `Failed to save case ${caseData.case_number}`,
                      caseNumber: caseData.case_number
                    });
                  }
                }
              }
            }
            
            // Update job status in database if we have a jobId
            if (jobId) {
              try {
                await pool.query(
                  `UPDATE scraping_jobs 
                   SET status = 'completed', 
                       completed_at = NOW(), 
                       cases_found = $1
                   WHERE id = $2`,
                  [result.arraignment_cases?.length || 0, jobId]
                );
                logger.info(`Updated job ${jobId} status to completed`);
              } catch (dbError) {
                logger.error(`Failed to update job ${jobId} status:`, dbError);
              }
            }
            
            // Emit completion
            if (io) {
              io.emit('scraping-progress', {
                type: 'completed',
                message: `Scraping completed. Found ${result.arraignment_cases?.length || 0} cases from ${result.stats?.courts_discovered || 0} courts`,
                totalCases: result.arraignment_cases?.length || 0,
                totalCourts: result.stats?.courts_discovered || 0
              });
            }
            
            // Invalidate related caches after successful scraping
            try {
              await cache.invalidate('cases');
              await cache.invalidate('dashboard');
              await cache.invalidate('statistics');
              await cache.invalidate('search');
              logger.info('Cache invalidated after successful scraping');
            } catch (cacheError) {
              logger.error('Failed to invalidate cache:', cacheError);
            }
            
            resolve(result);
          } catch (parseError) {
            logger.error('Error parsing arraignment data:', parseError);
            
            // Update job status to failed if we have a jobId
            if (jobId) {
              try {
                await pool.query(
                  `UPDATE scraping_jobs 
                   SET status = 'failed', 
                       completed_at = NOW(), 
                       error = $1
                   WHERE id = $2`,
                  [parseError.message, jobId]
                );
              } catch (dbError) {
                logger.error(`Failed to update job ${jobId} status:`, dbError);
              }
            }
            
            reject(parseError);
          }
        }
      });
    });
  });

  // Process default jobs
  scrapingQueue.process(async (job) => {
    const { config, userId, caseNumber, courtId } = job.data;
    const { pool } = require('../database');
    
    // Handle single case scraping
    if (job.name === 'scrape-single' && caseNumber) {
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [
          path.join(__dirname, '../../scrapers/scrape_arraignments.py'),
          caseNumber,
          courtId || 'hassayampa'
        ]);

        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          if (code !== 0) {
            logger.error(`Scraping job failed: ${error}`);
            reject(new Error(error));
          } else {
            try {
              const scrapedData = JSON.parse(output);
              
              // Save to database
              const result = await pool.query(
                `INSERT INTO cases 
                (case_number, court_id, case_title, filing_date, case_type, status, 
                 parties, docket_entries, next_hearing, judge, scraped_at, user_id, raw_data) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12) 
                ON CONFLICT (case_number, court_id) 
                DO UPDATE SET 
                  case_title = EXCLUDED.case_title,
                  filing_date = EXCLUDED.filing_date,
                  case_type = EXCLUDED.case_type,
                  status = EXCLUDED.status,
                  parties = EXCLUDED.parties,
                  docket_entries = EXCLUDED.docket_entries,
                  next_hearing = EXCLUDED.next_hearing,
                  judge = EXCLUDED.judge,
                  scraped_at = NOW(),
                  raw_data = EXCLUDED.raw_data
                RETURNING *`,
                [
                  scrapedData.case_number || caseNumber,
                  courtId || 'hassayampa',
                  scrapedData.case_title || scrapedData.caption,
                  scrapedData.filing_date,
                  scrapedData.case_type,
                  scrapedData.status,
                  JSON.stringify(scrapedData.parties || []),
                  JSON.stringify(scrapedData.docket_entries || []),
                  scrapedData.next_hearing,
                  scrapedData.judge,
                  userId,
                  JSON.stringify(scrapedData)
                ]
              );
              
              resolve(result.rows[0]);
            } catch (parseError) {
              logger.error('Error parsing/saving scraped data:', parseError);
              reject(parseError);
            }
          }
        });
      });
    }
    
    // Handle bulk scraping with config
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        path.join(__dirname, '../../scrapers/court_scraper.py'),
        JSON.stringify(config)
      ]);

      let output = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        job.progress(parseInt(data.toString().match(/\d+/)?.[0] || 0));
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          logger.error(`Scraping job failed: ${error}`);
          reject(new Error(error));
        } else {
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            resolve({ message: output });
          }
        }
      });
    });
  });

  } // Close the if(scrapingQueue) block
  
  logger.info('Job queue initialized');
}

function getQueue() {
  return scrapingQueue;
}

module.exports = { initQueue, getQueue };