import React from 'react';
import { render, screen } from '@testing-library/react';
import { WidgetBase } from '../WidgetBase';

describe('WidgetBase', () => {
  beforeEach(() => {
    // Mock postMessage
    window.parent.postMessage = jest.fn();
    window.postMessage = jest.fn();
  });

  it('renders with default props', () => {
    render(
      <WidgetBase title="Test Widget">
        <div>Widget Content</div>
      </WidgetBase>
    );
    
    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Widget Content')).toBeInTheDocument();
  });

  it('applies correct theme class', () => {
    const { container } = render(
      <WidgetBase title="Test" theme="dark">
        <div>Content</div>
      </WidgetBase>
    );
    
    expect(container.firstChild).toHaveClass('widget-container', 'theme-dark');
  });

  it('applies correct size class', () => {
    const { container } = render(
      <WidgetBase title="Test" size="card">
        <div>Content</div>
      </WidgetBase>
    );
    
    expect(container.firstChild).toHaveClass('widget-container', 'widget-card', 'size-card');
  });

  it('sends WIDGET_LOADED message on mount', () => {
    render(
      <WidgetBase title="Test Widget">
        <div>Content</div>
      </WidgetBase>
    );
    
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WIDGET_LOADED',
        widgetId: expect.any(String),
      }),
      '*'
    );
  });

  it('handles error boundary correctly', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    const { container } = render(
      <WidgetBase title="Test Widget">
        <ThrowError />
      </WidgetBase>
    );
    
    expect(container.textContent).toContain('Unable to load widget');
  });
});