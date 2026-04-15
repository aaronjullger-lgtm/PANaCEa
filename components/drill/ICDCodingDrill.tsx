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
  const handleBackToHub = onExit ?? (() => {});
  const {
    currentQuestion,
    score,
    streak,
    totalAttempts,
    userAnswerIndex,
    isCorrect,
    status,
    availableSystems,
    isLoading,
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    showCategoryMenu,
  } = useICDDrill();

  const breadcrumbs = [
    'Practice',
    'ICD-10 Coding',
  ];

  // Landing page
  if (status === 'landing') {
    return (
      <DrillShell
        title="ICD-10 Coding Drill"
        breadcrumb={breadcrumbs}
        onBackToHub={handleBackToHub}
        backTo={ROUTES.PRACTICE}
      >
        <DrillLandingPage
          title="ICD-10 Coding Drill"
          description="Test your knowledge of ICD-10-CM codes — a tested PANCE competency. Match clinical scenarios to the correct diagnostic code from plausible same-system options."
          icon={Hash}
          onStart={() => showCategoryMenu()}
        />
      </DrillShell>
    );
  }

  // System selection menu
  if (status === 'menu') {
    return (
      <DrillShell
        title="ICD-10 Coding Drill"
        breadcrumb={breadcrumbs}
        onBackToHub={handleBackToHub}
        backTo={ROUTES.PRACTICE}
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
        breadcrumb={breadcrumbs}
        onBackToHub={handleBackToHub}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName="ICD-10 Coding"
          icon={Hash}
          accentColor="var(--color-accent)"
          stats={{ correct: score, total: totalAttempts, streak }}
          onNewSession={reset}
          onExit={handleBackToHub}
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
        breadcrumb={breadcrumbs}
        onBackToHub={handleBackToHub}
        backTo={ROUTES.PRACTICE}
      >
        <QuestionSkeleton />
      </DrillShell>
    );
  }

  // Playing + Feedback
  return (
    <MiniDrillLayout
      title="ICD-10 Coding"
      score={score}
      totalAttempts={totalAttempts}
      streak={streak}
      isFeedback={status === 'feedback'}
      isCorrect={isCorrect}
      onExit={handleBackToHub}
      onReset={reset}
    >
      {/* Vignette */}
      <QuestionCard question={currentQuestion.vignette} category={currentQuestion.system} />

      {/* Options */}
      <div className="space-y-2 mt-4">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = userAnswerIndex === idx;
          const isCorrectOption = idx === currentQuestion.correctAnswerIndex;

          return (
            <AnswerOption
              key={`${option.code}-${idx}`}
              index={idx}
              text={`${option.code}: ${option.description}`}
              isSelected={isSelected}
              isCorrect={status === 'feedback' ? isCorrectOption : null}
              isAnswered={status === 'feedback'}
              onSelect={submitAnswer}
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
