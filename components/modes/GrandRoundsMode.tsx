/**
 * Grand Rounds Daily Challenge Mode Component
 *
 * REFACTORED: Server-authoritative, one attempt per day.
 * Users compete on a shared set of 5 questions with speed-weighted scoring.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Users,
  Calendar,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Crown,
  Medal,
  Zap,
  AlertCircle,
  Loader2,
  Timer,
  Target,
} from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import type { Question } from '@/types';

interface GrandRoundsModeProps {
  onExit?: () => void;
}

type ViewState = 'loading' | 'completed' | 'landing' | 'active' | 'summary' | 'error';

interface ChallengeData {
  challengeId: string;
  questions: Question[];
}

interface CompletedStats {
  score: number;
  correctCount: number;
  totalQuestions: number;
  timeSpentMs: number;
  percentile: number;
  ranking: number;
}

interface SubmissionResult {
  success: boolean;
  score: number;
  correctCount: number;
  totalQuestions: number;
  percentile: number;
  ranking: number;
  speedBonus: number;
}

const TOTAL_TIME_MS = 20 * 60 * 1000; // 20 minutes total
const QUESTIONS_COUNT = 5;

// Helper function to calculate time until next challenge (midnight UTC)
const getTimeUntilNextChallenge = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${hours}h ${minutes}m ${seconds}s`;
};

const GrandRoundsMode: React.FC<GrandRoundsModeProps> = ({ onExit }) => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [challengeData, setChallengeData] = useState<ChallengeData | null>(null);
  const [completedStats, setCompletedStats] = useState<CompletedStats | null>(null);

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<number>(0);
  const [timeElapsedMs, setTimeElapsedMs] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Next challenge countdown
  const [nextChallengeCountdown, setNextChallengeCountdown] = useState(getTimeUntilNextChallenge());

  // Fetch today's challenge once auth is ready
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetchTodaysChallenge();
  }, [isLoaded, isSignedIn]);

  const fetchTodaysChallenge = async () => {
    setViewState('loading');
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const response = await fetch('/api/grand-rounds/today', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch challenge`);
      }

      const data = await response.json();

      if (data.status === 'completed') {
        // User already completed today's challenge
        setCompletedStats(data.stats);
        setViewState('completed');
      } else if (data.status === 'active') {
        // Challenge available, user hasn't attempted yet
        setChallengeData({
          challengeId: data.challengeId,
          questions: data.questions,
        });
        setViewState('landing');
      } else {
        throw new Error('Invalid challenge status');
      }
    } catch (err) {
      console.error('Error fetching challenge:', err);
      const isNetworkIssue =
        err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message));
      setError(
        isNetworkIssue
          ? 'Unable to connect. Please check your internet connection and try again.'
          : 'Unable to load challenge. Please try again.'
      );
      setViewState('error');
    }
  };

  // Timer for next challenge countdown (only active when completed)
  useEffect(() => {
    if (viewState !== 'completed') return;

    const interval = setInterval(() => {
      setNextChallengeCountdown(getTimeUntilNextChallenge());
    }, 1000);
    return () => clearInterval(interval);
  }, [viewState]);

  // Timer for active quiz
  useEffect(() => {
    if (viewState !== 'active' || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeElapsedMs(elapsed);

      // Auto-submit if time limit reached
      if (elapsed >= TOTAL_TIME_MS) {
        handleAutoSubmit();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [viewState, startTime]);

  const handleStart = useCallback(() => {
    setViewState('active');
    setStartTime(Date.now());
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setSelectedAnswer(null);
  }, []);

  const handleAnswerSelect = useCallback(
    (index: number) => {
      if (!challengeData) return;
      setSelectedAnswer(index);
    },
    [challengeData]
  );

  const handleNext = useCallback(() => {
    if (!challengeData || selectedAnswer === null) return;

    const currentQuestion = challengeData.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    // Save answer - guard against undefined id for computed property type safety
    const questionId = currentQuestion.id;
    if (!questionId) return;
    const updatedAnswers = {
      ...userAnswers,
      [questionId]: selectedAnswer,
    };
    setUserAnswers(updatedAnswers);

    // Move to next question or finish
    if (currentQuestionIndex < challengeData.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      // Last question - submit
      handleSubmitChallenge(updatedAnswers);
    }
  }, [challengeData, currentQuestionIndex, selectedAnswer, userAnswers]);

  const handleAutoSubmit = useCallback(() => {
    if (!challengeData) return;
    handleSubmitChallenge(userAnswers);
  }, [challengeData, userAnswers]);

  const handleSubmitChallenge = async (answers: Record<string, number>) => {
    if (!challengeData || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const timeSpentMs = Date.now() - startTime;

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const response = await fetch('/api/grand-rounds/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challengeId: challengeData.challengeId,
          answers,
          timeSpentMs,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit challenge');
      }

      const result: SubmissionResult = await response.json();

      if (result.success) {
        hapticSuccess();

        setCompletedStats({
          score: result.score,
          correctCount: result.correctCount,
          totalQuestions: result.totalQuestions,
          timeSpentMs,
          percentile: result.percentile,
          ranking: result.ranking,
        });

        setViewState('summary');
      } else {
        throw new Error('Submission failed');
      }
    } catch (err) {
      console.error('Error submitting challenge:', err);
      hapticError();
      setError(
        err instanceof Error ? err.message : 'Unable to submit your results. Please try again.'
      );
      setViewState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimeRemaining = () => {
    return Math.max(0, TOTAL_TIME_MS - timeElapsedMs);
  };

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto" />
          <p className="text-xl text-[var(--color-text-muted)]">Loading Grand Rounds...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Error</h2>
          <p className="text-[var(--color-text-muted)]">
            {error || 'Something went wrong loading Grand Rounds.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={fetchTodaysChallenge}
              className="flex-1 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onExit}
              className="flex-1 px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-semibold transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Completed state - Already finished today's challenge
  if (viewState === 'completed' && completedStats) {
    const isTopPercentile = completedStats.percentile >= 90;

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6"
        >
          <div className="text-center space-y-4">
            {isTopPercentile && (
              <motion.div
                animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-block"
              >
                <Crown className="w-16 h-16 text-amber-500 mx-auto" />
              </motion.div>
            )}

            <h2 className="text-3xl font-bold text-amber-500">Challenge Complete!</h2>
            <p className="text-[var(--color-text-muted)]">
              You've already completed today's Grand Rounds challenge.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-amber-500">{completedStats.score}</div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">Total Score</div>
            </div>

            <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-amber-500">
                {completedStats.correctCount}/{completedStats.totalQuestions}
              </div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">Correct</div>
            </div>

            <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-amber-500">{completedStats.percentile}%</div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">Percentile</div>
            </div>

            <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-amber-500">#{completedStats.ranking}</div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">Global Rank</div>
            </div>
          </div>

          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)] mb-2">
              <Calendar className="w-5 h-5" />
              <span>Next Challenge In:</span>
            </div>
            <div className="text-2xl font-bold text-amber-500">{nextChallengeCountdown}</div>
          </div>

          <button
            onClick={onExit}
            className="w-full px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-semibold transition-colors"
          >
            Back to Menu
          </button>
        </motion.div>
      </div>
    );
  }

  // Landing state - Start challenge
  if (viewState === 'landing' && challengeData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6"
        >
          <div className="text-center space-y-4">
            <motion.div
              animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full"
            >
              <Trophy className="w-12 h-12 text-amber-500" />
            </motion.div>

            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              Grand Rounds Daily Challenge
            </h1>

            <p className="text-xl text-[var(--color-text-muted)]">
              Compete globally on today's challenge!
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-primary)] rounded-lg">
              <Target className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <div>
                <div className="font-semibold">5 Questions</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  High-yield clinical scenarios
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-primary)] rounded-lg">
              <Clock className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <div>
                <div className="font-semibold">20 Minutes</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Speed affects your score
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-primary)] rounded-lg">
              <Users className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <div>
                <div className="font-semibold">Global Leaderboard</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  See your percentile ranking
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[var(--color-text-muted)]">
                <strong className="text-amber-500">One Attempt Per Day:</strong> You can only
                complete this challenge once. New challenges available daily at midnight UTC.
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onExit}
              className="flex-1 px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleStart}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Start Challenge
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Active quiz state
  if (viewState === 'active' && challengeData) {
    const currentQuestion = challengeData.questions[currentQuestionIndex];

    // Guard: If currentQuestion is undefined, show loading
    if (!currentQuestion) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto" />
            <p className="text-xl text-[var(--color-text-muted)]">Loading question...</p>
          </div>
        </div>
      );
    }

    const progress = ((currentQuestionIndex + 1) / challengeData.questions.length) * 100;
    const timeRemaining = getTimeRemaining();
    const timeRemainingPercent = (timeRemaining / TOTAL_TIME_MS) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header with timer */}
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-amber-500">
                    {currentQuestionIndex + 1}/{challengeData.questions.length}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-muted)]">Question</div>
                  <div className="font-semibold">Grand Rounds Challenge</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Timer
                  className={`w-5 h-5 ${timeRemainingPercent < 25 ? 'text-red-500' : 'text-amber-500'}`}
                />
                <span
                  className={`text-2xl font-bold ${timeRemainingPercent < 25 ? 'text-red-500' : 'text-amber-500'}`}
                >
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-2 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                />
              </div>
              <div className="h-1 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    timeRemainingPercent < 25 ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${timeRemainingPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6"
            >
              {currentQuestion.vignette && (
                <div className="prose prose-invert max-w-none">
                  <p className="text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.vignette}
                  </p>
                </div>
              )}

              <div className="text-xl font-semibold">{currentQuestion.question}</div>

              <div className="space-y-3">
                {currentQuestion.options?.map((option: string, index: number) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleAnswerSelect(index)}
                    className={`w-full p-4 rounded-lg text-left transition-all border-2 ${
                      selectedAnswer === index
                        ? 'bg-amber-500/20 border-amber-500'
                        : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-amber-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                          selectedAnswer === index
                            ? 'bg-amber-500 text-white'
                            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span>{option}</span>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleNext}
                  disabled={selectedAnswer === null || isSubmitting}
                  className={`px-8 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    selectedAnswer === null || isSubmitting
                      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : currentQuestionIndex === challengeData.questions.length - 1 ? (
                    <>
                      Submit Challenge
                      <CheckCircle className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      Next Question
                      <Play className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Summary state - Just finished
  if (viewState === 'summary' && completedStats) {
    const isTopPercentile = completedStats.percentile >= 90;

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6"
        >
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              {isTopPercentile ? (
                <Crown className="w-20 h-20 text-amber-500 mx-auto" />
              ) : (
                <Trophy className="w-20 h-20 text-amber-500 mx-auto" />
              )}
            </motion.div>

            <h2 className="text-3xl font-bold text-amber-500">
              {isTopPercentile ? 'Outstanding Performance!' : 'Challenge Complete!'}
            </h2>
            <p className="text-[var(--color-text-muted)]">
              {isTopPercentile
                ? "You're in the top 10% of all participants today!"
                : "You've completed today's Grand Rounds challenge."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center"
            >
              <div className="text-4xl font-bold text-amber-500">{completedStats.score}</div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">Total Score</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center"
            >
              <div className="text-4xl font-bold text-amber-500">
                {completedStats.correctCount}/{completedStats.totalQuestions}
              </div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">Correct</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center"
            >
              <div className="text-4xl font-bold text-amber-500">{completedStats.percentile}%</div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">Percentile</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center"
            >
              <div className="text-4xl font-bold text-amber-500">#{completedStats.ranking}</div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">Global Rank</div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-[var(--color-bg-primary)] rounded-lg p-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)] mb-2">
              <Calendar className="w-5 h-5" />
              <span>Next Challenge In:</span>
            </div>
            <div className="text-2xl font-bold text-amber-500">{nextChallengeCountdown}</div>
          </motion.div>

          <button
            onClick={onExit}
            className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold transition-all"
          >
            Back to Menu
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default GrandRoundsMode;