'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ChevronLeft, Sparkles, Loader2, User, Bot } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { usePreferences } from '@/hooks/usePreferences';
import { API_ENDPOINTS, buildApiUrl } from '@/lib/utils/apiConfig';
import { callGeminiTextStreaming } from '@/services/ai/geminiService';

interface TutorChatPageProps {
  onExit: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export const TutorChatPage: React.FC<TutorChatPageProps> = ({ onExit }) => {
  const { getToken } = useAuth();
  const { preferences } = usePreferences();
  const [tutorContext, setTutorContext] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const customSettings = preferences.customSettings as Record<string, unknown> | undefined;
  const activeKnowledgeCacheName = customSettings?.activeKnowledgeCacheName as string | undefined;
  const activeKnowledgeCacheDisplayName = customSettings
    ?.activeKnowledgeCacheDisplayName as string | undefined;

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoadingContext(true);
      try {
        const token = await getToken();
        if (!token) {
          setTutorContext(
            'Student Weaknesses: Unknown (no profile loaded). Proceed with standard Socratic dialogue.'
          );
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
      } finally {
        setIsLoadingContext(false);
      }
    };

    void fetchProfile();
  }, [getToken]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    const historyText = messages
      .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.text}`)
      .join('\n');

    const profileHeader =
      tutorContext && tutorContext.trim().length > 0
        ? `${tutorContext}\n\nYou are a clinical reasoning tutor for a PA student. Use the weaknesses above to target your explanations and questions.`
        : 'You are a clinical reasoning tutor for a PA student. Use Socratic dialogue and focus on high-yield PANCE reasoning.';

    const prompt = `${profileHeader}

Conversation so far:
${historyText}
Student: ${trimmed}

Tutor:`;

    let assistantText = '';
    try {
      await callGeminiTextStreaming('gemini-3-flash-preview', prompt, 0.8, {
        getToken,
        cachedContent: activeKnowledgeCacheName,
        onChunk: (chunk) => {
          assistantText += chunk;
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') {
              copy[copy.length - 1] = { ...last, text: last.text + chunk };
            } else {
              copy.push({ role: 'assistant', text: chunk });
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
        // High reasoning for complex clinical vignettes
        thinkingLevel: 'HIGH',
      });
    } catch {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, tutorContext, getToken, activeKnowledgeCacheName]);

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
            This Tutor uses your{' '}
            <span className="font-semibold">Intelligence Profile</span> (Concept Gaps and recent
            misses) and, when set, your{' '}
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

      <div className="mb-4 h-64 sm:h-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
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
          {messages.map((m, idx) => (
            <div
              key={idx}
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
          >
            {isStreaming && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>{isStreaming ? 'Thinking…' : 'Ask'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TutorChatPage;

