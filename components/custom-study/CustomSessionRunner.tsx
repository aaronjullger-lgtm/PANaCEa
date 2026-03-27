/**
 * Custom Session Runner
 *
 * The quiz interface for custom study sessions.
 * Handles question display, answer submission, and retry logic.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Target,
  Loader2,
} from 'lucide-react';
import type { Question } from '../../types';
import type { CustomSessionConfig, CustomSessionState } from '../../types/custom-session';
import { customSessionService } from '@/services/core';

interface Props {
  config: CustomSessionConfig;
  onEnd: () => void;
}

type Phase = 'loading' | 'question' | 'feedback' | 'increment-complete' | 'error';

export default function CustomSessionRunner({ config, onEnd }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionState, setSessionState] = useState<CustomSessionState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionStartTime = useRef<number>(Date.now());

  // Initialize session
  useEffect(() => {
    async function initSession() {
      try {
        setPhase('loading');
        const state = await customSessionService.startSession(config);
        setSessionState(state);

        const question = customSessionService.getCurrentQuestion();
        if (question) {
          setCurrentQuestion(question);
          questionStartTime.current = Date.now();
          setPhase('question');
        } else {
          setError('No questions available for your selection');
          setPhase('error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start session');
        setPhase('error');
      }
    }

    initSession();

    return () => {
      // Cleanup on unmount
      customSessionService.clearSessionState();
    };
  }, [config]);

  // Handle answer selection
  const handleSelectAnswer = (index: number) => {
    if (phase !== 'question' || selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(index);
    const correct = index === currentQuestion.correctAnswerIndex;
    setIsCorrect(correct);

    // Submit answer
    const timeSpent = Date.now() - questionStartTime.current;
    const optionAtIndex = currentQuestion.options[index];
    // Guard: array access may return undefined, provide empty string fallback
    const selectedOption: string = typeof optionAtIndex === 'string' ? optionAtIndex : '';
    // Guard: question id is required, use empty string fallback if undefined
    const questionId: string = currentQuestion.id ?? '';
    const updatedState = customSessionService.submitAnswer(
      questionId,
      selectedOption,
      correct,
      timeSpent
    );
    setSessionState(updatedState);
    setPhase('feedback');
  };

  // Handle next question
  const handleNext = () => {
    // Check if increment is complete
    if (customSessionService.isIncrementComplete()) {
      setPhase('increment-complete');
      return;
    }

    // Get next question
    const question = customSessionService.getCurrentQuestion();
    if (question) {
      setCurrentQuestion(question);
      setSelectedAnswer(null);
      setIsCorrect(null);
      questionStartTime.current = Date.now();
      setPhase('question');
    } else {
      setPhase('increment-complete');
    }
  };

  // Handle continue to next increment
  const handleContinue = async () => {
    try {
      setPhase('loading');
      const state = await customSessionService.startNextIncrement();

      if (state) {
        setSessionState(state);
        const question = customSessionService.getCurrentQuestion();
        if (question) {
          setCurrentQuestion(question);
          setSelectedAnswer(null);
          setIsCorrect(null);
          questionStartTime.current = Date.now();
          setPhase('question');
        }
      } else {
        // No more questions available
        onEnd();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue');
      setPhase('error');
    }
  };

  // Get stats
  const stats = customSessionService.getCurrentStats();
  const progress = customSessionService.getIncrementProgress();

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] mb-4" />
        <p className="text-[var(--color-text-secondary)]">Loading questions...</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="w-12 h-12 text-[var(--color-data-provisional)] mb-4" />
        <p className="text-[var(--color-text-primary)] font-medium mb-2">Oops!</p>
        <p className="text-[var(--color-text-secondary)] mb-4">{error}</p>
        <button
          onClick={onEnd}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)]"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (phase === 'increment-complete') {
    return <IncrementComplete stats={stats} onContinue={handleContinue} onEnd={onEnd} />;
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {stats?.isRetryPhase && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)] rounded-full text-sm font-medium">
              <RotateCcw className="w-4 h-4" />
              Retry Phase
            </div>
          )}
          <div className="text-sm text-[var(--color-text-secondary)]">
            Round {stats?.currentIncrement}
          </div>
        </div>

        <button onClick={onEnd} className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]">
          <X className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-[var(--color-accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between mb-6 text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[var(--color-data-pass)]">
            <CheckCircle className="w-4 h-4" />
            {stats?.correctCount}
          </div>
          <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
            <Target className="w-4 h-4" />
            {stats?.accuracy.toFixed(0)}%
          </div>
        </div>
        {stats && stats.retryQueueSize && stats.retryQueueSize > 0 && !stats.isRetryPhase && (
          <div className="text-[var(--color-data-provisional)] text-sm">
            {stats.retryQueueSize} to retry
          </div>
        )}
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion?.id}
          initial={{ y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-lg p-6"
        >
          {/* Question Text */}
          <div className="mb-6">
            <p className="text-sm text-[var(--color-category-practice)] mb-2">
              {currentQuestion?.condition || currentQuestion?.topic}
            </p>
            <p className="text-lg text-[var(--color-text-primary)]">{currentQuestion?.question}</p>
          </div>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion?.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSelectAnswer(index)}
                disabled={phase === 'feedback'}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  phase === 'feedback'
                    ? index === currentQuestion.correctAnswerIndex
                      ? 'bg-data-pass dark:bg-data-pass/30 border-2 border-data-pass'
                      : index === selectedAnswer && !isCorrect
                        ? 'bg-[var(--color-data-fail)]/10 border-2 border-[var(--color-data-fail)]'
                        : 'bg-data-neutral dark:bg-data-neutral opacity-50'
                    : selectedAnswer === index
                      ? 'bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] border-2 border-[var(--color-category-practice)]'
                      : 'bg-data-neutral dark:bg-data-neutral hover:bg-data-neutral dark:hover:bg-data-neutral border-2 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-data-neutral dark:bg-data-neutral text-sm font-medium">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 text-[var(--color-text-primary)]">{option}</span>
                  {phase === 'feedback' && index === currentQuestion.correctAnswerIndex && (
                    <CheckCircle className="w-5 h-5 text-data-pass" />
                  )}
                  {phase === 'feedback' && index === selectedAnswer && !isCorrect && (
                    <XCircle className="w-5 h-5 text-[var(--color-data-fail)]" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Feedback & Rationale */}
          {phase === 'feedback' && currentQuestion?.rationale && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 p-4 bg-data-neutral dark:bg-data-neutral/50 rounded-xl"
            >
              <p className="text-sm font-medium text-data-neutral dark:text-data-neutral mb-2">
                Explanation
              </p>
              <p className="text-sm text-data-neutral dark:text-data-neutral">
                {currentQuestion.rationale}
              </p>
            </motion.div>
          )}

          {/* Next Button */}
          {phase === 'feedback' && (
            <motion.div
             
              animate={{ opacity: 1 }}
              className="mt-6 flex justify-end"
            >
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-category-practice)] text-white rounded-lg hover:bg-[var(--color-category-practice)] transition-colors"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// INCREMENT COMPLETE SCREEN
// ============================================================================

interface IncrementCompleteProps {
  stats: ReturnType<typeof customSessionService.getCurrentStats>;
  onContinue: () => void;
  onEnd: () => void;
}

function IncrementComplete({ stats, onContinue, onEnd }: IncrementCompleteProps) {
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-lg p-6 text-center">
        <div className="w-16 h-16 bg-data-pass dark:bg-data-pass/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-data-pass" />
        </div>

        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Round {stats?.currentIncrement} Complete!
        </h2>

        <div className="grid grid-cols-2 gap-4 my-6">
          <div className="p-4 bg-data-neutral dark:bg-data-neutral/50 rounded-xl">
            <div className="text-2xl font-bold text-data-pass dark:text-data-pass">
              {stats?.correctCount}
            </div>
            <div className="text-sm text-data-neutral dark:text-data-neutral">Correct</div>
          </div>
          <div className="p-4 bg-data-neutral dark:bg-data-neutral/50 rounded-xl">
            <div className="text-2xl font-bold text-[var(--color-category-practice)]">
              {stats?.accuracy.toFixed(0)}%
            </div>
            <div className="text-sm text-data-neutral dark:text-data-neutral">Accuracy</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onEnd}
            className="flex-1 px-4 py-2 border border-data-neutral dark:border-data-neutral rounded-lg text-data-neutral dark:text-data-neutral hover:bg-data-neutral dark:hover:bg-data-neutral"
          >
            End Session
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 bg-[var(--color-category-practice)] text-white rounded-lg hover:bg-[var(--color-category-practice)]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
