/**
 * ImagingDrillSession - Dedicated radiology review drill
 *
 * Loads reference content from /api/reference/imaging via related-content API
 * for "Related reference" links in feedback (imaging studies metadata).
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { usePhotoDrill } from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { EnhancedFeedbackPanel } from '@/components/drill/EnhancedFeedbackPanel';
import DrillShell from '@/components/drill/DrillShell';
import { ROUTES } from '@/config/routes';
import { Image, X, RotateCcw } from 'lucide-react';
import DrillSummaryCard from '@/components/drill/DrillSummaryCard';

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
    fsrsNextReview,
  } = usePhotoDrill();

  const prefersReducedMotion = useReducedMotion();

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
      <DrillShell
        title="Radiology Review"
        breadcrumb={['Drills', 'Imaging']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
        hideBreadcrumb
      >
        <DrillLandingPage
          title="Radiology Review"
          description="X-ray, CT, and MRI pattern recognition"
          icon={Image}
          accentColor="slate"
          onStart={() => startSession('radiology')}
          onExit={onExit}
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
            initial={prefersReducedMotion ? false : { y: 20 }}
            animate={{ y: 0 }}
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
            onDeepDive={onNavigateToReference ? handleDeepDive : undefined}
            nextReview={fsrsNextReview}
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
            initial={false}
            animate={{}}
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
                alt="Radiological image for diagnosis"
                className="w-full h-auto object-contain"
                role="img"
                onError={(e) => { e.currentTarget.alt = 'Image failed to load'; }}
              />
            </div>
          </motion.div>
        )}
      </MiniDrillLayout>
    );
  }

  if (status === 'summary') {
    return (
      <DrillShell
        title="Radiology Review — Complete"
        breadcrumb={['Drills', 'Imaging', 'Results']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName="Radiology Review"
          icon={Image}
          accentColor="var(--color-text-muted)"
          stats={{ correct: score, total: totalAttempts, streak }}
          onNewSession={handleReset}
          onExit={handleExit}
        />
      </DrillShell>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center">
      <p className="text-[var(--color-text-secondary)]">Loading imaging drill...</p>
    </div>
  );
};

export default ImagingDrillSession;
