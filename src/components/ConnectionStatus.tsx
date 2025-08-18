import React, { useState, useEffect } from 'react';
import { realtimeService, ConnectionStatus as Status } from '../services/realtimeService';
import './ConnectionStatus.css';

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<Status>('disconnected');
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribe = realtimeService.onStatusChange(setStatus);
    
    return unsubscribe;
  }, []);
  
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          text: 'Live',
          icon: '●',
          className: 'connected',
          description: 'Real-time updates active'
        };
      case 'connecting':
        return {
          text: 'Connecting...',
          icon: '◐',
          className: 'connecting',
          description: 'Establishing connection'
        };
      case 'disconnected':
        return {
          text: 'Offline',
          icon: '○',
          className: 'disconnected',
          description: 'No real-time updates'
        };
      case 'error':
        return {
          text: 'Error',
          icon: '✕',
          className: 'error',
          description: 'Connection failed'
        };
      default:
        return {
          text: 'Unknown',
          icon: '?',
          className: 'unknown',
          description: 'Status unknown'
        };
    }
  };
  
  const config = getStatusConfig();
  const channelCount = realtimeService.getActiveChannelCount();
  
  return (
    <div 
      className={`connection-status connection-status-${config.className}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="connection-indicator">
        <span className="connection-icon">{config.icon}</span>
        <span className="connection-text">{config.text}</span>
      </div>
      
      {isExpanded && (
        <div className="connection-tooltip">
          <div className="tooltip-content">
            <div className="tooltip-status">
              <strong>Status:</strong> {config.text}
            </div>
            <div className="tooltip-description">
              {config.description}
            </div>
            {channelCount > 0 && (
              <div className="tooltip-channels">
                <strong>Active channels:</strong> {channelCount}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};