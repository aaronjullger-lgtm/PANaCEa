/**
 * useLearnerAgent — client hook for Learner Agent API + optional WebSocket.
 */

import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import type { NextBestAction } from '@/lib/services/learner/types';

const ENABLED =
  import.meta.env.VITE_ENABLE_LEARNER_AGENT === 'true' ||
  import.meta.env.VITE_ENABLE_LEARNER_AGENT === '1';

export interface LearnerAgentRecommendationState {
  loading: boolean;
  error: string | null;
  recommendation: NextBestAction | null;
  correlationId: string | null;
  connected: boolean;
}

export function isLearnerAgentEnabled(): boolean {
  return ENABLED;
}

export function useLearnerAgent() {
  const { getToken, isSignedIn } = useAuth();
  const [state, setState] = useState<LearnerAgentRecommendationState>({
    loading: false,
    error: null,
    recommendation: null,
    correlationId: null,
    connected: false,
  });
  const wsRef = useRef<WebSocket | null>(null);

  const fetchRecommendation = useCallback(
    async (availableMinutes?: number) => {
      if (!ENABLED || !isSignedIn) return;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const token = await getToken();
        const params = new URLSearchParams();
        if (availableMinutes) params.set('availableMinutes', String(availableMinutes));
        const url = getApiEndpoint(`/api/learner-agent/recommendation?${params}`);
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? body?.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        const data = json.data ?? json;
        setState((s) => ({
          ...s,
          loading: false,
          recommendation: data.recommendation ?? null,
          correlationId: data.correlationId ?? null,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load recommendation',
        }));
      }
    },
    [getToken, isSignedIn]
  );

  const connectWebSocket = useCallback(async () => {
    if (!ENABLED || !isSignedIn) return;
    try {
      const token = await getToken();
      const res = await fetch(getApiEndpoint('/api/learner-agent/connect'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data ?? json;
      const wsUrl = `${String(data.websocketUrl).replace(/^http/, 'ws')}?token=${data.connectionToken}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setState((s) => ({ ...s, connected: true }));
      ws.onclose = () => setState((s) => ({ ...s, connected: false }));
      ws.onerror = () => setState((s) => ({ ...s, connected: false }));
    } catch {
      setState((s) => ({ ...s, connected: false }));
    }
  }, [getToken, isSignedIn]);

  const sendRecommendationResponse = useCallback(
    (response: 'accept' | 'defer' | 'adjust', adjustment?: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: 'recommendation_response',
          response,
          adjustment,
        })
      );
    },
    []
  );

  const startSession = useCallback(
    async (objective: string) => {
      if (!isSignedIn) return null;
      const token = await getToken();
      const res = await fetch(getApiEndpoint('/api/learner-agent/session'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start', objective }),
      });
      if (!res.ok) throw new Error('Failed to start session');
      const json = await res.json();
      const data = json.data ?? json;
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN && data.sessionId) {
        ws.send(JSON.stringify({ type: 'session_started', sessionId: data.sessionId }));
      }
      return data;
    },
    [getToken, isSignedIn]
  );

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return {
    enabled: ENABLED,
    ...state,
    fetchRecommendation,
    connectWebSocket,
    sendRecommendationResponse,
    startSession,
  };
}
