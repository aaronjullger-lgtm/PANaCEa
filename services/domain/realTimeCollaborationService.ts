/**
 * Real-time Collaboration Service
 * Sprint 8: Social & Gamification - Real-time peer collaboration and benchmarking
 *
 * Provides real-time collaboration features for study groups including:
 * - Live study sessions with peer presence
 * - Real-time leaderboard updates
 * - Collaborative question answering
 * - Peer benchmarking and comparison
 * - Live chat and discussion
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PeerPresence {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentActivity?: {
    type: 'studying' | 'quiz' | 'review' | 'break';
    system?: string;
    questionCount?: number;
    accuracy?: number;
    startedAt: Date;
  };
  lastSeen: Date;
}

export interface LiveSession {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  settings: LiveSessionSettings;
  participants: LiveSessionParticipant[];
  status: 'waiting' | 'active' | 'paused' | 'completed';
  currentQuestion?: LiveQuestion;
  statistics: LiveSessionStats;
}

export interface LiveSessionSettings {
  questionCount: number;
  timePerQuestion: number; // seconds
  systemFocus?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  allowCollaboration: boolean;
  showLiveLeaderboard: boolean;
  enableChat: boolean;
  autoStart: boolean;
}

export interface LiveSessionParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: Date;
  role: 'host' | 'participant';
  score: number;
  questionsAnswered: number;
  accuracy: number;
  streak: number;
  lastAnswer?: {
    questionId: string;
    wasCorrect: boolean;
    answeredAt: Date;
    timeSpent: number; // ms
  };
}

export interface LiveQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  system?: string;
  difficulty: number;
  startedAt: Date;
  endsAt: Date;
}

export interface LiveSessionStats {
  totalQuestions: number;
  completedQuestions: number;
  averageAccuracy: number;
  fastestAnswer: number; // ms
  slowestAnswer: number; // ms
  leaderboard: LiveLeaderboardEntry[];
}

export interface LiveLeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  rank: number;
  score: number;
  questionsAnswered: number;
  accuracy: number;
  streak: number;
  trend: 'up' | 'down' | 'stable';
  delta: number; // score change since last update
}

export interface PeerBenchmark {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  comparison: {
    accuracy: number; // user's accuracy
    peerAverage: number; // peer average accuracy
    percentile: number; // user's percentile (0-100)
    rank: number; // user's rank among peers
    totalPeers: number; // total peers in comparison
  };
  strengths: string[]; // systems where user outperforms peers
  weaknesses: string[]; // systems where user underperforms peers
  recommendations: string[]; // personalized recommendations
}

export interface CollaborationMessage {
  id: string;
  sessionId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  content: string;
  type: 'text' | 'question' | 'answer' | 'system';
  timestamp: Date;
  metadata?: Record<string, any>;
}

// =============================================================================
// REAL-TIME COLLABORATION SERVICE
// =============================================================================

export class RealTimeCollaborationService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventListeners: Map<string, Function[]> = new Map();
  private presenceInterval: NodeJS.Timeout | null = null;

  constructor(private apiBaseUrl: string = '') {
    if (typeof window !== 'undefined') {
      this.apiBaseUrl = window.location.origin;
    }
  }

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  async connect(userId: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.apiBaseUrl.replace('http', 'ws')}/api/collaboration/ws?userId=${userId}&token=${token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Real-time collaboration connected');
          this.reconnectAttempts = 0;
          this.startPresenceUpdates(userId);
          this.emit('connected', { userId, timestamp: new Date() });
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('Real-time collaboration disconnected:', event.code, event.reason);
          this.emit('disconnected', { code: event.code, reason: event.reason });
          this.attemptReconnect(userId, token);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { error });
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.ws = null;
    }
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
    this.eventListeners.clear();
  }

  private attemptReconnect(userId: string, token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('reconnect-failed', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect(userId, token).catch(console.error);
      }
    }, delay);
  }

  private startPresenceUpdates(userId: string): void {
    // Send periodic presence updates
    this.presenceInterval = setInterval(() => {
      this.send({
        type: 'presence',
        userId,
        timestamp: new Date().toISOString(),
        status: 'online'
      });
    }, 30000); // Every 30 seconds
  }

  // ===========================================================================
  // MESSAGE HANDLING
  // ===========================================================================

  private handleMessage(data: any): void {
    const { type, ...payload } = data;

    switch (type) {
      case 'presence-update':
        this.emit('presence', payload);
        break;
      case 'session-update':
        this.emit('session-update', payload);
        break;
      case 'question-start':
        this.emit('question-start', payload);
        break;
      case 'question-end':
        this.emit('question-end', payload);
        break;
      case 'leaderboard-update':
        this.emit('leaderboard-update', payload);
        break;
      case 'chat-message':
        this.emit('chat-message', payload);
        break;
      case 'peer-answer':
        this.emit('peer-answer', payload);
        break;
      case 'system-message':
        this.emit('system-message', payload);
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send:', data);
    }
  }

  // ===========================================================================
  // EVENT SYSTEM
  // ===========================================================================

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // ===========================================================================
  // COLLABORATION FEATURES
  // ===========================================================================

  async joinSession(sessionId: string, userId: string): Promise<void> {
    this.send({
      type: 'join-session',
      sessionId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    this.send({
      type: 'leave-session',
      sessionId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  async submitAnswer(sessionId: string, questionId: string, userId: string, answer: number, timeSpent: number): Promise<void> {
    this.send({
      type: 'submit-answer',
      sessionId,
      questionId,
      userId,
      answer,
      timeSpent,
      timestamp: new Date().toISOString()
    });
  }

  async sendChatMessage(sessionId: string, userId: string, content: string, type: 'text' | 'question' | 'answer' = 'text'): Promise<void> {
    this.send({
      type: 'chat-message',
      sessionId,
      userId,
      content,
      messageType: type,
      timestamp: new Date().toISOString()
    });
  }

  async requestHelp(sessionId: string, userId: string, questionId: string): Promise<void> {
    this.send({
      type: 'request-help',
      sessionId,
      userId,
      questionId,
      timestamp: new Date().toISOString()
    });
  }

  async updatePresence(userId: string, status: PeerPresence['status'], activity?: PeerPresence['currentActivity']): Promise<void> {
    this.send({
      type: 'update-presence',
      userId,
      status,
      activity,
      timestamp: new Date().toISOString()
    });
  }

  // ===========================================================================
  // PEER BENCHMARKING
  // ===========================================================================

  async getPeerBenchmark(userId: string, system?: string): Promise<PeerBenchmark> {
    // In a real implementation, this would fetch from an API
    // For now, return mock data
    return {
      userId,
      displayName: 'Current User',
      comparison: {
        accuracy: 0.85,
        peerAverage: 0.72,
        percentile: 90,
        rank: 15,
        totalPeers: 150
      },
      strengths: system ? [`Strong in ${system}`] : ['Cardiovascular', 'Pulmonary'],
      weaknesses: system ? [`Needs improvement in ${system}`] : ['GI/Nutrition', 'Musculoskeletal'],
      recommendations: [
        'Focus on GI/Nutrition system questions',
        'Join a study group for Musculoskeletal topics',
        'Try contrastive drills for weak areas'
      ]
    };
  }

  async getLiveLeaderboard(groupId: string, period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<LiveLeaderboardEntry[]> {
    // In a real implementation, this would fetch from an API
    // For now, return mock data
    return Array.from({ length: 10 }, (_, i) => ({
      userId: `user-${i + 1}`,
      displayName: `Student ${i + 1}`,
      rank: i + 1,
      score: 1000 - (i * 100),
      questionsAnswered: 50 - (i * 5),
      accuracy: 0.9 - (i * 0.05),
      streak: 7 - i,
      trend: i < 3 ? 'up' : i > 7 ? 'down' : 'stable',
      delta: i < 5 ? 50 : -20
    }));
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }
}

// =============================================================================
// REACT HOOK FOR REAL-TIME COLLABORATION
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseRealTimeCollaborationOptions {
  userId: string;
  token: string;
  autoConnect?: boolean;
  onConnected?: () => void;
  onDisconnected?: (code: number, reason: string) => void;
  onError?: (error: any) => void;
}

export function useRealTimeCollaboration(options: UseRealTimeCollaborationOptions) {
  const { userId, token, autoConnect = true, onConnected, onDisconnected, onError } = options;
  
  const [service] = useState(() => new RealTimeCollaborationService());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [presence, setPresence] = useState<PeerPresence[]>([]);
  const [activeSessions, setActiveSessions] = useState<LiveSession[]>([]);
  const [chatMessages, setChatMessages] = useState<CollaborationMessage[]>([]);
  
  const serviceRef = useRef(service);

  // Connect on mount if autoConnect is true
  useEffect(() => {
    if (autoConnect && userId && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [userId, token, autoConnect]);

  // Event listeners
  useEffect(() => {
    const svc = serviceRef.current;

    svc.on('connected', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      onConnected?.();
    });

    svc.on('disconnected', (data: { code: number; reason: string }) => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      onDisconnected?.(data.code, data.reason);
    });

    svc.on('error', (data: { error: any }) => {
      setConnectionStatus('error');
      onError?.(data.error);
    });

    svc.on('presence', (data: PeerPresence[]) => {
      setPresence(data);
    });

    svc.on('session-update', (data: LiveSession[]) => {
      setActiveSessions(data);
    });

    svc.on('chat-message', (data: CollaborationMessage) => {
      setChatMessages(prev => [...prev, data]);
    });

    return () => {
      svc.off('connected', () => {});
      svc.off('disconnected', () => {});
      svc.off('error', () => {});
      svc.off('presence', () => {});
      svc.off('session-update', () => {});
      svc.off('chat-message', () => {});
    };
  }, [onConnected, onDisconnected, onError]);

  const connect = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      await serviceRef.current.connect(userId, token);
    } catch (error) {
      setConnectionStatus('error');
      onError?.(error);
      throw error;
    }
  }, [userId, token, onError]);

  const disconnect = useCallback(() => {
    serviceRef.current.disconnect();
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const joinSession = useCallback(async (sessionId: string) => {
    await serviceRef.current.joinSession(sessionId, userId);
  }, [userId]);

  const leaveSession = useCallback(async (sessionId: string) => {
    await serviceRef.current.leaveSession(sessionId, userId);
  }, [userId]);

  const submitAnswer = useCallback(async (sessionId: string, questionId: string, answer: number, timeSpent: number) => {
    await serviceRef.current.submitAnswer(sessionId, questionId, userId, answer, timeSpent);
  }, [userId]);

  const sendChatMessage = useCallback(async (sessionId: string, content: string, type: 'text' | 'question' | 'answer' = 'text') => {
    await serviceRef.current.sendChatMessage(sessionId, userId, content, type);
  }, [userId]);

  const updatePresence = useCallback(async (status: PeerPresence['status'], activity?: PeerPresence['currentActivity']) => {
    await serviceRef.current.updatePresence(userId, status, activity);
  }, [userId]);

  const getPeerBenchmark = useCallback(async (system?: string) => {
    return await serviceRef.current.getPeerBenchmark(userId, system);
  }, [userId]);

  const getLiveLeaderboard = useCallback(async (groupId: string, period: 'daily' | 'weekly' | 'monthly' = 'weekly') => {
    return await serviceRef.current.getLiveLeaderboard(groupId, period);
  }, []);

  return {
    service: serviceRef.current,
    isConnected,
    connectionStatus,
    presence,
    activeSessions,
    chatMessages,
    connect,
    disconnect,
    joinSession,
    leaveSession,
    submitAnswer,
    sendChatMessage,
    updatePresence,
    getPeerBenchmark,
    getLiveLeaderboard
  };
}