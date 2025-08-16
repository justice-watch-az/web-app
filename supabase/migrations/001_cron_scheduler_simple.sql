-- Drop existing tables if they exist
DROP TABLE IF EXISTS cron_executions CASCADE;
DROP TABLE IF EXISTS cron_schedules CASCADE;

-- Schedule configuration table
CREATE TABLE IF NOT EXISTS cron_schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_expression VARCHAR(100) NOT NULL,
  job_type VARCHAR(50) NOT NULL DEFAULT 'arraignments',
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  next_run TIMESTAMP,
  last_run TIMESTAMP,
  last_status VARCHAR(50),
  consecutive_failures INTEGER DEFAULT 0
);

-- Execution history table
CREATE TABLE IF NOT EXISTS cron_executions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES cron_schedules(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  scraping_job_id INTEGER,
  cases_found INTEGER DEFAULT 0,
  courts_processed INTEGER DEFAULT 0,
  error TEXT,
  execution_time_ms INTEGER,
  metadata JSONB DEFAULT '{}'
);

-- Performance indexes
CREATE INDEX idx_cron_schedules_enabled_next ON cron_schedules(enabled, next_run) WHERE enabled = true;
CREATE INDEX idx_cron_executions_schedule_status ON cron_executions(schedule_id, status, started_at DESC);
CREATE INDEX idx_cron_executions_recent ON cron_executions(started_at) WHERE started_at > CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Default schedules (fixed cron expressions)
INSERT INTO cron_schedules (name, description, cron_expression, job_type, config) VALUES
  ('Hourly Arraignment Check', 'Check for new arraignment cases every hour during business hours', '0 * * * *', 'arraignments', '{"courtId": "all", "dateRangeDays": 7}'),
  ('Daily Full Scan', 'Complete scan of all courts daily at 2 AM', '0 2 * * *', 'arraignments', '{"courtId": "all", "dateRangeDays": 30}'),
  ('Weekly Deep Scan', 'Weekly comprehensive scan on Sunday', '0 3 * * 0', 'arraignments', '{"courtId": "all", "dateRangeDays": 90, "includeArchived": true}');