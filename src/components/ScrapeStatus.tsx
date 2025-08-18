import React, { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { getLastScrapeInfo } from '../services/casesService';
import './ScheduleManager.css'; // Reuse existing styles

interface ScrapeLog {
  id: string;
  scrape_type: string;
  status: string;
  courts_processed: number | null;
  cases_found: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

const ScrapeStatus: React.FC = () => {
  const [lastScrape, setLastScrape] = useState<ScrapeLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLastScrapeInfo();
    // Refresh every minute
    const interval = setInterval(loadLastScrapeInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadLastScrapeInfo = async () => {
    try {
      const data = await getLastScrapeInfo();
      setLastScrape(data);
    } catch (error) {
      console.error('Error loading scrape info:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextRunTime = () => {
    const now = new Date();
    const nextRun = new Date();
    
    // Set to 9 AM MST (4 PM UTC)
    nextRun.setUTCHours(16, 0, 0, 0);
    
    // If we've passed today's run time, set to tomorrow
    if (now > nextRun) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    // Skip weekends
    const dayOfWeek = nextRun.getDay();
    if (dayOfWeek === 0) { // Sunday
      nextRun.setDate(nextRun.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
      nextRun.setDate(nextRun.getDate() + 2);
    }
    
    return nextRun;
  };

  if (loading) {
    return (
      <div className="schedule-manager">
        <div className="schedule-header">
          <h2>Scraping Status</h2>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const nextRun = getNextRunTime();

  return (
    <div className="schedule-manager">
      <div className="schedule-header">
        <h2>Automated Scraping Status</h2>
        <div className="schedule-status">
          <span className="status-badge status-active">Automated</span>
        </div>
      </div>

      <div className="schedule-info">
        <div className="info-card">
          <h3>Schedule</h3>
          <p className="schedule-time">Monday - Friday at 9:00 AM MST</p>
          <p className="schedule-note">Scraping runs automatically via GitHub Actions</p>
        </div>

        {lastScrape && (
          <div className="info-card">
            <h3>Last Scrape</h3>
            <div className="scrape-details">
              <div className="detail-row">
                <span className="label">Status:</span>
                <span className={`status-badge status-${lastScrape.status === 'completed' ? 'active' : 'error'}`}>
                  {lastScrape.status}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Run Time:</span>
                <span>{format(new Date(lastScrape.started_at), 'MMM dd, yyyy h:mm a')}</span>
              </div>
              <div className="detail-row">
                <span className="label">Time Ago:</span>
                <span>{formatDistanceToNow(new Date(lastScrape.started_at), { addSuffix: true })}</span>
              </div>
              {lastScrape.courts_processed !== null && (
                <div className="detail-row">
                  <span className="label">Courts Processed:</span>
                  <span>{lastScrape.courts_processed}</span>
                </div>
              )}
              {lastScrape.cases_found !== null && (
                <div className="detail-row">
                  <span className="label">Cases Found:</span>
                  <span>{lastScrape.cases_found}</span>
                </div>
              )}
              {lastScrape.error_message && (
                <div className="detail-row error">
                  <span className="label">Error:</span>
                  <span>{lastScrape.error_message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="info-card">
          <h3>Next Run</h3>
          <div className="next-run-details">
            <p className="next-run-time">
              {format(nextRun, 'EEEE, MMM dd at h:mm a')}
            </p>
            <p className="time-until">
              {formatDistanceToNow(nextRun, { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>

      <div className="schedule-footer">
        <p className="footer-note">
          ℹ️ Scraping is fully automated and runs on GitHub Actions infrastructure.
          No manual intervention is required.
        </p>
      </div>
    </div>
  );
};

export default ScrapeStatus;