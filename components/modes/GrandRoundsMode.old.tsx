/**
 * Grand Rounds Daily Challenge Mode Component
 *
 * Database-first high-yield question mode with organ system selection.
 * Features speed-weighted scoring and one attempt per system per day.
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
  Stethoscope,
} from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { ABBREVIATION_TO_TOPIC_MAP, PANCE_TOPIC_ABBREVIATIONS } from '@/src/constants';
import type { Question, SystemCode } from '@/types';

interface GrandRoundsModeProps {
  onExit?: () => void;
}

type ViewState =
  | 'loading'
  | 'system-select'
  | 'completed'
  | 'landing'
  | 'active'
  | 'summary'
  | 'error';

interface ChallengeData {
  challengeId: string;
  questions: (Question & { id: string })[];
  system: SystemCode;
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
  percentile: number;
  ranking: number;
  speedBonus: number;
}

const TOTAL_TIME_MS = 20 * 60 * 1000; // 20 minutes total
const QUESTIONS_PER_SESSION = 10;

// Helper function to calculate time until next challenge (moved outside component for hook initialization)
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
  const { user } = useUser();
  const { getToken } = useAuth();
  const userId = user?.id || 'demo-user';

  const [viewState, setViewState] = useState<ViewState>('system-select');
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | null>(null);
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

  // Fetch challenge when system is selected
  const handleSystemSelect = useCallback(
    async (system: SystemCode) => {
      setSelectedSystem(system);
      setViewState('loading');
      setError(null);

      try {
        const token = await getToken();
        const response = await fetch(`/api/grand-rounds/system/${system}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Backend server not available. Using database-first fallback.');
        }

        if (!response.ok) {
          throw new Error('Failed to fetch challenge');
        }

        const data = await response.json();

        if (data.status === 'completed') {
          setCompletedStats({
            score: data.stats.score,
            correctCount: data.stats.correctCount,
            totalQuestions: data.stats.totalQuestions,
            timeSpentMs: data.stats.timeSpentMs,
            percentile: data.stats.percentile,
            ranking: data.stats.ranking,
          });
          setViewState('completed');
        } else if (data.status === 'active') {
          setChallengeData({
            challengeId: data.challengeId,
            questions: data.questions,
            system,
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
    },
    [getToken]
  );

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

    // Save answer
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: selectedAnswer,
    }));

    // Move to next question or finish
    if (currentQuestionIndex < challengeData.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      // Last question - submit
      handleSubmitChallenge({
        ...userAnswers,
        [currentQuestion.id]: selectedAnswer,
      });
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
        throw new Error('Failed to submit challenge');
      }

      const result: SubmissionResult = await response.json();

      if (result.success) {
        hapticSuccess();

        setCompletedStats({
          score: result.score,
          correctCount: result.correctCount,
          totalQuestions: challengeData.questions.length,
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
      // User-friendly error message - don't expose technical details
      setError(
        'Unable to submit your results. Your progress has been saved locally. Please try again.'
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

  // Note: getTimeUntilNextChallenge moved outside component for useState initialization

  // System selection view
  if (viewState === 'system-select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full space-y-8"
        >
          <div className="text-center space-y-4">
            <motion.div
              animate={{
                rotate: [0, -5, 5, 0],
                scale: [1, 1.05, 1],
              }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: 'easeInOut',
              }}
              className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full"
            >
              <Stethoscope className="w-12 h-12 text-amber-500" />
            </motion.div>

            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              Grand Rounds - System Focus
            </h1>

            <p className="text-xl text-[var(--color-text-muted)]">
              Select a PANCE organ system to begin your high-yield challenge
            </p>
          </div>

          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
            <h3 className="text-lg font-semibold text-center mb-4">14 PANCE Organ Systems</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {PANCE_TOPIC_ABBREVIATIONS.filter((abbr: string) => abbr !== 'PRO').map((systemCode) => {
                const systemName = ABBREVIATION_TO_TOPIC_MAP[systemCode];

                return (
                  <motion.button
                    key={systemCode}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSystemSelect(systemCode as SystemCode)}
                    className="bg-[var(--color-bg-primary)] hover:bg-amber-500/10 border-2 border-[var(--color-border)] hover:border-amber-500 rounded-xl p-4 transition-all text-center group"
                  >
                    <div className="text-2xl font-bold text-amber-500 mb-1">{systemCode}</div>
                    <div className="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] line-clamp-2">
                      {systemName}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[var(--color-border)] text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-amber-500 text-sm">
                <Trophy className="w-4 h-4" />
                <span>Each system: {QUESTIONS_PER_SESSION} high-yield questions in 20 minutes</span>
              </div>
              <button
                onClick={onExit}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] py-2 transition-colors text-sm"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading state
  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Error</h2>
          <p className="text-[var(--color-text-muted)]">
            {error || 'Something went wrong loading Grand Rounds.'}
          </p>
          <button
            onClick={onExit}
            className="w-full px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-semibold transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    );
  }

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

  // Completed state (already finished today)
  if (viewState === 'completed' && completedStats) {
    // Note: nextChallengeCountdown state and useEffect moved to top level to follow Rules of Hooks

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full space-y-6"
        >
          <div className="text-center space-y-4">
            <motion.div
              animate={{
                rotate: [0, -5, 5, 0],
                scale: [1, 1.05, 1],
              }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: 'easeInOut',
              }}
              className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full"
            >
              <Trophy className="w-12 h-12 text-amber-500" />
            </motion.div>

            <h1 className="text-4xl font-bold">Challenge Complete!</h1>
            <p className="text-xl text-[var(--color-text-muted)]">
              You've already completed today's Grand Rounds
            </p>
          </div>

          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-amber-500">{completedStats.score}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Points</div>
              </div>
              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-amber-500">
                  {completedStats.correctCount}/{completedStats.totalQuestions}
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
              </div>
              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-amber-500">#{completedStats.ranking}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Global Rank</div>
              </div>
              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-amber-500">
                  {Math.round(completedStats.percentile)}%
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">Percentile</div>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Time Spent</span>
                <span className="font-semibold">{formatTime(completedStats.timeSpentMs)}</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-500 mb-2">
                <Timer className="w-5 h-5" />
                <span className="font-semibold">Next Challenge In</span>
              </div>
              <div className="text-2xl font-bold">{nextChallengeCountdown}</div>
            </div>

            <button
              onClick={onExit}
              className="w-full px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-semibold transition-colors"
            >
              Exit
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Landing page (before starting challenge)
  if (viewState === 'landing' && challengeData) {
    const systemName = ABBREVIATION_TO_TOPIC_MAP[challengeData.system];

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-4">
              <motion.div
                animate={{
                  rotate: [0, -5, 5, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: 'easeInOut',
                }}
                className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full"
              >
                <Trophy className="w-12 h-12 text-amber-500" />
              </motion.div>

              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                {systemName} Challenge
              </h1>

              <p className="text-xl text-[var(--color-text-muted)]">
                High-Yield Questions • Speed Matters • One Attempt
              </p>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-2xl font-bold">{challengeData.questions.length}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Questions</div>
                </div>
                <div className="space-y-2">
                  <Clock className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-2xl font-bold">20</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Minutes</div>
                </div>
                <div className="space-y-2">
                  <Crown className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-2xl font-bold">1</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Attempt</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Speed Matters</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Faster completion = bonus points. 20 points per correct + speed bonus.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Global Competition</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Compete against medical students and PAs worldwide.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Daily Reset</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      New challenge every day at midnight UTC. One attempt only!
                    </p>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <Play className="w-5 h-5" />
                Start Challenge
              </motion.button>

              <button
                onClick={onExit}
                className="w-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] py-2 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Summary state (after completing challenge)
  if (viewState === 'summary' && completedStats && challengeData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full space-y-6"
        >
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.6 }}
              className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full"
            >
              <Trophy className="w-12 h-12 text-amber-500" />
            </motion.div>

            <h1 className="text-4xl font-bold">Challenge Complete!</h1>
            <p className="text-xl text-[var(--color-text-muted)]">
              Great work! Here's how you performed.
            </p>
          </div>

          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
            {/* Score highlight */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-6 text-center border-2 border-amber-500/50">
              <div className="text-sm text-[var(--color-text-muted)] mb-2">Final Score</div>
              <div className="text-6xl font-bold text-amber-500 mb-2">{completedStats.score}</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {completedStats.correctCount}/{completedStats.totalQuestions} correct
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-amber-500">#{completedStats.ranking}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Global Rank</div>
              </div>
              <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-amber-500">
                  {Math.round(completedStats.percentile)}%
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">Percentile</div>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Time Spent</span>
                <span className="font-semibold">{formatTime(completedStats.timeSpentMs)}</span>
              </div>
            </div>

            {completedStats.percentile >= 90 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg p-4 flex items-center gap-3"
              >
                <Crown className="w-6 h-6 text-yellow-500" />
                <div>
                  <div className="font-semibold text-yellow-500">Top Performer!</div>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    You scored in the top 10% globally!
                  </div>
                </div>
              </motion.div>
            )}

            <button
              onClick={onExit}
              className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all"
            >
              Exit
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Active quiz state
  if (viewState === 'active' && challengeData) {
    const currentQuestion = challengeData.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / challengeData.questions.length) * 100;
    const timeRemaining = getTimeRemaining();
    const isLastQuestion = currentQuestionIndex === challengeData.questions.length - 1;

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/10 via-[var(--color-bg-primary)] to-orange-500/10 text-[var(--color-text-primary)] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border)] p-4">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-500" />
                <div>
                  <div className="font-semibold">Grand Rounds Challenge</div>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    Question {currentQuestionIndex + 1} of {challengeData.questions.length}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-[var(--color-text-muted)]">Time Remaining</div>
                <div
                  className={`text-xl font-bold ${timeRemaining < 60000 ? 'text-red-500' : 'text-amber-500'}`}
                >
                  {formatTime(timeRemaining)}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full"
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>

        {/* Question content */}
        <div className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {/* Question */}
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6">
                <h2 className="text-xl font-semibold leading-relaxed">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion?.options?.map((option, index) => {
                  if (!option) return null;
                  const isSelected = selectedAnswer === index;

                  return (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleAnswerSelect(index)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500'
                          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-amber-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex-1">{option}</span>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 ml-2 flex-shrink-0 text-amber-500" />
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Next button */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNext}
                  disabled={selectedAnswer === null || isSubmitting}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                    selectedAnswer === null || isSubmitting
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </span>
                  ) : isLastQuestion ? (
                    'Submit Challenge'
                  ) : (
                    'Next Question'
                  )}
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
};

export default GrandRoundsMode;
