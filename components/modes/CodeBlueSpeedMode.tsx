/**
 * Code Blue Speed Mode Component
 *
 * Timed ACLS/PALS rapid-fire drill mode with 5 seconds per question.
 * High-intensity training for emergency cardiac and pediatric protocols.
 *
 * Database-driven: Fetches questions from /api/drills/code-blue
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Siren,
  Timer,
  CheckCircle,
  XCircle,
  Play,
  RotateCcw,
  Trophy,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';

interface CodeBlueSpeedModeProps {
  onExit?: () => void;
}

interface CodeBlueQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: 'ACLS' | 'PALS' | 'BLS' | 'Critical Care';
}

type ViewState = 'landing' | 'loading' | 'active' | 'complete' | 'error';

// ============================================================================
// API FETCHING
// ============================================================================

/**
 * Fetch Code Blue questions from the database API
 */
async function fetchCodeBlueQuestions(count: number = 10): Promise<CodeBlueQuestion[]> {
  try {
    const response = await fetch(`/api/drills/code-blue?count=${count}`);

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string;
      };
      throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    const questions = (await response.json()) as CodeBlueQuestion[];

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('No Code Blue questions available');
    }

    return questions;
  } catch (error) {
    console.error('[Code Blue] Failed to fetch questions:', error);
    throw error;
  }
}

const TIME_PER_QUESTION = 5; // seconds

const CodeBlueSpeedMode: React.FC<CodeBlueSpeedModeProps> = ({ onExit }) => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [questions, setQuestions] = useState<CodeBlueQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fetch questions and start game
  const handleStart = useCallback(async () => {
    setViewState('loading');
    setErrorMessage('');

    try {
      const fetchedQuestions = await fetchCodeBlueQuestions(10);
      setQuestions(fetchedQuestions);
      setCurrentQuestionIndex(0);
      setScore({ correct: 0, total: 0 });
      setTimeLeft(TIME_PER_QUESTION);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setIsTimeUp(false);
      setViewState('active');
    } catch (error) {
      console.error('[Code Blue] Failed to start:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load questions. Please try again.'
      );
      setViewState('error');
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (viewState !== 'active' || isSubmitted || isTimeUp) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimeUp(true);
          setIsSubmitted(true);
          hapticError();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewState, isSubmitted, isTimeUp]);

  const currentQuestion = questions[currentQuestionIndex];

  const handleSubmit = useCallback(() => {
    if (selectedAnswer === null || isSubmitted || !currentQuestion) return;

    const isCorrect = selectedAnswer === currentQuestion.correctIndex;
    setIsSubmitted(true);
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    if (isCorrect) {
      hapticSuccess();
    } else {
      hapticError();
    }
  }, [selectedAnswer, isSubmitted, currentQuestion]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setIsTimeUp(false);
      setTimeLeft(TIME_PER_QUESTION);
    } else {
      setViewState('complete');
    }
  }, [currentQuestionIndex, questions.length]);

  const handleRestart = useCallback(() => {
    handleStart();
  }, [handleStart]);

  // Auto-submit when time runs out (hooks must run unconditionally)
  useEffect(() => {
    if (isTimeUp && !isSubmitted) {
      setIsSubmitted(true);
      setScore((prev) => ({
        correct: prev.correct,
        total: prev.total + 1,
      }));
    }
  }, [isTimeUp, isSubmitted]);

  // Guard: If currentQuestion is undefined, show loading state
  if (viewState === 'active' && !currentQuestion) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Siren className="w-12 h-12 text-data-fail mx-auto animate-pulse" />
          <p className="text-[var(--color-text-muted)]">Loading question...</p>
        </div>
      </div>
    );
  }

  const handleAnswerSelect = (index: number) => {
    if (isSubmitted) return;
    setSelectedAnswer(index);
  };

  // Landing page
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-4">
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: 'easeInOut',
                }}
                className="inline-flex items-center justify-center w-24 h-24 bg-data-fail/10 rounded-full"
              >
                <Siren className="w-12 h-12 text-data-fail" />
              </motion.div>

              <h1 className="text-4xl font-bold text-data-fail">Code Blue Speed Mode</h1>

              <p className="text-xl text-[var(--color-text-muted)]">
                ACLS/PALS Rapid-Fire Challenge
              </p>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Timer className="w-5 h-5 text-data-fail mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">5 Seconds Per Question</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Think fast! Each question must be answered within 5 seconds.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-data-fail mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">ACLS & PALS Focus</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Emergency cardiac protocols and pediatric advanced life support.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-data-fail mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">High-Pressure Training</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Simulate real emergency scenarios under time pressure.
                    </p>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                className="w-full bg-data-fail hover:bg-data-fail text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-5 h-5" />
                Start Code Blue Drill
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

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center">
        <motion.div
          initial={false}
          animate={{}}
          className="text-center space-y-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="inline-flex items-center justify-center w-16 h-16 bg-data-fail/10 rounded-full"
          >
            <Siren className="w-8 h-8 text-data-fail" />
          </motion.div>
          <p className="text-[var(--color-text-muted)]">Loading questions...</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="max-w-md w-full space-y-6"
        >
          <div className="text-center space-y-4">
            <XCircle className="w-16 h-16 text-data-fail mx-auto" />
            <h2 className="text-2xl font-bold">Unable to Load Questions</h2>
            <p className="text-[var(--color-text-muted)]">{errorMessage}</p>
          </div>

          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Make sure the database is seeded with questions:
            </p>
            <code className="block bg-[var(--color-bg-primary)] p-3 rounded text-sm">
              npx ts-node scripts/seed-code-blue.ts
            </code>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              className="flex-1 bg-data-fail hover:bg-data-fail text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Try Again
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onExit}
              className="flex-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Exit
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Complete page
  if (viewState === 'complete') {
    const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-4">
              <Trophy className="w-20 h-20 text-data-fail mx-auto" aria-hidden="true" />

              <h1 className="text-4xl font-bold">Code Blue Complete!</h1>

              <p className="text-xl text-[var(--color-text-muted)]">Final Results</p>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="text-6xl font-bold text-data-fail tabular-nums">{accuracy}%</div>
                <div className="text-lg text-[var(--color-text-muted)]">
                  {score.correct} correct out of {score.total}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-data-pass mx-auto mb-2" aria-hidden="true" />
                  <div className="text-2xl font-bold tabular-nums">{score.correct}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
                </div>
                <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                  <XCircle className="w-8 h-8 text-data-fail mx-auto mb-2" aria-hidden="true" />
                  <div className="text-2xl font-bold">{score.total - score.correct}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">Missed</div>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRestart}
                  className="flex-1 bg-data-fail hover:bg-data-fail text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                >
                  <RotateCcw className="w-5 h-5" aria-hidden="true" />
                  Try Again
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onExit}
                  className="flex-1 bg-[var(--color-bg-primary)] hover:bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] font-semibold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                >
                  Exit
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Active drill page - Guard for TypeScript (currentQuestion must exist at this point)
  if (!currentQuestion) return null;

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isCorrect = selectedAnswer === currentQuestion.correctIndex;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Siren className="w-6 h-6 text-data-fail" />
              <div>
                <div className="font-semibold">Code Blue Speed</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-[var(--color-text-muted)]">Score</div>
              <div className="text-xl font-bold text-data-fail">
                {score.correct}/{score.total}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="bg-data-fail h-2 rounded-full"
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Timer */}
          <div className="flex items-center justify-center gap-2">
            <Timer
              className={`w-5 h-5 ${timeLeft <= 2 ? 'text-[var(--color-data-fail)]' : 'text-[var(--color-text-muted)]'}`}
            />
            <motion.div
              animate={{
                scale: timeLeft <= 2 ? [1, 1.1, 1] : 1,
                color: timeLeft <= 2 ? '#ef4444' : undefined,
              }}
              transition={{ repeat: timeLeft <= 2 ? Infinity : 0, duration: 0.5 }}
              className={`text-2xl font-bold ${timeLeft <= 2 ? 'text-[var(--color-data-fail)]' : ''}`}
            >
              {timeLeft}s
            </motion.div>
          </div>
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ x: 20 }}
            animate={{ x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Category badge */}
            <div className="inline-flex items-center px-3 py-1 bg-data-fail/10 text-data-fail text-sm font-medium rounded-full">
              {currentQuestion.category}
            </div>

            {/* Question */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6">
              <h2 className="text-xl font-semibold leading-relaxed">{currentQuestion.question}</h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const showResult = isSubmitted;
                const isThisCorrect = index === currentQuestion.correctIndex;

                return (
                  <motion.button
                    key={index}
                    whileHover={!isSubmitted ? { scale: 1.01 } : {}}
                    whileTap={!isSubmitted ? { scale: 0.99 } : {}}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={isSubmitted}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      showResult
                        ? isThisCorrect
                          ? 'bg-data-pass/10 border-data-pass text-data-pass'
                          : isSelected
                            ? 'bg-data-fail/10 border-data-fail text-data-fail'
                            : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] opacity-50'
                        : isSelected
                          ? 'bg-data-fail/10 border-data-fail'
                          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-data-fail/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex-1">{option}</span>
                      {showResult && isThisCorrect && (
                        <CheckCircle className="w-5 h-5 ml-2 flex-shrink-0" />
                      )}
                      {showResult && isSelected && !isThisCorrect && (
                        <XCircle className="w-5 h-5 ml-2 flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Explanation (shown after submission) */}
            {isSubmitted && (
              <motion.div
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                className={`p-4 rounded-lg ${
                  isCorrect
                    ? 'bg-data-pass/10 border-2 border-data-pass/50'
                    : 'bg-data-fail/10 border-2 border-data-fail/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-data-pass mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-data-fail mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div
                      className={`font-semibold mb-1 ${isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'}`}
                    >
                      {isTimeUp ? "Time's Up!" : isCorrect ? 'Correct!' : 'Incorrect'}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {!isSubmitted ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={selectedAnswer === null}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
                    selectedAnswer === null
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                      : 'bg-data-fail hover:bg-data-fail text-white'
                  }`}
                >
                  Submit Answer
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNext}
                  className="flex-1 bg-data-fail hover:bg-data-fail text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
                </motion.button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CodeBlueSpeedMode;
