'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Brain,
  MessageCircle,
  RefreshCw,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/loading';
import {
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
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

const STARTER_PROMPTS = [
  'Quiz me on my weakest cardiology topics.',
  'Walk me through the workup for chest pain.',
  'Why is this answer unsafe compared with the best answer?',
] as const;

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
  const [streamError, setStreamError] = useState<string | null>(null);
  const lastSentTextRef = useRef<string | null>(null);
  const streamStartTimeRef = useRef<number>(0);
  const thinkingTimeMsReportedRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);

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
      const response = await fetch(buildApiUrl(API_ENDPOINTS.INTELLIGENCE_PROFILE), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        setTutorContext(
          'Student Weaknesses: Profile service unavailable. Proceed with standard Socratic dialogue.'
        );
        setProfileLoadFailed(true);
        return;
      }
      const data = (await response.json()) as { data?: { tutorContext?: string } };
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

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, isStreaming]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    const token = await getToken();
    if (!token) return null;
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.USER_SESSION), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: { sessionType: 'mixed', systemsTargeted: [] } }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { data?: { session?: { id: string } } };
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
        /* telemetry is non-blocking */
      }
    },
    [getToken, sessionId]
  );

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const trimmed = (overrideText ?? input).trim();
      if (!trimmed || isStreaming) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsStreaming(true);
      setStreamError(null);
      lastSentTextRef.current = trimmed;
      thinkingTimeMsReportedRef.current = false;

      const history: StreamHistoryTurn[] = messages.map((message) => ({
        role: message.role === 'user' ? ('user' as const) : ('model' as const),
        text: message.text,
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
          onError: (err) => {
            setIsStreaming(false);
            const message = err instanceof Error ? err.message : 'Tutor stream failed.';
            setStreamError(message);
          },
        });
      } catch (err) {
        setIsStreaming(false);
        const message = err instanceof Error ? err.message : 'Tutor is unreachable right now.';
        setStreamError(message);
      }
    },
    [
      activeKnowledgeCacheName,
      ensureSession,
      getToken,
      input,
      isStreaming,
      messages,
      previousThoughtSignatures,
      reportThinkingTimeMs,
      tutorContext,
    ]
  );

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Reasoning Tutor',
            badgeTone: 'plum',
            title: 'Interrogate your reasoning, not just the answer key.',
            subtitle:
              'The tutor uses your intelligence profile and, when selected, your active library document to keep explanations targeted, clinical, and high-yield.',
            status: activeKnowledgeCacheName
              ? `Grounded in ${activeKnowledgeCacheDisplayName || 'your active library'}`
              : 'Profile-aware tutoring active',
            backLabel: 'Back to Study',
            onBack: onExit,
            primaryAction: {
              label: isStreaming ? 'Thinking…' : 'Send question',
              onClick: () => void handleSend(),
              disabled: !input.trim() || isStreaming,
            },
            secondaryActions: profileLoadFailed
              ? [
                  {
                    label: 'Retry profile',
                    onClick: () => void fetchProfile(),
                  },
                ]
              : undefined,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Profile context"
            value={isLoadingContext ? 'Loading…' : profileLoadFailed ? 'Fallback' : 'Active'}
            detail="Weak-system context from your intelligence profile."
            icon={Brain}
          />
          <WorkspaceMetricCard
            label="Library grounding"
            value={activeKnowledgeCacheName ? 'On' : 'Off'}
            detail={
              activeKnowledgeCacheName
                ? 'Tutor can cite and ground answers in your selected document.'
                : 'Set an active library document for grounded citations.'
            }
            accent="#7a8f6e"
            icon={Sparkles}
          />
          <WorkspaceMetricCard
            label="Messages"
            value={messages.length}
            detail="Conversation turns in this current workspace."
            accent="#728ba6"
            icon={MessageCircle}
          />
          <WorkspaceMetricCard
            label="Mode"
            value="Socratic"
            detail="Bias toward targeted questioning and concise reasoning."
            accent="#c4b78a"
            icon={Bot}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceSplit>
          <WorkspaceSurface accent="#9a7f9a">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                  Context layer
                </p>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                  What the tutor is seeing right now
                </h2>
              </div>
              <div className="space-y-3">
                <div className="workspace-subsurface rounded-[1.25rem] p-4">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Intelligence profile
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {isLoadingContext
                      ? 'Loading your recent weakness profile…'
                      : tutorContext ?? 'No profile context available.'}
                  </p>
                </div>
                <div className="workspace-subsurface rounded-[1.25rem] p-4">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Active library
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {activeKnowledgeCacheName
                      ? `Grounding answers in ${activeKnowledgeCacheDisplayName || 'your active document'}.`
                      : 'No active document selected. The tutor will rely on your profile and general clinical reasoning.'}
                  </p>
                </div>
              </div>
            </div>
          </WorkspaceSurface>

          <WorkspaceSurface accent="#c4b78a">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  Suggested starts
                </p>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                  Use the tutor like a reasoning coach.
                </h2>
              </div>
              <div className="space-y-3">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void handleSend(prompt)}
                    className="workspace-subsurface-interactive w-full rounded-[1.25rem] p-4 text-left"
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {prompt}
                    </p>
                  </button>
                ))}
              </div>
              {profileLoadFailed ? (
                <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--color-data-provisional)]/25 bg-[var(--color-data-provisional)]/8 p-4">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Personalized weakness context is unavailable right now. Standard tutoring is
                    still active.
                  </p>
                  <Button type="button" size="sm" variant="warning" onClick={() => void fetchProfile()}>
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : null}
            </div>
          </WorkspaceSurface>
        </WorkspaceSplit>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Conversation"
          subtitle="Use this like a live clinical reasoning whiteboard. Ask for scaffolding, counterarguments, differentials, and safer next steps."
        >
          <WorkspaceSurface accent="#728ba6" padded={false}>
            <div className="flex min-h-[34rem] flex-col">
              <div
                ref={logRef}
                className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6"
                role="log"
                aria-live="polite"
                aria-label="Tutor conversation"
              >
                <div className="sr-only" aria-live="assertive" aria-atomic role="status">
                  {isStreaming ? 'Tutor is thinking.' : ''}
                </div>

                {streamError ? (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="flex items-start gap-3 rounded-[1.25rem] border border-[var(--color-data-fail)]/25 bg-[var(--color-data-fail)]/8 p-4"
                  >
                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-[var(--color-data-fail)]" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        Tutor couldn't respond
                      </p>
                      <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                        {streamError}
                      </p>
                      {lastSentTextRef.current ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="warning"
                          onClick={() => {
                            const retryText = lastSentTextRef.current;
                            if (!retryText) return;
                            // Remove the stranded user message so we don't duplicate it
                            setMessages((prev) => {
                              const last = prev.at(-1);
                              if (last?.role === 'user' && last.text === retryText) {
                                return prev.slice(0, -1);
                              }
                              return prev;
                            });
                            void handleSend(retryText);
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {messages.length === 0 ? (
                  <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-4 px-6 text-center" role="status" aria-live="polite">
                    <div className="workspace-icon-tile flex h-14 w-14 items-center justify-center rounded-2xl">
                      {isLoadingContext ? (
                        <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
                      ) : (
                        <MessageCircle className="h-6 w-6 text-[var(--color-accent)]" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {isLoadingContext ? 'Loading your tutor context…' : 'Ask the first question'}
                      </h3>
                      <p className="max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
                        Start with a missed question, a system you keep forgetting, or a clinical
                        scenario you want to reason through more carefully.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] bg-[var(--color-accent)]/12">
                          <Bot className="h-4 w-4 text-[var(--color-accent)]" />
                        </div>
                      ) : null}

                      <div
                        className={`max-w-[82%] rounded-[1.35rem] px-4 py-3 text-sm leading-7 ${
                          message.role === 'user'
                            ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                            : 'workspace-subsurface text-[var(--color-text-primary)]'
                        }`}
                      >
                        {message.text}
                      </div>

                      {message.role === 'user' ? (
                        <div className="workspace-icon-tile flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl">
                          <User className="h-4 w-4 text-[var(--color-text-secondary)]" />
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="workspace-divider workspace-footer-surface border-t px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="block flex-1">
                    <span className="sr-only">Ask the reasoning tutor</span>
                    <input
                      type="text"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder="Ask for a differential, safer next step, or a quiz on your weak systems…"
                      className="workspace-field w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    />
                  </label>

                  <Button
                    type="button"
                    size="md"
                    variant="primary"
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || isStreaming}
                    className="sm:min-w-[156px]"
                  >
                    {isStreaming ? (
                      <>
                        <InlineSpinner size="sm" />
                        Thinking…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Ask tutor
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </WorkspaceSurface>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default TutorChatPage;
