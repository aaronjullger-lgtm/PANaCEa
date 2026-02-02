/**
 * Baseline Assessment Component
 * Initial diagnostic exam using real questions from the question bank.
 * Fetches 20 questions via GET /api/baseline/questions and submits via POST /api/baseline/submit.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardCheck, TrendingUp, Brain, Award, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

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

type AssessmentPhase = 'intro' | 'loading' | 'assessment' | 'submitting' | 'results';

interface BaselineQuestion {
  id: string;
  question: string;
  options: string[];
  system: string;
}

export function BaselineAssessment({ onComplete, onSkip }: BaselineAssessmentProps) {
  const { getToken } = useAuth();
  const [phase, setPhase] = useState<AssessmentPhase>('intro');
  const [questions, setQuestions] = useState<BaselineQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ questionId: string; selectedIndex: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BaselineResults | null>(null);

  const totalQuestions = questions.length;

  const fetchQuestions = useCallback(async () => {
    setError(null);
    setPhase('loading');
    try {
      const token = await getToken();
      if (!token) {
        setError('Please sign in to start the assessment.');
        setPhase('intro');
        return;
      }
      const res = await fetch('/api/baseline/questions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const list = data?.data?.questions ?? data?.questions ?? [];
      if (!Array.isArray(list) || list.length === 0) {
        setError('No baseline questions available. Try again later.');
        setPhase('intro');
        return;
      }
      setQuestions(list);
      setPhase('assessment');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load questions');
      setPhase('intro');
    }
  }, [getToken]);

  const handleStartAssessment = () => {
    void fetchQuestions();
  };

  const handleAnswer = (selectedIndex: number) => {
    const q = questions[currentIndex];
    if (!q) return;
    const newAnswers = [...answers, { questionId: q.id, selectedIndex }];
    setAnswers(newAnswers);

    if (newAnswers.length >= questions.length) {
      submitAndShowResults(newAnswers);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const submitAndShowResults = async (
    finalAnswers: Array<{ questionId: string; selectedIndex: number }>
  ) => {
    setPhase('submitting');
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError('Session expired. Please sign in again.');
        setPhase('assessment');
        return;
      }
      const res = await fetch('/api/baseline/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Submit failed (${res.status})`);
      }
      const data = await res.json();
      const payload = data?.data ?? data;
      const baselineResults: BaselineResults = {
        totalQuestions: payload.totalQuestions ?? finalAnswers.length,
        correctAnswers: payload.correctAnswers ?? 0,
        accuracy: payload.accuracy ?? 0,
        systemBreakdown: payload.systemBreakdown ?? {},
        weakestSystems: Array.isArray(payload.weakestSystems) ? payload.weakestSystems : [],
        strongestSystems: Array.isArray(payload.strongestSystems) ? payload.strongestSystems : [],
      };
      setResults(baselineResults);
      setPhase('results');
      setTimeout(() => onComplete(baselineResults), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit assessment');
      setPhase('assessment');
    }
  };

  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-2xl w-full p-8"
        >
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-[var(--color-accent)]/20 rounded-full">
              <ClipboardCheck className="w-12 h-12 text-[var(--color-accent)]" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] text-center mb-4">
            Welcome to PANaCEa
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] text-center mb-8">
            Let's establish your baseline with a brief diagnostic assessment
          </p>
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
          {error && (
            <p className="text-[var(--color-data-fail)] text-sm mb-4 text-center">{error}</p>
          )}
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

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          <Loader2 className="w-12 h-12 text-[var(--color-accent)] animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-text-primary)] font-medium">Loading assessment...</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Preparing your baseline questions
          </p>
        </motion.div>
      </div>
    );
  }

  if (phase === 'assessment' && questions.length > 0) {
    const q = questions[currentIndex];
    const progress = ((currentIndex + 1) / totalQuestions) * 100;

    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-3xl w-full p-8 max-h-[90vh] overflow-y-auto"
        >
          <div className="mb-6">
            <div className="flex justify-between text-sm text-[var(--color-text-muted)] mb-2">
              <span>Baseline Assessment</span>
              <span>
                {currentIndex + 1} of {totalQuestions}
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

          {q && (
            <>
              <p className="text-[var(--color-text-primary)] text-lg mb-6 whitespace-pre-wrap">
                {q.question}
              </p>
              <div className="grid gap-3">
                {q.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className="text-left p-4 bg-[var(--color-bg-secondary)] rounded-xl hover:bg-[var(--color-bg-secondary)]/80 transition-colors text-[var(--color-text-primary)] border border-[var(--color-border)]"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  if (phase === 'submitting') {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          <Loader2 className="w-12 h-12 text-[var(--color-accent)] animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-text-primary)] font-medium">Calculating your results...</p>
        </motion.div>
      </div>
    );
  }

  if (phase === 'results' && results) {
    return (
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-2xl w-full p-8"
        >
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
          <p className="text-[var(--color-text-muted)] text-center mb-4">
            You got {results.correctAnswers} of {results.totalQuestions} correct (
            {results.accuracy.toFixed(0)}%)
          </p>
          {results.weakestSystems.length > 0 && (
            <p className="text-sm text-[var(--color-text-muted)] text-center mb-8">
              Focus areas: {results.weakestSystems.join(', ')}
            </p>
          )}
          <div className="flex justify-center">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-3 h-3 bg-[var(--color-accent)] rounded-full"
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
