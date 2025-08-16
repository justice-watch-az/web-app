# PRP: Add Cron Scheduler for Automatic Scraping - Justice Watch App

## Goal
Implement a comprehensive cron scheduling system that automatically triggers arraignment case scraping at configurable intervals, integrates with the existing Bull queue + Redis infrastructure, provides monitoring/logging capabilities, and includes admin management interfaces for scheduling control.

## Why
**Business Value:**
- **Continuous Data Collection**: Ensures court case data is automatically updated without manual intervention
- **Operational Efficiency**: Reduces manual work and ensures consistent data freshness
- **User Experience**: Users always have access to the latest arraignment case information
- **Scalability**: Automated scheduling supports growth and reduces operational overhead

**Technical Need:**
- Current scraping requires manual triggering via API endpoints
- No automated data refresh mechanism exists
- Risk of stale data if manual scraping is forgotten
- Need for configurable scraping intervals (hourly, daily, weekly)
- Integration with existing Redis/Bull queue infrastructure
- Monitoring and error handling for scheduled operations

## What

### User-Visible Behavior
1. **Automatic Background Scraping**: Cases are automatically scraped at configured intervals
2. **Admin Dashboard**: Interface to view, create, modify, and delete cron schedules
3. **Schedule Status Monitoring**: Real-time status of scheduled jobs (next run, last run, success/failure)
4. **Schedule Management API**: REST endpoints for programmatic schedule management
5. **Logging & Notifications**: Detailed logs and optional notifications for schedule events

### Technical Requirements
1. **Cron Scheduler Integration**: node-cron package integrated with Express server
2. **Redis/Bull Queue Integration**: Scheduled jobs use existing queue infrastructure
3. **Database Schema**: Tables for storing schedule configurations and execution history
4. **Error Handling**: Retry logic, failure notifications, and graceful degradation
5. **Configuration Management**: Environment-based and database-stored scheduling configs
6. **Monitoring**: Health checks, performance metrics, and execution tracking
7. **Admin Interface**: Web UI for schedule management

## All Needed Context

### Current Architecture Analysis

**Existing Scraping Infrastructure:**
- **Queue System**: Bull queue with Redis backend (`server/queue/index.js`)
- **Scraper**: Python-based Maricopa arraignment scraper (`scrapers/maricopa_arraignment_scraper.py`)
- **Database**: PostgreSQL with `scraping_jobs` table tracking job execution
- **API Endpoints**: `/api/scraping/arraignments` for manual triggering
- **WebSocket**: Real-time progress updates via Socket.io

**Current Scraping Flow:**
1. POST `/api/scraping/arraignments` → Creates job record in `scraping_jobs` table
2. Job added to Bull queue with type `scrape-arraignments`
3. Queue processor spawns Python scraper process
4. Progress updates sent via WebSocket
5. Results saved to `court_cases` table via `saveCaseToDatabase()`

**Dependencies Already Present:**
- **bull**: v4.12.0 (Queue management)
- **redis**: v4.7.0 (Queue backend)
- **winston**: v3.17.0 (Logging)
- **express**: v4.21.2 (Web server)
- **socket.io**: v4.8.1 (Real-time updates)

### Database Schema Context

**Existing Tables:**
```sql
-- scraping_jobs table (server/database/index.js)
CREATE TABLE scraping_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  config JSONB,
  job_type VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cases_found INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- court_cases table (database/schema_no_auth.sql)
CREATE TABLE court_cases (
  id SERIAL PRIMARY KEY,
  case_number VARCHAR(100) NOT NULL,
  court_id VARCHAR(100) NOT NULL,
  court_name VARCHAR(255),
  case_title VARCHAR(500),
  case_type VARCHAR(100),
  case_status VARCHAR(100),
  filing_date DATE,
  judge VARCHAR(255),
  next_hearing DATE,
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- ... additional fields
  UNIQUE(case_number, court_id)
);
```

### Deployment Context
- **Platform**: Akash Network containerized deployment
- **Database**: Supabase PostgreSQL
- **Environment Variables**: Managed via `.env` files and Docker
- **Container**: Single container serving both frontend and backend
- **Logging**: File-based with winston (error.log, combined.log)

### Cron Scheduling Options Analysis

**Option 1: node-cron (Recommended)**
```javascript
// Pros: Simple, in-process, good for single-container deployment
const cron = require('node-cron');
cron.schedule('0 */6 * * *', () => {
  // Trigger scraping every 6 hours
});
```

**Option 2: Bull Queue Scheduler**
```javascript
// Pros: Built on existing Bull infrastructure
const Queue = require('bull');
const scheduledJobs = new Queue('scheduled jobs');
scheduledJobs.add('scrape-job', data, {
  repeat: { cron: '0 */6 * * *' }
});
```

**Option 3: System Cron (Not Recommended for Container)**
- Requires cron daemon in container
- Complex in containerized environments
- Less control from application

### Error Handling Patterns
**Existing Error Handling in Queue (`server/queue/index.js`):**
- Database status updates on job failure
- WebSocket error notifications
- Winston logging for all errors
- Graceful degradation when Redis unavailable

### Integration Points
1. **Queue Integration**: Use existing `scrapingQueue.add('scrape-arraignments', data)`
2. **Database Integration**: Use existing `pool.query()` patterns
3. **Logging Integration**: Use existing `logger` (winston)
4. **WebSocket Integration**: Use existing `io.emit()` for real-time updates
5. **API Integration**: Extend existing `/api/scraping` routes

## Implementation Blueprint

### Phase 1: Core Cron Scheduler Infrastructure

#### 1.1 Install Dependencies
```bash
npm install node-cron
```

#### 1.2 Create Scheduler Service (`server/services/scheduler.js`)
```javascript
const cron = require('node-cron');
const { getQueue } = require('../queue');
const { pool } = require('../database');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.activeJobs = new Map();
    this.io = null;
  }

  async init(socketIo) {
    this.io = socketIo;
    await this.loadSchedulesFromDatabase();
    logger.info('Scheduler service initialized');
  }

  async loadSchedulesFromDatabase() {
    const result = await pool.query(
      'SELECT * FROM cron_schedules WHERE enabled = true'
    );
    
    for (const schedule of result.rows) {
      this.scheduleJob(schedule);
    }
  }

  scheduleJob(schedule) {
    const { id, cron_expression, job_type, config } = schedule;
    
    const task = cron.schedule(cron_expression, async () => {
      await this.executeScheduledJob(schedule);
    }, {
      scheduled: false,
      timezone: process.env.TIMEZONE || 'America/Phoenix'
    });

    this.activeJobs.set(id, task);
    task.start();
    
    logger.info(`Scheduled job ${id}: ${cron_expression} for ${job_type}`);
  }

  async executeScheduledJob(schedule) {
    try {
      const queue = getQueue();
      
      // Create execution record
      const executionResult = await pool.query(
        `INSERT INTO cron_executions (schedule_id, status, started_at) 
         VALUES ($1, 'running', NOW()) RETURNING id`,
        [schedule.id]
      );
      
      const executionId = executionResult.rows[0].id;
      
      // Add to scraping queue
      const job = await queue.add('scrape-arraignments', {
        scheduledExecution: true,
        executionId,
        scheduleId: schedule.id,
        ...schedule.config
      });

      // Emit WebSocket update
      if (this.io) {
        this.io.emit('schedule-executed', {
          scheduleId: schedule.id,
          executionId,
          jobId: job.id
        });
      }

    } catch (error) {
      logger.error(`Scheduled job ${schedule.id} failed:`, error);
      await this.recordExecutionFailure(schedule.id, error);
    }
  }
}

module.exports = new SchedulerService();
```

#### 1.3 Database Schema Extension
```sql
-- Cron schedules configuration table
CREATE TABLE IF NOT EXISTS cron_schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_expression VARCHAR(100) NOT NULL,
  job_type VARCHAR(50) NOT NULL DEFAULT 'arraignments',
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  next_run TIMESTAMP,
  last_run TIMESTAMP
);

-- Cron execution history table
CREATE TABLE IF NOT EXISTS cron_executions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES cron_schedules(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  scraping_job_id INTEGER REFERENCES scraping_jobs(id),
  cases_found INTEGER DEFAULT 0,
  error TEXT,
  execution_time_ms INTEGER
);

-- Indexes for performance
CREATE INDEX idx_cron_schedules_enabled ON cron_schedules(enabled);
CREATE INDEX idx_cron_schedules_next_run ON cron_schedules(next_run);
CREATE INDEX idx_cron_executions_schedule_id ON cron_executions(schedule_id);
CREATE INDEX idx_cron_executions_started_at ON cron_executions(started_at DESC);
```

### Phase 2: API Endpoints for Schedule Management

#### 2.1 Cron Management Routes (`server/routes/cron.js`)
```javascript
const express = require('express');
const { pool } = require('../database');
const logger = require('../utils/logger');
const schedulerService = require('../services/scheduler');
const router = express.Router();

// Get all schedules
router.get('/schedules', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, 
             COUNT(e.id) as total_executions,
             MAX(e.completed_at) as last_successful_run
      FROM cron_schedules s
      LEFT JOIN cron_executions e ON s.id = e.schedule_id AND e.status = 'completed'
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    
    res.json({ schedules: result.rows });
  } catch (error) {
    logger.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Create new schedule
router.post('/schedules', async (req, res) => {
  try {
    const { name, description, cronExpression, jobType, config } = req.body;
    
    // Validate cron expression
    const cron = require('node-cron');
    if (!cron.validate(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }
    
    const result = await pool.query(`
      INSERT INTO cron_schedules (name, description, cron_expression, job_type, config, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, cronExpression, jobType, config, req.userId]);
    
    const schedule = result.rows[0];
    
    // Schedule the job
    await schedulerService.scheduleJob(schedule);
    
    res.status(201).json({ schedule });
  } catch (error) {
    logger.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Toggle schedule enabled/disabled
router.put('/schedules/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE cron_schedules 
      SET enabled = NOT enabled, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    const schedule = result.rows[0];
    
    if (schedule.enabled) {
      await schedulerService.scheduleJob(schedule);
    } else {
      schedulerService.stopJob(id);
    }
    
    res.json({ schedule });
  } catch (error) {
    logger.error('Error toggling schedule:', error);
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

// Get execution history for a schedule
router.get('/schedules/:id/executions', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    const result = await pool.query(`
      SELECT e.*, sj.cases_found, sj.error as scraping_error
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
});

module.exports = router;
```

#### 2.2 Integration with Main Server (`server/index.js`)
```javascript
// Add to existing imports
const cronRoutes = require('./routes/cron');
const schedulerService = require('./services/scheduler');

// Add to routes section
app.use('/api/cron', cronRoutes);

// Update startServer function
async function startServer() {
  try {
    await initDatabase();
    await initQueue(io);
    
    // Initialize scheduler service
    await schedulerService.init(io);
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}
```

### Phase 3: Queue Integration and Job Processing

#### 3.1 Enhanced Queue Processing (`server/queue/index.js`)
```javascript
// Add to existing queue processor for 'scrape-arraignments'
scrapingQueue.process('scrape-arraignments', async (job) => {
  const { courtId, userId, dateRangeDays, jobId, scheduledExecution, executionId } = job.data;
  const { pool } = require('../database');
  
  // Enhanced logging for scheduled jobs
  if (scheduledExecution) {
    logger.info(`Processing scheduled arraignment scraping job - execution ${executionId}`);
  }
  
  // ... existing scraping logic ...
  
  pythonProcess.on('close', async (code) => {
    if (code !== 0) {
      // Update cron execution status on failure
      if (scheduledExecution && executionId) {
        await pool.query(`
          UPDATE cron_executions 
          SET status = 'failed', completed_at = NOW(), error = $1,
              execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
          WHERE id = $2
        `, [error || `Process exited with code ${code}`, executionId]);
      }
      
      // ... existing error handling ...
    } else {
      // Update cron execution status on success
      if (scheduledExecution && executionId) {
        await pool.query(`
          UPDATE cron_executions 
          SET status = 'completed', completed_at = NOW(), 
              cases_found = $1, scraping_job_id = $2,
              execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
          WHERE id = $3
        `, [result.arraignment_cases?.length || 0, jobId, executionId]);
        
        // Update next_run time for the schedule
        if (job.data.scheduleId) {
          const cron = require('node-cron');
          const parser = require('cron-parser');
          const schedule = await pool.query('SELECT cron_expression FROM cron_schedules WHERE id = $1', [job.data.scheduleId]);
          if (schedule.rows.length > 0) {
            const nextRun = parser.parseExpression(schedule.rows[0].cron_expression).next().toDate();
            await pool.query(`
              UPDATE cron_schedules 
              SET last_run = NOW(), next_run = $1 
              WHERE id = $2
            `, [nextRun, job.data.scheduleId]);
          }
        }
      }
      
      // ... existing success handling ...
    }
  });
});
```

### Phase 4: Admin Interface Components

#### 4.1 Frontend Schedule Management Component (`src/components/ScheduleManager.tsx`)
```typescript
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Schedule {
  id: number;
  name: string;
  description: string;
  cron_expression: string;
  job_type: string;
  enabled: boolean;
  next_run: string;
  last_run: string;
  total_executions: number;
}

export const ScheduleManager: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    description: '',
    cronExpression: '0 */6 * * *', // Every 6 hours
    jobType: 'arraignments',
    config: {}
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const response = await api.get('/api/cron/schedules');
      setSchedules(response.data.schedules);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  };

  const createSchedule = async () => {
    try {
      await api.post('/api/cron/schedules', newSchedule);
      await loadSchedules();
      setNewSchedule({
        name: '',
        description: '',
        cronExpression: '0 */6 * * *',
        jobType: 'arraignments',
        config: {}
      });
    } catch (error) {
      console.error('Failed to create schedule:', error);
    }
  };

  const toggleSchedule = async (id: number) => {
    try {
      await api.put(`/api/cron/schedules/${id}/toggle`);
      await loadSchedules();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  return (
    <div className="schedule-manager">
      <h2>Automatic Scraping Schedules</h2>
      
      {/* Schedule Creation Form */}
      <div className="create-schedule">
        <h3>Create New Schedule</h3>
        <input
          type="text"
          placeholder="Schedule name"
          value={newSchedule.name}
          onChange={(e) => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
        />
        <input
          type="text"
          placeholder="Cron expression (e.g., 0 */6 * * *)"
          value={newSchedule.cronExpression}
          onChange={(e) => setNewSchedule(prev => ({ ...prev, cronExpression: e.target.value }))}
        />
        <textarea
          placeholder="Description"
          value={newSchedule.description}
          onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
        />
        <button onClick={createSchedule}>Create Schedule</button>
      </div>

      {/* Schedules List */}
      <div className="schedules-list">
        {schedules.map(schedule => (
          <div key={schedule.id} className="schedule-card">
            <h4>{schedule.name}</h4>
            <p>{schedule.description}</p>
            <div className="schedule-details">
              <span>Expression: {schedule.cron_expression}</span>
              <span>Status: {schedule.enabled ? 'Enabled' : 'Disabled'}</span>
              <span>Next Run: {schedule.next_run ? new Date(schedule.next_run).toLocaleString() : 'N/A'}</span>
              <span>Executions: {schedule.total_executions}</span>
            </div>
            <button 
              onClick={() => toggleSchedule(schedule.id)}
              className={schedule.enabled ? 'disable-btn' : 'enable-btn'}
            >
              {schedule.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Phase 5: Monitoring and Configuration

#### 5.1 Environment Configuration
```bash
# .env additions
CRON_ENABLED=true
CRON_TIMEZONE=America/Phoenix
DEFAULT_SCRAPING_INTERVAL=0 */6 * * *  # Every 6 hours
NOTIFICATION_EMAIL=admin@example.com
```

#### 5.2 Health Check Endpoint (`server/routes/cron.js`)
```javascript
// Health check for scheduler
router.get('/health', async (req, res) => {
  try {
    const schedulesResult = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN enabled THEN 1 END) as enabled FROM cron_schedules');
    const recentExecutions = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM cron_executions 
      WHERE started_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `);
    
    const health = {
      scheduler_status: 'running',
      total_schedules: parseInt(schedulesResult.rows[0].total),
      enabled_schedules: parseInt(schedulesResult.rows[0].enabled),
      executions_24h: recentExecutions.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      next_scheduled_run: await getNextScheduledRun()
    };
    
    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});
```

### Phase 6: Error Handling and Retry Logic

#### 6.1 Enhanced Error Handling
```javascript
// In scheduler service
async executeScheduledJob(schedule) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      attempt++;
      
      // ... existing execution logic ...
      
      break; // Success, exit retry loop
      
    } catch (error) {
      logger.error(`Scheduled job ${schedule.id} attempt ${attempt} failed:`, error);
      
      if (attempt >= maxRetries) {
        await this.recordExecutionFailure(schedule.id, error, attempt);
        
        // Optionally disable schedule after multiple failures
        if (schedule.auto_disable_on_failure) {
          await this.disableSchedule(schedule.id);
        }
        
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
```

## Validation Loop

### Level 1: Syntax & Dependencies
```bash
# Install new dependency
npm install node-cron cron-parser

# Type checking (if using TypeScript)
npm run type-check

# Linting
npm run lint
```

### Level 2: Database Schema
```bash
# Apply new database schema
node -e "
const { pool } = require('./server/database');
const fs = require('fs');
const schema = fs.readFileSync('./database/cron_schema.sql', 'utf8');
pool.query(schema).then(() => {
  console.log('Cron schema applied successfully');
  process.exit(0);
}).catch(err => {
  console.error('Schema application failed:', err);
  process.exit(1);
});
"
```

### Level 3: Service Integration Tests
```bash
# Test scheduler service initialization
node -e "
const schedulerService = require('./server/services/scheduler');
schedulerService.init().then(() => {
  console.log('Scheduler service initialized successfully');
  process.exit(0);
}).catch(err => {
  console.error('Scheduler initialization failed:', err);
  process.exit(1);
});
"

# Test cron expression validation
node -e "
const cron = require('node-cron');
const expressions = ['0 */6 * * *', '0 0 * * *', '0 0 * * 0'];
expressions.forEach(expr => {
  console.log(\`\${expr}: \${cron.validate(expr) ? 'VALID' : 'INVALID'}\`);
});
"
```

### Level 4: API Endpoint Tests
```bash
# Start server
npm run start &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test schedule creation
curl -X POST http://localhost:3001/api/cron/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Arraignment Scraping",
    "description": "Scrape arraignment cases daily at midnight",
    "cronExpression": "0 0 * * *",
    "jobType": "arraignments",
    "config": {"courtId": "all", "dateRangeDays": 7}
  }'

# Test schedule listing
curl http://localhost:3001/api/cron/schedules

# Test health check
curl http://localhost:3001/api/cron/health

# Test schedule toggle
SCHEDULE_ID=$(curl -s http://localhost:3001/api/cron/schedules | jq -r '.schedules[0].id')
curl -X PUT http://localhost:3001/api/cron/schedules/$SCHEDULE_ID/toggle

# Cleanup
kill $SERVER_PID
```

### Level 5: Integration Testing
```bash
# Test full flow: create schedule → wait for execution → verify results
node -e "
const { pool } = require('./server/database');
const schedulerService = require('./server/services/scheduler');

async function testIntegration() {
  // Create a test schedule (every minute for testing)
  const result = await pool.query(\`
    INSERT INTO cron_schedules (name, cron_expression, job_type, config, enabled)
    VALUES ('Test Schedule', '* * * * *', 'arraignments', '{}', true)
    RETURNING id
  \`);
  
  const scheduleId = result.rows[0].id;
  console.log(\`Created test schedule: \${scheduleId}\`);
  
  // Schedule the job
  await schedulerService.scheduleJob(result.rows[0]);
  
  // Wait 65 seconds for execution
  console.log('Waiting for execution...');
  await new Promise(resolve => setTimeout(resolve, 65000));
  
  // Check if execution was recorded
  const executions = await pool.query(
    'SELECT * FROM cron_executions WHERE schedule_id = \$1',
    [scheduleId]
  );
  
  console.log(\`Executions found: \${executions.rows.length}\`);
  
  // Cleanup
  await pool.query('DELETE FROM cron_schedules WHERE id = \$1', [scheduleId]);
  
  if (executions.rows.length > 0) {
    console.log('✅ Integration test PASSED');
    process.exit(0);
  } else {
    console.log('❌ Integration test FAILED');
    process.exit(1);
  }
}

testIntegration().catch(err => {
  console.error('Integration test error:', err);
  process.exit(1);
});
"
```

### Level 6: Production Readiness
```bash
# Test with production-like environment
export NODE_ENV=production
export CRON_ENABLED=true
export REDIS_HOST=localhost
export REDIS_PORT=6379

# Start with production config
npm run start

# Monitor logs for scheduler messages
tail -f combined.log | grep -i cron

# Verify schedules persist across restarts
curl http://localhost:3001/api/cron/schedules
# Restart server
# Verify schedules still exist and are active
curl http://localhost:3001/api/cron/schedules
```

### Level 7: Performance & Monitoring
```bash
# Monitor scheduler performance
node -e "
const { pool } = require('./server/database');

async function monitorPerformance() {
  setInterval(async () => {
    const stats = await pool.query(\`
      SELECT 
        COUNT(*) as total_schedules,
        COUNT(CASE WHEN enabled THEN 1 END) as active_schedules,
        AVG(execution_time_ms) as avg_execution_time,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failures_24h
      FROM cron_schedules s
      LEFT JOIN cron_executions e ON s.id = e.schedule_id 
        AND e.started_at > NOW() - INTERVAL '24 hours'
    \`);
    
    console.log('Scheduler Stats:', stats.rows[0]);
  }, 10000);
}

monitorPerformance();
"
```

## Success Criteria Checklist

### Implementation Complete
- [ ] node-cron package installed and integrated
- [ ] SchedulerService class created with job management
- [ ] Database schema extended with cron_schedules and cron_executions tables
- [ ] API endpoints for schedule CRUD operations implemented
- [ ] Queue integration for scheduled job execution
- [ ] WebSocket integration for real-time schedule updates
- [ ] Admin interface components for schedule management
- [ ] Error handling and retry logic implemented
- [ ] Health check and monitoring endpoints created

### Validation Passed
- [ ] All syntax and linting checks pass
- [ ] Database schema successfully applied
- [ ] Scheduler service initializes without errors
- [ ] API endpoints respond correctly to test requests
- [ ] Cron expressions validate properly
- [ ] Scheduled jobs execute and update database correctly
- [ ] Integration tests pass with real job execution
- [ ] Production environment testing completed
- [ ] Performance monitoring shows acceptable metrics

### Operational Ready
- [ ] Default schedules can be created via environment variables
- [ ] Schedules persist across server restarts
- [ ] Failed jobs are logged and retried appropriately
- [ ] Admin interface allows full schedule lifecycle management
- [ ] Monitoring shows scheduler health status
- [ ] Documentation updated with scheduler usage instructions
- [ ] Deployment configuration includes new environment variables

## Edge Cases and Gotchas

### Cron Expression Validation
- **Issue**: Invalid cron expressions can crash the scheduler
- **Solution**: Validate all expressions using `cron.validate()` before database storage
- **Code**: Input validation in API endpoints and database constraints

### Timezone Handling
- **Issue**: Cron jobs may execute at unexpected times in different timezones
- **Solution**: Explicitly set timezone in cron.schedule() options
- **Config**: Use `CRON_TIMEZONE` environment variable, default to `America/Phoenix`

### Server Restart Behavior
- **Issue**: In-memory scheduled jobs are lost on server restart
- **Solution**: Load all enabled schedules from database on service initialization
- **Implementation**: `loadSchedulesFromDatabase()` in scheduler service init

### Redis Unavailability
- **Issue**: Scheduled jobs fail if Redis/Bull queue is unavailable
- **Solution**: Graceful degradation - log error but don't crash scheduler
- **Fallback**: Direct execution mode as backup (already implemented in scraping routes)

### Concurrent Job Execution
- **Issue**: Multiple instances of the same scheduled job running simultaneously
- **Solution**: Use database locks or job deduplication in Bull queue
- **Implementation**: Check for running jobs before starting new ones

### Long-Running Jobs
- **Issue**: If scraping takes longer than schedule interval, jobs may overlap
- **Solution**: Implement job timeout and overlap prevention
- **Configuration**: Configurable job timeout in schedule config

### Database Connection Issues
- **Issue**: Schedule execution fails if database is temporarily unavailable
- **Solution**: Retry logic with exponential backoff
- **Monitoring**: Health checks to detect database connectivity issues

### Memory Leaks
- **Issue**: Long-running scheduler may accumulate memory from job references
- **Solution**: Properly clean up completed job references and use weak references where appropriate
- **Monitoring**: Monitor memory usage in production

## Performance Considerations

### Database Query Optimization
- **Indexes**: Created on `cron_schedules.enabled`, `cron_schedules.next_run`, `cron_executions.schedule_id`
- **Query Patterns**: Use prepared statements and connection pooling
- **Cleanup**: Regular cleanup of old execution records (retention policy)

### Scheduler Efficiency
- **In-Memory Jobs**: Keep active job references in Map for O(1) access
- **Lazy Loading**: Only load schedules that are enabled
- **Batch Operations**: Group database updates for multiple schedule updates

### Resource Management
- **Connection Pooling**: Reuse existing database pool
- **Queue Efficiency**: Leverage existing Bull queue infrastructure
- **Memory Usage**: Clean up completed job references promptly

This comprehensive PRP provides all the context, implementation details, and validation steps needed to successfully add a robust cron scheduling system to the justice-watch-app. The implementation leverages existing infrastructure while adding powerful scheduling capabilities with proper monitoring, error handling, and administrative controls.