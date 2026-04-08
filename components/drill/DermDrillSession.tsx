/**
 * DermDrillSession - Dedicated dermatology recognition drill
 *
 * Focuses exclusively on skin lesions, rashes, and dermatological findings.
 * Uses PhotoDrill infrastructure with Derm-only filtering.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotoDrill } from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import DrillShell from '@/components/drill/DrillShell';
import { ROUTES } from '@/config/routes';
import { Scan, X, ArrowRight, RotateCcw, Eye, EyeOff } from 'lucide-react';
import DrillSummaryCard from '@/components/drill/DrillSummaryCard';

interface DermDrillSessionProps {
  onExit?: () => void;
}

const DermDrillSession: React.FC<DermDrillSessionProps> = ({ onExit }) => {
  const {
    currentCase,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    totalAttempts,
    submitAnswer,
    nextCase,
    reset,
    startSession,
    exitToMenu,
    validDiagnoses,
  } = usePhotoDrill();

  const [imageRevealed, setImageRevealed] = useState<boolean>(false);

  // Auto-start Derm-only mode
  useEffect(() => {
    if (status === 'menu') {
      startSession('derm');
    }
  }, [status, startSession]);

  // Reset imageRevealed when case changes
  useEffect(() => {
    if (currentCase) {
      setImageRevealed(!currentCase.clinicalContext);
    }
  }, [currentCase?.id]);

  const handleExit = () => {
    exitToMenu();
    if (onExit) onExit();
  };

  const handleReset = () => {
    reset();
    startSession('derm');
  };

  if (status === 'menu') {
    return (
      <DrillShell
        title="Derm Recognition"
        breadcrumb={['Drills', 'Dermatology']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
        hideBreadcrumb
      >
        <DrillLandingPage
          title="Derm Recognition"
          description="Identify skin lesions and rashes"
          icon={Scan}
          accentColor="pink"
          onStart={() => startSession('derm')}
          onExit={onExit}
          instructions={[
            'Read clinical presentation first',
            'Reveal image when ready',
            'Identify skin lesions and rashes',
            'Master dermatological patterns',
            'Practice PANCE high-yield derm',
          ]}
          objectives={[
            'Recognize common skin lesions',
            'Identify rashes by morphology',
            'Differentiate bacterial vs viral vs fungal',
            'Master PANCE dermatology buzzwords',
          ]}
          estimatedMinutes={10}
          categories={['Dermatology', 'Infectious Disease']}
        />
      </DrillShell>
    );
  }

  if (status === 'playing' || status === 'feedback') {
    const footerContent = (
      <AnimatePresence mode="wait">
        {status === 'playing' && (
          <motion.div
            key="playing-controls"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4"
          >
            <div className="max-w-2xl mx-auto">
              <p className="text-sm text-[var(--color-text-secondary)] mb-2 text-center">
                What is your diagnosis?
              </p>
              <DiagnosisInput onSubmit={submitAnswer} autoFocus options={validDiagnoses} />
            </div>
          </motion.div>
        )}

        {status === 'feedback' && currentCase && (
          <motion.div
            key="feedback-controls"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className={`p-4 ${isCorrect ? 'bg-[var(--color-data-pass)]/10 border-t-2 border-[var(--color-data-pass)]' : 'bg-[var(--color-data-fail)]/10 border-t-2 border-[var(--color-data-fail)]'}`}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div
                    className={`text-lg font-bold ${isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'}`}
                  >
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </div>
                  {!isCorrect && (
                    <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                      Correct answer:{' '}
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {currentCase.correctDiagnosis}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={nextCase}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${isCorrect ? 'bg-[var(--color-data-pass)] hover:opacity-90 text-[var(--color-text-inverse)]' : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'}`}
                  aria-label="Proceed to next dermatology case"
                >
                  Next Case <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              {currentCase.explanation && (
                <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg p-3">
                  <span className="font-medium text-[var(--color-text-primary)]">
                    Explanation:{' '}
                  </span>
                  {currentCase.explanation}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );

    return (
      <MiniDrillLayout
        title="Derm Recognition"
        score={score}
        totalAttempts={totalAttempts}
        streak={streak}
        isFeedback={status === 'feedback'}
        isCorrect={isCorrect}
        onExit={handleExit}
        onReset={handleReset}
        footer={footerContent}
      >
        {currentCase && (
          <motion.div
            initial={false}
            animate={{}}
            className="flex flex-col items-center space-y-4"
          >
            {currentCase.clinicalContext && (
              <div className="w-full max-w-4xl bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Clinical Presentation
                </h3>
                <p className="text-[var(--color-text-primary)]">
                  {typeof currentCase.clinicalContext === 'string'
                    ? currentCase.clinicalContext
                    : `${currentCase.clinicalContext.age}yo ${currentCase.clinicalContext.sex === 'M' ? 'Male' : 'Female'} - ${currentCase.clinicalContext.chiefComplaint}. ${currentCase.clinicalContext.history}`}
                </p>
              </div>
            )}

            <div className="w-full max-w-4xl">
              <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                {imageRevealed ? (
                  <img
                    src={currentCase.imageUrl}
                    alt="Dermatological finding for diagnosis"
                    className="w-full h-auto object-contain"
                    role="img"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Eye className="w-16 h-16 text-[var(--color-text-muted)]" aria-hidden="true" />
                    <button
                      onClick={() => setImageRevealed(true)}
                      className="px-6 py-3 bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-text-inverse)] rounded-lg font-medium transition-colors"
                      aria-label="Reveal dermatology image"
                    >
                      Reveal Image
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </MiniDrillLayout>
    );
  }

  if (status === 'summary') {
    return (
      <DrillShell
        title="Derm Recognition — Complete"
        breadcrumb={['Drills', 'Dermatology', 'Results']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName="Derm Recognition"
          icon={Scan}
          accentColor="var(--color-accent)"
          stats={{ correct: score, total: totalAttempts, streak }}
          onNewSession={handleReset}
          onExit={handleExit}
        />
      </DrillShell>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center">
      <p className="text-[var(--color-text-secondary)]">Loading derm drill...</p>
    </div>
  );
};

export default DermDrillSession;
