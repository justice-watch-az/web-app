import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WidgetBase } from './WidgetBase';

interface ArraignmentData {
  id: string;
  caseNumber: string;
  defendantName: string;
  caseTitle?: string;
  court: string;
  judge?: string;
  charges: string[];
  scheduledDate?: string;
  scheduledTime?: string;
  status?: string;
}

interface ApiResponse {
  success: boolean;
  data: ArraignmentData[];
  count: number;
  timestamp: string;
  error?: string;
}

// Safe hook that works both in Router and standalone contexts
const useQueryParams = () => {
  try {
    const [searchParams] = useSearchParams();
    return searchParams;
  } catch {
    // Fallback for non-router context (standalone widget)
    return new URLSearchParams(window.location.search);
  }
};

export const ArraignmentsWidget: React.FC = () => {
  const searchParams = useQueryParams();
  const [data, setData] = useState<ArraignmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse URL parameters
  const config = {
    size: (searchParams.get('size') || 'standard') as 'compact' | 'standard' | 'full',
    theme: (searchParams.get('theme') || 'light') as 'light' | 'dark' | 'auto',
    court: searchParams.get('court') || 'all',
    date: searchParams.get('date') || 'today',
    limit: parseInt(searchParams.get('limit') || '10'),
    refresh: parseInt(searchParams.get('refresh') || '0'),
    title: searchParams.get('title') || "Today's Arraignments",
    hideHeader: searchParams.get('hideHeader') === 'true'
  };

  // Calculate actual date
  const getDate = () => {
    if (config.date === 'today') return new Date().toISOString().split('T')[0];
    if (config.date === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    return config.date;
  };

  // Fetch data from API
  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        court: config.court,
        date: getDate(),
        limit: config.limit.toString()
      });

      const response = await fetch(`/api/widgets/data/arraignments?${params}`, {
        headers: {
          'Accept': 'application/json',
          'X-Widget-Version': '1.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      console.error('Error fetching arraignment data:', err);
      setError('Failed to load arraignment data');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and refresh interval
  useEffect(() => {
    fetchData();

    if (config.refresh > 0) {
      const interval = setInterval(fetchData, config.refresh);
      return () => clearInterval(interval);
    }
  }, [config.court, config.date, config.limit, config.refresh]);

  // Render compact view
  const renderCompact = () => (
    <ul className="arraignments-list-compact">
      {data.map((item) => (
        <li key={item.id} className="arraignment-item-compact">
          <div className="case-number">{item.caseNumber}</div>
          <div className="defendant">{item.defendantName}</div>
          <div className="time">{item.scheduledTime || 'TBD'}</div>
        </li>
      ))}
    </ul>
  );

  // Render standard view
  const renderStandard = () => (
    <div className="arraignments-grid">
      {data.map((item) => (
        <div key={item.id} className="arraignment-card">
          <h4>{item.caseNumber}</h4>
          <p className="defendant">{item.defendantName}</p>
          {item.charges.length > 0 && (
            <p className="charges">{item.charges.slice(0, 2).join(', ')}</p>
          )}
          <div className="metadata">
            <span className="court">{item.court}</span>
            <span className="time">{item.scheduledTime || 'TBD'}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // Render full view
  const renderFull = () => (
    <div className="table-container">
      <table className="arraignments-table">
        <thead>
          <tr>
            <th>Case #</th>
            <th>Defendant</th>
            <th>Charges</th>
            <th>Court</th>
            <th>Time</th>
            <th>Judge</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td>{item.caseNumber}</td>
              <td>{item.defendantName}</td>
              <td>{item.charges.join(', ') || 'N/A'}</td>
              <td>{item.court}</td>
              <td>{item.scheduledTime || 'TBD'}</td>
              <td>{item.judge || 'TBD'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render content based on state
  const renderContent = () => {
    if (loading) {
      return <div className="widget-loading">Loading arraignments...</div>;
    }

    if (error) {
      return <div className="widget-error-message">{error}</div>;
    }

    if (!data || data.length === 0) {
      return (
        <div className="widget-empty">
          <p>No arraignments found for {getDate()}</p>
          {config.court !== 'all' && (
            <p className="widget-empty-hint">
              Try selecting "All Courts" for more results
            </p>
          )}
        </div>
      );
    }

    switch (config.size) {
      case 'compact':
        return renderCompact();
      case 'full':
        return renderFull();
      default:
        return renderStandard();
    }
  };

  return (
    <WidgetBase
      title={config.title}
      size={config.size}
      theme={config.theme}
      hideHeader={config.hideHeader}
      className="arraignments-widget"
    >
      {renderContent()}
    </WidgetBase>
  );
};