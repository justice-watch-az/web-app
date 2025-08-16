import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WidgetBase } from './WidgetBase';

interface StatsData {
  summary: {
    total_cases: number;
    total_courts: number;
    unique_defendants: number;
    active_cases: number;
    closed_cases: number;
  };
  daily: Array<{
    date: string;
    count: number;
  }>;
  period: string;
  court: string;
}

export const StatsWidget: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = {
    size: (searchParams.get('size') || 'card') as 'card' | 'dashboard',
    theme: (searchParams.get('theme') || 'light') as 'light' | 'dark' | 'auto',
    court: searchParams.get('court') || 'all',
    period: searchParams.get('period') || '7d',
    title: searchParams.get('title') || 'Case Statistics',
    hideHeader: searchParams.get('hideHeader') === 'true'
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          court: config.court,
          period: config.period
        });

        const response = await fetch(`/api/widgets/data/stats?${params}`);
        const result = await response.json();

        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to load statistics');
        }
      } catch (err) {
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [config.court, config.period]);

  const renderCard = () => {
    if (!data) return null;

    return (
      <div className="stats-card">
        <div className="stat-item">
          <span className="stat-value">{data.summary.total_cases}</span>
          <span className="stat-label">Total Cases</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{data.summary.active_cases}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{data.summary.closed_cases}</span>
          <span className="stat-label">Closed</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{data.summary.total_courts}</span>
          <span className="stat-label">Courts</span>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    if (!data) return null;

    const maxCount = Math.max(...data.daily.map(d => d.count), 1);

    return (
      <div className="stats-dashboard">
        <div className="stats-summary">
          <div className="stat-card primary">
            <h4>Total Cases</h4>
            <div className="stat-number">{data.summary.total_cases}</div>
            <div className="stat-period">Last {config.period}</div>
          </div>
          <div className="stat-card">
            <h4>Active Cases</h4>
            <div className="stat-number">{data.summary.active_cases}</div>
          </div>
          <div className="stat-card">
            <h4>Closed Cases</h4>
            <div className="stat-number">{data.summary.closed_cases}</div>
          </div>
          <div className="stat-card">
            <h4>Unique Defendants</h4>
            <div className="stat-number">{data.summary.unique_defendants}</div>
          </div>
        </div>
        
        <div className="stats-chart">
          <h4>Daily Activity</h4>
          <div className="chart-container">
            {data.daily.map((day) => (
              <div key={day.date} className="chart-bar-container">
                <div 
                  className="chart-bar"
                  style={{ height: `${(day.count / maxCount) * 100}%` }}
                  title={`${day.date}: ${day.count} cases`}
                />
                <div className="chart-label">
                  {new Date(day.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <div className="widget-loading">Loading statistics...</div>;
    }

    if (error) {
      return <div className="widget-error-message">{error}</div>;
    }

    if (!data) {
      return <div className="widget-empty">No statistics available</div>;
    }

    return config.size === 'card' ? renderCard() : renderDashboard();
  };

  return (
    <WidgetBase
      title={config.title}
      size={config.size === 'card' ? 'compact' : 'full'}
      theme={config.theme}
      hideHeader={config.hideHeader}
      className="stats-widget"
    >
      {renderContent()}
    </WidgetBase>
  );
};