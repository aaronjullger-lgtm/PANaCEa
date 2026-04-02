/**
 * DrillViewRouter
 *
 * Renders the appropriate drill-mode component based on the current `view` value.
 * Extracted from App.tsx to reduce its size. All drill modes that live inside the
 * main layout shell (NavRail + content area) are handled here.
 *
 * Owner: App.tsx passes all required props; this component is purely presentational.
 */
import React, { Suspense, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { Loader } from '@/components/loading';
import { WithGeminiErrorBoundary } from '@/components/error/ErrorBoundary';
import {
  PhotoDrillSession,
  RapidRecallDrill,
  DDxCompareDrill,
  MiniLabDrillSession,
  FirstLineDrillSession,
  ConditionDrillSession,
  GuidelineDrillSession,
  SystemDrillSession,
  PharmacologyDrillSession,
  SubcategoryDrillSession,
  VentilatorDrillSession,
  PhysiologyDrillSession,
  AnatomyDrillSession,
  ECGDrillSession,
  DermDrillSession,
  ImagingDrillSession,
  FluidElectrolyteMode,
  AntibioticMode,
  PatientEncounterMode,
  CodeBlueSpeedMode,
  GrandRoundsMode,
  ContrastiveDrillSession,
  ReasoningTutorMode,
  CramMode,
  CommuterMode,
  MedicalWordleMode,
  DiagnosticPuzzleMode,
  FullSitDownTestMode,
  IntegrationsHub,
  PANRELASimulator,
  MediaApproval,
  CoreAdaptiveSession,
} from '@/config/lazyComponents';
import type { View } from '@/config/appViews';
import type { Question as QuizQuestion, PerformanceRecord, ErrorTag } from '@/types';
// TRAINING_MODES import removed — no longer needed after polypharmacy simplification

interface DrillViewRouterProps {
  view: View;
  setView: (v: View) => void;
  // Performance tracking callbacks
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: QuizQuestion) => void;
  updateReviewQuestion: (question: QuizQuestion, wasCorrect: boolean) => void;
  updateLastPerformanceErrorTag: (tag: ErrorTag) => void;
  performanceData: PerformanceRecord[];
  fontSizeAdjustment: number;
  setFontSizeAdjustment: (n: number) => void;
  // Flagged questions
  flaggedQuestions: QuizQuestion[];
  addFlaggedQuestion: (q: QuizQuestion) => void;
  removeFlaggedQuestion: (q: QuizQuestion) => void;
  updateQuestionNote: (q: QuizQuestion, note: string) => void;
  // Drill-specific
  initialDrillSystem: string | null;
  missedQuestions: QuizQuestion[];
}

export const DrillViewRouter: React.FC<DrillViewRouterProps> = ({
  view,
  setView,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
  updateLastPerformanceErrorTag,
  performanceData,
  fontSizeAdjustment,
  setFontSizeAdjustment,
  flaggedQuestions,
  addFlaggedQuestion,
  removeFlaggedQuestion,
  updateQuestionNote,
  initialDrillSystem,
  missedQuestions,
}) => {
  const navigate = useNavigate();

  /**
   * Unified exit handler for all drill modes.
   * Always:
   * 1. Navigate to the study dashboard (ROUTES.STUDY)
   * 2. Reset the view to 'command_center' for UI consistency
   *
   * This ensures the URL and local view state are always synchronized
   * when exiting any drill mode.
   */
  const handleExitDrill = useCallback(() => {
    navigate(ROUTES.STUDY);
    // Set view to command_center to ensure UI state matches URL
    // (useAppNavigation will also set this, but doing it here ensures immediate consistency)
    setView('command_center');
  }, [navigate, setView]);

  const exit = handleExitDrill;

  const sharedQuizProps = {
    addPerformanceRecord,
    addMissedQuestion,
    updateReviewQuestion,
    updateLastPerformanceErrorTag,
    performanceData,
    fontSizeAdjustment,
    setFontSizeAdjustment,
    flaggedQuestions,
    addFlaggedQuestion,
    removeFlaggedQuestion,
    updateQuestionNote,
  };

  return (
    <>
      {view === 'photo_drill' && (
        <WithGeminiErrorBoundary viewName="photo_drill" onRetry={() => setView('photo_drill')}>
          <Suspense fallback={<Loader />}>
            <PhotoDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {/* ECG, Derm, and Imaging drills use dedicated session components with different filters */}
      {view === 'ecg_drill' && (
        <WithGeminiErrorBoundary viewName="ecg_drill" onRetry={() => setView('ecg_drill')}>
          <Suspense fallback={<Loader />}>
            <ECGDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'derm_drill' && (
        <WithGeminiErrorBoundary viewName="derm_drill" onRetry={() => setView('derm_drill')}>
          <Suspense fallback={<Loader />}>
            <DermDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'imaging_drill' && (
        <WithGeminiErrorBoundary viewName="imaging_drill" onRetry={() => setView('imaging_drill')}>
          <Suspense fallback={<Loader />}>
            <ImagingDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'rapid_recall' && (
        <WithGeminiErrorBoundary viewName="rapid_recall" onRetry={() => setView('rapid_recall')}>
          <Suspense fallback={<Loader />}>
            <RapidRecallDrill onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'ddx_compare' && (
        <WithGeminiErrorBoundary viewName="ddx_compare" onRetry={() => setView('ddx_compare')}>
          <Suspense fallback={<Loader />}>
            <DDxCompareDrill onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'mini_lab' && (
        <WithGeminiErrorBoundary viewName="mini_lab" onRetry={() => setView('mini_lab')}>
          <Suspense fallback={<Loader />}>
            <MiniLabDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'pharmacology' && (
        <WithGeminiErrorBoundary viewName="pharmacology" onRetry={() => setView('pharmacology')}>
          <Suspense fallback={<Loader />}>
            <PharmacologyDrillSession onExit={exit} {...sharedQuizProps} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'first_line_treatment' && (
        <WithGeminiErrorBoundary
          viewName="first_line_treatment"
          onRetry={() => setView('first_line_treatment')}
        >
          <Suspense fallback={<Loader />}>
            <FirstLineDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'condition_drill' && (
        <WithGeminiErrorBoundary
          viewName="condition_drill"
          onRetry={() => setView('condition_drill')}
        >
          <Suspense fallback={<Loader />}>
            <ConditionDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'system_drill' && (
        <WithGeminiErrorBoundary viewName="system_drill" onRetry={() => setView('system_drill')}>
          <Suspense fallback={<Loader />}>
            <SystemDrillSession
              onExit={exit}
              initialSystem={initialDrillSystem ?? undefined}
              {...sharedQuizProps}
            />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'subcategory_drill' && (
        <WithGeminiErrorBoundary
          viewName="subcategory_drill"
          onRetry={() => setView('subcategory_drill')}
        >
          <Suspense fallback={<Loader />}>
            <SubcategoryDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'guideline_drill' && (
        <WithGeminiErrorBoundary
          viewName="guideline_drill"
          onRetry={() => setView('guideline_drill')}
        >
          <Suspense fallback={<Loader />}>
            <GuidelineDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'ventilator_hero' && (
        <WithGeminiErrorBoundary
          viewName="ventilator_hero"
          onRetry={() => setView('ventilator_hero')}
        >
          <Suspense fallback={<Loader />}>
            <VentilatorDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'physiology_drill' && (
        <WithGeminiErrorBoundary
          viewName="physiology_drill"
          onRetry={() => setView('physiology_drill')}
        >
          <Suspense fallback={<Loader />}>
            <PhysiologyDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'anatomy_review' && (
        <WithGeminiErrorBoundary
          viewName="anatomy_review"
          onRetry={() => setView('anatomy_review')}
        >
          <Suspense fallback={<Loader />}>
            <AnatomyDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'fluid_electrolyte' && (
        <WithGeminiErrorBoundary
          viewName="fluid_electrolyte"
          onRetry={() => setView('fluid_electrolyte')}
        >
          <Suspense fallback={<Loader />}>
            <FluidElectrolyteMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'antibiotic_mode' && (
        <WithGeminiErrorBoundary
          viewName="antibiotic_mode"
          onRetry={() => setView('antibiotic_mode')}
        >
          <Suspense fallback={<Loader />}>
            <AntibioticMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'patient_encounter' && (
        <WithGeminiErrorBoundary
          viewName="patient_encounter"
          onRetry={() => setView('patient_encounter')}
        >
          <Suspense fallback={<Loader />}>
            <PatientEncounterMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'integrations' && (
        <WithGeminiErrorBoundary viewName="integrations" onRetry={() => setView('integrations')}>
          <Suspense fallback={<Loader />}>
            <IntegrationsHub
              performanceData={performanceData}
              missedQuestions={missedQuestions}
              onBack={exit}
            />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'panre_la' && (
        <WithGeminiErrorBoundary viewName="panre_la" onRetry={() => setView('panre_la')}>
          <Suspense fallback={<Loader />}>
            <PANRELASimulator onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'pance_simulator' && (
        <WithGeminiErrorBoundary viewName="pance_simulator" onRetry={() => setView('pance_simulator')}>
          <Suspense fallback={<Loader />}>
            <FullSitDownTestMode onExit={exit} {...sharedQuizProps} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'code_blue_speed' && (
        <WithGeminiErrorBoundary
          viewName="code_blue_speed"
          onRetry={() => setView('code_blue_speed')}
        >
          <Suspense fallback={<Loader />}>
            <CodeBlueSpeedMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'grand_rounds' && (
        <WithGeminiErrorBoundary viewName="grand_rounds" onRetry={() => setView('grand_rounds')}>
          <Suspense fallback={<Loader />}>
            <GrandRoundsMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'contrastive_drill' && (
        <WithGeminiErrorBoundary
          viewName="contrastive_drill"
          onRetry={() => setView('contrastive_drill')}
        >
          <Suspense fallback={<Loader />}>
            <ContrastiveDrillSession onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'reasoning_tutor' && (
        <WithGeminiErrorBoundary
          viewName="reasoning_tutor"
          onRetry={() => setView('reasoning_tutor')}
        >
          <Suspense fallback={<Loader />}>
            <ReasoningTutorMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'cram_mode' && (
        <WithGeminiErrorBoundary viewName="cram_mode" onRetry={() => setView('cram_mode')}>
          <Suspense fallback={<Loader />}>
            <CramMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'polypharmacy_puzzle' && (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Coming Soon
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            Polypharmacy Puzzle is currently under development.
          </p>
          <button
            onClick={exit}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:opacity-90 transition-opacity"
          >
            Return to Home
          </button>
        </div>
      )}

      {view === 'commuter_mode' && (
        <WithGeminiErrorBoundary viewName="commuter_mode" onRetry={() => setView('commuter_mode')}>
          <Suspense fallback={<Loader />}>
            <CommuterMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'medical_wordle' && (
        <WithGeminiErrorBoundary
          viewName="medical_wordle"
          onRetry={() => setView('medical_wordle')}
        >
          <Suspense fallback={<Loader />}>
            <MedicalWordleMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'diagnostic_puzzle' && (
        <WithGeminiErrorBoundary
          viewName="diagnostic_puzzle"
          onRetry={() => setView('diagnostic_puzzle')}
        >
          <Suspense fallback={<Loader />}>
            <DiagnosticPuzzleMode onExit={handleExitDrill} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'full_sit_down_test' && (
        <WithGeminiErrorBoundary
          viewName="full_sit_down_test"
          onRetry={() => setView('full_sit_down_test')}
        >
          <Suspense fallback={<Loader />}>
            <FullSitDownTestMode onExit={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'core_adaptive' && (
        <WithGeminiErrorBoundary viewName="core_adaptive" onRetry={() => setView('core_adaptive')}>
          <Suspense fallback={<Loader />}>
            <CoreAdaptiveSession onExit={exit} {...sharedQuizProps} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}

      {view === 'admin_media' && (
        <WithGeminiErrorBoundary viewName="admin_media" onRetry={() => setView('admin_media')}>
          <Suspense fallback={<Loader />}>
            <MediaApproval onClose={exit} />
          </Suspense>
        </WithGeminiErrorBoundary>
      )}
    </>
  );
};
