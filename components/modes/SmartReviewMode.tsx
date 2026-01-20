import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Brain,
  Clock,
  Zap,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { SkeletonLoader, SkeletonText } from '@/components/ui/SkeletonLoader';
import { useSession } from '@/contexts/SessionContext';
import type { SubmitReviewResponse } from '@/services/calibrationService';

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

type ViewState = 'loading' | 'active' | 'complete';

const SmartReviewMode: React.FC<SmartReviewModeProps> = ({ onExit }) => {
  const { getToken } = useAuth();
  
  // Safely get calibration tracking from SessionContext (may not be available if used standalone)
  let recordCalibrationObservation: ((questionId: string, response: SubmitReviewResponse, organSystem?: string) => void) | null = null;
  try {
    const session = useSession();
    recordCalibrationObservation = session.recordCalibrationObservation;
  } catch {
    // SessionProvider not available - calibration tracking disabled for standalone usage
  }
  
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });

  useEffect(() => {
    loadReviewItems();
  }, []);
  const loadReviewItems = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/drills/smart-review', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();

      if (data.success && data.items.length > 0) {
        setReviewQueue(data.items);
        setViewState('active');
        setStartTime(Date.now());
      } else {
        setViewState('complete');
      }
    } catch (error) {
      console.error('Failed to load review items:', error);
      setViewState('complete');
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

    // Submit to backend for FSRS update
    try {
      const token = await getToken();
      const response = await fetch('/api/drills/submit-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: 'current-user-id', // Will be replaced by server with actual userId from auth
          questionId: currentItem.questionId,
          selectedAnswer,
          timeSpentMs,
        }),
      });
      
      const result = await response.json();
      
      // Record JOL calibration observation for metacognitive tracking
      if (recordCalibrationObservation && result.implicitMetrics) {
        recordCalibrationObservation(
          currentItem.questionId,
          result as SubmitReviewResponse,
          currentItem.question.system
        );
      }
    } catch (error) {
      console.warn('Failed to submit review:', error);
    }

    // Show feedback toast
    showSpeedFeedback(timeSpentMs);
  };

  const showSpeedFeedback = (timeMs: number) => {
    // Placeholder: implement toast/animation based on speed
    const isFast = timeMs < 15000;
    console.log(isFast ? 'Fast Recall (Easy)' : 'Slow Recall (Hard)');
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
        return { Icon: AlertCircle, label: 'Memory Critical', color: 'bg-red-500 text-white' };
      case 'WEAK_SPOT':
        return { Icon: AlertTriangle, label: 'Weak Area', color: 'bg-orange-500 text-white' };
      case 'NEW':
        return { Icon: Sparkles, label: 'New Concept', color: 'bg-blue-500 text-white' };
      default:
        return { Icon: FileText, label: 'Review', color: 'bg-gray-500 text-white' };
    }
  };

  // Loading State
  if (viewState === 'loading') {
    return (
      <div className="fixed inset-0 bg-[var(--color-bg-primary)] overflow-y-auto z-50">
        {/* Header Skeleton */}
        <div className="sticky top-0 bg-[var(--color-bg-secondary)]/95 backdrop-blur border-b border-[var(--color-border)]">
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

  // Complete State
  if (viewState === 'complete' || !currentItem) {
    const accuracy = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            <CheckCircle className="w-24 h-24 text-white mx-auto mb-6" />
          </motion.div>

          <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <Brain className="w-10 h-10" /> Brain Upgraded!
          </h1>
          <p className="text-white/80 mb-8">You've completed all your reviews for today.</p>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-3xl font-bold text-white">{stats.reviewed}</div>
                <div className="text-white/60 text-sm">Items Reviewed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">{accuracy}%</div>
                <div className="text-white/60 text-sm">Accuracy</div>
              </div>
            </div>
          </div>

          <button
            onClick={onExit}
            className="px-8 py-3 bg-white text-purple-700 rounded-xl font-semibold hover:bg-white/90 transition-colors"
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
      <div className="sticky top-0 bg-[var(--color-bg-secondary)]/95 backdrop-blur border-b border-[var(--color-border)] z-10">
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
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
                          <div className="w-2 h-2 bg-white rounded-full" />
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border-2 rounded-2xl p-6 ${
                  isCorrect
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-500'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-500'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  {isCorrect ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
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
                  className="px-8 py-3 bg-[var(--color-accent)] text-white rounded-xl font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-[var(--color-accent)] text-white rounded-xl font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
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