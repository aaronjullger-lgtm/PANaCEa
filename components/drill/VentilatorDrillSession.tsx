/**
 * VentilatorDrillSession - Ventilator Management drill
 *
 * Practice adjusting vent settings based on ABGs and clinical scenarios.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wind,
  X,
  ArrowRight,
  RotateCcw,
  Activity,
  Droplets,
  Gauge,
  Wind as Breaths,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useVentilatorDrill, type VentCase } from '@/hooks/game/use-ventilator-drill';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { QuestionSkeleton } from '@/components/loading/SkeletonLoader';
import { getDrillLandingStats } from '@/services/analytics';

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
      <DrillLandingPage
        title="Ventilator Management"
        description="Master mechanical ventilation settings and troubleshooting"
        icon={Wind}
        accentColor="blue"
        stats={stats}
        onStart={startSession}
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
        <div className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            Failed to Load Questions
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {error || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Try Again
            </button>
            <button
              onClick={handleExit}
              className="px-6 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors font-medium"
            >
              Exit
            </button>
          </div>
        </div>
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-[var(--color-bg-secondary)]"
          >
            <div className="max-w-6xl mx-auto">
              <p className="text-sm text-[var(--color-text-secondary)] mb-4 text-center font-medium">
                What is the most appropriate action?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentCase?.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => submitAction(option)}
                    className="group p-4 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all text-left"
                  >
                    <div className="font-semibold text-[var(--color-text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400">
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 ${
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
                      isCorrect
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
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
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'
                  }`}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 p-6 max-w-6xl mx-auto"
          >
            {/* Patient Info */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
              <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
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
                <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
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
                <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  Arterial Blood Gas
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">pH</span>
                    <span
                      className={`text-sm font-semibold ${
                        currentCase.abg.pH < 7.35
                          ? 'text-red-600 dark:text-red-400'
                          : currentCase.abg.pH > 7.45
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-emerald-600 dark:text-emerald-400'
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
                          ? 'text-orange-600 dark:text-orange-400'
                          : currentCase.abg.paCO2 > 45
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
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
                          ? 'text-red-600 dark:text-red-400'
                          : currentCase.abg.paO2 < 80
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-emerald-600 dark:text-emerald-400'
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
                          ? 'text-red-600 dark:text-red-400'
                          : currentCase.abg.sao2 < 95
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-emerald-600 dark:text-emerald-400'
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
              <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
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
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl text-center"
        >
          <Wind className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Excellent work managing ventilators!
          </p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400">{score}</div>
              <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
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
      <p className="text-[var(--color-text-secondary)]">Loading ventilator drill...</p>
    </div>
  );
};

export default VentilatorDrillSession;
