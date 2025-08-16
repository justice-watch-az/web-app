import React, { useEffect, useState, useRef, ReactNode } from 'react';
import './widget-styles.css';

interface WidgetBaseProps {
  children: ReactNode;
  title?: string;
  size?: 'compact' | 'standard' | 'full' | 'card' | 'dashboard';
  theme?: 'light' | 'dark' | 'auto';
  hideHeader?: boolean;
  className?: string;
  onError?: (error: Error) => void;
}

interface PostMessageData {
  type: string;
  [key: string]: any;
}

// Widget Error Boundary Component
class WidgetErrorBoundary extends React.Component<
  { children: ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Widget error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="widget-error">
          <h4>Unable to load widget</h4>
          <p>Please try refreshing the page</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Widget Loader Component
const WidgetLoader: React.FC = () => (
  <div className="widget-loader">
    <div className="spinner"></div>
    <p>Loading data...</p>
  </div>
);

// Main Widget Base Component
export const WidgetBase: React.FC<WidgetBaseProps> = ({
  children,
  title,
  size = 'standard',
  theme = 'light',
  hideHeader = false,
  className = '',
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Notify parent frame that widget is loaded
  useEffect(() => {
    // Give parent time to attach listener
    const timer = setTimeout(() => {
      const message = {
        type: 'WIDGET_LOADED',
        widgetId: `widget-${Date.now()}`,
        height: containerRef.current?.scrollHeight,
        width: containerRef.current?.scrollWidth
      } as PostMessageData;
      
      // Always send to self for testing
      window.postMessage(message, '*');
      
      // Also send to parent if in iframe
      if (window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
      
      setIsLoaded(true);
    }, 100); // Small delay to ensure listeners are attached

    return () => clearTimeout(timer);
  }, []);

  // Listen for messages from parent frame
  useEffect(() => {
    const handleMessage = (event: MessageEvent<PostMessageData>) => {
      // Validate origin
      const allowedOrigins = process.env.REACT_APP_ALLOWED_ORIGINS?.split(',') || [];
      if (
        allowedOrigins.length > 0 &&
        !allowedOrigins.includes('*') &&
        !allowedOrigins.includes(event.origin)
      ) {
        return;
      }

      switch (event.data.type) {
        case 'RESIZE':
          // Handle resize request
          if (containerRef.current) {
            const newHeight = containerRef.current.scrollHeight;
            window.parent.postMessage(
              {
                type: 'WIDGET_RESIZED',
                height: newHeight
              },
              '*'
            );
          }
          break;
        case 'REFRESH':
          window.location.reload();
          break;
        case 'UPDATE_THEME':
          document.body.className = `theme-${event.data.theme}`;
          break;
        case 'GET_HEIGHT':
          if (containerRef.current) {
            window.parent.postMessage(
              {
                type: 'WIDGET_HEIGHT',
                height: containerRef.current.scrollHeight
              },
              '*'
            );
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Observe size changes and notify parent
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (window.parent !== window) {
          window.parent.postMessage(
            {
              type: 'WIDGET_RESIZED',
              height: entry.contentRect.height,
              width: entry.contentRect.width
            },
            '*'
          );
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleExpand = () => {
    window.parent.postMessage(
      {
        type: 'EXPAND_WIDGET',
        url: window.location.href
      },
      '*'
    );
  };

  return (
    <WidgetErrorBoundary onError={onError}>
      <div
        ref={containerRef}
        className={`widget-container widget-${size} theme-${theme} ${className} ${
          size === 'card' ? 'size-card' : ''
        } ${size === 'dashboard' ? 'size-dashboard' : ''}`}
        data-widget-loaded={isLoaded}
      >
        {!hideHeader && title && (
          <div className="widget-header">
            <h3>{title}</h3>
            <button
              className="widget-expand"
              onClick={handleExpand}
              title="Expand widget"
              aria-label="Expand widget"
            >
              ⤢
            </button>
          </div>
        )}
        <div className="widget-content">
          {isLoaded ? children : <WidgetLoader />}
        </div>
        <div className="widget-footer">
          <a
            href={process.env.REACT_APP_MAIN_URL || 'https://justicewatch.org'}
            target="_blank"
            rel="noopener noreferrer"
            className="widget-attribution"
          >
            Powered by Justice Watch
          </a>
        </div>
      </div>
    </WidgetErrorBoundary>
  );
};