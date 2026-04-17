import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springs } from '@/config/appViews';
import {
  X,
  Brain,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { createApiClient, createDrillsClient, ApiError } from '@/lib/sdk';
import { SkeletonLoader, SkeletonText } from '@/components/loading';
import SessionContext from '@/contexts/SessionContext';
import type { SubmitReviewResponse } from '@/services/analytics';

interface ReviewItem {
  id: string;
  questionId: string;
  srsReason: 'OVERDUE' | 'WEAK_SPOT' | 'NEW';
  overdueDays: number;
  difficulty: number;
  interval: number;
  question: {
    id: string;
    stem: string;
    choices: Array<{ text: string; value: string } | string>;
    correctAnswer: string;
    explanation: string;
    system: string;
    difficulty: string;
  };
}

interface SmartReviewModeProps {
  onExit?: () => void;
}

type ViewState = 'loading' | 'active' | 'complete' | 'error';

const SmartReviewMode: React.FC<SmartReviewModeProps> = ({ onExit }) => {
  const { getToken } = useAuth();

  // Safely get calibration tracking from SessionContext (may not be available if used standalone)
  const session = useContext(SessionContext);
  const recordCalibrationObservation = session?.recordCalibrationObservation ?? null;

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });

  useEffect(() => {
    loadReviewItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadReviewItems = async () => {
    setViewState('loading');
    setLoadError(null);
    try {
      const token = await getToken();
      const response = await fetch('/api/drills/smart-review', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(`Failed to load review items: ${response.status}`);
      }
      const data = (await response.json()) as { success?: boolean; items?: unknown[] };

      if (data.success && data.items && data.items.length > 0) {
        setReviewQueue(data.items as ReviewItem[]);
        setViewState('active');
        setStartTime(Date.now());
      } else {
        // Legitimate empty state — user has no reviews due. Show celebratory complete screen.
        setViewState('complete');
      }
    } catch (error) {
      console.error('Failed to load review items:', error);
      const message =
        error instanceof Error ? error.message : 'Could not load review items.';
      toast.error('Could not load review items. Check your connection and try again.');
      setLoadError(message);
      // Distinguish a real fetch failure from a legitimate empty review queue —
      // the old behavior showed "Brain Upgraded!" celebration even when the API
      // errored, which masked real load failures from the user.
      setViewState('error');
    }
  };

  const currentItem = reviewQueue[currentIndex];

  const handleSubmit = async () => {
    if (!currentItem || !selectedAnswer) return;

    const timeSpentMs = Date.now() - startTime;
    const correct = selectedAnswer === currentItem.question.correctAnswer;

    setIsCorrect(correct);
    setIsSubmitted(true);
    setStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (correct ? 1 : 0),
    }));

    // Trigger haptics
    if (correct) hapticSuccess();
    else hapticError();

    // Submit to backend for FSRS update (via SDK for retry + error classification)
    try {
      const api = createApiClient(getToken, {
        retryablePosts: ['/api/drills/submit-review'],
      });
      const drills = createDrillsClient(api);

      const submitted = await drills.submitReview({
        questionId: currentItem.questionId,
        selectedAnswer,
        timeSpentMs,
        sessionType: 'drill',
      });

      const result = submitted as { implicitMetrics?: unknown };

      // Record JOL calibration observation for metacognitive tracking
      if (recordCalibrationObservation && result?.implicitMetrics) {
        recordCalibrationObservation(
          currentItem.questionId,
          result as SubmitReviewResponse,
          currentItem.question.system
        );
      }
    } catch (error) {
      const isApiErr = error instanceof ApiError;
      console.warn('Failed to submit review:', isApiErr ? error.userMessage : error);
      if (isApiErr && error.isAuthError) {
        toast.error('Session expired — please sign in again.');
      } else if (isApiErr && !error.isRetryable) {
        toast.error(error.userMessage);
      }
      // For retryable errors (network/timeout/server) the SDK already retried;
      // the answer's correctness is already reflected in the UI, so we silently
      // continue rather than alarming the user during review flow.
    }

    // Show feedback toast
    showSpeedFeedback(timeSpentMs);
  };

  const showSpeedFeedback = (timeMs: number) => {
    const seconds = Math.floor(timeMs / 1000);

    if (timeMs < 10000) {
      toast.success(`Lightning fast! ${seconds}s - Strong recall`, {
        icon: '⚡',
        duration: 2000,
      });
    } else if (timeMs < 20000) {
      toast.success(`Quick recall! ${seconds}s - Good retention`, {
        icon: '✓',
        duration: 2000,
      });
    } else if (timeMs < 40000) {
      toast.info(`${seconds}s - Consider reviewing this topic again`, {
        icon: '🔄',
        duration: 2500,
      });
    } else {
      toast.warning(`Slow recall (${seconds}s) - Flag for intensive review`, {
        icon: '⏱️',
        duration: 3000,
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < reviewQueue.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setStartTime(Date.now());
    } else {
      setViewState('complete');
    }
  };

  const getBadgeConfig = (reason: string) => {
    switch (reason) {
      case 'OVERDUE':
        return { Icon: AlertCircle, label: 'Memory Critical', color: 'bg-data-fail text-[var(--color-text-inverse)]' };
      case 'WEAK_SPOT':
        return { Icon: AlertTriangle, label: 'Focus Area', color: 'bg-[var(--color-data-provisional)] text-[var(--color-text-inverse)]' };
      case 'NEW':
        return { Icon: Sparkles, label: 'New Concept', color: 'bg-[var(--color-category-practice)] text-[var(--color-text-inverse)]' };
      default:
        return {
          Icon: FileText,
          label: 'Review',
          color: 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]',
        };
    }
  };

  // Loading State
  if (viewState === 'loading') {
    return (
      <div className="fixed inset-0 bg-[var(--color-bg-primary)] overflow-y-auto z-50">
        {/* Header Skeleton */}
        <div className="sticky top-0 bg-[var(--color-bg-secondary)]/95 border-b border-[var(--color-border)]">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonLoader width="24px" height="24px" className="rounded" />
              <SkeletonLoader width="100px" height="20px" className="rounded" />
            </div>
            <SkeletonLoader width="60px" height="20px" className="rounded" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {/* Badge skeleton */}
          <div className="flex justify-center">
            <SkeletonLoader width="140px" height="36px" className="rounded-full" />
          </div>

          {/* Question card skeleton */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8">
            <SkeletonText lines={3} className="mb-8" />

            {/* Answer choices skeleton */}
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonLoader key={i} height="64px" className="rounded-xl" />
              ))}
            </div>
          </div>

          {/* Button skeleton */}
          <div className="flex justify-center">
            <SkeletonLoader width="160px" height="48px" className="rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error State — distinct from "Complete" so failed loads are visible to the user
  if (viewState === 'error') {
    return (
      <div className="fixed inset-0 bg-[var(--color-bg-primary)] flex items-center justify-center z-50">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-16 h-16 text-data-fail mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
            Couldn't load review items
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            {loadError ?? 'Check your connection and try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadReviewItems}
              className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onExit}
              className="px-6 py-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl font-semibold hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Complete State
  if (viewState === 'complete' || !currentItem) {
    const accuracy = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center z-50">
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...springs.gentle, delay: 0.2 }}
          >
            <CheckCircle className="w-24 h-24 text-[var(--color-text-inverse)] mx-auto mb-6" />
          </motion.div>

          <h1 className="text-4xl font-bold text-[var(--color-text-inverse)] mb-4 flex items-center justify-center gap-3">
            <Brain className="w-10 h-10" /> Brain Upgraded!
          </h1>
          <p className="text-[var(--color-text-inverse)]/80 mb-8">You've completed all your reviews for today.</p>

          <div className="bg-[var(--color-bg-primary)]/10 rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-3xl font-bold text-[var(--color-text-inverse)]">{stats.reviewed}</div>
                <div className="text-[var(--color-text-inverse)]/60 text-sm">Items Reviewed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[var(--color-text-inverse)]">{accuracy}%</div>
                <div className="text-[var(--color-text-inverse)]/60 text-sm">Accuracy</div>
              </div>
            </div>
          </div>

          <button
            onClick={onExit}
            className="px-8 py-3 bg-[var(--color-bg-primary)] text-[var(--color-accent)] rounded-xl font-semibold hover:bg-[var(--color-bg-primary)]/90 transition-colors"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // Active Review State
  const badge = getBadgeConfig(currentItem.srsReason);
  const choices = currentItem.question.choices.map((c) =>
    typeof c === 'string' ? { text: c, value: c } : c
  );

  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)] overflow-y-auto z-50">
      {/* Header */}
      <div className="sticky top-0 bg-[var(--color-bg-secondary)]/95 border-b border-[var(--color-border)] z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-[var(--color-accent)]" />
            <span className="font-semibold text-[var(--color-text-primary)]">Smart Review</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-[var(--color-text-muted)]">
              {currentIndex + 1} / {reviewQueue.length}
            </div>
            <button
              onClick={onExit}
              className="p-2 hover:bg-[var(--color-bg-primary)] rounded-lg transition-colors"
              aria-label="Exit Smart Review Mode"
            >
              <X className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ x: 20 }}
            animate={{ x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Reason Badge */}
            <div className="flex justify-center">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${badge.color} shadow-lg`}
              >
                <badge.Icon className="w-5 h-5" />
                <span className="font-semibold text-sm">{badge.label}</span>
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8 shadow-lg">
              <p className="text-lg text-[var(--color-text-primary)] leading-relaxed mb-8">
                {currentItem.question.stem}
              </p>

              {/* Answer Choices */}
              <div className="space-y-3">
                {choices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => !isSubmitted && setSelectedAnswer(choice.value)}
                    disabled={isSubmitted}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      selectedAnswer === choice.value
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-accent)]/50'
                    } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedAnswer === choice.value
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                            : 'border-[var(--color-border)]'
                        }`}
                      >
                        {selectedAnswer === choice.value && (
                          <div className="w-2 h-2 bg-[var(--color-bg-primary)] rounded-full" />
                        )}
                      </div>
                      <span className="text-[var(--color-text-primary)]">{choice.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback */}
            {isSubmitted && (
              <motion.div
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                className={`border-2 rounded-2xl p-6 ${
                  isCorrect
                    ? 'bg-data-pass/20 border-data-pass'
                    : 'bg-data-fail/20 border-data-fail'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  {isCorrect ? (
                    <CheckCircle className="w-6 h-6 text-data-pass" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-data-fail" />
                  )}
                  <div>
                    <div className="font-semibold text-lg mb-2">
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {currentItem.question.explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
              {!isSubmitted ? (
                <button
                  onClick={handleSubmit}
                  disabled={!selectedAnswer}
                  className="px-8 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  Next Question
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SmartReviewMode;
