/**
 * Baseline Assessment Component
 * Initial diagnostic exam to establish user's knowledge baseline
 * 20 questions across mixed topics to generate initial strengths/weaknesses
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardCheck, TrendingUp, Brain, Award, ChevronRight } from 'lucide-react';

interface BaselineAssessmentProps {
  onComplete: (results: BaselineResults) => void;
  onSkip?: () => void;
}

export interface BaselineResults {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  systemBreakdown: Record<string, { correct: number; total: number; accuracy: number }>;
  weakestSystems: string[];
  strongestSystems: string[];
}

type AssessmentPhase = 'intro' | 'assessment' | 'results';

export function BaselineAssessment({ onComplete, onSkip }: BaselineAssessmentProps) {
  const [phase, setPhase] = useState<AssessmentPhase>('intro');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);

  // Predetermined mock answers for consistency (demo purposes only)
  const mockAnswers = [
    true,
    false,
    true,
    true,
    false,
    true,
    false,
    true,
    true,
    false,
    true,
    true,
    false,
    true,
    false,
    true,
    true,
    false,
    true,
    true,
  ];

  // Mock questions for demonstration
  // In production, these would be fetched from your question bank
  const totalQuestions = 20;

  const handleStartAssessment = () => {
    setPhase('assessment');
  };

  const handleAnswer = (isCorrect: boolean) => {
    const newAnswers = [...answers, isCorrect];
    setAnswers(newAnswers);

    if (newAnswers.length >= totalQuestions) {
      // Assessment complete, calculate results
      setTimeout(() => {
        calculateResults(newAnswers);
      }, 500);
    } else {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const calculateResults = (finalAnswers: boolean[]) => {
    const correctCount = finalAnswers.filter((a) => a).length;
    const accuracy = (correctCount / totalQuestions) * 100;

    // Mock system breakdown
    const systemBreakdown = {
      CV: { correct: 3, total: 4, accuracy: 75 },
      PULM: { correct: 2, total: 3, accuracy: 66.7 },
      GI: { correct: 4, total: 4, accuracy: 100 },
      NEURO: { correct: 1, total: 3, accuracy: 33.3 },
      RENAL: { correct: 2, total: 2, accuracy: 100 },
      MSK: { correct: 1, total: 2, accuracy: 50 },
      DERM: { correct: 1, total: 2, accuracy: 50 },
    };

    // Sort systems by accuracy
    const sorted = Object.entries(systemBreakdown).sort(([, a], [, b]) => b.accuracy - a.accuracy);

    const results: BaselineResults = {
      totalQuestions,
      correctAnswers: correctCount,
      accuracy,
      systemBreakdown,
      strongestSystems: sorted.slice(0, 3).map(([sys]) => sys),
      weakestSystems: sorted
        .slice(-3)
        .map(([sys]) => sys)
        .reverse(),
    };

    setPhase('results');

    // Wait a moment before calling onComplete to show results
    setTimeout(() => {
      onComplete(results);
    }, 5000);
  };

  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-2xl w-full p-8"
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-[var(--color-accent)]/20 rounded-full">
              <ClipboardCheck className="w-12 h-12 text-[var(--color-accent)]" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] text-center mb-4">
            Welcome to PANaCEa
          </h2>

          <p className="text-lg text-[var(--color-text-muted)] text-center mb-8">
            Let's establish your baseline with a brief diagnostic assessment
          </p>

          {/* Benefits */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <Brain className="w-6 h-6 text-[var(--color-accent)] flex-shrink-0 mt-1" />
              <div>
                <div className="font-medium text-[var(--color-text-primary)] mb-1">
                  Personalized Learning Path
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  We'll identify your strengths and areas for growth to create a tailored study plan
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 text-[var(--color-accent)] flex-shrink-0 mt-1" />
              <div>
                <div className="font-medium text-[var(--color-text-primary)] mb-1">
                  Track Your Progress
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Measure improvement from day one with detailed analytics
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Award className="w-6 h-6 text-[var(--color-accent)] flex-shrink-0 mt-1" />
              <div>
                <div className="font-medium text-[var(--color-text-primary)] mb-1">
                  Quick Assessment
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Just 20 questions covering core medical systems (10-15 minutes)
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleStartAssessment}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors font-medium"
            >
              Start Assessment
              <ChevronRight className="w-5 h-5" />
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-6 py-3 border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === 'assessment') {
    const progress = ((currentQuestion + 1) / totalQuestions) * 100;

    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-3xl w-full p-8"
        >
          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-[var(--color-text-muted)] mb-2">
              <span>Baseline Assessment</span>
              <span>
                {currentQuestion + 1} of {totalQuestions}
              </span>
            </div>
            <div className="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* Mock Question Display */}
          <div className="text-center py-12">
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mb-8">
              Question {currentQuestion + 1}
            </div>
            <p className="text-[var(--color-text-muted)] mb-8">
              In a production app, this would display actual questions from your question bank.
            </p>

            {/* Mock Answer Buttons */}
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <button
                onClick={() => handleAnswer(mockAnswers[currentQuestion] ?? false)}
                className="p-4 bg-[var(--color-bg-secondary)] rounded-lg hover:bg-[var(--color-bg-secondary)]/80 transition-colors text-[var(--color-text-primary)] border border-[var(--color-border)]"
              >
                Option A
              </button>
              <button
                onClick={() => handleAnswer(!(mockAnswers[currentQuestion] ?? true))}
                className="p-4 bg-[var(--color-bg-secondary)] rounded-lg hover:bg-[var(--color-bg-secondary)]/80 transition-colors text-[var(--color-text-primary)] border border-[var(--color-border)]"
              >
                Option B
              </button>
              <button
                onClick={() => handleAnswer(mockAnswers[currentQuestion] ?? false)}
                className="p-4 bg-[var(--color-bg-secondary)] rounded-lg hover:bg-[var(--color-bg-secondary)]/80 transition-colors text-[var(--color-text-primary)] border border-[var(--color-border)]"
              >
                Option C
              </button>
              <button
                onClick={() => handleAnswer(!(mockAnswers[currentQuestion] ?? true))}
                className="p-4 bg-[var(--color-bg-secondary)] rounded-lg hover:bg-[var(--color-bg-secondary)]/80 transition-colors text-[var(--color-text-primary)] border border-[var(--color-border)]"
              >
                Option D
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Results phase
  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-2xl w-full p-8"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex justify-center mb-6"
        >
          <div className="p-4 bg-green-500/20 rounded-full">
            <ClipboardCheck className="w-12 h-12 text-green-500" />
          </div>
        </motion.div>

        <h2 className="text-3xl font-bold text-[var(--color-text-primary)] text-center mb-2">
          Assessment Complete
        </h2>

        <p className="text-[var(--color-text-muted)] text-center mb-8">
          Your personalized learning profile is being generated...
        </p>

        {/* Loading animation */}
        <div className="flex justify-center">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                className="w-3 h-3 bg-[var(--color-accent)] rounded-full"
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
