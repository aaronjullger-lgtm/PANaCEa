/**
 * SRS Review View — Spaced Repetition via Variant PANCE Questions
 *
 * Replaces the old flashcard flip-card UI. FSRS scheduling is fully implicit:
 * no Correct/Incorrect buttons, no self-evaluation. The system presents a
 * variant PANCE-style MCQ question (from GET /api/srs/next), the learner
 * selects an answer and submits, and the FSRS rating is derived entirely from
 * behavioral signals (time-to-first-click, answer switches, dwell time, etc.).
 *
 * Flow: GET /api/srs/next → render MCQ → select answer → Submit →
 *   deriveFsrsRatingFromBehavior → POST /api/srs/submit → show explanation →
 *   Next question
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAuth } from '@clerk/clerk-react';
import {
  fetchNextVariantCard,
  submitVariantReview,
  type VariantNextResponse,
} from '@/lib/services/srsReviewClient';
import { deriveFsrsRatingFromBehavior } from '@/lib/utils/fsrsImplicitRating';
import { toast } from '@/lib/toast';

interface SrsReviewViewProps {
  onExit: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Normalised question data extracted from Question or QuestionVariant payloads. */
interface ReviewQuestion {
  questionId: string;
  srsItemId: string | null;
  cardId?: string | null;
  topicProgressId?: string;
  variantId?: string;
  isVariant: boolean;
  progressContext?: 'READINESS' | 'TARGETED' | string | null;
  /** Optional vignette / case stem to display above the question. */
  vignette: string;
  stem: string;
  options: string[];
  /** Index (0-based) of the correct option in the `options` array. */
  correctIndex: number;
  explanation: string;
  conditionId?: string;
  /** Par (expected) time for behavioral scoring (ms). Defaults to 90 s. */
  parTimeMs: number;
}

function parseQuestion(raw: VariantNextResponse): ReviewQuestion | null {
  const q = raw.question as Record<string, unknown> | null | undefined;
  if (!q) return null;

  const questionId = ((q.id ?? q.baseQuestionId) as string | undefined)?.trim();
  if (!questionId) return null;

  const stem = ((q.question ?? q.stem ?? '') as string).trim();
  if (!stem) return null;

  // options can be a string array or JSON-stored array
  const rawOptions = (q.options ?? []) as unknown[];
  const options: string[] = Array.isArray(rawOptions)
    ? rawOptions.map((o) => String(o))
    : [];
  if (options.length === 0) return null;

  // Determine correct index: prefer correctAnswerIndex, fall back to indexOf(correctAnswer)
  let correctIndex = -1;
  if (typeof q.correctAnswerIndex === 'number') {
    correctIndex = q.correctAnswerIndex;
  } else if (typeof q.correctAnswer === 'string') {
    correctIndex = options.findIndex(
      (o) => o.trim().toLowerCase() === (q.correctAnswer as string).trim().toLowerCase()
    );
  }
  if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

  const explanation = ((q.explanation ?? q.rationale ?? '') as string).trim();
  const vignette = ((q.vignette ?? '') as string).trim();

  return {
    questionId,
    srsItemId: raw.srsItemId,
    cardId: raw.cardId ?? null,
    topicProgressId: raw.topicProgressId,
    variantId: raw.isVariant ? questionId : undefined,
    isVariant: raw.isVariant,
    progressContext: raw.progressContext ?? null,
    vignette,
    stem,
    options,
    correctIndex,
    explanation,
    conditionId: (q.conditionId as string | undefined) ?? undefined,
    parTimeMs: 90_000,
  };
}

function formatNextReview(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function SrsFlashcardView({ onExit }: Readonly<SrsReviewViewProps>) {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const srsAuth = useCallback(() => ({ getToken }), [getToken]);

  const [question, setQuestion] = useState<ReviewQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Answer state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Behavioral signal tracking
  const displayTimeRef = useRef<number>(0);
  const firstClickTimeRef = useRef<number | null>(null);
  const answerSwitchesRef = useRef<number>(0);
  const lastSelectionTimeRef = useRef<number | null>(null);

  const resetBehavior = () => {
    displayTimeRef.current = Date.now();
    firstClickTimeRef.current = null;
    answerSwitchesRef.current = 0;
    lastSelectionTimeRef.current = null;
  };

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQuestion(null);
    setSelectedIndex(null);
    setSubmitted(false);
    setSubmitError(null);
    resetBehavior();

    try {
      const raw = await fetchNextVariantCard(srsAuth());
      const data = (
        raw && typeof raw === 'object' && 'data' in raw
          ? (raw as { data: VariantNextResponse }).data
          : raw
      ) as VariantNextResponse | null | undefined;

      if (!data) {
        setError('Could not load next question.');
        setLoading(false);
        return;
      }
      if ('message' in data && data.message && !data.question) {
        const msg =
          data.message === 'No items due'
            ? 'All caught up — no questions due right now.'
            : String(data.message);
        setError(msg);
        setLoading(false);
        return;
      }

      const parsed = parseQuestion(data);
      if (!parsed) {
        setError('Could not parse question data.');
        setLoading(false);
        return;
      }
      setQuestion(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load question.');
    } finally {
      setLoading(false);
    }
  }, [srsAuth]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  const handleSelectOption = useCallback((index: number) => {
    if (submitted || submitting) return;
    setSubmitError(null);

    // Record first click
    if (firstClickTimeRef.current === null) {
      firstClickTimeRef.current = Date.now();
    }
    // Count switches (only after the first selection)
    if (lastSelectionTimeRef.current !== null) {
      answerSwitchesRef.current += 1;
    }
    lastSelectionTimeRef.current = Date.now();
    setSelectedIndex(index);
  }, [submitted, submitting]);

  const handleSubmit = useCallback(async () => {
    if (selectedIndex === null || !question || submitting || submitted) return;
    setSubmitting(true);

    const now = Date.now();
    const totalDwellTimeMs = now - displayTimeRef.current;
    const timeToFirstClickMs = firstClickTimeRef.current !== null
      ? firstClickTimeRef.current - displayTimeRef.current
      : null;
    const selectionDriftMs = lastSelectionTimeRef.current !== null
      ? now - lastSelectionTimeRef.current
      : null;
    const isCorrect = selectedIndex === question.correctIndex;

    const rating = deriveFsrsRatingFromBehavior({
      isCorrect,
      timeToFirstClickMs,
      totalDwellTimeMs,
      parTimeMs: question.parTimeMs,
      answerSwitches: answerSwitchesRef.current,
      selectionDriftMs,
    });

    try {
      const result = await submitVariantReview(
        {
          srsItemId: question.srsItemId ?? undefined,
          topicProgressId: question.topicProgressId,
          questionId: question.questionId,
          variantId: question.variantId,
          progressContext: question.progressContext,
          rating,
          isCorrect,
          userAnswer: question.options[selectedIndex],
          timeSpent: Math.round(totalDwellTimeMs),
        },
        srsAuth()
      );

      if (!result?.success) {
        throw new Error('Review was not saved. Check your connection and try again.');
      }

      setSubmitted(true);
      setSubmitting(false);
      setSubmitError(null);

      if (result?.nextReviewDate) {
        const nextStr = formatNextReview(result.nextReviewDate);
        if (nextStr) {
          toast.info(`Next review: ${nextStr}`, { duration: 2500 });
        }
      }
    } catch (srsErr) {
      console.warn('[SrsFlashcardView] FSRS submit failed', srsErr);
      setSubmitting(false);
      const message =
        srsErr instanceof Error
          ? srsErr.message
          : 'Review was not saved. Check your connection and try again.';
      setSubmitError(message);
      toast.error(message);
    }
  }, [selectedIndex, question, submitting, submitted, srsAuth]);

  // ─── Render: Loading ─────────────────────────────────────────────────────────

  if (loading && !question) {
    return (
      <div role="status" aria-label="Loading next question" aria-live="polite" className="flex flex-col items-center justify-center min-h-[320px] p-6">
        <div className="mb-4">
          <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">Loading next question…</p>
      </div>
    );
  }

  // ─── Render: Empty / Error ────────────────────────────────────────────────────

  if (error && !question) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex flex-col items-center justify-center min-h-[320px] p-6 text-center gap-4"
      >
        <p
          className="text-sm text-[var(--color-text-secondary)]"
          data-testid="srs-review-message"
        >
          {error}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    );
  }

  if (!question) return null;

  const isCorrect = submitted && selectedIndex === question.correctIndex;

  // ─── Render: MCQ Question ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer inline-flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1
          className="text-base font-semibold text-[var(--color-text-primary)]"
          data-testid="srs-review-heading"
        >
          Due Review
        </h1>
        {question.isVariant && (
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            Variant
          </span>
        )}
      </div>

      {/* Vignette */}
      {question.vignette && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {question.vignette}
          </p>
        </div>
      )}

      {/* Stem */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <p className="text-[var(--color-text-primary)] leading-relaxed font-medium">
          {question.stem}
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2" data-testid="srs-review-options">
        {question.options.map((option, index) => {
          const label = OPTION_LABELS[index] ?? String.fromCharCode(65 + index);
          const isSelected = selectedIndex === index;
          const isCorrectOption = index === question.correctIndex;

          let borderClass = 'border-[var(--color-border)]';
          let bgClass = 'bg-[var(--color-bg-secondary)]';
          let textClass = 'text-[var(--color-text-primary)]';

          if (submitted) {
            if (isCorrectOption) {
              borderClass = 'border-[var(--color-data-pass)]';
              bgClass = 'bg-[var(--color-data-pass)]/10';
              textClass = 'text-[var(--color-data-pass)]';
            } else if (isSelected && !isCorrectOption) {
              borderClass = 'border-[var(--color-data-provisional)]';
              bgClass = 'bg-[var(--color-data-provisional)]/10';
              textClass = 'text-[var(--color-data-provisional)]';
            }
          } else if (isSelected) {
            borderClass = 'border-[var(--color-accent)]';
            bgClass = 'bg-[var(--color-accent)]/10';
          }

          return (
            <button
              key={`${question.questionId}-${index}`}
              type="button"
              disabled={submitted || submitting}
              onClick={() => handleSelectOption(index)}
              className={`w-full flex items-start gap-3 min-h-[44px] px-4 py-3 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm text-left cursor-pointer disabled:cursor-default transition-colors duration-150 hover:enabled:bg-[var(--color-bg-tertiary)]`}
            >
              <span className="font-bold shrink-0 w-5">{label}.</span>
              <span className="leading-relaxed">{option}</span>
              {submitted && isCorrectOption && (
                <CheckCircle2 className="w-4 h-4 ml-auto shrink-0 mt-0.5" />
              )}
              {submitted && isSelected && !isCorrectOption && (
                <XCircle className="w-4 h-4 ml-auto shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Submit / Next */}
      {submitError && !submitted && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10 px-4 py-3 text-sm text-[var(--color-data-provisional)]"
          data-testid="srs-review-submit-error"
        >
          {submitError}
        </div>
      )}
      {!submitted ? (
        <button
          type="button"
          disabled={selectedIndex === null || submitting}
          onClick={() => void handleSubmit()}
          className="min-h-[44px] px-6 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-sm disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 self-end"
          data-testid="srs-review-submit"
        >
          {submitting ? (
            <InlineSpinner size="sm" />
          ) : (
            <>
              Submit
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key="explanation"
            initial={prefersReducedMotion ? false : { y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
            className="flex flex-col gap-3"
          >
            {/* Result banner */}
            <div
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm ${
                isCorrect
                  ? 'bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)]'
                  : 'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)]'
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0" />
              )}
              {isCorrect ? 'Correct' : 'Incorrect'}
            </div>

            {/* Explanation */}
            {question.explanation && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                  Explanation
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {question.explanation}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void loadNext()}
              className="min-h-[44px] px-6 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-sm cursor-pointer inline-flex items-center justify-center gap-2 self-end"
              data-testid="srs-review-next"
            >
              Next question
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

export default SrsFlashcardView;
