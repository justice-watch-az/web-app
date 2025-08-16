import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001';

export const ScheduleManagerSimple: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/cron/schedules`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        console.log('Schedules loaded:', data);
        setSchedules(data.schedules || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading schedules:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Schedule Manager (Simple)</h1>
      <div>
        <h2>Schedules ({schedules.length})</h2>
        {schedules.map((schedule: any) => (
          <div key={schedule.id} style={{ 
            border: '1px solid #ccc', 
            padding: '10px', 
            margin: '10px 0',
            backgroundColor: schedule.enabled ? '#e8f5e9' : '#ffebee'
          }}>
            <h3>{schedule.name}</h3>
            <p>Expression: {schedule.cron_expression}</p>
            <p>Status: {schedule.enabled ? 'Enabled' : 'Disabled'}</p>
            <p>Next Run: {schedule.next_run || 'N/A'}</p>
          </div>
        ))}
      </div>
    </div>
  );
};