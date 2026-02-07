/**
 * OSCE Live Session - Voice-based simulated patient via Gemini Live API.
 * Uses @google/genai live.connect() with Modality.AUDIO and get_current_vitals tool.
 * Browser connects directly to Gemini WebSocket; vitals resolved via GET /api/osce/session/:sessionId/vitals.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Loader2, Phone, PhoneOff } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are Marcus, a 55-year-old male with crushing chest pain. You are anxious and short of breath. If the student interrupts you, stop talking immediately. When asked about your vitals, use the get_current_vitals tool to look them up.';

/** Optional patient context so the voice persona matches the current encounter case. */
export interface LivePatientContext {
  patientName?: string;
  age?: number;
  sex?: string;
  chiefComplaint?: string;
}

function buildSystemInstruction(context: LivePatientContext | null | undefined): string {
  if (!context?.patientName && !context?.chiefComplaint) return DEFAULT_SYSTEM_INSTRUCTION;
  const name = context.patientName ?? 'the patient';
  const ageStr = context.age != null ? `${context.age}-year-old` : '';
  const sexStr = context.sex ?? '';
  const demo = [ageStr, sexStr].filter(Boolean).join(' ') || 'adult';
  const cc = context.chiefComplaint?.trim()
    ? ` Chief complaint: ${context.chiefComplaint}.`
    : '';
  return `You are ${name}, a ${demo} patient.${cc} Stay in character. If the student interrupts you, stop talking immediately. When asked about your vitals, use the get_current_vitals tool to look them up.`;
}

interface OSCELiveSessionProps {
  sessionId: string;
  /** When provided, the voice persona matches this encounter (name, age, sex, chief complaint). */
  patientContext?: LivePatientContext | null;
  onClose?: () => void;
}

export const OSCELiveSession: React.FC<OSCELiveSessionProps> = ({
  sessionId,
  patientContext,
  onClose,
}) => {
  const systemInstruction = useMemo(
    () => buildSystemInstruction(patientContext),
    [patientContext]
  );
  const patientLabel = patientContext?.patientName ?? 'Marcus';
  const { getToken } = useAuth();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const sessionRef = useRef<{ close?: () => void; sendClientContent?: (opts: unknown) => void; sendToolResponse?: (opts: { functionResponses: Array<{ id?: string; name: string; response: unknown }> }) => void } | null>(null);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage(null);
    try {
      const token = await getToken();
      const configRes = await fetch('/api/osce/live-config', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!configRes.ok) {
        const err = (await configRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Failed to get live config');
      }
      const config = (await configRes.json()) as { data?: { model?: string; apiKey?: string } };
      const data = config.data;
      if (!data?.model || !data?.apiKey) throw new Error('Live config missing model or apiKey');
      const { model, apiKey } = data;

      const { GoogleGenAI, Modality } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const session = await ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_current_vitals',
                  description: 'Look up the current vital signs for this patient (e.g. when the student asks for BP or heart rate). Returns bp, hr, rr, temp, o2.',
                  parameters: { type: 'object', properties: {} } as Record<string, unknown>,
                },
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => setStatus('connected'),
          onmessage: (msg: unknown) => {
            const m = msg as { toolCall?: { functionCalls?: Array<{ id?: string; name?: string }> }; serverContent?: { turnComplete?: boolean } };
            const calls = m?.toolCall?.functionCalls;
            if (calls?.length && sessionRef.current?.sendToolResponse) {
              Promise.all(
                calls.map((fc) =>
                  fetch(`/api/osce/session/${sessionId}/vitals`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  })
                    .then((r) => r.json())
                    .then((json: unknown) => {
                      const j = json as { data?: unknown };
                      return { id: fc.id, name: fc.name ?? 'get_current_vitals', response: j?.data ?? j };
                    })
                    .catch(() => ({ id: fc.id, name: fc.name ?? 'get_current_vitals', response: { bp: '160/90', hr: 110 } }))
                )
              ).then((functionResponses) => {
                sessionRef.current?.sendToolResponse?.({ functionResponses });
              });
            }
          },
          onerror: (e: { message?: string }) => {
            setStatus('error');
            setErrorMessage(e?.message ?? 'Connection error');
          },
          onclose: (e: { reason?: string }) => {
            if (status !== 'error') setStatus('idle');
            if (e?.reason) setErrorMessage(e.reason);
          },
        },
      });

      sessionRef.current = session as { close?: () => void; sendClientContent?: (opts: unknown) => void };
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [sessionId, getToken, status, systemInstruction]);

  const disconnect = useCallback(() => {
    if (sessionRef.current?.close) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    return () => {
      if (sessionRef.current?.close) sessionRef.current.close();
      sessionRef.current = null;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Live voice patient</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Close
          </button>
        )}
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Connect to talk to {patientLabel} (simulated patient) with voice. They can look up vitals when you ask.
      </p>
      {status === 'idle' && (
        <button
          type="button"
          onClick={connect}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:opacity-90"
        >
          <Phone className="w-5 h-5" />
          Connect
        </button>
      )}
      {status === 'connecting' && (
        <div className="flex items-center justify-center gap-2 py-3 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          Connecting…
        </div>
      )}
      {status === 'connected' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMicMuted((m) => !m)}
            className={`p-3 rounded-full ${micMuted ? 'bg-red-500/20' : 'bg-[var(--color-accent)]/20'}`}
          >
            {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <span className="text-sm text-[var(--color-text-muted)]">Connected</span>
          <button
            type="button"
            onClick={disconnect}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)]"
          >
            <PhoneOff className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
      {status === 'error' && (
        <div>
          <p className="text-sm text-red-500 mb-2">{errorMessage}</p>
          <button
            type="button"
            onClick={connect}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-[var(--color-border)]"
          >
            Retry
          </button>
        </div>
      )}
    </motion.div>
  );
};
