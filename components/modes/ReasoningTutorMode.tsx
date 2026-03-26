import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, X, Loader2, ShieldCheck, Sparkles, Search } from 'lucide-react';

type ChatRole = 'user' | 'model';

interface GroundingSource {
  title: string;
  uri: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  groundingSources?: GroundingSource[];
}

interface ReasoningTutorModeProps {
  onExit?: () => void;
}

const STORAGE_KEY_GOOGLE_SEARCH = 'reasoning-tutor-google-search';

const ReasoningTutorMode: React.FC<ReasoningTutorModeProps> = ({ onExit }) => {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionCacheName, setSessionCacheName] = useState<string | undefined>(undefined);
  const [thinkingLevel] = useState<'minimal' | 'low' | 'medium' | 'high'>('high');
  const [enableGoogleSearch, setEnableGoogleSearch] = useState(() => {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY_GOOGLE_SEARCH) === 'true';
    } catch {
      return false;
    }
  });
  const [error, setError] = useState<string | null>(null);

  const toggleGoogleSearch = () => {
    setEnableGoogleSearch((prev) => {
      const next = !prev;
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY_GOOGLE_SEARCH, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await getToken();

      const history = messages
        .concat(userMessage)
        .slice(-12)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const response = await fetch('/api/intelligence/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          history,
          sessionCacheName,
          thinkingLevel,
          enableGoogleSearch,
          reasoningEffort: enableGoogleSearch ? 'high' : undefined,
        }),
      });

      const json = (await response.json()) as {
        error?: string;
        data?: { reply?: string; sessionCacheName?: string; groundingSources?: GroundingSource[] };
      };

      if (!response.ok) {
        const message = json?.error || 'Tutor failed to respond. Please try again.';
        setError(message);
        setIsLoading(false);
        return;
      }

      const replyText: string | undefined = json?.data?.reply;
      const newCacheName: string | undefined = json?.data?.sessionCacheName;
      const groundingSources: GroundingSource[] | undefined = json?.data?.groundingSources;

      if (newCacheName) {
        setSessionCacheName(newCacheName);
      }

      if (!replyText) {
        setError('Tutor returned an empty response. Please try again.');
        setIsLoading(false);
        return;
      }

      const tutorMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: replyText,
        groundingSources,
      };

      setMessages((prev) => [...prev, tutorMessage]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Network error while contacting the Reasoning Tutor.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const getSystemPromptSnippet = () => {
    return 'Gemini 3 Reasoning Tutor • Focused on NCCPA blueprint, differential diagnosis, and high-yield reasoning.';
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)]/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-4 py-6">
        <header className="mb-4 flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--color-accent)]/15 p-3">
              <Brain className="h-6 w-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Reasoning Tutor
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">{getSystemPromptSnippet()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleGoogleSearch}
              title={
                enableGoogleSearch
                  ? 'Google Search grounding on – answers include up-to-date guidelines'
                  : 'Enable Google Search – check latest guidelines for treatments'
              }
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] transition-colors ${
                enableGoogleSearch
                  ? 'border-data-pass/50 bg-data-pass/10 text-data-pass dark:text-data-pass'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Search className="h-3 w-3" />
              <span>{enableGoogleSearch ? 'Search on' : 'Search off'}</span>
            </button>
            <div className="hidden items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1 text-[10px] text-[var(--color-text-muted)] md:flex">
              <ShieldCheck className="h-3 w-3 text-data-pass" />
              <span>Context-aware • Weak-spot guided</span>
            </div>
            <button
              type="button"
              onClick={onExit}
              aria-label="Close Reasoning Tutor"
              className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
          >
            {messages.length === 0 && !isLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[var(--color-text-muted)]">
                <Sparkles className="h-8 w-8 text-[var(--color-accent)]" />
                <p className="max-w-md text-sm">
                  Ask a complex clinical vignette or differential diagnosis question. The tutor will
                  think through the case step-by-step before answering.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ y: 10 }}
                      animate={{ y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`flex ${
                        m.role === 'user' ? 'justify-end' : 'justify-start'
                      } text-sm leading-relaxed`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl border px-3 py-2 ${
                          m.role === 'user'
                            ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-transparent'
                            : 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border-[var(--color-border)]'
                        }`}
                      >
                        {m.text}
                        {m.role === 'model' &&
                          m.groundingSources &&
                          m.groundingSources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {m.groundingSources.map((src, i) => (
                                <a
                                  key={i}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)] hover:underline"
                                >
                                  Source: {src.title}
                                </a>
                              ))}
                            </div>
                          )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reasoning through your case&hellip;
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-data-fail/40 bg-data-fail/5 px-3 py-2 text-xs text-data-fail">
              {error}
            </div>
          )}

          <div className="mt-1 flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Describe a patient scenario or ask a PANCE-style question..."
                className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                <span>Press Enter to send • Shift+Enter for newline</span>
                <span>Thinking level: {thinkingLevel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReasoningTutorMode;
