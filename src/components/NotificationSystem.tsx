import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './NotificationSystem.css';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
}

interface NotificationEvent extends CustomEvent {
  detail: Omit<Notification, 'id' | 'timestamp'>;
}

export const NotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useEffect(() => {
    const handleNotification = (event: NotificationEvent) => {
      const notification: Notification = {
        ...event.detail,
        id: `notif-${Date.now()}-${Math.random()}`,
        timestamp: new Date()
      };
      
      setNotifications(prev => [...prev, notification]);
      
      // Auto-remove notification after duration (default 5 seconds)
      if (notification.duration !== 0) {
        setTimeout(() => {
          removeNotification(notification.id);
        }, notification.duration || 5000);
      }
    };
    
    window.addEventListener('realtime-notification', handleNotification as any);
    
    return () => {
      window.removeEventListener('realtime-notification', handleNotification as any);
    };
  }, []);
  
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };
  
  if (notifications.length === 0) {
    return null;
  }
  
  return createPortal(
    <div className="notification-container">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className={`notification notification-${notification.type}`}
        >
          <div className="notification-icon">
            {getIcon(notification.type)}
          </div>
          <div className="notification-content">
            <div className="notification-header">
              <span className="notification-title">{notification.title}</span>
              <button 
                className="notification-close" 
                onClick={() => removeNotification(notification.id)}
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
            <div className="notification-message">{notification.message}</div>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
};

// Helper function to emit notifications
export const notify = (
  type: 'info' | 'success' | 'warning' | 'error',
  title: string,
  message: string,
  duration?: number
) => {
  window.dispatchEvent(new CustomEvent('realtime-notification', {
    detail: { type, title, message, duration }
  }));
};

// Convenience methods
export const notifySuccess = (title: string, message: string, duration?: number) => 
  notify('success', title, message, duration);

export const notifyError = (title: string, message: string, duration?: number) => 
  notify('error', title, message, duration);

export const notifyWarning = (title: string, message: string, duration?: number) => 
  notify('warning', title, message, duration);

export const notifyInfo = (title: string, message: string, duration?: number) => 
  notify('info', title, message, duration);