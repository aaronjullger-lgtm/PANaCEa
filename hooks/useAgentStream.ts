/**
 * SSE streaming hook for /api/agents/invoke/stream.
 *
 * Lifecycle events emitted by the endpoint:
 *   event: agent_started   → agent invocation begins
 *   event: agent_completed → final result ready
 *   event: agent_error     → agent failed
 *
 * Usage:
 *   const { send, status, result, error, steps } = useAgentStream();
 *   send({ agent: 'clinical-explorer', input: { topic: 'chest pain' } });
 */

import { useCallback, useRef, useState } from 'react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

// ─── Types ────────────────────────────────────────────────────────────────

export type StreamStatus = 'idle' | 'connecting' | 'started' | 'completed' | 'error';

export interface AgentStreamStep {
  event: 'agent_started' | 'agent_completed' | 'agent_error';
  data: Record<string, unknown>;
  timestamp: number;
}

interface AgentStartedData {
  agent: string;
}

interface AgentCompletedData {
  agent: string;
  status: string;
  output: unknown;
  durationMs: number;
  telemetry?: unknown;
}

interface AgentErrorData {
  agent: string;
  status: string;
  error: { status: string; message: string };
  durationMs: number;
}

export interface AgentStreamResult {
  agent: string;
  status: string;
  output: unknown;
  durationMs: number;
  telemetry?: unknown;
}

export interface UseAgentStreamReturn {
  send: (payload: { agent: string; input: Record<string, unknown> }) => void;
  abort: () => void;
  status: StreamStatus;
  result: AgentStreamResult | null;
  error: string | null;
  steps: AgentStreamStep[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAgentStream(getToken: () => Promise<string | null>): UseAgentStreamReturn {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [result, setResult] = useState<AgentStreamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AgentStreamStep[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (payload: { agent: string; input: Record<string, unknown> }) => {
      // Abort any in-flight request.
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('connecting');
      setResult(null);
      setError(null);
      setSteps([]);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('You need to be signed in to use the agent.');
        }

        const res = await fetch(getApiEndpoint('/api/agents/invoke/stream'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body?.error ?? `Stream request failed (${res.status}).`);
        }

        if (!res.body) {
          throw new Error('No response body received.');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (terminated by \n\n).
          const messages = buffer.split('\n\n');
          // Keep the last incomplete chunk in the buffer.
          buffer = messages.pop() ?? '';

          for (const raw of messages) {
            if (!raw.trim()) continue;

            let eventType = 'message';
            let dataLine = '';

            for (const line of raw.split('\n')) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataLine = line.slice(6);
              }
            }

            if (!dataLine) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataLine) as Record<string, unknown>;
            } catch {
              continue; // Skip malformed JSON.
            }

            const step: AgentStreamStep = {
              event: eventType as AgentStreamStep['event'],
              data,
              timestamp: Date.now(),
            };

            setSteps((prev) => [...prev, step]);

            switch (eventType) {
              case 'agent_started':
                setStatus('started');
                break;

              case 'agent_completed': {
                const completed = data as unknown as AgentCompletedData;
                setResult({
                  agent: completed.agent,
                  status: completed.status,
                  output: completed.output,
                  durationMs: completed.durationMs,
                  telemetry: completed.telemetry,
                });
                setStatus('completed');
                break;
              }

              case 'agent_error': {
                const errData = data as unknown as AgentErrorData;
                setError(errData.error?.message ?? 'Agent request failed.');
                setStatus('error');
                break;
              }
            }
          }
        }

        // If status is still 'connecting' or 'started' after stream ends, the
        // server closed without sending agent_completed/agent_error. Treat as
        // error only if we never got 'started'.
        if (status === 'connecting') {
          setStatus('error');
          setError('Stream ended before agent started.');
        }
      } catch (err) {
        if (controller.signal.aborted) return; // User cancelled — don't update state.
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('error');
      }
    },
    [getToken, status],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  return { send, abort, status, result, error, steps };
}
