/**
 * ImagingDrillSession - Dedicated radiology review drill
 *
 * Loads reference content from /api/reference/imaging via related-content API
 * for "Related reference" links in feedback (imaging studies metadata).
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotoDrill } from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { EnhancedFeedbackPanel } from '@/components/drill/EnhancedFeedbackPanel';
import { Image, X, RotateCcw } from 'lucide-react';

interface ImagingDrillSessionProps {
  onExit?: () => void;
  onNavigateToReference?: (type: string, id: string) => void;
}

const ImagingDrillSession: React.FC<ImagingDrillSessionProps> = ({
  onExit,
  onNavigateToReference,
}) => {
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

  const handleDeepDive = (type: string, id: string) => {
    onNavigateToReference?.(type, id);
  };

  if (status === 'menu') {
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
              aria-label="Exit"
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
          <EnhancedFeedbackPanel
            isCorrect={isCorrect || false}
            correctAnswer={currentCase.correctDiagnosis}
            userAnswer={userAnswer}
            explanation={currentCase.explanation || 'Review the imaging findings carefully.'}
            onNext={nextCase}
            nextLabel="Next Image"
            category="imaging"
            tags={[currentCase.correctDiagnosis, currentCase.category || 'radiology']}
            relatedConceptId={currentCase.correctDiagnosis}
            onDeepDive={handleDeepDive}
          />
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
                <p className="text-[var(--color-text-primary)]">
                  {typeof currentCase.clinicalContext === 'string'
                    ? currentCase.clinicalContext
                    : (() => {
                        const ctx = currentCase.clinicalContext as {
                          age?: number;
                          sex?: 'M' | 'F';
                          chiefComplaint?: string;
                          history?: string;
                        };
                        return `${ctx.age ?? '?'}yo ${ctx.sex === 'M' ? 'Male' : 'Female'} - ${ctx.chiefComplaint ?? ''}. ${ctx.history ?? ''}`;
                      })()}
                </p>
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
          className="w-full max-w-md p-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] text-center border border-[var(--color-border)]"
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
