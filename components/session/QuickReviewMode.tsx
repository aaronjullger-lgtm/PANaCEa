/**
 * Quick Review Mode Component
 * Allows rapid review of recently missed questions for immediate reinforcement.
 * Fetches concept variants via due-siblings API so the same question is not repeated.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, XCircle, Clock, Target } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAuth } from '@clerk/clerk-react';
import type { Question } from '@/types';
import type { QuizQuestion } from '@/types';

interface QuickReviewModeProps {
  missedQuestions: Question[];
  onClose: () => void;
  /** Called with variant questions (or empty) to start the quiz. Skip items with no variant. */
  onStartReview: (questions: QuizQuestion[]) => void;
}

export const QuickReviewMode: React.FC<QuickReviewModeProps> = ({
  missedQuestions,
  onClose,
  onStartReview,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'all'>('today');
  const [selectedCount, setSelectedCount] = useState<number>(10);

  // Filter questions by timeframe
  const getFilteredQuestions = () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let filtered = [...missedQuestions];

    switch (selectedTimeframe) {
      case 'today':
        filtered = filtered.filter(
          (q) => q.lastReviewedAt && now - new Date(q.lastReviewedAt).getTime() < dayMs
        );
        break;
      case 'week':
        filtered = filtered.filter(
          (q) => q.lastReviewedAt && now - new Date(q.lastReviewedAt).getTime() < 7 * dayMs
        );
        break;
      case 'all':
        // No filtering
        break;
    }

    // Sort by most recent first
    filtered.sort((a, b) => {
      const aTime = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
      const bTime = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
      return bTime - aTime;
    });

    return filtered.slice(0, selectedCount);
  };

  const filteredQuestions = getFilteredQuestions();
  const totalMissed = missedQuestions.length;

  // Get stats by timeframe
  const todayMissed = missedQuestions.filter((q) => {
    if (!q.lastReviewedAt) return false;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return new Date(q.lastReviewedAt).getTime() > dayAgo;
  }).length;

  const weekMissed = missedQuestions.filter((q) => {
    if (!q.lastReviewedAt) return false;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(q.lastReviewedAt).getTime() > weekAgo;
  }).length;

  const { getToken } = useAuth();
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  const handleStartReviewWithVariants = async () => {
    if (filteredQuestions.length === 0) return;
    const token = await getToken();
    if (!token) {
      setVariantError('Sign in to load variant questions.');
      return;
    }
    setVariantLoading(true);
    setVariantError(null);
    try {
      const dueItems = filteredQuestions
        .map((q) => ({
          conditionId: q.conditionId ?? '',
          taskType: q.taskType ?? null,
          originalQuestionId: q.id ?? (q as { questionId?: string }).questionId ?? '',
        }))
        .filter((d) => d.conditionId && d.originalQuestionId);
      if (dueItems.length === 0) {
        setVariantError('No concept data for selected questions.');
        setVariantLoading(false);
        return;
      }
      const res = await fetch('/api/questions/due-siblings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dueItems }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: {
          results?: Array<{
            question: {
              id: string;
              question: string;
              vignette?: string;
              options: string[];
              correctAnswerIndex: number;
              rationale: string;
              system: string;
              conditionId?: string;
              condition?: string;
            } | null;
            dueConceptKey: { conditionId: string; taskType: string | null };
          }>;
        };
      };
      const results = json?.data?.results ?? [];
      const queue: QuizQuestion[] = results
        .filter((r): r is typeof r & { question: NonNullable<typeof r.question> } => r.question != null)
        .map((r) => {
          const key = r.dueConceptKey;
          const q = r.question;
          return {
            id: q.id,
            question: q.vignette ? `${q.vignette}\n\n${q.question}` : q.question,
            options: q.options,
            correctAnswerIndex: q.correctAnswerIndex,
            rationale: q.rationale,
            system: q.system,
            conditionId: key.conditionId,
            condition: q.condition ?? '',
            topic: q.system,
            dueConceptKey: key,
          } as QuizQuestion;
        });
      if (queue.length === 0) {
        setVariantError('No variants available for these concepts. Try a general session.');
        setVariantLoading(false);
        return;
      }
      onClose();
      onStartReview(queue);
    } catch (variantErr) {
      console.warn('[QuickReviewMode] Failed to load variant questions', variantErr);
      setVariantError('Could not load variant questions. Try again.');
    } finally {
      setVariantLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={false}
      animate={{}}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={prefersReducedMotion ? undefined : { scale: 0.9, opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick review"
        className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-2xl w-full max-h-[90vh] overflow-hidden border border-[var(--color-border)]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] p-6 text-[var(--color-text-inverse)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-text-inverse)]/20 rounded-lg backdrop-blur-sm">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Quick Review</h2>
                <p className="text-[var(--color-text-inverse)]/80 text-sm">
                  Reinforce what you've learned
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-text-inverse)]/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
              <Clock className="w-5 h-5 text-[var(--color-accent)] mx-auto mb-2" />
              <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {todayMissed}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Today</div>
            </div>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
              <Target className="w-5 h-5 text-[var(--color-accent-hover)] mx-auto mb-2" />
              <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {weekMissed}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">This Week</div>
            </div>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 text-center">
              <RefreshCw className="w-5 h-5 text-[var(--color-data-neutral)] mx-auto mb-2" />
              <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {totalMissed}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Total</div>
            </div>
          </div>

          {/* Timeframe Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Select Timeframe
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'today', label: 'Today', count: todayMissed },
                { value: 'week', label: 'This Week', count: weekMissed },
                { value: 'all', label: 'All Time', count: totalMissed },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedTimeframe(option.value as 'today' | 'week' | 'all')}
                  className={`
                    p-3 rounded-lg border-2 transition-all duration-200
                    ${
                      selectedTimeframe === option.value
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
                    }
                  `}
                >
                  <div className="font-semibold text-sm">{option.label}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {option.count} questions
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Question Count Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Number of Questions
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((count) => (
                <button
                  key={count}
                  onClick={() => setSelectedCount(count)}
                  className={`
                    flex-1 py-2 px-4 rounded-lg border-2 transition-all duration-200 font-semibold
                    ${
                      selectedCount === count
                        ? 'border-[var(--color-accent-hover)] bg-[var(--color-accent-hover)]/10 text-[var(--color-accent-hover)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
                    }
                  `}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Review Summary */}
          <div className="bg-gradient-to-r from-[var(--color-bg-secondary)] to-[var(--color-accent)]/10 rounded-lg p-4 mb-6 border border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-[var(--color-text-primary)]">
                  Ready to Review
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  {filteredQuestions.length} questions selected
                </div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-[var(--color-data-pass)]" />
            </div>
          </div>

          {/* Empty State */}
          {filteredQuestions.length === 0 && (
            <div className="text-center py-8">
              <div className="text-[var(--color-text-muted)] mb-2">
                <CheckCircle2 className="w-16 h-16 mx-auto" />
              </div>
              <p className="text-[var(--color-text-secondary)]">
                Nothing to review in this timeframe
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Try selecting a different timeframe or keep studying!
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 rounded-lg border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartReviewWithVariants}
              disabled={filteredQuestions.length === 0 || variantLoading}
              className="flex-1 py-3 px-6 rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] text-[var(--color-text-inverse)] font-semibold hover:from-[var(--color-accent-hover)] hover:to-[var(--color-accent)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {variantLoading ? 'Loading variants…' : `Start Review (${filteredQuestions.length})`}
            </button>
          </div>
          {variantError && (
            <p className="mt-3 text-sm text-[var(--color-error)]" role="alert">
              {variantError}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default QuickReviewMode;
