/**
 * ImagingDrillSession - Dedicated radiology review drill
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotoDrill } from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { Image, X, ArrowRight, RotateCcw } from 'lucide-react';

interface ImagingDrillSessionProps {
  onExit?: () => void;
}

const ImagingDrillSession: React.FC<ImagingDrillSessionProps> = ({ onExit }) => {
  const {
    currentCase,
    score,
    totalAttempts,
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

  useEffect(() => {
    if (status === 'menu') startSession('radiology');
  }, [status, startSession]);

  const handleExit = () => {
    exitToMenu();
    if (onExit) onExit();
  };

  const handleReset = () => {
    reset();
    startSession('radiology');
  };

  if (status === 'landing') {
    return (
      <DrillLandingPage
        title="Radiology Review"
        description="X-ray, CT, and MRI pattern recognition"
        icon={Image}
        accentColor="slate"
        onStart={() => startSession('radiology')}
        instructions={[
          'Analyze X-rays, CTs, and MRIs',
          'Identify pathology and normal variants',
          'Master PANCE imaging patterns',
          'Build radiology reading speed',
        ]}
        objectives={[
          'Recognize chest X-ray findings',
          'Identify fractures and dislocations',
          'Spot abdominal pathology',
          'Master neuroimaging basics',
        ]}
        estimatedMinutes={10}
        categories={['Radiology', 'Emergency Medicine']}
      >
        {onExit && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </DrillLandingPage>
    );
  }

  if (status === 'playing' || status === 'feedback') {
    const footerContent = (
      <AnimatePresence mode="wait">
        {status === 'playing' && (
          <motion.div
            key="playing-controls"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4"
          >
            <div className="max-w-2xl mx-auto">
              <p className="text-sm text-[var(--color-text-secondary)] mb-2 text-center">
                What do you see?
              </p>
              <DiagnosisInput onSubmit={submitAnswer} autoFocus options={validDiagnoses} />
            </div>
          </motion.div>
        )}
        {status === 'feedback' && currentCase && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 ${isCorrect ? 'bg-emerald-100 dark:bg-emerald-950/50 border-t-2 border-emerald-500' : 'bg-red-100 dark:bg-red-950/50 border-t-2 border-red-500'}`}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div
                    className={`text-lg font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}
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
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${isCorrect ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'}`}
                >
                  Next Image <ArrowRight className="w-4 h-4" />
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
        title="Radiology Review"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center space-y-4"
          >
            {currentCase.clinicalContext && (
              <div className="w-full max-w-4xl bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Clinical Context
                </h3>
                <p className="text-[var(--color-text-primary)]">{String(currentCase.clinicalContext)}</p>
              </div>
            )}
            <div className="w-full max-w-4xl bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
              <img
                src={currentCase.imageUrl}
                alt="Radiological finding"
                className="w-full h-auto object-contain"
              />
            </div>
          </motion.div>
        )}
      </MiniDrillLayout>
    );
  }

  if (status === 'summary') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl text-center"
        >
          <Image className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">Great work on radiology!</p>
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400">{score}</div>
              <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Start New Session
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

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center">
      <p className="text-[var(--color-text-secondary)]">Loading imaging drill...</p>
    </div>
  );
};

export default ImagingDrillSession;
