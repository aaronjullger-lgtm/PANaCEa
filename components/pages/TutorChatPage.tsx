'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ChevronLeft, Sparkles, Loader2, User, Bot, RefreshCw } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { usePreferences } from '@/hooks/usePreferences';
import { API_ENDPOINTS, buildApiUrl, getApiEndpoint } from '@/lib/utils/apiConfig';
import { callGeminiTextStreaming } from '@/services/ai/geminiService';
import type { StreamHistoryTurn } from '@/lib/utils/streamingClient';

interface TutorChatPageProps {
  onExit: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const TUTOR_SYSTEM_INSTRUCTION =
  'You are a clinical reasoning tutor for a PA student. Use Socratic dialogue and focus on high-yield PANCE reasoning. When citing library context use {{Page:N}} or {{Pages:N-M}}. Be concise and rigorous.';

export const TutorChatPage: React.FC<TutorChatPageProps> = ({ onExit }) => {
  const { getToken } = useAuth();
  const { preferences } = usePreferences();
  const [tutorContext, setTutorContext] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [previousThoughtSignatures, setPreviousThoughtSignatures] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const streamStartTimeRef = useRef<number>(0);
  const thinkingTimeMsReportedRef = useRef(false);

  const customSettings = preferences.customSettings as Record<string, unknown> | undefined;
  const activeKnowledgeCacheName = customSettings?.activeKnowledgeCacheName as string | undefined;
  const activeKnowledgeCacheDisplayName = customSettings?.activeKnowledgeCacheDisplayName as
    | string
    | undefined;

  const fetchProfile = useCallback(async () => {
    setIsLoadingContext(true);
    setProfileLoadFailed(false);
    try {
      const token = await getToken();
      if (!token) {
        setTutorContext(
          'Student Weaknesses: Unknown (no profile loaded). Proceed with standard Socratic dialogue.'
        );
        setProfileLoadFailed(true);
        return;
      }
      const res = await fetch(buildApiUrl(API_ENDPOINTS.INTELLIGENCE_PROFILE), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        setTutorContext(
          'Student Weaknesses: Profile service unavailable. Proceed with standard Socratic dialogue.'
        );
        setProfileLoadFailed(true);
        return;
      }
      const data = (await res.json()) as { data?: { tutorContext?: string } };
      setTutorContext(
        data.data?.tutorContext ??
          'Student Weaknesses: None identified. Proceed with standard Socratic dialogue.'
      );
    } catch {
      setTutorContext(
        'Student Weaknesses: Profile service unavailable. Proceed with standard Socratic dialogue.'
      );
      setProfileLoadFailed(true);
    } finally {
      setIsLoadingContext(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.USER_SESSION), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: { sessionType: 'mixed', systemsTargeted: [] } }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: { session?: { id: string } } };
      const id = data?.data?.session?.id ?? null;
      if (id) setSessionId(id);
      return id;
    } catch {
      return null;
    }
  }, [getToken, sessionId]);

  const reportThinkingTimeMs = useCallback(
    async (ms: number) => {
      if (thinkingTimeMsReportedRef.current || !sessionId) return;
      thinkingTimeMsReportedRef.current = true;
      const token = await getToken();
      if (!token) return;
      try {
        await fetch(getApiEndpoint(API_ENDPOINTS.USER_SESSION), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            body: { sessionId, action: 'update', thinkingTimeMs: ms },
          }),
        });
      } catch {
        // non-blocking
      }
    },
    [getToken, sessionId]
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    thinkingTimeMsReportedRef.current = false;

    const history: StreamHistoryTurn[] = messages.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      text: m.text,
    }));

    const profilePart =
      tutorContext && tutorContext.trim().length > 0
        ? `${tutorContext}\n\nUse the weaknesses above to target your explanations and questions. `
        : '';
    const systemInstruction = `${profilePart}${TUTOR_SYSTEM_INSTRUCTION}`;

    await ensureSession();
    streamStartTimeRef.current = Date.now();

    try {
      await callGeminiTextStreaming('gemini-3-flash-preview', trimmed, 0.8, {
        getToken,
        cachedContent: activeKnowledgeCacheName,
        history: history.length > 0 ? history : undefined,
        previousThoughtSignatures:
          previousThoughtSignatures.length > 0 ? previousThoughtSignatures : undefined,
        systemInstruction,
        thinkingLevel: 'HIGH',
        onThoughtSignatures(signatures) {
          setPreviousThoughtSignatures(signatures);
          const ms = Date.now() - streamStartTimeRef.current;
          if (ms >= 0) void reportThinkingTimeMs(ms);
        },
        onChunk(chunk) {
          const ms = Date.now() - streamStartTimeRef.current;
          if (!thinkingTimeMsReportedRef.current && ms >= 0) {
            void reportThinkingTimeMs(ms);
          }
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy.at(-1);
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = { ...last, text: last.text + chunk };
            } else {
              copy.push({
                id: crypto.randomUUID(),
                role: 'assistant',
                text: chunk,
              });
            }
            return copy;
          });
        },
        onComplete: () => {
          setIsStreaming(false);
        },
        onError: () => {
          setIsStreaming(false);
        },
      });
    } catch {
      setIsStreaming(false);
    }
  }, [
    input,
    isStreaming,
    messages,
    tutorContext,
    getToken,
    activeKnowledgeCacheName,
    previousThoughtSignatures,
    ensureSession,
    reportThinkingTimeMs,
  ]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onExit}
          className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[var(--color-accent)]/10">
            <MessageCircle className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Reasoning Tutor
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Profile-aware Gemini Tutor that targets your weak spots.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/70 text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-[var(--color-accent)] mt-0.5" />
        <div>
          <p className="mb-1">
            This Tutor uses your <span className="font-semibold">Intelligence Profile</span>{' '}
            (Concept Gaps and recent misses) and, when set, your{' '}
            <span className="font-semibold">active Library document</span> to personalize answers.
          </p>
          {activeKnowledgeCacheName && (
            <p className="text-[var(--color-text-muted)]">
              Active Library:{' '}
              <span className="font-semibold">
                {activeKnowledgeCacheDisplayName || 'Unnamed cached document'}
              </span>
            </p>
          )}
          {!activeKnowledgeCacheName && (
            <p className="text-[var(--color-text-muted)]">
              Tip: Set an active document in <span className="font-semibold">My Library</span> to
              ground answers in your textbook.
            </p>
          )}
        </div>
      </div>

      {profileLoadFailed && !isLoadingContext && (
        <div
          className="mb-4 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-400/10 flex items-center justify-between gap-3"
          aria-live="polite"
        >
          <span className="text-xs">
            Personalized weaknesses unavailable; using standard tutoring.
          </span>
          <button
            type="button"
            onClick={() => void fetchProfile()}
            disabled={isLoadingContext}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 dark:bg-amber-400/20 dark:hover:bg-amber-400/30 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingContext ? 'animate-spin' : ''}`} aria-hidden />
            Retry
          </button>
        </div>
      )}

      <div
        className="mb-4 h-64 sm:h-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 overflow-hidden flex flex-col"
        aria-busy={isStreaming}
        aria-label="Tutor conversation area"
      >
        <div
          className="flex-1 overflow-y-auto px-3 py-2 space-y-3"
          role="log"
          aria-live="polite"
          aria-label="Tutor conversation"
        >
          {/* Live region so screen readers announce when the tutor is thinking */}
          <div className="sr-only" aria-live="assertive" aria-atomic role="status">
            {isStreaming ? 'Thinking…' : ''}
          </div>
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)] text-center px-6">
              {isLoadingContext ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading your Intelligence Profile…
                </span>
              ) : (
                'Ask about a question you missed, a confusing topic, or have the Tutor quiz your weak systems.'
              )}
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="mt-1 flex-shrink-0 rounded-full bg-[var(--color-bg-primary)] p-1.5">
                  <Bot className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-br-sm'
                    : 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] rounded-bl-sm border border-[var(--color-border)]/60'
                }`}
              >
                {m.text}
              </div>
              {m.role === 'user' && (
                <div className="mt-1 flex-shrink-0 rounded-full bg-[var(--color-bg-primary)] p-1.5">
                  <User className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up, or say: Quiz me on my weakest cardiology topics…"
            className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming}
            aria-busy={isStreaming}
            aria-label={isStreaming ? 'Tutor is thinking' : 'Send message'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
          >
            {isStreaming && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
            <span>{isStreaming ? 'Thinking…' : 'Ask'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TutorChatPage;
