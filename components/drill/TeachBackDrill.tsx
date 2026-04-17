/**
 * TeachBackDrill — Teach-Back Mode Component
 *
 * A drill that leverages the generation effect: students explain well-learned
 * clinical topics as if teaching a classmate. Graded by AI on a 4-category rubric.
 *
 * Flow: Landing → Topic Presented → Typing → Grading → Feedback → Next/Summary
 *
 * Research:
 * - Fiorella & Mayer (2016): Learning by explaining improves understanding
 * - Chi et al. (1994): Self-explanation effect
 *
 * @see hooks/game/use-teachback-drill.ts
 * @see functions/api/drills/teachback/generate.ts
 * @see functions/api/drills/teachback/grade.ts
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  MessageSquare,
  Send,
  Lightbulb,
  ChevronRight,
  Award,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import DrillShell from '@/components/drill/DrillShell';
import DrillSummaryCard from '@/components/drill/DrillSummaryCard';
import { ROUTES } from '@/config/routes';
import {
  useTeachBackDrill,
  type TeachBackStatus,
  type CategoryScore,
} from '@/hooks/game/use-teachback-drill';

interface TeachBackDrillProps {
  onBackToHub: () => void;
}

export function TeachBackDrill({ onBackToHub }: TeachBackDrillProps) {
  const drill = useTeachBackDrill();
  const prefersReducedMotion = useReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const handleExit = () => {
    if (drill.sessionStats.topicsAttempted > 0 && !showSummary) {
      setShowSummary(true);
      return;
    }
    onBackToHub();
  };

  // Auto-focus textarea when topic is presented
  useEffect(() => {
    if (drill.status === 'topic_presented' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [drill.status]);

  const motionProps = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  if (showSummary) {
    return (
      <DrillShell
        title="Teach-Back — Complete"
        breadcrumb={['Practice', 'Teach-Back', 'Results']}
        onBackToHub={onBackToHub}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName="Teach-Back"
          icon={GraduationCap}
          accentColor="var(--color-accent)"
          stats={{
            correct: drill.sessionStats.topicsPassed,
            total: drill.sessionStats.topicsAttempted,
            streak: 0,
          }}
          onNewSession={() => { setShowSummary(false); drill.reset(); drill.startSession(); }}
          onExit={onBackToHub}
          newSessionLabel="Practice More"
        />
      </DrillShell>
    );
  }

  return (
    <DrillShell
      title="Teach-Back Mode"
      breadcrumb={['Practice', 'Teach-Back']}
      onBackToHub={handleExit}
      headerContent={
        drill.sessionStats.topicsAttempted > 0 ? (
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span>{drill.sessionStats.topicsPassed}/{drill.sessionStats.topicsAttempted} passed</span>
            {drill.sessionStats.maxPossibleScore > 0 && (
              <span>
                {Math.round((drill.sessionStats.totalScore / drill.sessionStats.maxPossibleScore) * 100)}% avg
              </span>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="max-w-3xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* Landing */}
          {drill.status === 'landing' && (
            <motion.div key="landing" {...motionProps} className="text-center py-12">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
              >
                <GraduationCap className="w-8 h-8" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Teach-Back Mode
              </h2>
              <p className="text-base mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                The best way to solidify knowledge is to teach it.
              </p>
              <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                You'll be given a clinical topic you've shown mastery in. Explain it as if
                teaching a classmate — our AI will grade your explanation across 4 clinical categories.
              </p>
              <button
                onClick={drill.startSession}
                disabled={drill.isLoading}
                className="px-6 py-3 rounded-xl text-base font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-btn-primary-text)',
                }}
              >
                {drill.isLoading ? 'Loading topic...' : 'Start Teaching'}
              </button>
              {drill.error && (
                <p className="mt-4 text-sm" style={{ color: 'var(--color-data-fail)' }}>{drill.error}</p>
              )}
            </motion.div>
          )}

          {/* Topic Presented / Typing */}
          {(drill.status === 'topic_presented' || drill.status === 'typing') && drill.currentTopic && (
            <motion.div key="topic" {...motionProps}>
              {/* Topic card */}
              <div
                className="rounded-xl border p-5 mb-6"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <MessageSquare className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {drill.currentTopic.topic}
                      </h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        {drill.currentTopic.system}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {drill.currentTopic.prompt}
                    </p>
                  </div>
                </div>

                {/* Hint */}
                {drill.hintUsed && (
                  <div
                    className="mt-3 p-3 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-data-provisional) 10%, transparent)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <Lightbulb className="w-4 h-4 inline mr-1.5" style={{ color: 'var(--color-data-provisional)' }} />
                    Key concepts to cover: {drill.currentTopic.expectedConcepts.slice(0, 2).join(', ')}...
                  </div>
                )}
              </div>

              {/* Textarea */}
              <div className="mb-4">
                <label htmlFor="teachback-explanation" className="sr-only">
                  Your explanation
                </label>
                <textarea
                  id="teachback-explanation"
                  ref={textareaRef}
                  value={drill.explanation}
                  onChange={(e) => {
                    drill.setExplanation(e.target.value);
                    if (drill.status === 'topic_presented' && e.target.value.length > 0) {
                      // Status stays the same, just tracking
                    }
                  }}
                  placeholder="Start your explanation here... Aim for 3-5 sentences covering the key clinical points."
                  rows={8}
                  className="w-full p-4 rounded-xl border text-sm resize-y focus:outline-none focus:ring-2 transition-colors"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                    // @ts-expect-error -- CSS custom property in focus ring
                    '--tw-ring-color': 'var(--color-accent)',
                  }}
                  aria-describedby="teachback-char-count"
                />
                <div className="flex items-center justify-between mt-2">
                  <span
                    id="teachback-char-count"
                    className="text-xs"
                    style={{ color: drill.explanation.length < 20 ? 'var(--color-data-fail)' : 'var(--color-text-muted)' }}
                  >
                    {drill.explanation.length} characters {drill.explanation.length < 20 ? '(minimum 20)' : ''}
                  </span>
                  {!drill.hintUsed && (
                    <button
                      onClick={drill.useHint}
                      className="text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-80"
                      style={{ color: 'var(--color-data-provisional)' }}
                    >
                      <Lightbulb className="w-3 h-3 inline mr-1" />
                      Show hint
                    </button>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={drill.submitExplanation}
                disabled={drill.explanation.trim().length < 20 || drill.isLoading}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-btn-primary-text)',
                }}
              >
                <Send className="w-4 h-4" />
                Submit Explanation
              </button>
            </motion.div>
          )}

          {/* Grading */}
          {drill.status === 'grading' && (
            <motion.div key="grading" {...motionProps} className="text-center py-16">
              <div className="animate-pulse">
                <Sparkles className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--color-accent)' }} />
                <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Evaluating your explanation...
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Checking clinical accuracy across 4 categories
                </p>
              </div>
            </motion.div>
          )}

          {/* Feedback */}
          {drill.status === 'feedback' && drill.gradeResult && (
            <motion.div key="feedback" {...motionProps}>
              {/* Score header */}
              <div
                className="rounded-xl border p-5 mb-4 text-center"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: drill.gradeResult.passed ? 'var(--color-data-pass)' : 'var(--color-data-fail)',
                }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  {drill.gradeResult.passed ? (
                    <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--color-data-pass)' }} />
                  ) : (
                    <XCircle className="w-6 h-6" style={{ color: 'var(--color-data-fail)' }} />
                  )}
                  <span
                    className="text-lg font-bold"
                    style={{ color: drill.gradeResult.passed ? 'var(--color-data-pass)' : 'var(--color-data-fail)' }}
                  >
                    {drill.gradeResult.totalScore}/{drill.gradeResult.maxScore}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {drill.gradeResult.overallFeedback}
                </p>
              </div>

              {/* Category breakdown */}
              <div className="space-y-2 mb-4">
                {drill.gradeResult.categories.map((cat) => (
                  <CategoryScoreRow key={cat.category} category={cat} />
                ))}
              </div>

              {/* Strengths & Missing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {drill.gradeResult.strengths.length > 0 && (
                  <div
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'var(--color-data-pass)', backgroundColor: 'color-mix(in srgb, var(--color-data-pass) 5%, var(--color-bg-secondary))' }}
                  >
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-data-pass)' }}>
                      Strengths
                    </p>
                    <ul className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {drill.gradeResult.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-data-pass)' }} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {drill.gradeResult.missingConcepts.length > 0 && (
                  <div
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'var(--color-data-provisional)', backgroundColor: 'color-mix(in srgb, var(--color-data-provisional) 5%, var(--color-bg-secondary))' }}
                  >
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-data-provisional)' }}>
                      Concepts to Review
                    </p>
                    <ul className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {drill.gradeResult.missingConcepts.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <BookOpen className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-data-provisional)' }} />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Model answer toggle */}
              {drill.gradeResult.modelExplanation && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowModelAnswer(!showModelAnswer)}
                    className="text-sm font-medium flex items-center gap-1 transition-colors hover:opacity-80"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    <Award className="w-4 h-4" />
                    {showModelAnswer ? 'Hide' : 'Show'} model explanation
                  </button>
                  <AnimatePresence>
                    {showModelAnswer && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="mt-2 p-3 rounded-lg text-sm"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-secondary))',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {drill.gradeResult.modelExplanation}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={drill.nextTopic}
                  disabled={drill.isLoading}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-btn-primary-text)',
                  }}
                >
                  Next Topic <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={drill.reset}
                  className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:opacity-80 border"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DrillShell>
  );
}

/** Individual category score row with visual bar */
function CategoryScoreRow({ category }: { category: CategoryScore }) {
  const percentage = (category.score / category.maxScore) * 100;
  const color =
    category.score >= 3 ? 'var(--color-data-pass)'
    : category.score >= 2 ? 'var(--color-data-provisional)'
    : 'var(--color-data-fail)';

  return (
    <div
      className="rounded-lg border p-3"
      style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {category.category}
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {category.score}/{category.maxScore}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {category.feedback}
      </p>
    </div>
  );
}

export default TeachBackDrill;
