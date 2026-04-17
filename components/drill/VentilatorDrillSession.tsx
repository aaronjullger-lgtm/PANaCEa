/**
 * VentilatorDrillSession - Ventilator Management drill
 *
 * Practice adjusting vent settings based on ABGs and clinical scenarios.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Wind, X, ArrowRight, Activity, Droplets, Gauge } from 'lucide-react';
import { useVentilatorDrill, type VentCase } from '@/hooks/game/use-ventilator-drill';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { QuestionSkeleton } from '@/components/loading';
import { getDrillLandingStats } from '@/services/analytics';
import { EmptyState } from '@/components/ui/EmptyState';
import DrillShell from '@/components/drill/DrillShell';
import DrillSummaryCard from '@/components/drill/DrillSummaryCard';
import { ROUTES } from '@/config/routes';

// Action options for ventilator adjustments
const ACTION_OPTIONS = [
  { id: 'increase-peep', label: 'Increase PEEP' },
  { id: 'decrease-peep', label: 'Decrease PEEP' },
  { id: 'increase-fio2', label: 'Increase FiO2' },
  { id: 'decrease-fio2', label: 'Decrease FiO2' },
  { id: 'increase-rr', label: 'Increase Respiratory Rate' },
  { id: 'decrease-rr', label: 'Decrease Respiratory Rate' },
  { id: 'increase-tv', label: 'Increase Tidal Volume' },
  { id: 'decrease-tv', label: 'Decrease Tidal Volume' },
  { id: 'no-change', label: 'No Change Needed' },
];

interface VentilatorDrillSessionProps {
  onExit?: () => void;
}

const VentilatorDrillSession: React.FC<VentilatorDrillSessionProps> = ({ onExit }) => {
  const prefersReducedMotion = useReducedMotion();
  const {
    currentCase,
    score,
    totalAttempts,
    streak,
    userAction,
    isCorrect,
    status,
    error,
    submitAction,
    nextCase,
    reset,
    startSession,
    exitToMenu,
  } = useVentilatorDrill();

  const stats = getDrillLandingStats('ventilator_hero');

  const handleExit = () => {
    exitToMenu();
    if (onExit) onExit();
  };

  const handleReset = () => {
    reset();
    startSession();
  };

  // Landing page
  if (status === 'landing') {
    return (
      <DrillShell
        title="Ventilator Management"
        breadcrumb={['Drills', 'Ventilator']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
        hideBreadcrumb
      >
        <DrillLandingPage
          title="Ventilator Management"
          description="Master mechanical ventilation settings and troubleshooting"
          icon={Wind}
          accentColor="blue"
          stats={stats}
          onStart={startSession}
          onExit={onExit}
          instructions={[
            'Review patient info and current vent settings',
            'Analyze ABG results',
            'Select the most appropriate management',
            'Learn from detailed explanations',
          ]}
          objectives={[
            'Master AC, SIMV, PRVC, and PS modes',
            'Interpret ABGs in ventilated patients',
            'Recognize volutrauma and barotrauma',
            'Know when to wean and extubate',
          ]}
          estimatedMinutes={15}
          categories={['Critical Care', 'Pulmonary']}
        />
      </DrillShell>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
        <div className="max-w-4xl mx-auto">
          <QuestionSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-4">
        <EmptyState
          title="Failed to Load Questions"
          description={error || 'An unexpected error occurred'}
          action={{ label: 'Try Again', onClick: handleReset }}
        />
      </div>
    );
  }

  // Playing or feedback state
  if (status === 'playing' || status === 'feedback') {
    const footerContent = (
      <AnimatePresence mode="wait">
        {status === 'playing' && (
          <motion.div
            key="playing-controls"
            initial={prefersReducedMotion ? false : { y: 20 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="p-6 bg-[var(--color-bg-secondary)]"
          >
            <div className="max-w-6xl mx-auto">
              <p className="text-sm text-[var(--color-text-secondary)] mb-4 text-center font-medium">
                What is the most appropriate action?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="Ventilator action options">
                {currentCase?.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => submitAction(option)}
                    className="group p-4 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:border-[var(--color-category-practice)] hover:bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] transition-all text-left"
                    aria-label={`Select action: ${option}`}
                  >
                    <div className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-category-practice)]">
                      {option}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {status === 'feedback' && currentCase && (
          <motion.div
            key="feedback"
            initial={prefersReducedMotion ? false : { y: 20 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className={`p-6 ${
              isCorrect
                ? 'bg-data-pass border-t-2 border-data-pass'
                : 'bg-data-fail border-t-2 border-data-fail'
            }`}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div
                    className={`text-lg font-bold ${
                      isCorrect
                        ? 'text-data-pass'
                        : 'text-data-fail'
                    }`}
                  >
                    {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                  </div>
                  {!isCorrect && (
                    <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                      Correct action:{' '}
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {ACTION_OPTIONS.find((o) => o.id === currentCase.correctAction)?.label}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={nextCase}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    isCorrect
                      ? 'bg-data-pass hover:brightness-110 text-[var(--color-text-inverse)]'
                      : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'
                  }`}
                  aria-label="Proceed to next ventilator case"
                >
                  Next Case <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg p-4">
                <span className="font-medium text-[var(--color-text-primary)]">Explanation: </span>
                {currentCase.explanation}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );

    return (
      <MiniDrillLayout
        title="Ventilator Management"
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
            className="space-y-6 p-6 max-w-6xl mx-auto"
          >
            {/* Patient Info */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
              <h3 className="text-sm font-semibold text-[var(--color-category-practice)] mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Patient Information
              </h3>
              <p className="text-[var(--color-text-primary)] mb-2">{currentCase.patientInfo}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Indication: {currentCase.indication}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Ventilator Settings */}
              <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
                <h3 className="text-sm font-semibold text-[var(--color-category-practice)] mb-3 flex items-center gap-2">
                  <Wind className="w-4 h-4" />
                  Current Ventilator Settings
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">Mode</span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {currentCase.currentSettings.mode}
                    </span>
                  </div>
                  {currentCase.currentSettings.tidalVolume && (
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--color-text-muted)]">Tidal Volume</span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {currentCase.currentSettings.tidalVolume} mL
                      </span>
                    </div>
                  )}
                  {currentCase.currentSettings.respiratoryRate && (
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--color-text-muted)]">RR</span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {currentCase.currentSettings.respiratoryRate} /min
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">PEEP</span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {currentCase.currentSettings.peep} cmH₂O
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">FiO₂</span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {currentCase.currentSettings.fio2}%
                    </span>
                  </div>
                  {currentCase.currentSettings.pressureSupport && (
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--color-text-muted)]">
                        Pressure Support
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {currentCase.currentSettings.pressureSupport} cmH₂O
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ABG Results */}
              <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
                <h3 className="text-sm font-semibold text-[var(--color-category-practice)] mb-3 flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  Arterial Blood Gas
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">pH</span>
                    <span
                      className={`text-sm font-semibold ${
                        currentCase.abg.pH < 7.35
                          ? 'text-data-fail'
                          : currentCase.abg.pH > 7.45
                            ? 'text-[var(--color-data-provisional)]'
                            : 'text-data-pass'
                      }`}
                    >
                      {currentCase.abg.pH.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">PaCO₂</span>
                    <span
                      className={`text-sm font-semibold ${
                        currentCase.abg.paCO2 < 35
                          ? 'text-[var(--color-data-provisional)]'
                          : currentCase.abg.paCO2 > 45
                            ? 'text-data-fail'
                            : 'text-data-pass'
                      }`}
                    >
                      {currentCase.abg.paCO2} mmHg
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">PaO₂</span>
                    <span
                      className={`text-sm font-semibold ${
                        currentCase.abg.paO2 < 60
                          ? 'text-data-fail'
                          : currentCase.abg.paO2 < 80
                            ? 'text-[var(--color-data-provisional)]'
                            : 'text-data-pass'
                      }`}
                    >
                      {currentCase.abg.paO2} mmHg
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">HCO₃</span>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {currentCase.abg.hco3} mEq/L
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">SaO₂</span>
                    <span
                      className={`text-sm font-semibold ${
                        currentCase.abg.sao2 < 90
                          ? 'text-data-fail'
                          : currentCase.abg.sao2 < 95
                            ? 'text-[var(--color-data-provisional)]'
                            : 'text-data-pass'
                      }`}
                    >
                      {currentCase.abg.sao2}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Physical Exam */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
              <h3 className="text-sm font-semibold text-[var(--color-category-practice)] mb-2 flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                Physical Examination
              </h3>
              <p className="text-sm text-[var(--color-text-primary)]">{currentCase.physicalExam}</p>
            </div>
          </motion.div>
        )}
      </MiniDrillLayout>
    );
  }

  // Summary state
  if (status === 'summary') {
    return (
      <DrillShell
        title="Ventilator — Complete"
        breadcrumb={['Drills', 'Ventilator', 'Results']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName="Ventilator Management"
          icon={Wind}
          accentColor="var(--color-category-practice)"
          stats={{ correct: score, total: totalAttempts, streak }}
          onNewSession={handleReset}
          onExit={handleExit}
        />
      </DrillShell>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center">
      <p className="text-[var(--color-text-secondary)]">Loading ventilator drill...</p>
    </div>
  );
};

export default VentilatorDrillSession;
