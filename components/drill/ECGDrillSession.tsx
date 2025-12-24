/**
 * ECGDrillSession - Dedicated ECG interpretation drill
 * 
 * Focuses exclusively on ECG rhythm strips and 12-lead interpretation.
 * Uses PhotoDrill infrastructure with ECG-only filtering.
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotoDrill } from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { Activity, X, ArrowRight, RotateCcw, Heart, TrendingUp, Zap } from 'lucide-react';

interface ECGDrillSessionProps {
  onExit?: () => void;
}

/**
 * ECGDrillSession Component
 * 
 * Dedicated ECG interpretation training with rhythm recognition and 12-lead analysis
 */
const ECGDrillSession: React.FC<ECGDrillSessionProps> = ({ onExit }) => {
  const {
    currentCase,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    submitAnswer,
    nextCase,
    reset,
    startSession,
    exitToMenu,
    validDiagnoses,
  } = usePhotoDrill();

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
      <DrillLandingPage
        title="ECG Interpretation"
        description="Master ECG rhythm strips and 12-lead patterns"
        icon={Activity}
        accentColor="rose"
        onStart={() => startSession('ecg')}
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
      >
        {onExit && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
              aria-label="Exit"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </DrillLandingPage>
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            <div className="max-w-2xl mx-auto">
              <p className="text-sm text-[var(--color-text-secondary)] mb-2 text-center">
                What is your ECG diagnosis?
              </p>
              <DiagnosisInput
                onSubmit={handleSubmitAnswer}
                autoFocus
                options={validDiagnoses}
              />
            </div>
          </motion.div>
        )}

        {status === 'feedback' && currentCase && (
          <motion.div
            key="feedback-controls"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className={`p-4 ${
              isCorrect
                ? 'bg-emerald-100 dark:bg-emerald-950/50 border-t-2 border-emerald-500'
                : 'bg-red-100 dark:bg-red-950/50 border-t-2 border-red-500'
            }`}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div
                    className={`text-lg font-bold ${
                      isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                    }`}
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
                  {userAnswer && !isCorrect && (
                    <div className="text-sm text-[var(--color-text-muted)] mt-0.5">
                      Your answer: {userAnswer}
                    </div>
                  )}
                </div>
                <button
                  onClick={nextCase}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    isCorrect
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'
                  }`}
                >
                  Next ECG
                  <ArrowRight className="w-4 h-4" />
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
        title="ECG Interpretation"
        score={score}
        totalAttempts={0}
        streak={streak}
        isFeedback={status === 'feedback'}
        isCorrect={isCorrect}
        onExit={handleExit}
        onReset={handleReset}
        footer={footerContent}
      >
        {currentCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center space-y-4"
          >
            {/* ECG Image */}
            <div className="w-full max-w-4xl">
              <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <img
                  src={currentCase.imageUrl}
                  alt="ECG for diagnosis"
                  className="w-full h-auto object-contain"
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
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md p-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl text-center"
        >
          <Activity className="w-16 h-16 text-rose-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Session Complete
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Great work on ECG interpretation!
          </p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400">
                {score}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-rose-400">
                {streak}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">Best Streak</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Start New Session
            </button>
            <button
              onClick={handleExit}
              className="px-6 py-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium transition-colors"
            >
              Exit to Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Fallback loading
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center">
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)] mb-4">Loading ECG drill...</p>
        <button
          onClick={handleExit}
          className="text-sky-400 hover:text-sky-300"
        >
          Exit
        </button>
      </div>
    </div>
  );
};

export default ECGDrillSession;
