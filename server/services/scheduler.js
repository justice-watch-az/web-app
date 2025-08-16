const cron = require('node-cron');
const cronParser = require('cron-parser');
const { getQueue } = require('../queue');
const { pool } = require('../database');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class SchedulerService extends EventEmitter {
  constructor() {
    super();
    this.activeJobs = new Map();
    this.io = null;
    this.isRunning = false;
    this.healthCheckInterval = null;
  }

  async init(socketIo) {
    try {
      this.io = socketIo;
      
      // Load and activate schedules
      await this.loadSchedulesFromDatabase();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isRunning = true;
      logger.info(`Scheduler service initialized with ${this.activeJobs.size} active schedules`);
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize scheduler:', error);
      throw error;
    }
  }

  async loadSchedulesFromDatabase() {
    try {
      const result = await pool.query(`
        SELECT * FROM cron_schedules 
        WHERE enabled = true 
        ORDER BY created_at
      `);
      
      for (const schedule of result.rows) {
        await this.activateSchedule(schedule);
      }
      
      logger.info(`Loaded ${result.rows.length} active schedules from database`);
    } catch (error) {
      logger.error('Failed to load schedules:', error);
      throw error;
    }
  }

  async activateSchedule(schedule) {
    const { id, cron_expression, name } = schedule;
    
    // Stop existing job if present
    this.deactivateSchedule(id);
    
    // Validate cron expression
    if (!cron.validate(cron_expression)) {
      logger.error(`Invalid cron expression for schedule ${id}: ${cron_expression}`);
      return false;
    }
    
    // Create scheduled task
    const task = cron.schedule(cron_expression, async () => {
      await this.executeScheduledJob(schedule);
    }, {
      scheduled: false,
      timezone: process.env.CRON_TIMEZONE || 'America/Phoenix'
    });
    
    // Calculate next run time
    const nextRun = this.calculateNextRun(cron_expression);
    await pool.query(
      'UPDATE cron_schedules SET next_run = $1 WHERE id = $2',
      [nextRun, id]
    );
    
    // Store and start task
    this.activeJobs.set(id, { task, schedule });
    task.start();
    
    logger.info(`Activated schedule ${id}: "${name}" (${cron_expression})`);
    this.emit('schedule-activated', { scheduleId: id, name, nextRun });
    
    return true;
  }

  deactivateSchedule(scheduleId) {
    const job = this.activeJobs.get(scheduleId);
    if (job) {
      job.task.stop();
      this.activeJobs.delete(scheduleId);
      logger.info(`Deactivated schedule ${scheduleId}`);
      this.emit('schedule-deactivated', { scheduleId });
    }
  }

  async executeScheduledJob(schedule) {
    const { id, name, config, consecutive_failures = 0 } = schedule;
    const startTime = Date.now();
    let executionId;
    
    try {
      logger.info(`Executing scheduled job ${id}: "${name}"`);
      
      // Create execution record
      const execResult = await pool.query(`
        INSERT INTO cron_executions (schedule_id, status, started_at) 
        VALUES ($1, 'running', NOW()) 
        RETURNING id
      `, [id]);
      
      executionId = execResult.rows[0].id;
      
      // Emit start event
      if (this.io) {
        this.io.emit('schedule-execution-started', {
          scheduleId: id,
          executionId,
          scheduleName: name,
          timestamp: new Date()
        });
      }
      
      // Add job to queue
      const queue = getQueue();
      if (!queue) {
        throw new Error('Queue service unavailable');
      }
      
      const job = await queue.add('scrape-arraignments', {
        ...config,
        scheduledExecution: true,
        executionId,
        scheduleId: id,
        scheduleName: name
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });
      
      // Wait for job completion (with timeout)
      const jobResult = await this.waitForJobCompletion(job, 600000); // 10 min timeout
      
      // Update execution record
      const executionTime = Date.now() - startTime;
      await pool.query(`
        UPDATE cron_executions 
        SET status = 'completed',
            completed_at = NOW(),
            scraping_job_id = $1,
            cases_found = $2,
            courts_processed = $3,
            execution_time_ms = $4,
            metadata = $5
        WHERE id = $6
      `, [
        jobResult.jobId,
        jobResult.casesFound || 0,
        jobResult.courtsProcessed || 26,
        executionTime,
        JSON.stringify(jobResult.metadata || {}),
        executionId
      ]);
      
      // Update schedule status
      const nextRun = this.calculateNextRun(schedule.cron_expression);
      await pool.query(`
        UPDATE cron_schedules 
        SET last_run = NOW(),
            last_status = 'success',
            next_run = $1,
            consecutive_failures = 0,
            updated_at = NOW()
        WHERE id = $2
      `, [nextRun, id]);
      
      // Emit completion event
      if (this.io) {
        this.io.emit('schedule-execution-completed', {
          scheduleId: id,
          executionId,
          scheduleName: name,
          casesFound: jobResult.casesFound,
          executionTime,
          nextRun
        });
      }
      
      logger.info(`Schedule ${id} executed successfully in ${executionTime}ms`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Schedule ${id} execution failed:`, error);
      
      // Update execution record
      if (executionId) {
        await pool.query(`
          UPDATE cron_executions 
          SET status = 'failed',
              completed_at = NOW(),
              error = $1,
              execution_time_ms = $2
          WHERE id = $3
        `, [error.message, executionTime, executionId]);
      }
      
      // Update schedule with failure
      const newFailureCount = consecutive_failures + 1;
      await pool.query(`
        UPDATE cron_schedules 
        SET last_status = 'failed',
            consecutive_failures = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [newFailureCount, id]);
      
      // Auto-disable after 5 consecutive failures
      if (newFailureCount >= 5) {
        await this.disableSchedule(id, 'Too many consecutive failures');
      }
      
      // Emit failure event
      if (this.io) {
        this.io.emit('schedule-execution-failed', {
          scheduleId: id,
          executionId,
          scheduleName: name,
          error: error.message,
          consecutiveFailures: newFailureCount
        });
      }
    }
  }

  async waitForJobCompletion(job, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error('Job execution timeout'));
      }, timeout);
      
      job.finished().then(result => {
        clearTimeout(timeoutHandle);
        resolve(result);
      }).catch(error => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  calculateNextRun(cronExpression) {
    try {
      const interval = cronParser.CronExpressionParser.parse(cronExpression, {
        tz: process.env.CRON_TIMEZONE || 'America/Phoenix'
      });
      return interval.next().toDate();
    } catch (error) {
      logger.error('Failed to calculate next run:', error);
      return null;
    }
  }

  async disableSchedule(scheduleId, reason) {
    try {
      this.deactivateSchedule(scheduleId);
      
      await pool.query(`
        UPDATE cron_schedules 
        SET enabled = false,
            updated_at = NOW(),
            description = description || $1
        WHERE id = $2
      `, [` [Auto-disabled: ${reason}]`, scheduleId]);
      
      logger.warn(`Schedule ${scheduleId} auto-disabled: ${reason}`);
    } catch (error) {
      logger.error('Failed to disable schedule:', error);
    }
  }

  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        
        // Log warnings if issues detected
        if (health.failedSchedules > 0) {
          logger.warn(`${health.failedSchedules} schedules in failed state`);
        }
        
        if (health.queueBacklog > 100) {
          logger.warn(`High queue backlog: ${health.queueBacklog} jobs`);
        }
        
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 60000); // Check every minute
  }

  async getHealthStatus() {
    try {
      const [scheduleStats, executionStats, queueStats] = await Promise.all([
        pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE enabled = true) as enabled,
            COUNT(*) FILTER (WHERE last_status = 'failed' AND enabled = true) as failed
          FROM cron_schedules
        `),
        pool.query(`
          SELECT 
            COUNT(*) as total_24h,
            COUNT(*) FILTER (WHERE status = 'completed') as successful_24h,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_24h,
            AVG(execution_time_ms) FILTER (WHERE status = 'completed') as avg_execution_time
          FROM cron_executions
          WHERE started_at > NOW() - INTERVAL '24 hours'
        `),
        this.getQueueHealth()
      ]);
      
      return {
        scheduler: 'running',
        activeSchedules: this.activeJobs.size,
        totalSchedules: parseInt(scheduleStats.rows[0].total),
        enabledSchedules: parseInt(scheduleStats.rows[0].enabled),
        failedSchedules: parseInt(scheduleStats.rows[0].failed),
        executions24h: {
          total: parseInt(executionStats.rows[0].total_24h),
          successful: parseInt(executionStats.rows[0].successful_24h),
          failed: parseInt(executionStats.rows[0].failed_24h),
          avgExecutionTime: parseFloat(executionStats.rows[0].avg_execution_time) || 0
        },
        queue: queueStats
      };
    } catch (error) {
      logger.error('Failed to get health status:', error);
      return { scheduler: 'error', error: error.message };
    }
  }

  async getQueueHealth() {
    try {
      const queue = getQueue();
      if (!queue) {
        return { status: 'unavailable' };
      }
      
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount()
      ]);
      
      return {
        status: 'healthy',
        waiting,
        active,
        completed,
        failed,
        backlog: waiting + active
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  async shutdown() {
    logger.info('Shutting down scheduler service');
    
    // Stop all active schedules
    for (const [id, job] of this.activeJobs) {
      job.task.stop();
    }
    this.activeJobs.clear();
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.isRunning = false;
    this.emit('shutdown');
  }
}

module.exports = new SchedulerService();