/**
 * ICDCodingDrill — ICD-10 Coding Drill Component
 *
 * Presents clinical vignettes and asks students to select the correct ICD-10 code.
 * Wrapped in DrillShell with system filter menu.
 *
 * @see hooks/game/use-icd-drill.ts
 * @see lib/constants/high-yield-icd10.ts
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Hash, CheckCircle, XCircle, ArrowRight, Stethoscope } from 'lucide-react';
import { useICDDrill } from '@/hooks/game/use-icd-drill';
import MiniDrillLayout, { QuestionCard, AnswerOption } from './MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { QuestionSkeleton } from '@/components/loading';
import DrillShell from './DrillShell';
import DrillSummaryCard from './DrillSummaryCard';
import { ROUTES } from '@/config/routes';

interface ICDCodingDrillProps {
  onExit?: () => void;
}

export default function ICDCodingDrill({ onExit }: ICDCodingDrillProps) {
  const {
    currentQuestion,
    score,
    streak,
    totalAttempts,
    userAnswerIndex,
    isCorrect,
    status,
    selectedSystem,
    availableSystems,
    isLoading,
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    showCategoryMenu,
    fsrsNextReview,
  } = useICDDrill();

  const breadcrumbs = [
    { label: 'Practice', href: ROUTES.STUDY },
    { label: 'ICD-10 Coding' },
  ];

  // Landing page
  if (status === 'landing') {
    return (
      <DrillShell
        title="ICD-10 Coding Drill"
        subtitle="Match clinical scenarios to ICD-10-CM codes"
        breadcrumbs={breadcrumbs}
        onExit={onExit}
      >
        <DrillLandingPage
          title="ICD-10 Coding Drill"
          description="Test your knowledge of ICD-10-CM codes — a tested PANCE competency. Match clinical scenarios to the correct diagnostic code from plausible same-system options."
          icon={<Hash className="w-10 h-10 text-[var(--color-accent)]" />}
          onStart={() => showCategoryMenu()}
          stats={{
            totalCodes: '150+',
            systems: '15',
            difficulty: 'PANCE-Level',
          }}
        />
      </DrillShell>
    );
  }

  // System selection menu
  if (status === 'menu') {
    return (
      <DrillShell
        title="ICD-10 Coding Drill"
        subtitle="Choose an organ system to focus on"
        breadcrumbs={breadcrumbs}
        onExit={onExit}
      >
        <div className="max-w-lg mx-auto py-8 space-y-3">
          {availableSystems.map((system) => (
            <button
              key={system}
              onClick={() => startSession(system)}
              className="w-full text-left p-4 rounded-lg border transition-colors hover:border-[var(--color-accent)]/40"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-center gap-3">
                <Stethoscope
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: 'var(--color-accent)' }}
                />
                <div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {system === 'all' ? 'All Systems (Mixed)' : system}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DrillShell>
    );
  }

  // Summary
  if (status === 'summary') {
    return (
      <DrillShell
        title="ICD-10 Coding Drill"
        subtitle="Session Complete"
        breadcrumbs={breadcrumbs}
        onExit={onExit}
      >
        <DrillSummaryCard
          drillName="ICD-10 Coding"
          icon={Hash}
          accentColor="var(--color-accent)"
          stats={{ correct: score, total: totalAttempts, streak }}
          onNewSession={reset}
          onExit={onExit ?? (() => {})}
          newSessionLabel="New Session"
        />
      </DrillShell>
    );
  }

  // Loading
  if (isLoading || !currentQuestion) {
    return (
      <DrillShell
        title="ICD-10 Coding Drill"
        breadcrumbs={breadcrumbs}
        onExit={onExit}
      >
        <QuestionSkeleton />
      </DrillShell>
    );
  }

  // Playing + Feedback
  return (
    <MiniDrillLayout
      score={score}
      streak={streak}
      total={totalAttempts}
      onExit={onExit}
      title="ICD-10 Coding"
    >
      {/* Vignette */}
      <QuestionCard>
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {currentQuestion.system}
            </span>
          </div>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {currentQuestion.vignette}
          </p>
        </div>
      </QuestionCard>

      {/* Options */}
      <div className="space-y-2 mt-4">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = userAnswerIndex === idx;
          const isCorrectOption = idx === currentQuestion.correctAnswerIndex;
          const showFeedback = status === 'feedback';

          let variant: 'default' | 'correct' | 'incorrect' | 'missed' = 'default';
          if (showFeedback) {
            if (isCorrectOption) variant = 'correct';
            else if (isSelected && !isCorrectOption) variant = 'incorrect';
          }

          return (
            <AnswerOption
              key={`${option.code}-${idx}`}
              label={option.code}
              text={option.description}
              variant={variant}
              selected={isSelected}
              disabled={status === 'feedback'}
              onClick={() => submitAnswer(idx)}
            />
          );
        })}
      </div>

      {/* Feedback bar */}
      {status === 'feedback' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 rounded-lg border"
          style={{
            backgroundColor: isCorrect
              ? 'color-mix(in srgb, var(--color-data-pass) 10%, var(--color-bg-secondary))'
              : 'color-mix(in srgb, var(--color-data-fail) 10%, var(--color-bg-secondary))',
            borderColor: isCorrect ? 'var(--color-data-pass)' : 'var(--color-data-fail)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {isCorrect ? (
              <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-data-pass)' }} />
            ) : (
              <XCircle className="w-5 h-5" style={{ color: 'var(--color-data-fail)' }} />
            )}
            <span
              className="text-sm font-semibold"
              style={{ color: isCorrect ? 'var(--color-data-pass)' : 'var(--color-data-fail)' }}
            >
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </span>
          </div>
          {!isCorrect && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              The correct code is <strong>{currentQuestion.correctCode}</strong>: {currentQuestion.correctDescription}
            </p>
          )}

          <button
            onClick={nextQuestion}
            className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
            }}
          >
            Next Question
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </MiniDrillLayout>
  );
}
