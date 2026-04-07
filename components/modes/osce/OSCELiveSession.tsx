/**
 * OSCE Live Session - Voice-based simulated patient via Gemini Live API.
 * Uses @google/genai live.connect() with Modality.AUDIO and get_current_vitals tool.
 * Browser connects directly to Gemini WebSocket; vitals resolved via GET /api/osce/session/:sessionId/vitals.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Loader2, Phone, PhoneOff } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useOSCEMetrics } from '@/hooks/useOSCEMetrics';

import type { VoiceModulation, AVState } from '@/types/patient-av-state-machine';

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are Marcus, a 55-year-old male with crushing chest pain. You are anxious and short of breath. If the student interrupts you, stop talking immediately. When asked about your vitals, use the get_current_vitals tool to look them up.';

/** Optional patient context so the voice persona matches the current encounter case. */
export interface LivePatientContext {
  patientName?: string;
  age?: number;
  sex?: string;
  chiefComplaint?: string;
}

/**
 * Builds a Gemini system instruction that includes voice tone descriptors and clinical context
 * from the AV state machine, so the AI's verbal delivery matches the patient's clinical state.
 *
 * The tone descriptors (e.g. "breathless", "agitated", "weak") tell Gemini how to speak,
 * while the clinical context (e.g. "Acute MI — compensating") gives narrative grounding.
 * Vocal strain and background sounds are described so the AI can incorporate verbal cues
 * (e.g. pausing to cough, speaking through labored breathing).
 */
function buildSystemInstruction(
  context: LivePatientContext | null | undefined,
  avState?: AVState | null,
): string {
  if (!context?.patientName && !context?.chiefComplaint && !avState) return DEFAULT_SYSTEM_INSTRUCTION;
  const name = context?.patientName ?? 'the patient';
  const ageStr = context?.age != null ? `${context.age}-year-old` : '';
  const sexStr = context?.sex ?? '';
  const demo = [ageStr, sexStr].filter(Boolean).join(' ') || 'adult';
  const cc = context?.chiefComplaint?.trim() ? ` Chief complaint: ${context.chiefComplaint}.` : '';

  // Voice modulation directives from AV state
  let voiceDirective = '';
  if (avState?.voice) {
    const v = avState.voice;
    const tones = v.toneDescriptors?.length
      ? `Speak in a ${v.toneDescriptors.join(', ')} tone.`
      : '';
    const strain = v.applyVocalStrain
      ? ' Your voice is strained — pause occasionally to catch your breath or wince in pain.'
      : '';
    const bgSounds = v.backgroundSounds?.length
      ? ` You are ${v.backgroundSounds.join(' and ')} between sentences.`
      : '';
    const clinicalCtx = avState.clinicalContext
      ? ` Clinical state: ${avState.clinicalContext}.`
      : '';
    const rate = v.rate < 0.8
      ? ' Speak slowly and deliberately.'
      : v.rate > 1.3
        ? ' Speak rapidly, as if rushed or panicked.'
        : '';

    voiceDirective = ` ${tones}${strain}${bgSounds}${rate}${clinicalCtx}`;
  }

  return `You are ${name}, a ${demo} patient.${cc}${voiceDirective} Stay in character. If the student interrupts you, stop talking immediately. When asked about your vitals, use the get_current_vitals tool to look them up.`;
}

/**
 * Maps VoiceModulation from the AV state machine to Gemini Live speechConfig.
 * Gemini Live supports voiceName and (on some models) rate/pitch overrides.
 */
function buildSpeechConfig(voice?: VoiceModulation | null): Record<string, unknown> {
  if (!voice) return { voiceName: 'Aoede' };
  return {
    voiceName: voice.voiceId || 'Aoede',
    // Gemini Live experimental models may support these; they're ignored if unsupported
    ...(voice.rate !== 1.0 && { speechRate: voice.rate }),
    ...(voice.pitch !== 0 && { pitchShift: voice.pitch }),
  };
}

interface OSCELiveSessionProps {
  sessionId: string;
  /** When provided, the voice persona matches this encounter (name, age, sex, chief complaint). */
  patientContext?: LivePatientContext | null;
  /** Current AV state from the PatientAVEngine — drives voice modulation and tone descriptors. */
  avState?: AVState | null;
  onClose?: () => void;
}

export const OSCELiveSession: React.FC<OSCELiveSessionProps> = ({
  sessionId,
  patientContext,
  avState,
  onClose,
}) => {
  const systemInstruction = useMemo(
    () => buildSystemInstruction(patientContext, avState),
    [patientContext, avState],
  );
  const speechConfig = useMemo(() => buildSpeechConfig(avState?.voice), [avState?.voice]);
  const patientLabel = patientContext?.patientName ?? 'Marcus';
  const { getToken } = useAuth();
  const { logAction, calculateMetrics } = useOSCEMetrics();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const sessionRef = useRef<{
    close?: () => void;
    sendClientContent?: (opts: unknown) => void;
    sendToolResponse?: (opts: {
      functionResponses: Array<{ id?: string; name: string; response: unknown }>;
    }) => void;
  } | null>(null);
  /** Guard against setState on unmounted component (same pattern as AudioInterface) */
  const mountedRef = useRef(true);

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
          speechConfig: speechConfig as Record<string, unknown>,
          systemInstruction,
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_current_vitals',
                  description:
                    'Look up the current vital signs for this patient (e.g. when the student asks for BP or heart rate). Returns bp, hr, rr, temp, o2.',
                  parameters: { type: 'object', properties: {} } as Record<string, unknown>,
                },
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => {
            if (mountedRef.current) setStatus('connected');
          },
          onmessage: (msg: unknown) => {
            const m = msg as {
              toolCall?: { functionCalls?: Array<{ id?: string; name?: string }> };
              serverContent?: { turnComplete?: boolean };
            };
            const calls = m?.toolCall?.functionCalls;
            if (calls?.length && sessionRef.current?.sendToolResponse) {
              logAction('exam', 'vitals_requested');
              Promise.all(
                calls.map((fc) =>
                  fetch(`/api/osce/session/${sessionId}/vitals`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  })
                    .then((r) => r.json())
                    .then((json: unknown) => {
                      const j = json as { data?: unknown };
                      return {
                        id: fc.id,
                        name: fc.name ?? 'get_current_vitals',
                        response: j?.data ?? j,
                      };
                    })
                    .catch(() => ({
                      id: fc.id,
                      name: fc.name ?? 'get_current_vitals',
                      response: { bp: '160/90', hr: 110 },
                    }))
                )
              ).then((functionResponses) => {
                sessionRef.current?.sendToolResponse?.({ functionResponses });
              });
            }
          },
          onerror: (e: { message?: string }) => {
            if (!mountedRef.current) return;
            setStatus('error');
            setErrorMessage(e?.message ?? 'Connection error');
          },
          onclose: (e: { reason?: string }) => {
            if (!mountedRef.current) return;
            // Use functional update to avoid stale closure over `status`
            setStatus((prev) => (prev === 'error' ? prev : 'idle'));
            if (e?.reason) setErrorMessage(e.reason);
          },
        },
      });

      sessionRef.current = session as {
        close?: () => void;
        sendClientContent?: (opts: unknown) => void;
      };
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [sessionId, getToken, systemInstruction, speechConfig]);

  const disconnect = useCallback(() => {
    if (sessionRef.current?.close) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (sessionRef.current?.close) sessionRef.current.close();
      sessionRef.current = null;
    };
  }, []);

  return (
    <motion.div
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Live voice patient
        </h3>
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
        Connect to talk to {patientLabel} (simulated patient) with voice. They can look up vitals
        when you ask.
      </p>
      {status === 'idle' && (
        <button
          type="button"
          onClick={connect}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium hover:opacity-90"
        >
          <Phone className="w-5 h-5" />
          Connect
        </button>
      )}
      {status === 'connecting' && (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-3 text-[var(--color-text-muted)]">
          <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
          Connecting…
        </div>
      )}
      {status === 'connected' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMicMuted((m) => !m)}
              className={`p-3 rounded-full ${micMuted ? 'bg-[var(--color-data-fail)]/20' : 'bg-[var(--color-accent)]/20'}`}
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
          <div className="p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Clinical Confidence</div>
            <div className="text-2xl font-bold text-[var(--color-accent)]">
              {calculateMetrics().clinicalConfidenceIndex.toFixed(1)}/4.0
            </div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div>
          <p className="text-sm text-data-fail mb-2">{errorMessage}</p>
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
