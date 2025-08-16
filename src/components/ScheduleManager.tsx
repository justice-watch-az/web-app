import React, { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import axios from 'axios';
import io from 'socket.io-client';
import './ScheduleManager.css';

interface Schedule {
  id: number;
  name: string;
  description?: string;
  cron_expression: string;
  job_type: string;
  config: any;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  next_run?: string;
  last_run?: string;
  last_status?: string;
  consecutive_failures: number;
  total_executions: number;
  successful_executions: number;
  avg_execution_time?: number;
}

interface Execution {
  id: number;
  schedule_id: number;
  status: string;
  started_at: string;
  completed_at?: string;
  cases_found: number;
  courts_processed: number;
  execution_time_ms?: number;
  error?: string;
}

const cronPresets = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Weekdays at 8 AM', value: '0 8 * * 1-5' },
  { label: 'Weekly on Sunday', value: '0 0 * * 0' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

console.log('API_URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
});

let socket: any = null;
try {
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 3
  });
  console.log('Socket.io initialized');
} catch (error) {
  console.error('Failed to initialize socket.io:', error);
}

export const ScheduleManager: React.FC = () => {
  console.log('ScheduleManager component rendering');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cronExpression: '0 */6 * * *',
    config: {
      courtId: 'all',
      dateRangeDays: 30
    }
  });

  // Load schedules
  const loadSchedules = useCallback(async () => {
    console.log('Loading schedules from API...');
    try {
      const response = await api.get('/api/cron/schedules');
      console.log('Schedules API response:', response.data);
      setSchedules(response.data.schedules);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load executions for selected schedule
  const loadExecutions = useCallback(async (scheduleId: number) => {
    try {
      const response = await api.get(`/api/cron/schedules/${scheduleId}/executions`);
      setExecutions(response.data.executions);
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  }, []);

  // Create schedule
  const createSchedule = async () => {
    try {
      await api.post('/api/cron/schedules', {
        name: formData.name,
        description: formData.description,
        cronExpression: formData.cronExpression,
        jobType: 'arraignments',
        config: formData.config
      });
      
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        cronExpression: '0 */6 * * *',
        config: { courtId: 'all', dateRangeDays: 30 }
      });
      await loadSchedules();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create schedule');
    }
  };

  // Toggle schedule
  const toggleSchedule = async (scheduleId: number) => {
    try {
      await api.put(`/api/cron/schedules/${scheduleId}/toggle`);
      await loadSchedules();
    } catch (error) {
      alert('Failed to toggle schedule');
    }
  };

  // Delete schedule
  const deleteSchedule = async (scheduleId: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
      await api.delete(`/api/cron/schedules/${scheduleId}`);
      await loadSchedules();
      setSelectedSchedule(null);
    } catch (error) {
      alert('Failed to delete schedule');
    }
  };

  // Execute schedule manually
  const executeSchedule = async (scheduleId: number) => {
    try {
      await api.post(`/api/cron/schedules/${scheduleId}/execute`);
      alert('Schedule execution started');
    } catch (error) {
      alert('Failed to execute schedule');
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) {
      console.warn('Socket not initialized, skipping event handlers');
      return;
    }
    
    socket.on('schedule-execution-started', (data) => {
      console.log(`Schedule "${data.scheduleName}" started`);
      loadSchedules();
    });

    socket.on('schedule-execution-completed', (data) => {
      console.log(`Schedule "${data.scheduleName}" completed (${data.casesFound} cases)`);
      loadSchedules();
      if (selectedSchedule?.id === data.scheduleId) {
        loadExecutions(data.scheduleId);
      }
    });

    socket.on('schedule-execution-failed', (data) => {
      console.error(`Schedule "${data.scheduleName}" failed: ${data.error}`);
      loadSchedules();
    });

    return () => {
      socket.off('schedule-execution-started');
      socket.off('schedule-execution-completed');
      socket.off('schedule-execution-failed');
    };
  }, [selectedSchedule, loadSchedules, loadExecutions]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    if (selectedSchedule) {
      loadExecutions(selectedSchedule.id);
    }
  }, [selectedSchedule, loadExecutions]);

  if (loading) {
    return <div className="scheduler-container">Loading schedules...</div>;
  }

  return (
    <div className="scheduler-container">
      <div className="scheduler-header">
        <h1 className="scheduler-title">Cron Scheduler</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          New Schedule
        </button>
      </div>

      <div className="scheduler-grid">
        {/* Schedules List */}
        <div>
          {schedules.length === 0 ? (
            <div className="empty-state">
              No schedules configured. Create one to start automatic scraping.
            </div>
          ) : (
            schedules.map(schedule => (
              <div
                key={schedule.id}
                className={`schedule-card ${
                  selectedSchedule?.id === schedule.id ? 'selected' : ''
                }`}
                onClick={() => setSelectedSchedule(schedule)}
              >
                <div className="schedule-header">
                  <div>
                    <h3 className="schedule-name">
                      {schedule.name}
                      <span className={`status-indicator ${schedule.enabled ? 'enabled' : 'disabled'}`}></span>
                    </h3>
                    {schedule.description && (
                      <p style={{ color: '#6b7280', marginTop: '4px' }}>{schedule.description}</p>
                    )}
                  </div>
                  <div className="schedule-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSchedule(schedule.id);
                      }}
                      className={`btn btn-sm ${
                        schedule.enabled ? 'btn-secondary' : 'btn-success'
                      }`}
                    >
                      {schedule.enabled ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executeSchedule(schedule.id);
                      }}
                      className="btn btn-sm btn-primary"
                    >
                      Run Now
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSchedule(schedule.id);
                      }}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="schedule-info">
                  <div>
                    <span style={{ fontFamily: 'monospace' }}>{schedule.cron_expression}</span>
                  </div>
                  <div>
                    {schedule.next_run ? (
                      <span>Next: {formatDistanceToNow(new Date(schedule.next_run), { addSuffix: true })}</span>
                    ) : (
                      <span>Not scheduled</span>
                    )}
                  </div>
                </div>

                {schedule.consecutive_failures > 0 && (
                  <div className="warning-box">
                    Warning: {schedule.consecutive_failures} consecutive failures
                  </div>
                )}

                <div className="schedule-stats">
                  <span>{schedule.total_executions} runs</span>
                  <span>{schedule.successful_executions} successful</span>
                  {schedule.avg_execution_time && (
                    <span>Avg: {(schedule.avg_execution_time / 1000).toFixed(1)}s</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Execution History */}
        <div className="execution-history">
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Execution History</h2>
          {selectedSchedule ? (
            <div>
              {executions.length === 0 ? (
                <p style={{ color: '#6b7280' }}>No executions yet</p>
              ) : (
                executions.slice(0, 10).map(execution => (
                  <div
                    key={execution.id}
                    className={`execution-card ${execution.status}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>
                          {format(new Date(execution.started_at), 'MMM d, HH:mm')}
                        </div>
                        {execution.status === 'completed' && (
                          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                            {execution.cases_found} cases in {(execution.execution_time_ms! / 1000).toFixed(1)}s
                          </div>
                        )}
                        {execution.error && (
                          <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '4px' }}>
                            {execution.error}
                          </div>
                        )}
                      </div>
                      <span className={`execution-status ${execution.status}`}>
                        {execution.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p style={{ color: '#6b7280' }}>Select a schedule to view history</p>
          )}
        </div>
      </div>

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Create Schedule</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Daily Arraignment Scan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Scans all courts for new arraignment cases"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Schedule</label>
                <select
                  value={formData.cronExpression}
                  onChange={(e) => setFormData(prev => ({ ...prev, cronExpression: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {cronPresets.map(preset => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label} ({preset.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date Range (days)</label>
                <input
                  type="number"
                  value={formData.config.dateRangeDays}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, dateRangeDays: parseInt(e.target.value) }
                  }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="1"
                  max="365"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createSchedule}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};