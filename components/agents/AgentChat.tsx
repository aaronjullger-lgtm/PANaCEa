/**
 * Agent Chat
 *
 * Thin frontend for the `/api/agents/run` endpoint. The server-side agent
 * runs a tool-calling loop (clinical library search, user progress
 * summary, FSRS due count, etc.) and returns a single final answer plus
 * an optional step transcript for debugging.
 *
 * Design goals:
 *  - One request per turn. The server handles the full tool loop so the
 *    client is a pure text-in / text-out surface.
 *  - Async-state hardened: empty / loading / error / success states are
 *    all rendered explicitly (no blank screens, no swallowed errors).
 *  - Trace transparency: students can toggle a "Show reasoning" panel
 *    that reveals which tools the agent called and what they returned.
 *    This is essential for trust in a clinical education context — the
 *    agent should never be a black box.
 *  - Clinical safety: the assistant's final text is the answer of
 *    record, but the trace panel and token counter give the student the
 *    provenance they need to verify it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Hammer,
  RefreshCw,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { InlineSpinner } from '@/components/loading';
import { useAgentStream, type AgentStreamStep } from '@/hooks/useAgentStream';

// ─── Types (mirror server AgentRunResult / AgentStep) ──────────────────────

type AgentStopReason =
  | 'completed'
  | 'max_iterations'
  | 'tool_error'
  | 'model_error'
  | 'safety_block'
  | 'aborted';

interface AgentTextPart {
  type: 'text';
  text: string;
}
interface AgentFunctionCallPart {
  type: 'function_call';
  name: string;
  args: Record<string, unknown>;
}
interface AgentFunctionResultPart {
  type: 'function_result';
  name: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}
type AgentPart = AgentTextPart | AgentFunctionCallPart | AgentFunctionResultPart;

interface AgentStep {
  iteration: number;
  role: 'user' | 'model' | 'tool';
  parts: AgentPart[];
  durationMs?: number;
}

interface AgentRunResponse {
  finalText: string;
  stopReason: AgentStopReason;
  iterations: number;
  tokensUsed: { input: number; output: number; total: number };
  durationMs: number;
  error?: { message: string; code?: string };
  steps?: AgentStep[];
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Attached to assistant turns — the raw run payload for the trace panel. */
  run?: AgentRunResponse;
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface AgentChatProps {
  readonly onExit: () => void;
  /**
   * Optional per-user context forwarded to the agent so it can personalize
   * without an extra DB round-trip. When omitted, the server falls back
   * to its default system prompt.
   */
  readonly userContext?: {
    currentRotation?: string | null;
    examDate?: string | null;
    focusSystem?: string | null;
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_MESSAGE_CHARS = 4000;

const EXAMPLE_PROMPTS: ReadonlyArray<{ title: string; prompt: string }> = [
  {
    title: 'What should I study next?',
    prompt:
      "What's the highest-ROI thing for me to study in the next 30 minutes? Use my progress data.",
  },
  {
    title: 'Review a topic',
    prompt:
      'Give me a rapid high-yield review of acute pancreatitis for the PANCE — include Ranson criteria and first-line management.',
  },
  {
    title: 'Differential reasoning',
    prompt:
      'A 58-year-old man presents with tearing chest pain radiating to the back. Walk me through the differential and the next best test.',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

const AgentChat: React.FC<AgentChatProps> = ({ onExit, userContext }) => {
  const { getToken } = useAuth();
  const { send: sendStream, abort, status, result, error: streamError, steps } = useAgentStream(getToken);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [showTrace, setShowTrace] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const loading = status === 'connecting' || status === 'started';
  const error = localError ?? streamError;

  // Auto-scroll to newest message whenever turns grow or loading toggles.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns, loading, status]);

  // Escape to exit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onExit();
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [onExit, loading]);

  // When stream completes, materialise the assistant turn from the result.
  useEffect(() => {
    if (status !== 'completed' || !result) return;

    const output = result.output as Record<string, unknown> | undefined;
    const run: AgentRunResponse = {
      finalText: (output?.finalText as string) ?? '',
      stopReason: ((output?.stopReason as string) ?? 'completed') as AgentStopReason,
      iterations: (output?.iterations as number) ?? 0,
      tokensUsed: (output?.tokensUsed as { input: number; output: number; total: number }) ?? { input: 0, output: 0, total: 0 },
      durationMs: result.durationMs,
      error: output?.error as { message: string; code?: string } | undefined,
      steps: output?.steps as AgentStep[] | undefined,
    };

    const assistantText =
      run.finalText.trim().length > 0
        ? run.finalText
        : stopReasonFallbackText(run.stopReason, run.error?.message);

    const assistantTurn: ChatTurn = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: assistantText,
      run,
    };
    setTurns((prev) => [...prev, assistantTurn]);

    if (run.stopReason !== 'completed') {
      setLocalError(
        run.error?.message ??
          `Agent stopped early (${run.stopReason}).`
      );
    }

    // Return focus to the textarea so the student can keep typing.
    textareaRef.current?.focus();
  }, [status, result]);

  const sendMessage = useCallback(
    (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || loading) return;
      if (trimmed.length > MAX_MESSAGE_CHARS) {
        setLocalError(`Message must be under ${MAX_MESSAGE_CHARS} characters.`);
        return;
      }

      setLocalError(null);
      const userTurn: ChatTurn = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      setTurns((prev) => [...prev, userTurn]);
      setInput('');

      sendStream({
        agent: 'clinical-explorer',
        input: {
          message: trimmed,
          includeSteps: true,
          userContext: userContext ?? undefined,
        },
      });
    },
    [loading, userContext, sendStream]
  );

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleRetry = useCallback(() => {
    const lastUser = [...turns].reverse().find((t) => t.role === 'user');
    if (!lastUser) return;
    setTurns((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && prev[lastIdx]?.role === 'assistant') {
        return prev.slice(0, -1);
      }
      return prev;
    });
    sendMessage(lastUser.text);
  }, [turns, sendMessage]);

  const handleStop = useCallback(() => {
    abort();
  }, [abort]);

  const handleExamplePick = useCallback(
    (prompt: string) => {
      setInput(prompt);
      textareaRef.current?.focus();
    },
    []
  );

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const charCount = input.length;
  const overLimit = charCount > MAX_MESSAGE_CHARS;
  const latestAssistant = [...turns]
    .reverse()
    .find((t) => t.role === 'assistant');

  return (
    <div
      className="flex flex-col h-full min-h-0 bg-[var(--color-bg-primary)]"
      aria-label="PANaCEa Study Agent"
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            disabled={loading}
            aria-label="Back"
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                Study Agent
              </h1>
              <p className="truncate text-xs text-[var(--color-text-muted)]">
                Tool-calling PANCE study assistant
              </p>
            </div>
          </div>
        </div>
        {latestAssistant?.run && (
          <button
            type="button"
            onClick={() => setShowTrace((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            aria-pressed={showTrace}
          >
            <Wrench className="h-3.5 w-3.5" />
            {showTrace ? 'Hide reasoning' : 'Show reasoning'}
          </button>
        )}
      </header>

      {/* ── Transcript ────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {turns.length === 0 && !loading && (
            <EmptyState onPick={handleExamplePick} />
          )}

          <AnimatePresence initial={false}>
            {turns.map((turn) => (
              <motion.div
                key={turn.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <TurnBubble turn={turn} />
                {showTrace && turn.run?.steps && turn.run.steps.length > 0 && (
                  <TracePanel run={turn.run} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && <LoadingBubble steps={steps} />}

          {error && !loading && (
            <ErrorBanner message={error} onRetry={turns.length > 0 ? handleRetry : undefined} />
          )}
        </div>
      </div>

      {/* ── Composer ──────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Ask the agent about a topic, your progress, or a clinical case…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
              style={{ minHeight: 48, maxHeight: 160 }}
              aria-label="Message the agent"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim() || overLimit}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-text-inverse)] hover:opacity-90 disabled:opacity-50"
              aria-label="Send message"
            >
              {loading ? (
                <InlineSpinner size="sm" />
              ) : (
                <CornerDownLeft className="h-4 w-4" />
              )}
              Send
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>Enter to send, Shift+Enter for newline</span>
            <span
              className={
                overLimit
                  ? 'text-[var(--color-danger,#dc2626)] font-semibold'
                  : undefined
              }
            >
              {charCount}/{MAX_MESSAGE_CHARS}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentChat;

// ─── Sub-components ────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onPick: (prompt: string) => void }> = ({
  onPick,
}) => (
  <div className="flex flex-col items-center gap-6 py-8 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
      <Bot className="h-7 w-7" aria-hidden />
    </div>
    <div className="max-w-md">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Ask the Study Agent
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        The agent can search the clinical library, look up your progress,
        and check your FSRS review load before answering. Everything you
        ask is grounded in PANCE-blueprint content.
      </p>
    </div>
    <div className="grid w-full gap-2 sm:grid-cols-3">
      {EXAMPLE_PROMPTS.map((ex) => (
        <button
          key={ex.title}
          type="button"
          onClick={() => onPick(ex.prompt)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-left text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)]"
        >
          <div className="font-medium">{ex.title}</div>
          <div className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">
            {ex.prompt}
          </div>
        </button>
      ))}
    </div>
  </div>
);

const TurnBubble: React.FC<{ turn: ChatTurn }> = ({ turn }) => {
  const isUser = turn.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
        }`}
        aria-hidden
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[calc(100%-3rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
            : 'border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
        }`}
      >
        <div className="whitespace-pre-wrap">{turn.text}</div>
        {!isUser && turn.run && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] pt-2 text-[11px] text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Hammer className="h-3 w-3" /> {countToolCalls(turn.run)} tool
              {countToolCalls(turn.run) === 1 ? '' : 's'}
            </span>
            <span>{turn.run.iterations} iteration{turn.run.iterations === 1 ? '' : 's'}</span>
            <span>{turn.run.tokensUsed.total.toLocaleString()} tokens</span>
            <span>{(turn.run.durationMs / 1000).toFixed(1)}s</span>
            {turn.run.stopReason !== 'completed' && (
              <span className="rounded-full bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 font-medium">
                {turn.run.stopReason}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingBubble: React.FC<{ steps: AgentStreamStep[] }> = ({ steps }) => {
  const startedStep = steps.find((s) => s.event === 'agent_started');
  const statusLabel = startedStep
    ? `Running ${startedStep.data.agent as string}…`
    : 'Connecting…';

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]">
        <Bot className="h-4 w-4" />
      </div>
      <div
        className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <InlineSpinner size="sm" className="text-[var(--color-accent)]" />
          {statusLabel}
        </div>
        {steps.length > 1 && (
          <div className="text-xs text-[var(--color-text-muted)]">
            {steps.length - 1} event{steps.length - 1 === 1 ? '' : 's'} received
          </div>
        )}
      </div>
    </div>
  );
};

const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div
    role="alert"
    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-danger,#ef4444)] bg-[var(--color-danger,#ef4444)]/10 px-4 py-3 text-sm text-[var(--color-text-primary)]"
  >
    <span className="flex-1">{message}</span>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    )}
  </div>
);

const TracePanel: React.FC<{ run: AgentRunResponse }> = ({ run }) => (
  <details className="group ml-11 mt-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 p-3 text-xs">
    <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-[var(--color-text-secondary)] list-none">
      <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
      Agent trace · {run.steps?.length ?? 0} steps
    </summary>
    <ol className="mt-2 space-y-2">
      {run.steps?.map((step, idx) => (
        <li
          key={`${step.iteration}-${step.role}-${idx}`}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2"
        >
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <span>iter {step.iteration}</span>
            <span>·</span>
            <span>{step.role}</span>
            {typeof step.durationMs === 'number' && (
              <>
                <span>·</span>
                <span>{step.durationMs}ms</span>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            {step.parts.map((part, pIdx) => (
              <TracePart key={pIdx} part={part} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  </details>
);

const TracePart: React.FC<{ part: AgentPart }> = ({ part }) => {
  if (part.type === 'text') {
    return (
      <div className="whitespace-pre-wrap text-[var(--color-text-primary)]">
        {part.text}
      </div>
    );
  }
  if (part.type === 'function_call') {
    return (
      <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 font-mono text-[11px] text-[var(--color-text-primary)]">
        <div className="font-semibold text-[var(--color-accent)]">
          → {part.name}(
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all">
          {safeStringify(part.args, 2)}
        </pre>
        <div className="font-semibold text-[var(--color-accent)]">)</div>
      </div>
    );
  }
  // function_result
  return (
    <div
      className={`rounded border p-2 font-mono text-[11px] ${
        part.ok
          ? 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
          : 'border-[var(--color-data-fail)] bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 font-semibold">
        <span>← {part.name}</span>
        <span>
          {part.ok ? 'ok' : 'error'} · {part.durationMs}ms
        </span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all">
        {part.ok ? safeStringify(part.output, 2) : part.error}
      </pre>
    </div>
  );
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function countToolCalls(run: AgentRunResponse): number {
  if (!run.steps) return 0;
  let n = 0;
  for (const step of run.steps) {
    for (const part of step.parts) {
      if (part.type === 'function_call') n++;
    }
  }
  return n;
}

function stopReasonFallbackText(
  reason: AgentStopReason,
  message?: string
): string {
  switch (reason) {
    case 'max_iterations':
      return "I wasn't able to finish reasoning about that in the time I had. Try a more focused question or break it into smaller parts.";
    case 'safety_block':
      return "Gemini's safety filter blocked that response. Try rephrasing the question.";
    case 'model_error':
      return `The model returned an error${message ? `: ${message}` : '.'} Please try again.`;
    case 'tool_error':
      return `A tool I relied on failed${message ? `: ${message}` : '.'} I can try again if you want.`;
    case 'aborted':
      return 'The request was cancelled before I finished.';
    case 'completed':
    default:
      return 'I finished, but I have nothing to say. Try asking a more specific question.';
  }
}

function safeStringify(value: unknown, space = 0): string {
  try {
    return JSON.stringify(value, null, space);
  } catch {
    return String(value);
  }
}
