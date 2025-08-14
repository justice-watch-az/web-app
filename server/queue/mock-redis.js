// Mock Redis for environments without Redis
// This allows the app to run without Redis for basic functionality

const logger = require('../utils/logger');

class MockQueue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    logger.info(`MockQueue: Created queue ${name} (Redis not available)`);
  }

  async add(jobName, data) {
    const job = {
      id: Date.now(),
      name: jobName,
      data,
      status: 'pending'
    };
    this.jobs.push(job);
    logger.info(`MockQueue: Added job ${jobName} with id ${job.id}`);
    
    // Execute immediately in background
    setTimeout(() => this.processJob(job), 100);
    
    return job;
  }

  async processJob(job) {
    try {
      logger.info(`MockQueue: Processing job ${job.name}`);
      job.status = 'processing';
      
      // Import and run the scraper directly
      const { exec } = require('child_process');
      const path = require('path');
      
      const scraperPath = path.join(__dirname, '../../scrapers/maricopa_arraignment_scraper.py');
      const command = `python3 ${scraperPath} '${JSON.stringify(job.data)}'`;
      
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          logger.error('MockQueue: Scraper error:', error);
          job.status = 'failed';
          job.error = error.message;
        } else {
          logger.info('MockQueue: Scraper completed successfully');
          job.status = 'completed';
          job.result = stdout;
        }
      });
    } catch (error) {
      logger.error('MockQueue: Error processing job:', error);
      job.status = 'failed';
      job.error = error.message;
    }
  }

  process(concurrency, handler) {
    logger.info(`MockQueue: Process handler registered (mock mode)`);
  }

  on(event, handler) {
    logger.info(`MockQueue: Event handler registered for ${event} (mock mode)`);
  }
}

module.exports = { MockQueue };