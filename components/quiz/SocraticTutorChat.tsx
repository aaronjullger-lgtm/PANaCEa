/**
 * Socratic Tutor Chat
 *
 * Lightweight chat that slides up when reviewing an incorrect answer.
 * Guides the student with 2–3 Socratic questions before revealing the full explanation.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/config/appViews';
import { MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

interface SocraticTutorChatProps {
  readonly questionId?: string;
  readonly conditionId?: string;
  readonly vignette: string;
  readonly question: string;
  readonly correctAnswer: string;
  readonly userWrongAnswer: string;
  readonly options?: string[];
  readonly fullExplanation: string;
  readonly onClose: () => void;
}

const MAX_TURNS = 3;

type Message = { role: 'user' | 'tutor'; text: string };

export function SocraticTutorChat({
  questionId,
  conditionId,
  vignette,
  question,
  correctAnswer,
  userWrongAnswer,
  options,
  fullExplanation,
  onClose,
}: SocraticTutorChatProps) {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchGuidingQuestion = useCallback(
    async (userReply?: string) => {
      const token = await getToken();
      if (!token) return;

      setLoading(true);
      try {
        const url = getApiEndpoint('/api/ai/learning/socratic');
        const historyForApi = userReply
          ? [...messages, { role: 'user' as const, text: userReply }]
          : messages;
        const turnNumber = historyForApi.filter((message) => message.role === 'user').length;
        const payload = {
          body: {
            questionId,
            conditionId,
            vignette,
            question,
            correctAnswer,
            userWrongAnswer,
            options,
            history: historyForApi.length > 0 ? historyForApi : undefined,
            turnNumber,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = (await res.json()) as {
          data?: { guidingQuestion?: string };
          error?: string;
        };
        const text =
          json?.data?.guidingQuestion ??
          json?.error ??
          'What clue in the vignette suggests your answer might be wrong?';

        setMessages((prev) =>
          userReply
            ? [...prev, { role: 'user', text: userReply }, { role: 'tutor', text }]
            : [{ role: 'tutor', text }]
        );
      } catch (err) {
        console.warn('[SocraticTutorChat] Failed to fetch guiding question', err);
        setMessages((prev) => [
          ...prev,
          {
            role: 'tutor',
            text: 'Something went wrong. Consider re-reading the vignette—what detail contradicts your choice?',
          },
        ]);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [
      getToken,
      questionId,
      conditionId,
      vignette,
      question,
      correctAnswer,
      userWrongAnswer,
      options,
      messages,
    ]
  );

  const handleStart = useCallback(() => {
    setInitialLoad(false);
    void fetchGuidingQuestion();
  }, [fetchGuidingQuestion]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const turnCount = messages.filter((m) => m.role === 'user').length + 1;
    if (turnCount >= MAX_TURNS) {
      setRevealed(true);
      setInput('');
      return;
    }

    void fetchGuidingQuestion(trimmed);
    setInput('');
  }, [input, loading, messages, fetchGuidingQuestion]);

  const handleReveal = useCallback(() => setRevealed(true), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const userTurnCount = messages.filter((m) => m.role === 'user').length;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={springs.gentle}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[50vh] rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[0_-8px_32px_rgba(15,23,42,0.25)]"
    >
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
          <span className="font-semibold text-[var(--color-text-primary)]">Socratic Tutor</span>
        </div>
        <div className="flex items-center gap-2">
          {!revealed && (
            <button
              type="button"
              onClick={handleReveal}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Skip to answer
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Socratic Tutor"
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px] max-h-[28vh]">
        {initialLoad && (
          <button
            type="button"
            onClick={handleStart}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium hover:bg-[var(--color-accent)]/20 transition-colors"
          >
            {loading ? 'Thinking…' : 'Ask a guiding question'}
          </button>
        )}

        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={`msg-${m.role}-${i}-${m.text.slice(0, 30)}`}
              initial={prefersReducedMotion ? false : { y: 8 }}
              animate={{ y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  m.role === 'user'
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {revealed && (
          <motion.div
            initial={false}
            animate={{}}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]"
          >
            <strong className="text-[var(--color-text-primary)]">Full explanation:</strong>
            <p className="mt-2 leading-relaxed">{fullExplanation}</p>
          </motion.div>
        )}
      </div>

      {!revealed && (messages.length > 0 || !initialLoad) && (
        <div className="p-3 border-t border-[var(--color-border)] flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={
              userTurnCount >= MAX_TURNS - 1 ? 'Ready for the answer?' : 'Type your response…'
            }
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            aria-label="Your response to the tutor"
          />
          {userTurnCount >= MAX_TURNS - 1 ? (
            <button
              type="button"
              onClick={handleReveal}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium text-sm hover:opacity-90"
            >
              Show answer
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={loading}
              className="p-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 disabled:opacity-60"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
