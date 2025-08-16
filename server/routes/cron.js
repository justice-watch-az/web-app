const express = require('express');
const { pool } = require('../database');
const logger = require('../utils/logger');
const schedulerService = require('../services/scheduler');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all schedules with stats
router.get('/schedules', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      
      const [schedules, count] = await Promise.all([
        pool.query(`
          SELECT 
            s.*,
            COUNT(DISTINCT e.id) as total_executions,
            COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed') as successful_executions,
            MAX(e.completed_at) as last_successful_run,
            AVG(e.execution_time_ms) FILTER (WHERE e.status = 'completed') as avg_execution_time
          FROM cron_schedules s
          LEFT JOIN cron_executions e ON s.id = e.schedule_id
          GROUP BY s.id
          ORDER BY s.created_at DESC
          LIMIT $1 OFFSET $2
        `, [limit, offset]),
        pool.query('SELECT COUNT(*) FROM cron_schedules')
      ]);
      
      res.json({
        schedules: schedules.rows,
        pagination: {
          page,
          limit,
          total: parseInt(count.rows[0].count),
          totalPages: Math.ceil(count.rows[0].count / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  }
);

// Get single schedule with details
router.get('/schedules/:id',
  param('id').isInt(),
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const [schedule, executions] = await Promise.all([
        pool.query('SELECT * FROM cron_schedules WHERE id = $1', [id]),
        pool.query(`
          SELECT * FROM cron_executions 
          WHERE schedule_id = $1 
          ORDER BY started_at DESC 
          LIMIT 10
        `, [id])
      ]);
      
      if (schedule.rows.length === 0) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      res.json({
        schedule: schedule.rows[0],
        recentExecutions: executions.rows
      });
    } catch (error) {
      logger.error('Error fetching schedule:', error);
      res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  }
);

// Create new schedule
router.post('/schedules',
  body('name').notEmpty().isLength({ max: 255 }),
  body('description').optional().isLength({ max: 1000 }),
  body('cronExpression').notEmpty().custom(value => {
    const cron = require('node-cron');
    return cron.validate(value);
  }).withMessage('Invalid cron expression'),
  body('jobType').optional().isIn(['arraignments']),
  body('config').optional().isObject(),
  validateRequest,
  async (req, res) => {
    try {
      const { name, description, cronExpression, jobType = 'arraignments', config = {} } = req.body;
      const userId = req.userId || null; // From auth middleware
      
      // Check for duplicate names
      const existing = await pool.query(
        'SELECT id FROM cron_schedules WHERE name = $1',
        [name]
      );
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Schedule with this name already exists' });
      }
      
      // Create schedule
      const result = await pool.query(`
        INSERT INTO cron_schedules 
        (name, description, cron_expression, job_type, config, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [name, description, cronExpression, jobType, config, userId]);
      
      const schedule = result.rows[0];
      
      // Activate if enabled
      if (schedule.enabled) {
        await schedulerService.activateSchedule(schedule);
      }
      
      logger.info(`Schedule created: ${schedule.id} - ${name}`);
      res.status(201).json({ schedule });
      
    } catch (error) {
      logger.error('Error creating schedule:', error);
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  }
);

// Update schedule
router.put('/schedules/:id',
  param('id').isInt(),
  body('name').optional().isLength({ max: 255 }),
  body('description').optional().isLength({ max: 1000 }),
  body('cronExpression').optional().custom(value => {
    const cron = require('node-cron');
    return cron.validate(value);
  }),
  body('config').optional().isObject(),
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Build update query
      const fields = [];
      const values = [];
      let paramCount = 1;
      
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'cronExpression') {
          fields.push(`cron_expression = $${paramCount}`);
        } else {
          fields.push(`${key} = $${paramCount}`);
        }
        values.push(value);
        paramCount++;
      });
      
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }
      
      fields.push(`updated_at = NOW()`);
      values.push(id);
      
      const result = await pool.query(`
        UPDATE cron_schedules 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      const schedule = result.rows[0];
      
      // Reactivate if enabled and cron changed
      if (schedule.enabled && updates.cronExpression) {
        await schedulerService.activateSchedule(schedule);
      }
      
      res.json({ schedule });
      
    } catch (error) {
      logger.error('Error updating schedule:', error);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  }
);

// Toggle schedule enabled/disabled
router.put('/schedules/:id/toggle',
  param('id').isInt(),
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        UPDATE cron_schedules 
        SET enabled = NOT enabled,
            updated_at = NOW(),
            consecutive_failures = CASE WHEN NOT enabled THEN 0 ELSE consecutive_failures END
        WHERE id = $1
        RETURNING *
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      const schedule = result.rows[0];
      
      if (schedule.enabled) {
        await schedulerService.activateSchedule(schedule);
      } else {
        schedulerService.deactivateSchedule(id);
      }
      
      logger.info(`Schedule ${id} toggled: enabled=${schedule.enabled}`);
      res.json({ schedule });
      
    } catch (error) {
      logger.error('Error toggling schedule:', error);
      res.status(500).json({ error: 'Failed to toggle schedule' });
    }
  }
);

// Delete schedule
router.delete('/schedules/:id',
  param('id').isInt(),
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Deactivate first
      schedulerService.deactivateSchedule(id);
      
      // Delete from database (cascades to executions)
      const result = await pool.query(
        'DELETE FROM cron_schedules WHERE id = $1 RETURNING name',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      logger.info(`Schedule ${id} deleted: ${result.rows[0].name}`);
      res.json({ message: 'Schedule deleted successfully' });
      
    } catch (error) {
      logger.error('Error deleting schedule:', error);
      res.status(500).json({ error: 'Failed to delete schedule' });
    }
  }
);

// Execute schedule immediately
router.post('/schedules/:id/execute',
  param('id').isInt(),
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const schedule = await pool.query(
        'SELECT * FROM cron_schedules WHERE id = $1',
        [id]
      );
      
      if (schedule.rows.length === 0) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      // Execute in background
      schedulerService.executeScheduledJob(schedule.rows[0])
        .catch(error => {
          logger.error(`Manual execution of schedule ${id} failed:`, error);
        });
      
      res.json({ message: 'Schedule execution started' });
      
    } catch (error) {
      logger.error('Error executing schedule:', error);
      res.status(500).json({ error: 'Failed to execute schedule' });
    }
  }
);

// Get execution history
router.get('/schedules/:id/executions',
  param('id').isInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await pool.query(`
        SELECT 
          e.*,
          sj.cases_found as total_cases,
          sj.error as job_error
        FROM cron_executions e
        LEFT JOIN scraping_jobs sj ON e.scraping_job_id = sj.id
        WHERE e.schedule_id = $1
        ORDER BY e.started_at DESC
        LIMIT $2
      `, [id, limit]);
      
      res.json({ executions: result.rows });
      
    } catch (error) {
      logger.error('Error fetching executions:', error);
      res.status(500).json({ error: 'Failed to fetch executions' });
    }
  }
);

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = await schedulerService.getHealthStatus();
    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ 
      scheduler: 'error',
      error: error.message 
    });
  }
});

// Statistics endpoint
router.get('/stats', async (req, res) => {
  try {
    const [hourlyStats, dailyStats, topSchedules] = await Promise.all([
      pool.query(`
        SELECT 
          DATE_TRUNC('hour', started_at) as hour,
          COUNT(*) as executions,
          COUNT(*) FILTER (WHERE status = 'completed') as successful,
          AVG(execution_time_ms) as avg_time
        FROM cron_executions
        WHERE started_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour DESC
      `),
      pool.query(`
        SELECT 
          DATE_TRUNC('day', started_at) as day,
          COUNT(*) as executions,
          SUM(cases_found) as total_cases,
          AVG(execution_time_ms) as avg_time
        FROM cron_executions
        WHERE started_at > NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day DESC
      `),
      pool.query(`
        SELECT 
          s.name,
          s.cron_expression,
          COUNT(e.id) as executions,
          AVG(e.execution_time_ms) as avg_time,
          SUM(e.cases_found) as total_cases
        FROM cron_schedules s
        JOIN cron_executions e ON s.id = e.schedule_id
        WHERE e.started_at > NOW() - INTERVAL '7 days'
        GROUP BY s.id
        ORDER BY executions DESC
        LIMIT 5
      `)
    ]);
    
    res.json({
      hourly: hourlyStats.rows,
      daily: dailyStats.rows,
      topSchedules: topSchedules.rows
    });
    
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;