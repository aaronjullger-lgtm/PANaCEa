/**
 * Lazy-loaded components for code splitting
 * Centralized to reduce App.tsx size and improve maintainability
 */

import React, { lazy } from 'react';

const productionDeferred = (
  label: string
): React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>> =>
  lazy(async () => ({
    default: () =>
      React.createElement(
        'div',
        {
          className:
            'mx-auto flex min-h-[45vh] max-w-xl flex-col justify-center px-6 py-16 text-[var(--color-text-primary)]',
        },
        React.createElement(
          'div',
          {
            className:
              'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]',
          },
          React.createElement(
            'p',
            {
              className:
                'text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]',
            },
            'Private beta'
          ),
          React.createElement(
            'h1',
            { className: 'mt-3 text-2xl font-semibold' },
            `${label} is not enabled for this launch.`
          ),
          React.createElement(
            'p',
            { className: 'mt-3 text-sm leading-6 text-[var(--color-text-secondary)]' },
            'The production launch is focused on the core study loop, review, progress, study plan, and content lookup.'
          )
        )
      ),
  }));

export const QuizViewWithErrorBoundary = lazy(
  () => import('../components/session/QuizViewWithErrorBoundary')
);
export const SessionRunner = lazy(() => import('../components/session/SessionRunner'));
export const PhotoDrillSession = productionDeferred('Photo drill');
export const RapidRecallDrill = productionDeferred('Rapid recall');
export const DDxCompareDrill = productionDeferred('Differential comparison');
export const MiniLabDrillSession = productionDeferred('Mini lab drill');
export const PharmDrillSession = productionDeferred('Pharmacology drill');
export const FirstLineDrillSession = productionDeferred('First-line drill');
export const ConditionDrillSession = lazy(() =>
  import('../components/session/StudyModeAdaptiveSession').then((m) => ({
    default: m.ConditionDrillSession,
  }))
);
export const GuidelineDrillSession = productionDeferred('Guideline drill');
export const SystemDrillSession = lazy(() =>
  import('../components/session/StudyModeAdaptiveSession').then((m) => ({
    default: m.SystemDrillSession,
  }))
);
export const PharmacologyDrillSession = productionDeferred('Pharmacology drill');
export const SubcategoryDrillSession = productionDeferred('Subcategory drill');
export const VentilatorDrillSession = productionDeferred('Ventilator drill');
export const PhysiologyDrillSession = productionDeferred('Physiology drill');
export const AnatomyDrillSession = productionDeferred('Anatomy drill');
export const ECGDrillSession = productionDeferred('ECG drill');
export const DermDrillSession = productionDeferred('Dermatology drill');
export const ImagingDrillSession = productionDeferred('Imaging drill');
export const FluidElectrolyteMode = productionDeferred('Fluid and electrolyte mode');
export const AntibioticMode = productionDeferred('Antibiotic mode');
export const PatientEncounterMode = productionDeferred('Patient encounter mode');
export const CodeBlueSpeedMode = productionDeferred('Code blue mode');
export const GrandRoundsMode = productionDeferred('Grand rounds mode');
export const ContrastiveDrillSession = productionDeferred('Contrastive drill');
export const ReasoningTutorMode = productionDeferred('Reasoning tutor mode');
export const CommuterMode = productionDeferred('Commuter mode');
export const CramMode = productionDeferred('Cram mode');
export const PolypharmacyPuzzleMode = productionDeferred('Polypharmacy puzzle');
export const MedicalWordleMode = productionDeferred('Medical word game');
export const DiagnosticPuzzleMode = productionDeferred('Diagnostic puzzle');
export const FullSitDownTestMode = productionDeferred('Full sit-down test');
export const IntegrationsHub = productionDeferred('Integrations');
export const SettingsStatsModal = lazy(() => import('../components/modals/SettingsStatsModal'));
export const KeyboardShortcutsModal = lazy(
  () => import('../components/modals/KeyboardShortcutsModal')
);
export const PANRELASimulator = productionDeferred('PANRE-LA simulator');
export const CommandPalette = lazy(() => import('../components/navigation/CommandPalette'));
export const UserProfileModal = lazy(() => import('../components/onboarding/UserProfileModal'));
export const BaselineAssessment = lazy(() =>
  import('../components/onboarding/BaselineAssessment').then((m) => ({
    default: m.BaselineAssessment,
  }))
);
export const OnboardingYourPlan = lazy(() =>
  import('../components/onboarding/OnboardingYourPlan').then((m) => ({
    default: m.OnboardingYourPlan,
  }))
);
export const MediaApproval = lazy(() => import('../pages/admin/MediaApproval'));
export const CoreAdaptiveSession = lazy(() => import('../components/session/CoreAdaptiveSession'));
// StudyGroupDashboard removed — social API not implemented
export const ToolkitHub = lazy(() => import('../components/toolkit/ToolkitHub'));
export const GapAnalysisDashboard = lazy(() =>
  import('../components/dashboard/GapAnalysisDashboard').then((m) => ({
    default: m.GapAnalysisDashboard,
  }))
);
export const StudyPathDashboard = lazy(() =>
  import('../components/dashboard/StudyPathDashboard').then((m) => ({
    default: m.default,
  }))
);
export const CommandCenterHub = lazy(() => import('../components/navigation/CommandCenterHub'));
export const TrainingMenu = lazy(() => import('../components/dashboard/TrainingMenu'));
export const DailyChallengesHub = lazy(() =>
  import('../components/pages/DailyChallengesHub').then((m) => ({ default: m.DailyChallengesHub }))
);
export const MedicalDatabaseWorkspacePage = lazy(() => import('../pages/MedicalDatabaseWorkspacePage'));
export const ExplorerWorkspacePage = productionDeferred('Explorer workspace');
export const LiveCollaborationWorkspacePage = productionDeferred('Live collaboration workspace');
export const SimulationPage = lazy(() => import('../pages/SimulationPage'));
export const CommandCenterPage = productionDeferred('Command center workspace');
export const ClinicalReferenceLibrary = lazy(
  () => import('../components/library/ClinicalReferenceLibrary')
);
export const SmartConditionView = lazy(() =>
  import('../components/library/SmartConditionView').then((m) => ({
    default: m.SmartConditionView,
  }))
);

export const KnowledgeBaseHub = lazy(() =>
  import('../components/knowledge/KnowledgeBaseHub').then((m) => ({ default: m.KnowledgeBaseHub }))
);
export const MyLibraryPage = lazy(() =>
  import('../components/pages/MyLibraryPage').then((m) => ({ default: m.MyLibraryPage }))
);
export const TutorChatPage = lazy(() =>
  import('../components/pages/TutorChatPage').then((m) => ({ default: m.TutorChatPage }))
);
export const AgentChat = productionDeferred('Agent chat');
export const StudyCompanionPage = lazy(() =>
  import('../components/pages/StudyCompanionPage').then((m) => ({ default: m.StudyCompanionPage }))
);
export const SrsFlashcardView = lazy(() =>
  import('../components/session/SrsFlashcardView').then((m) => ({ default: m.SrsFlashcardView }))
);
export const CustomStudyMode = productionDeferred('Custom study mode');
export const QuestionCurationPanel = lazy(() => import('../components/admin/QuestionCurationPanel'));
export const ClinicalProfileDashboard = lazy(
  () => import('../components/dashboard/ClinicalProfile/ClinicalProfileDashboard')
);
export const AdminDashboard = lazy(() =>
  import('../pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
export const TaxonomiesPage = lazy(() =>
  import('../pages/admin/TaxonomiesPage').then((m) => ({ default: m.TaxonomiesPage }))
);
export const SystemMappingsPage = lazy(() =>
  import('../pages/admin/SystemMappingsPage').then((m) => ({ default: m.SystemMappingsPage }))
);
export const QuestionGeneratorPage = lazy(() =>
  import('../pages/admin/QuestionGeneratorPage').then((m) => ({ default: m.QuestionGeneratorPage }))
);
export const RefineryPage = lazy(() =>
  import('../pages/admin/RefineryPage').then((m) => ({ default: m.RefineryPage }))
);
export const MyPearlsPanel = lazy(() => import('../components/pearls/MyPearlsPanel'));
export const ClinicalEyePage = lazy(() => import('../pages/ClinicalEyePage'));
export const VisualizerPage = lazy(() => import('../pages/VisualizerPage'));
export const CrossSystemExplorer = productionDeferred('Cross-system explorer');
export const MedicalDatabaseSearch = productionDeferred('External medical database search');
export const LiveStudySession = productionDeferred('Live study session');
export const LectureConverterPage = lazy(() => import('../pages/LectureConverterPage'));
export const TechniqueCheckPage = lazy(() => import('../pages/TechniqueCheckPage'));
export const CalibrationDashboard = productionDeferred('Calibration dashboard');
export const AnalyticsDashboard = productionDeferred('Advanced analytics');
export const DatabaseAnalyticsDashboard = productionDeferred('Database analytics');
export const LearningProfileDashboard = productionDeferred('Learning profile');
export const AdvancedLearningProfileDashboard = productionDeferred('Advanced learning profile');
export const UserFriendlyStatsDisplay = productionDeferred('Experimental stats display');
export const PracticePage = lazy(() => import('../pages/PracticePage').then((m) => ({ default: m.PracticePage })));
export const ProgressPage = lazy(() => import('../pages/ProgressPage').then((m) => ({ default: m.ProgressPage })));
export const ElaborationDrill = productionDeferred('Elaboration drill');
export const ICDCodingDrill = productionDeferred('ICD coding drill');
export const TeachBackDrill = productionDeferred('Teach-back drill');
export const IllnessScriptView = lazy(() =>
  import('../components/library/IllnessScriptView').then((m) => ({
    default: m.IllnessScriptView,
  }))
);
