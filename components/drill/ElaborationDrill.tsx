/**
 * ElaborationDrill — Elaborative Interrogation Drill Component
 *
 * Shows a clinical fact and asks the student to explain WHY it's true
 * via free-text input. Graded by Gemini on a 0-3 rubric.
 *
 * @see hooks/game/use-elaboration-drill.ts
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Send,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { useElaborationDrill } from '@/hooks/game/use-elaboration-drill';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { QuestionSkeleton, InlineSpinner } from '@/components/loading';
import DrillShell from './DrillShell';
import DrillSummaryCard from './DrillSummaryCard';
import { ROUTES } from '@/config/routes';

interface ElaborationDrillProps {
  onExit?: () => void;
}

const SCORE_COLORS: Record<number, string> = {
  0: 'var(--color-data-fail, #ef4444)',
  1: 'var(--color-data-provisional, #f59e0b)',
  2: 'var(--color-accent, #3b82f6)',
  3: 'var(--color-data-pass, #22c55e)',
};

const SCORE_LABELS: Record<number, string> = {
  0: 'Needs Work',
  1: 'Partial',
  2: 'Good',
  3: 'Excellent',
};

export default function ElaborationDrill({ onExit }: ElaborationDrillProps) {
  const [showSummary, setShowSummary] = useState(false);
  const {
    currentFact,
    status,
    explanation,
    gradeResult,
    score,
    totalAttempts,
    isLoading,
    hintUsed,
    setExplanation,
    submitExplanation,
    useHint,
    nextFact,
    startSession,
    reset,
  } = useElaborationDrill();

  const handleBackToHub = () => {
    if (totalAttempts > 0 && !showSummary) {
      setShowSummary(true);
      return;
    }
    onExit?.();
  };
  const breadcrumb = ['Practice', 'Elaborative Interrogation'];

  // Summary
  if (showSummary) {
    return (
      <DrillShell
        title="Elaborative Interrogation — Complete"
        breadcrumb={['Practice', 'Elaborative Interrogation', 'Results']}
        onBackToHub={() => onExit?.()}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName="Elaborative Interrogation"
          icon={Lightbulb}
          accentColor="var(--color-accent)"
          stats={{ correct: score, total: totalAttempts, streak: 0 }}
          onNewSession={() => { setShowSummary(false); reset(); startSession(); }}
          onExit={() => onExit?.()}
          newSessionLabel="Practice More"
        />
      </DrillShell>
    );
  }

  // Landing
  if (status === 'landing') {
    return (
      <DrillShell
        title="Elaborative Interrogation"
        breadcrumb={breadcrumb}
        onBackToHub={handleBackToHub}
        backTo={ROUTES.PRACTICE}
      >
        <DrillLandingPage
          title="Elaborative Interrogation"
          description="Research shows that explaining WHY something is true produces 2-3x better retention than passive review. You'll see a clinical fact and must explain the underlying mechanism before the answer is revealed."
          icon={Lightbulb}
          onStart={startSession}
        />
      </DrillShell>
    );
  }

  // Loading
  if (isLoading && !currentFact) {
    return (
      <DrillShell title="Elaborative Interrogation" breadcrumb={breadcrumb} onBackToHub={handleBackToHub} backTo={ROUTES.PRACTICE}>
        <QuestionSkeleton />
      </DrillShell>
    );
  }

  if (!currentFact) return null;

  return (
    <DrillShell
      title="Elaborative Interrogation"
      breadcrumb={breadcrumb}
      onBackToHub={handleBackToHub}
      backTo={ROUTES.PRACTICE}
      headerContent={<span className="text-sm text-[var(--color-text-muted)]">{currentFact.system}</span>}
    >
      <div className="max-w-2xl mx-auto py-6 space-y-6">
        {/* Score bar */}
        <div className="flex items-center justify-between text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
          <span>Score: {score}/{totalAttempts}</span>
          <span>{currentFact.system}</span>
        </div>

        {/* Fact card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl border"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Explain why this is true:
              </p>
              <p className="text-base font-semibold leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                {currentFact.fact}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Hint (rubric keywords) */}
        {hintUsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 rounded-lg border"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-secondary))',
              borderColor: 'var(--color-accent)',
              opacity: 0.8,
            }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
              Key concepts to address: {currentFact.gradingRubric.join(', ')}
            </p>
          </motion.div>
        )}

        {/* Input area (pre-grading) */}
        {(status === 'fact_presented' || status === 'typing') && (
          <div className="space-y-3">
              <textarea
                value={explanation}
                onChange={(e) => {
                  setExplanation(e.target.value);
                }}
              placeholder="Explain the mechanism behind this clinical fact..."
              rows={5}
              className="w-full p-4 rounded-lg border text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {!hintUsed && (
                  <button
                    onClick={useHint}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors hover:border-[var(--color-accent)]/40"
                    style={{
                      color: 'var(--color-text-secondary)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Show Hint (FSRS penalty)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {explanation.length} chars
                </span>
                <button
                  onClick={submitExplanation}
                  disabled={explanation.trim().length < 10 || isLoading}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-all disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  <Send className="w-4 h-4" />
                  {isLoading ? 'Grading...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Grading spinner */}
        {status === 'grading' && (
          <div className="text-center py-8" role="status" aria-live="polite">
            <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
            <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>
              Grading your explanation...
            </p>
          </div>
        )}

        {/* Feedback */}
        <AnimatePresence>
          {status === 'feedback' && gradeResult && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Score badge */}
              <div className="flex items-center gap-3 p-4 rounded-lg border" style={{ borderColor: SCORE_COLORS[gradeResult.score] }}>
                {gradeResult.score >= 2 ? (
                  <CheckCircle className="w-6 h-6" style={{ color: SCORE_COLORS[gradeResult.score] }} />
                ) : (
                  <XCircle className="w-6 h-6" style={{ color: SCORE_COLORS[gradeResult.score] }} />
                )}
                <div>
                  <span className="text-lg font-bold" style={{ color: SCORE_COLORS[gradeResult.score] }}>
                    {gradeResult.score}/{gradeResult.maxScore}
                  </span>
                  <span className="ml-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {SCORE_LABELS[gradeResult.score]}
                  </span>
                </div>
              </div>

              {/* AI feedback */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                  {gradeResult.feedback}
                </p>
              </div>

              {/* Missing concepts */}
              {gradeResult.missingConcepts.length > 0 && (
                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--color-data-provisional)' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-data-provisional)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-data-provisional)' }}>
                      Missing Concepts
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {gradeResult.missingConcepts.join(' · ')}
                  </p>
                </div>
              )}

              {/* Model explanation */}
              {gradeResult.modelExplanation && (
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Complete Explanation
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                    {gradeResult.modelExplanation}
                  </p>
                </div>
              )}

              {/* Next button */}
              <button
                onClick={nextFact}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-md transition-colors"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                }}
              >
                Next Fact
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DrillShell>
  );
}
