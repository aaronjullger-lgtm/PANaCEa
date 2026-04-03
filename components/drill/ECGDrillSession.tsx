/**
 * ECGDrillSession - Dedicated ECG interpretation drill
 *
 * Focuses exclusively on ECG rhythm strips and 12-lead interpretation.
 * Uses PhotoDrill infrastructure with ECG-only filtering.
 * Enhanced with database-linked reference material in feedback.
 */

import React, { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotoDrill } from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { EnhancedFeedbackPanel } from '@/components/drill/EnhancedFeedbackPanel';
import DrillShell from '@/components/drill/DrillShell';
import { ROUTES } from '@/config/routes';
import { Activity, X, ArrowRight, RotateCcw, Heart, TrendingUp, Zap } from 'lucide-react';

interface ECGDrillSessionProps {
  onExit?: () => void;
  onNavigateToReference?: (type: string, id: string) => void;
}

/**
 * ECGDrillSession Component
 *
 * Dedicated ECG interpretation training with rhythm recognition and 12-lead analysis
 */
const ECGDrillSession: React.FC<ECGDrillSessionProps> = ({ onExit, onNavigateToReference }) => {
  const {
    currentCase,
    score,
    streak,
    totalAttempts,
    userAnswer,
    isCorrect,
    status,
    submitAnswer,
    nextCase,
    reset,
    startSession,
    exitToMenu,
    validDiagnoses,
    fsrsNextReview,
  } = usePhotoDrill();

  const [useEnhancedFeedback, setUseEnhancedFeedback] = useState(true);

  // Handler for deep dive into reference material
  const handleDeepDive = useCallback(
    (type: string, id: string) => {
      if (onNavigateToReference) {
        onNavigateToReference(type, id);
      }
    },
    [onNavigateToReference]
  );

  // Auto-start ECG-only mode
  useEffect(() => {
    if (status === 'menu') {
      startSession('ecg');
    }
  }, [status, startSession]);

  const handleExit = () => {
    exitToMenu();
    if (onExit) onExit();
  };

  const handleReset = () => {
    reset();
    startSession('ecg');
  };

  const handleSubmitAnswer = (answer: string) => {
    submitAnswer(answer);
  };

  // =========================================================================
  // LANDING PAGE
  // =========================================================================
  if (status === 'menu') {
    return (
      <DrillShell
        title="ECG Interpretation"
        breadcrumb={['Drills', 'ECG']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
        hideBreadcrumb
      >
        <DrillLandingPage
          title="ECG Interpretation"
          description="Master ECG rhythm strips and 12-lead patterns"
          icon={Activity}
          accentColor="rose"
          onStart={() => startSession('ecg')}
          onExit={onExit}
          isLoading={false}
          instructions={[
            'Analyze rhythm strips and 12-lead ECGs',
            'Identify arrhythmias, blocks, and STEMI patterns',
            'Practice rate calculation and interval measurement',
            'Master high-yield ECG diagnoses for PANCE',
            'Build pattern recognition speed',
          ]}
          objectives={[
            'Recognize all major arrhythmias',
            'Identify heart blocks (1st, 2nd, 3rd degree)',
            'Spot STEMI and ischemia patterns',
            'Calculate heart rate and intervals',
            'Differentiate SVT vs. VT',
          ]}
          estimatedMinutes={10}
          categories={['Cardiovascular', 'Emergency Medicine']}
        />
      </DrillShell>
    );
  }

  // =========================================================================
  // DRILL SESSION (Status: 'playing' | 'feedback')
  // =========================================================================
  if (status === 'playing' || status === 'feedback') {
    const footerContent = (
      <AnimatePresence mode="wait">
        {status === 'playing' && (
          <motion.div
            key="playing-controls"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            <div className="max-w-2xl mx-auto">
              <p className="text-sm text-[var(--color-text-secondary)] mb-2 text-center">
                What is your ECG diagnosis?
              </p>
              <DiagnosisInput onSubmit={handleSubmitAnswer} autoFocus options={validDiagnoses} />
            </div>
          </motion.div>
        )}

        {status === 'feedback' && currentCase && (
          <EnhancedFeedbackPanel
            isCorrect={isCorrect || false}
            correctAnswer={currentCase.correctDiagnosis}
            userAnswer={userAnswer}
            explanation={currentCase.explanation || 'Review the ECG features carefully.'}
            onNext={nextCase}
            nextLabel="Next ECG"
            category="ecg"
            tags={[currentCase.correctDiagnosis, currentCase.category || 'cardiovascular']}
            relatedConceptId={currentCase.correctDiagnosis}
            onDeepDive={onNavigateToReference ? handleDeepDive : undefined}
            nextReview={fsrsNextReview}
          />
        )}
      </AnimatePresence>
    );

    return (
      <MiniDrillLayout
        title="ECG Interpretation"
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
            className="flex flex-col items-center justify-center space-y-4"
          >
            {/* ECG Image */}
            <div className="w-full max-w-4xl">
              <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <img
                  src={currentCase.imageUrl}
                  alt="ECG strip for diagnosis interpretation"
                  className="w-full h-auto object-contain"
                  role="img"
                />
              </div>
            </div>

            {/* Clinical Context (if provided) */}
            {currentCase.clinicalContext && (
              <div className="w-full max-w-4xl bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Clinical Context
                </h3>
                <p className="text-[var(--color-text-primary)]">
                  {typeof currentCase.clinicalContext === 'string'
                    ? currentCase.clinicalContext
                    : `${currentCase.clinicalContext.age}yo ${currentCase.clinicalContext.sex === 'M' ? 'Male' : 'Female'} - ${currentCase.clinicalContext.chiefComplaint}. ${currentCase.clinicalContext.history}`}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </MiniDrillLayout>
    );
  }

  // =========================================================================
  // SUMMARY VIEW
  // =========================================================================
  if (status === 'summary') {
    return (
      <DrillShell
        title="ECG Interpretation — Complete"
        breadcrumb={['Drills', 'ECG', 'Results']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md p-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] text-center border border-[var(--color-border)]"
          >
            <Activity className="w-16 h-16 text-[var(--color-data-fail)] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Session Complete
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Great work on ECG interpretation!
            </p>

            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-[var(--color-data-pass)]">{score}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[var(--color-data-fail)]">{streak}</div>
                <div className="text-sm text-[var(--color-text-muted)]">Best Streak</div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-data-fail)] hover:opacity-90 text-white rounded-lg font-medium transition-colors"
                aria-label="Start a new ECG interpretation session"
              >
                <RotateCcw className="w-4 h-4" />
                Start New Session
              </button>
              <button
                onClick={handleExit}
                className="px-6 py-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium transition-colors"
                aria-label="Exit to drill menu"
              >
                Exit to Menu
              </button>
            </div>
          </motion.div>
        </div>
      </DrillShell>
    );
  }

  // Fallback loading
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center">
      <div className="text-center" role="status" aria-live="polite">
        <p className="text-[var(--color-text-secondary)] mb-4">Loading ECG drill...</p>
        <button onClick={handleExit} className="text-[var(--color-accent)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 rounded-lg px-2 py-1" aria-label="Exit ECG drill">
          Exit
        </button>
      </div>
    </div>
  );
};

export default ECGDrillSession;
