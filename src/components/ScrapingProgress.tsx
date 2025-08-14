import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

interface ProgressEvent {
  type: 'started' | 'court' | 'case_found' | 'extracting' | 'case_saved' | 'error' | 'completed';
  message: string;
  court?: string;
  caseNumber?: string;
  totalCourts?: number;
  totalCases?: number;
}

interface Court {
  name: string;
  status: 'waiting' | 'processing' | 'completed';
  casesFound: number;
}

function ScrapingProgress() {
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [courts, setCourts] = useState<Map<string, Court>>(new Map());
  const [currentCourt, setCurrentCourt] = useState<string>('');
  const [totalCourts, setTotalCourts] = useState(26); // We know there are 26 courts
  const [completedCourts, setCompletedCourts] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [socket, setSocket] = useState<any>(null);
  
  // Initialize with all 26 courts
  const ALL_COURTS = [
    'Agua Fria', 'Arcadia Biltmore', 'Arrowhead', 'Country Meadows',
    'Desert Ridge', 'Dreamy Draw', 'East Mesa', 'El Centro', 'Encanto',
    'Hassayampa', 'Highland', 'Ironwood', 'Kyrene', 'Manistee', 'Maryvale',
    'McDowell Mountain', 'Moon Valley', 'North Mesa', 'North Valley',
    'San Marcos', 'San Tan', 'South Mountain', 'University Lakes',
    'West McDowell', 'West Mesa', 'White Tank'
  ];

  useEffect(() => {
    // Initialize all courts on mount
    const newCourtsMap = new Map<string, Court>();
    ALL_COURTS.forEach(name => {
      newCourtsMap.set(name, { name, status: 'waiting', casesFound: 0 });
    });
    setCourts(newCourtsMap);
    
    // Connect to WebSocket
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.on('scraping-progress', (event: ProgressEvent) => {
      setIsActive(true);
      
      // Add to progress log
      setProgress(prev => [...prev.slice(-50), event]); // Keep last 50 events
      
      // Update state based on event type
      switch (event.type) {
        case 'started':
          // Reset counters
          setCompletedCourts(0);
          setTotalCases(0);
          setCurrentCourt('');
          // Reset all courts to waiting
          setCourts(prev => {
            const updated = new Map(prev);
            updated.forEach(court => {
              court.status = 'waiting';
              court.casesFound = 0;
            });
            return updated;
          });
          break;
          
        case 'court':
          if (event.court) {
            // Mark previous court as completed if there was one
            setCurrentCourt(prevCourt => {
              if (prevCourt && prevCourt !== event.court) {
                setCourts(courts => {
                  const updated = new Map(courts);
                  const prev = updated.get(prevCourt);
                  if (prev && prev.status === 'processing') {
                    prev.status = 'completed';
                    updated.set(prevCourt, prev);
                    setCompletedCourts(c => c + 1);
                  }
                  return updated;
                });
              }
              return event.court!;
            });
            
            // Mark new court as processing
            setCourts(prev => {
              const updated = new Map(prev);
              const court = updated.get(event.court!) || { name: event.court!, status: 'waiting', casesFound: 0 };
              court.status = 'processing';
              updated.set(event.court!, court);
              return updated;
            });
          }
          break;
          
        case 'case_found':
          // Increment cases for the court that found it
          if (event.court || currentCourt) {
            const courtName = event.court || currentCourt;
            setCourts(prev => {
              const updated = new Map(prev);
              const court = updated.get(courtName);
              if (court) {
                court.casesFound++;
                updated.set(courtName, court);
              }
              return updated;
            });
            // Also increment total cases found
            setTotalCases(prev => prev + 1);
          }
          break;
          
        case 'case_saved':
          // Don't double count - already counted in case_found
          break;
          
        case 'completed':
          setIsActive(false);
          if (currentCourt) {
            setCourts(prev => {
              const updated = new Map(prev);
              const court = updated.get(currentCourt);
              if (court) {
                court.status = 'completed';
                updated.set(currentCourt, court);
              }
              return updated;
            });
          }
          setCompletedCourts(totalCourts);
          if (event.totalCases) setTotalCases(event.totalCases);
          break;
      }
    });

    return () => {
      newSocket.close();
    };
  }, []); // Empty dependency array - only run once on mount

  if (!isActive && progress.length === 0) {
    return null;
  }

  return (
    <div className="scraping-progress">
      <div className="progress-header">
        <h3>🔍 Scraping Progress</h3>
        <div className="progress-stats">
          <span className="stat courts-stat">
            <span className="stat-icon">🏛️</span>
            <strong>{completedCourts}</strong> / {totalCourts} Courts
          </span>
          <span className="stat cases-stat">
            <span className="stat-icon">📋</span>
            <strong>{totalCases}</strong> Cases Found
          </span>
        </div>
      </div>

      <div className="courts-grid">
        {Array.from(courts.values()).map(court => (
          <div 
            key={court.name} 
            className={`court-tile ${court.status}`}
            title={`${court.name}: ${court.casesFound} cases found`}
          >
            <div className="court-name">{court.name}</div>
            <div className="court-status">
              {court.status === 'waiting' && '⏳'}
              {court.status === 'processing' && '⚡'}
              {court.status === 'completed' && '✅'}
            </div>
            {court.casesFound > 0 && (
              <div className="case-count">{court.casesFound}</div>
            )}
          </div>
        ))}
      </div>

      {currentCourt && (
        <div className="current-activity">
          <div className="activity-indicator">
            <div className="pulse"></div>
            Currently processing: <strong>{currentCourt} Justice Court</strong>
          </div>
        </div>
      )}

      <div className="progress-log">
        <h4>Activity Log</h4>
        <div className="log-entries">
          {progress.slice(-10).reverse().map((event, idx) => (
            <div key={idx} className={`log-entry ${event.type}`}>
              <span className="log-time">{new Date().toLocaleTimeString()}</span>
              <span className="log-message">{event.message}</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .scraping-progress {
          background: var(--bg-secondary, white);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 12px var(--shadow, rgba(0, 0, 0, 0.1));
          margin-bottom: 30px;
          animation: slideIn 0.3s ease;
          border: 1px solid var(--border-color, #e0e0e0);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .progress-header h3 {
          margin: 0;
          color: var(--text-primary, #2c5282);
        }

        .progress-stats {
          display: flex;
          gap: 20px;
        }

        .stat {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 25px;
          font-size: 14px;
          color: white;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s;
        }

        .stat:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }

        .stat.courts-stat {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        .stat.cases-stat {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        .stat-icon {
          font-size: 20px;
        }

        .stat strong {
          color: white;
          font-size: 24px;
          margin-right: 4px;
          font-weight: bold;
        }

        .courts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }

        .court-tile {
          padding: 10px;
          border-radius: 8px;
          text-align: center;
          font-size: 12px;
          transition: all 0.3s ease;
          position: relative;
          border: 2px solid transparent;
        }

        .court-tile.waiting {
          background: var(--bg-hover, #f5f5f5);
          color: var(--text-muted, #999);
        }

        .court-tile.processing {
          background: linear-gradient(135deg, #ffd89b 0%, #19547b 100%);
          color: white;
          animation: pulse 1.5s infinite;
          border-color: #ffd89b;
        }

        .court-tile.completed {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-color: #667eea;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          }
        }

        .court-name {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .court-status {
          font-size: 20px;
        }

        .case-count {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ff4757;
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 11px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .current-activity {
          background: var(--bg-hover, #f0f7ff);
          border-left: 4px solid #4a90e2;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          color: var(--text-primary, #2c5282);
        }

        .activity-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-primary, #2c5282);
        }

        .pulse {
          width: 12px;
          height: 12px;
          background: #4a90e2;
          border-radius: 50%;
          animation: pulseDot 1.5s infinite;
        }

        @keyframes pulseDot {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.5;
          }
        }

        .progress-log {
          margin-top: 20px;
        }

        .progress-log h4 {
          color: var(--text-secondary, #666);
          font-size: 14px;
          margin-bottom: 10px;
        }

        .log-entries {
          max-height: 150px;
          overflow-y: auto;
          background: var(--bg-hover, #f9f9f9);
          border-radius: 8px;
          padding: 10px;
          border: 1px solid var(--border-color, #e0e0e0);
        }

        .log-entry {
          padding: 5px 0;
          font-size: 12px;
          display: flex;
          gap: 10px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          color: var(--text-primary, #333);
        }

        .log-entry:last-child {
          border-bottom: none;
        }

        .log-entry.error {
          color: #ff4757;
        }

        .log-entry.completed {
          color: #00b894;
          font-weight: bold;
        }

        .log-time {
          color: var(--text-muted, #999);
          font-size: 11px;
        }

        .log-message {
          flex: 1;
        }
      `}</style>
    </div>
  );
}

export default ScrapingProgress;