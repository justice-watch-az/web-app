import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SubscriptionOptions {
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  onInsert?: (record: any) => void;
  onUpdate?: (record: any, oldRecord: any) => void;
  onDelete?: (oldRecord: any) => void;
  onError?: (error: Error) => void;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  subscribeToTable(
    table: string,
    options: SubscriptionOptions
  ): () => void {
    const channelName = `${table}-channel-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: options.event || '*', 
          schema: 'public', 
          table,
          filter: options.filter
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          try {
            console.log(`[RealtimeService] Received ${payload.eventType} event for ${table}:`, payload);
            
            switch (payload.eventType) {
              case 'INSERT':
                options.onInsert?.(payload.new);
                break;
              case 'UPDATE':
                options.onUpdate?.(payload.new, payload.old);
                break;
              case 'DELETE':
                options.onDelete?.(payload.old);
                break;
            }
          } catch (error) {
            console.error(`[RealtimeService] Error handling ${payload.eventType} event:`, error);
            options.onError?.(error as Error);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[RealtimeService] Channel ${channelName} status:`, status);
        this.updateConnectionStatus(status);
      });
    
    this.channels.set(channelName, channel);
    
    return () => this.unsubscribe(channelName);
  }

  private updateConnectionStatus(status: string) {
    let newStatus: ConnectionStatus = 'connecting';
    
    if (status === 'SUBSCRIBED') {
      newStatus = 'connected';
      this.reconnectAttempts = 0;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      newStatus = 'disconnected';
      this.attemptReconnect();
    } else if (status === 'TIMED_OUT') {
      newStatus = 'error';
      this.attemptReconnect();
    } else {
      newStatus = 'connecting';
    }
    
    if (this.connectionStatus !== newStatus) {
      this.connectionStatus = newStatus;
      this.notifyStatusListeners();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RealtimeService] Max reconnection attempts reached');
      this.connectionStatus = 'error';
      this.notifyStatusListeners();
      return;
    }
    
    if (this.reconnectTimeout) {
      return; // Already attempting to reconnect
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`[RealtimeService] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.channels.forEach((channel, name) => {
        console.log(`[RealtimeService] Reconnecting channel ${name}`);
        channel.subscribe();
      });
    }, delay);
  }

  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log(`[RealtimeService] Unsubscribing from ${channelName}`);
      channel.unsubscribe();
      this.channels.delete(channelName);
    }
  }

  unsubscribeAll() {
    console.log('[RealtimeService] Unsubscribing from all channels');
    this.channels.forEach((channel, name) => {
      channel.unsubscribe();
    });
    this.channels.clear();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    // Immediately notify with current status
    listener(this.connectionStatus);
    
    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatusListeners() {
    this.statusListeners.forEach(listener => {
      try {
        listener(this.connectionStatus);
      } catch (error) {
        console.error('[RealtimeService] Error notifying status listener:', error);
      }
    });
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  getActiveChannelCount(): number {
    return this.channels.size;
  }
}

// Export singleton instance
export const realtimeService = RealtimeService.getInstance();