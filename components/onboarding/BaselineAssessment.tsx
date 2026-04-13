/**
 * Baseline Assessment Component
 * Initial diagnostic exam using real questions from the question bank.
 * Fetches 20 questions via GET /api/baseline/questions and submits via POST /api/baseline/submit.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springs, buttonPressVariants } from '@/config/appViews';
import { ClipboardCheck, TrendingUp, Brain, Award, ChevronRight } from 'lucide-react';
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
      const data = (await res.json()) as {
        data?: { questions?: unknown[] };
        questions?: unknown[];
      };
      const list = (data?.data?.questions ?? data?.questions ?? []) as BaselineQuestion[];
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
      const data = (await res.json()) as {
        data?: Record<string, unknown>;
        totalQuestions?: number;
        correctAnswers?: number;
        accuracy?: number;
        systemBreakdown?: Record<string, unknown>;
        weakestSystems?: unknown[];
        strongestSystems?: unknown[];
      };
      const payload = data?.data ?? data;
      const baselineResults: BaselineResults = {
        totalQuestions:
          typeof payload.totalQuestions === 'number' ? payload.totalQuestions : finalAnswers.length,
        correctAnswers: typeof payload.correctAnswers === 'number' ? payload.correctAnswers : 0,
        accuracy: typeof payload.accuracy === 'number' ? payload.accuracy : 0,
        systemBreakdown: (payload.systemBreakdown && typeof payload.systemBreakdown === 'object'
          ? payload.systemBreakdown
          : {}) as Record<string, { correct: number; total: number; accuracy: number }>,
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
      <motion.div
        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
        transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
        className="fixed inset-0 bg-[var(--color-overlay)] z-[60] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12, filter: 'blur(8px)' }}
          animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ ...springs.bouncy, opacity: { duration: 0.2 }, filter: { duration: 0.25 } }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-2xl w-full p-8 border border-[var(--color-border)]"
        >
          {/* Icon entrance with bouncy rotation */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...springs.bouncy, delay: 0.15 }}
            className="flex justify-center mb-6"
          >
            <div className="p-4 bg-[var(--color-accent)]/20 rounded-full">
              <ClipboardCheck className="w-12 h-12 text-[var(--color-accent)]" />
            </div>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ ...springs.snappy, delay: 0.2 }}
            className="text-3xl font-bold text-[var(--color-text-primary)] text-center mb-4"
          >
            Welcome to PANaCEa
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ ...springs.snappy, delay: 0.25 }}
            className="text-lg text-[var(--color-text-muted)] text-center mb-8"
          >
            Let's establish your baseline with a brief diagnostic assessment
          </motion.p>
          <div className="space-y-4 mb-8">
            {[
              { icon: Brain, title: 'Personalized Learning Path', desc: "We'll identify your strengths and areas for growth to create a tailored study plan" },
              { icon: TrendingUp, title: 'Track Your Progress', desc: 'Measure improvement from day one with detailed analytics' },
              { icon: Award, title: 'Quick Assessment', desc: 'Just 20 questions covering core medical systems (10-15 minutes)' },
            ].map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -16, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  transition={{ ...springs.snappy, delay: 0.3 + i * 0.08 }}
                  className="flex items-start gap-3"
                >
                  <ItemIcon className="w-6 h-6 text-[var(--color-accent)] flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-medium text-[var(--color-text-primary)] mb-1">{item.title}</div>
                    <div className="text-sm text-[var(--color-text-muted)]">{item.desc}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[var(--color-data-fail)] text-sm mb-4 text-center"
            >
              {error}
            </motion.p>
          )}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.snappy, delay: 0.5 }}
            className="flex gap-3"
          >
            <motion.button
              variants={buttonPressVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleStartAssessment}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors font-medium"
            >
              Start Assessment
              <ChevronRight className="w-5 h-5" />
            </motion.button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-6 py-3 border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)] transition-colors"
              >
                Skip for now
              </button>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  if (phase === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
        transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
        className="fixed inset-0 bg-[var(--color-overlay)] z-[60] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, filter: 'blur(8px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ ...springs.bouncy, opacity: { duration: 0.2 }, filter: { duration: 0.25 } }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-md w-full p-8 text-center border border-[var(--color-border)]"
        >
          {/* Orbital spinner */}
          <div className="relative w-12 h-12 mx-auto mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-accent)]"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-[var(--color-accent)]/40"
            />
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />
            </motion.div>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.snappy, delay: 0.15 }}
            className="text-[var(--color-text-primary)] font-medium"
          >
            Loading assessment...
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.snappy, delay: 0.2 }}
            className="text-sm text-[var(--color-text-muted)] mt-1"
          >
            Preparing your baseline questions
          </motion.p>
        </motion.div>
      </motion.div>
    );
  }

  if (phase === 'assessment' && questions.length > 0) {
    const q = questions[currentIndex];
    const progress = ((currentIndex + 1) / totalQuestions) * 100;

    return (
      <motion.div
        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
        transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
        className="fixed inset-0 bg-[var(--color-overlay)] z-[60] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12, filter: 'blur(8px)' }}
          animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ ...springs.bouncy, opacity: { duration: 0.2 }, filter: { duration: 0.25 } }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-3xl w-full p-8 max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
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
                initial={{ width: 0, filter: 'blur(2px)' }}
                animate={{ width: `${progress}%`, filter: 'blur(0px)' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="h-full bg-[var(--color-accent)]"
              />
            </div>
          </div>

          {q && (
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 20, filter: 'blur(4px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -20, filter: 'blur(4px)', transition: { duration: 0.15 } }}
                transition={springs.snappy}
              >
                <p className="text-[var(--color-text-primary)] text-lg mb-6 whitespace-pre-wrap">
                  {q.question}
                </p>
                <div className="grid gap-3">
                  {q.options.map((opt, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, x: -12, filter: 'blur(3px)' }}
                      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                      transition={{ ...springs.snappy, delay: 0.05 + idx * 0.04 }}
                      whileHover={{ x: 4, transition: springs.snappy }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAnswer(idx)}
                      className="text-left p-4 bg-[var(--color-bg-secondary)] rounded-xl hover:bg-[var(--color-bg-secondary)]/80 transition-colors text-[var(--color-text-primary)] border border-[var(--color-border)]"
                    >
                      {opt}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </motion.div>
    );
  }

  if (phase === 'submitting') {
    return (
      <motion.div
        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
        transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
        className="fixed inset-0 bg-[var(--color-overlay)] z-[60] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, filter: 'blur(8px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ ...springs.bouncy, opacity: { duration: 0.2 }, filter: { duration: 0.25 } }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-md w-full p-8 text-center border border-[var(--color-border)]"
        >
          {/* Orbital spinner */}
          <div className="relative w-12 h-12 mx-auto mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-accent)]"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-[var(--color-accent)]/40"
            />
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />
            </motion.div>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.snappy, delay: 0.15 }}
            className="text-[var(--color-text-primary)] font-medium"
          >
            Calculating your results...
          </motion.p>
        </motion.div>
      </motion.div>
    );
  }

  if (phase === 'results' && results) {
    return (
      <motion.div
        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
        transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
        className="fixed inset-0 bg-[var(--color-overlay)] z-[60] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12, filter: 'blur(8px)' }}
          animate={{
            scale: 1, opacity: 1, y: 0, filter: 'blur(0px)',
            boxShadow: [
              '0 18px 42px var(--color-shadow-soft)',
              '0 18px 42px var(--color-shadow-soft), 0 0 40px rgba(196, 183, 138, 0.2)',
              '0 18px 42px var(--color-shadow-soft), 0 0 20px rgba(196, 183, 138, 0.1)',
            ],
          }}
          transition={{ ...springs.bouncy, opacity: { duration: 0.2 }, filter: { duration: 0.25 }, boxShadow: { duration: 1.2, times: [0, 0.5, 1] } }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl max-w-2xl w-full p-8 border border-[var(--color-border)]"
        >
          {/* Icon — bouncy with rotation */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...springs.bouncy, delay: 0.15 }}
            className="flex justify-center mb-6"
          >
            <div className="p-4 bg-[var(--color-data-pass)]/20 rounded-full">
              <ClipboardCheck className="w-12 h-12 text-[var(--color-data-pass)]" />
            </div>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ ...springs.snappy, delay: 0.25 }}
            className="text-3xl font-bold text-[var(--color-text-primary)] text-center mb-2"
          >
            Assessment Complete
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ ...springs.snappy, delay: 0.3 }}
            className="text-[var(--color-text-muted)] text-center mb-4"
          >
            You got {results.correctAnswers} of {results.totalQuestions} correct (
            {results.accuracy.toFixed(0)}%)
          </motion.p>
          {results.weakestSystems.length > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ ...springs.snappy, delay: 0.35 }}
              className="text-sm text-[var(--color-text-muted)] text-center mb-8"
            >
              Focus areas: {results.weakestSystems.join(', ')}
            </motion.p>
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
      </motion.div>
    );
  }

  return null;
}
