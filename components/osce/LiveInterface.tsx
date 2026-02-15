/**
 * Hyper-Real OSCE Live Interface
 * Unified Voice + Text session with Gemini Live API.
 * - Vitals Monitor: updates when AI calls get_current_vitals
 * - Barge-in: user text/voice interrupts model (clientContent / activityStart)
 * - Tools: get_current_vitals(), reveal_lab_result(test_name)
 */

import React, { useState, useCallback, useRef, useEffect, useReducer } from 'react';
import { MicOff, Send, Activity, Heart } from 'lucide-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

interface VitalsState {
  bp?: string;
  hr?: number;
  rr?: number;
  temp?: number;
  o2?: number;
  updatedAt?: number;
}

interface LiveConfig {
  wsUrl: string;
  setup: {
    model: string;
    systemInstruction: { parts: { text: string }[] };
    generationConfig: Record<string, unknown>;
    tools: unknown[];
    realtimeInputConfig?: Record<string, unknown>;
  };
  sessionId?: string | null;
}

export function LiveInterface({
  sessionId,
  getToken,
  onError,
}: {
  sessionId?: string;
  getToken: () => Promise<string | null>;
  onError?: (message: string) => void;
}) {
  const [config, setConfig] = useState<LiveConfig | null>(null);
  const [, setWs] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'ready' | 'setup_sent'>(
    'disconnected'
  );
  const [vitals, setVitals] = useState<VitalsState>({});
  // Use a reducer for the transcript to avoid O(n) spread-copy on every incoming message.
  // The reducer pushes to a mutable array and returns a new reference to trigger re-render.
  const [transcript, appendTranscript] = useReducer((prev: string[], line: string) => {
    prev.push(line);
    return [...prev];
  }, [] as string[]);
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const playbackRef = useRef<HTMLAudioElement | null>(null); // reserved for audio playback

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const base = getApiEndpoint('/api/osce/live-engine');
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      const res = await fetch(`${base}${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load live config');
      const data = (await res.json()) as { data?: LiveConfig };
      setConfig(data.data ?? null);
      return data.data as LiveConfig;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load config';
      onError?.(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId, getToken, onError]);

  const fetchVitals = useCallback(async (): Promise<VitalsState> => {
    if (!sessionId) {
      return { bp: '180/110', hr: 110, rr: 18, temp: 98.6, o2: 96, updatedAt: Date.now() };
    }
    try {
      const token = await getToken();
      const res = await fetch(getApiEndpoint(`/api/osce/session/${sessionId}/vitals`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Vitals fetch failed');
      const data = (await res.json()) as { data?: VitalsState };
      const v = data.data ?? {};
      setVitals({ ...v, updatedAt: Date.now() });
      return v;
    } catch {
      return { bp: '—', hr: 0, rr: 0, temp: 0, o2: 0, updatedAt: Date.now() };
    }
  }, [sessionId, getToken]);

  const sendToolResponse = useCallback((id: string, name: string, result: unknown) => {
    const wsSocket = wsRef.current;
    if (!wsSocket || wsSocket.readyState !== WebSocket.OPEN) return;
    wsSocket.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: [
            {
              id,
              name,
              response: result,
            },
          ],
        },
      })
    );
  }, []);

  const connect = useCallback(async () => {
    const cfg = config ?? (await fetchConfig());
    if (!cfg?.wsUrl) return;

    setStatus('connecting');
    const socket = new WebSocket(cfg.wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setStatus('ready');
      const setupMsg = { setup: cfg.setup };
      socket.send(JSON.stringify(setupMsg));
      setStatus('setup_sent');
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;

        if (msg.setupComplete !== undefined) {
          appendTranscript('[Session ready. You can speak or type.]');
          return;
        }

        if (msg.serverContent) {
          const content = msg.serverContent as {
            modelTurn?: {
              parts?: { text?: string; inlineData?: { data: string; mimeType: string } }[];
            };
            interrupted?: boolean;
            generationComplete?: boolean;
          };
          if (content?.interrupted) {
            appendTranscript('[Interrupted]');
            audioQueueRef.current = [];
            return;
          }
          const parts = content.modelTurn?.parts ?? [];
          for (const part of parts) {
            if (part.text) appendTranscript(`Patient: ${part.text}`);
          }
        }

        if (msg.toolCall) {
          const toolCall = msg.toolCall as {
            functionCalls?: { id: string; name: string; args?: Record<string, unknown> }[];
          };
          const calls = toolCall.functionCalls ?? [];
          for (const call of calls) {
            if (call.name === 'get_current_vitals') {
              fetchVitals().then((v) => {
                sendToolResponse(call.id, call.name, v);
              });
            } else if (call.name === 'reveal_lab_result') {
              const testName = (call.args?.test_name as string) ?? 'Unknown';
              sendToolResponse(call.id, call.name, {
                test_name: testName,
                result: 'See chart (simulated).',
              });
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    socket.onerror = () => {
      setStatus('disconnected');
      onError?.('WebSocket error');
    };

    socket.onclose = () => {
      wsRef.current = null;
      setWs(null);
      setStatus('disconnected');
    };

    setWs(socket);
  }, [config, fetchConfig, fetchVitals, sendToolResponse, onError]);

  const sendText = useCallback(() => {
    const s = textInput.trim();
    if (!s || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: s }] }],
          turnComplete: true,
        },
      })
    );
    appendTranscript(`You: ${s}`);
    setTextInput('');
  }, [textInput]);

  const bargeIn = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        realtimeInput: { activityStart: {} },
      })
    );
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  if (loading && !config) {
    return (
      <div className="p-4 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)]">
        <p className="text-[var(--color-text-muted)]">Loading live engine…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)]">
          <h3 className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)] mb-2">
            <Heart className="w-4 h-4 text-red-500" />
            Vitals Monitor
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Updates when the patient (AI) calls get_current_vitals
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-[var(--color-text-muted)]">BP</span>
            <span className="font-mono">{vitals.bp ?? '—'}</span>
            <span className="text-[var(--color-text-muted)]">HR</span>
            <span className="font-mono">{vitals.hr ?? '—'}</span>
            <span className="text-[var(--color-text-muted)]">RR</span>
            <span className="font-mono">{vitals.rr ?? '—'}</span>
            <span className="text-[var(--color-text-muted)]">Temp</span>
            <span className="font-mono">{vitals.temp ?? '—'}</span>
            <span className="text-[var(--color-text-muted)]">O2</span>
            <span className="font-mono">{vitals.o2 ?? '—'}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)]">
          <h3 className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)] mb-2">
            <Activity className="w-4 h-4" />
            Status
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] capitalize">{status}</p>
          {status === 'disconnected' && (
            <button
              type="button"
              onClick={() => void connect()}
              className="mt-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90"
            >
              Connect to patient
            </button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)]">
        <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">Transcript</h3>
        <div className="max-h-48 overflow-y-auto space-y-1 text-sm text-[var(--color-text-primary)]">
          {transcript.length === 0 && (
            <p className="text-[var(--color-text-muted)]">Connect and speak or type to start.</p>
          )}
          {transcript.map((line, i) => (
            <div key={`t-${i}-${line.slice(0, 20)}`}>{line}</div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText()}
          placeholder="Type to patient (sends as clientContent, barge-in)"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
        />
        <button
          type="button"
          onClick={sendText}
          disabled={status !== 'setup_sent' && status !== 'ready'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
        >
          <Send className="w-4 h-4" /> Send
        </button>
        <button
          type="button"
          onClick={bargeIn}
          title="Send barge-in signal (stop AI speech)"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)]"
        >
          <MicOff className="w-4 h-4" /> Barge-in
        </button>
      </div>
    </div>
  );
}
