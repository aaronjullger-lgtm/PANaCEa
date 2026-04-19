/**
 * Real-Time SOAP Note Hook
 *
 * Provides real-time SOAP note generation during OSCE sessions.
 * Automatically forwards transcript to the SOAP generator and polls for
 * updates from the server-side extractor.
 *
 * Sprint 4 migration notes:
 *   - The hook no longer accepts a Gemini API key. The browser bundle is
 *     now key-free; all model calls go through the authenticated
 *     `/api/scribe/soap/extract` endpoint.
 *   - Callers must supply a Clerk `getToken` function (or any async
 *     `() => Promise<string | null>` producer).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createSOAPNoteService, type TokenProvider } from '@/services/scribe/soapNoteService';
import type { SOAPNote } from '@/types/smart-scribe-system';

interface UseRealtimeSOAPOptions {
  sessionId: string | null;
  /** Clerk token provider — typically `useAuth().getToken`. */
  getToken?: TokenProvider;
  updateInterval?: number;
  enabled?: boolean;
}

export function useRealtimeSOAP({
  sessionId,
  getToken,
  updateInterval = 5000,
  enabled = true,
}: UseRealtimeSOAPOptions) {
  const [draftNote, setDraftNote] = useState<SOAPNote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Create service instance once per token-provider identity. The token
  // provider itself is a function reference (stable across renders for
  // Clerk's `getToken`) — using it as the memo key avoids rebuilding the
  // service on every render while still letting callers swap providers.
  const service = useMemo(() => createSOAPNoteService(getToken), [getToken]);

  // Start generation when session begins
  useEffect(() => {
    if (!sessionId || !enabled) return;

    setIsGenerating(true);
    service.startRealtimeGeneration(sessionId).then(() => {
      setIsGenerating(false);
    });
  }, [sessionId, enabled, service]);

  // Poll for updates
  useEffect(() => {
    if (!sessionId || !enabled) return;

    const interval = setInterval(() => {
      const draft = service.getDraftNote(sessionId);
      if (draft) {
        setDraftNote(draft);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [sessionId, enabled, updateInterval, service]);

  /**
   * Add transcript segment to SOAP generator.
   */
  const addTranscript = useCallback(
    async (speaker: 'student' | 'patient', text: string) => {
      if (!sessionId) return;
      await service.addTranscript(sessionId, speaker, text);
    },
    [sessionId, service]
  );

  /**
   * Add vitals update to SOAP generator.
   */
  const addVitals = useCallback(
    async (vitals: Record<string, string | number>) => {
      if (!sessionId) return;
      await service.addVitals(sessionId, vitals);
    },
    [sessionId, service]
  );

  /**
   * Finalize SOAP note.
   */
  const finalize = useCallback(async () => {
    if (!sessionId) return null;
    return await service.finalizeNote(sessionId);
  }, [sessionId, service]);

  return {
    draftNote,
    isGenerating,
    addTranscript,
    addVitals,
    finalize,
  };
}
