import React, { useState, useEffect } from 'react';

export const ScheduleManagerDebug: React.FC = () => {
  const [error, setError] = useState<string>('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('ScheduleManagerDebug mounted');
    
    // Test basic fetch
    fetch('http://localhost:3001/api/cron/schedules')
      .then(res => {
        console.log('Response status:', res.status);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('Schedules data:', data);
        setSchedules(data.schedules || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Schedule Manager Debug</h1>
      
      {error && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}
      
      {loading ? (
        <p>Loading schedules...</p>
      ) : (
        <div>
          <h2>Schedules ({schedules.length})</h2>
          <ul>
            {schedules.map((schedule: any) => (
              <li key={schedule.id}>
                {schedule.name} - {schedule.cron_expression} - {schedule.enabled ? 'Enabled' : 'Disabled'}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <h3>Debug Info:</h3>
        <p>API URL: http://localhost:3001</p>
        <p>Component mounted: Yes</p>
        <p>Check browser console for detailed logs</p>
      </div>
    </div>
  );
};