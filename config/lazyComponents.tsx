/**
 * Lazy-loaded components for code splitting
 * Centralized to reduce App.tsx size and improve maintainability
 */

import { lazy } from 'react';

export const QuizViewWithErrorBoundary = lazy(
  () => import('../components/session/QuizViewWithErrorBoundary')
);
export const SessionRunner = lazy(() => import('../components/session/SessionRunner'));
export const MenuView = lazy(() => import('../components/navigation/MenuView'));
export const PhotoDrillSession = lazy(() => import('../components/session/PhotoDrillSession'));
export const RapidRecallDrill = lazy(() => import('../components/drill/recall/RapidRecallDrill'));
export const DDxCompareDrill = lazy(() => import('../components/drill/ddx/DDxCompareDrill'));
export const MiniLabDrillSession = lazy(() => import('../components/drill/MiniLabDrillSession'));
export const PharmDrillSession = lazy(() => import('../components/drill/PharmDrillSession'));
export const FirstLineDrillSession = lazy(
  () => import('../components/drill/FirstLineDrillSession')
);
export const ConditionDrillSession = lazy(
  () => import('../components/drill/ConditionDrillSession')
);
export const GuidelineDrillSession = lazy(
  () => import('../components/drill/GuidelineDrillSession')
);
export const SystemDrillSession = lazy(() => import('../components/drill/SystemDrillSession'));
export const PharmacologyDrillSession = lazy(
  () => import('../components/drill/PharmacologyDrillSession')
);
export const SubcategoryDrillSession = lazy(
  () => import('../components/drill/SubcategoryDrillSession')
);
export const VentilatorDrillSession = lazy(
  () => import('../components/drill/VentilatorDrillSession')
);
export const PhysiologyDrillSession = lazy(
  () => import('../components/drill/PhysiologyDrillSession')
);
export const AnatomyDrillSession = lazy(() => import('../components/drill/AnatomyDrillSession'));
export const ECGDrillSession = lazy(() => import('../components/drill/ECGDrillSession'));
export const DermDrillSession = lazy(() => import('../components/drill/DermDrillSession'));
export const ImagingDrillSession = lazy(() => import('../components/drill/ImagingDrillSession'));
export const FluidElectrolyteMode = lazy(() => import('../components/modes/FluidElectrolyteMode'));
export const AntibioticMode = lazy(() => import('../components/modes/AntibioticMode'));
export const PatientEncounterMode = lazy(() => import('../components/modes/PatientEncounterMode'));
export const CodeBlueSpeedMode = lazy(() => import('../components/modes/CodeBlueSpeedMode'));
export const GrandRoundsMode = lazy(() => import('../components/modes/GrandRoundsMode'));
export const ContrastiveDrillSession = lazy(() =>
  import('../components/drill/ContrastiveDrillSession').then((m) => ({
    default: m.ContrastiveDrillSession,
  }))
);
export const ReasoningTutorMode = lazy(() => import('../components/modes/ReasoningTutorMode'));
export const CommuterMode = lazy(() => import('../components/modes/CommuterMode'));
export const CramMode = lazy(() =>
  import('../components/modes').then((m) => ({ default: m.CramMode }))
);
export const PolypharmacyPuzzleMode = lazy(() =>
  import('../components/modes').then((m) => ({ default: m.PolypharmacyPuzzleMode }))
);
export const MedicalWordleMode = lazy(() =>
  import('../components/modes').then((m) => ({ default: m.MedicalWordleMode }))
);
export const DiagnosticPuzzleMode = lazy(() =>
  import('../components/modes').then((m) => ({ default: m.DiagnosticPuzzleMode }))
);
export const FullSitDownTestMode = lazy(() =>
  import('../components/modes').then((m) => ({ default: m.FullSitDownTestMode }))
);
export const IntegrationsHub = lazy(() => import('../components/integrations/IntegrationsHub'));
export const SettingsStatsModal = lazy(() => import('../components/modals/SettingsStatsModal'));
export const KeyboardShortcutsModal = lazy(
  () => import('../components/modals/KeyboardShortcutsModal')
);
export const PANRELASimulator = lazy(
  () => import('../components/lifelong-learning/PANRELASimulator')
);
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
export const StudyGroupDashboard = lazy(() => import('../components/social/StudyGroupDashboard'));
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
  import('@/components/pages/DailyChallengesHub').then((m) => ({ default: m.DailyChallengesHub }))
);
export const SimulationPage = lazy(() =>
  import('../pages/SimulationPage').then((m) => ({ default: m.SimulationPage }))
);
export const CommandCenterPage = lazy(() =>
  import('../pages/CommandCenterPage').then((m) => ({ default: m.CommandCenterPage }))
);
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
export const StudyCompanionPage = lazy(() =>
  import('../components/pages/StudyCompanionPage').then((m) => ({ default: m.StudyCompanionPage }))
);
export const SrsFlashcardView = lazy(() =>
  import('../components/session/SrsFlashcardView').then((m) => ({ default: m.SrsFlashcardView }))
);
export const CustomStudyMode = lazy(() => import('../components/modes/CustomStudyMode'));
export const QuestionCurationPanel = lazy(
  () => import('../components/admin/QuestionCurationPanel')
);
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
export const ClinicalEyePage = lazy(() =>
  import('../pages/ClinicalEyePage').then((m) => ({ default: m.ClinicalEyePage }))
);
export const VisualizerPage = lazy(() =>
  import('../pages/VisualizerPage').then((m) => ({ default: m.VisualizerPage }))
);
export const CrossSystemExplorer = lazy(() =>
  import('../components/explorer/CrossSystemExplorer').then((m) => ({ default: m.CrossSystemExplorer }))
);
export const MedicalDatabaseSearch = lazy(() =>
  import('../components/external/MedicalDatabaseSearch').then((m) => ({
    default: m.MedicalDatabaseSearch,
  }))
);
export const LiveStudySession = lazy(() =>
  import('../components/collaboration/LiveStudySession').then((m) => ({
    default: m.LiveStudySession,
  }))
);
export const LectureConverterPage = lazy(() =>
  import('../pages/LectureConverterPage').then((m) => ({ default: m.LectureConverterPage }))
);
export const TechniqueCheckPage = lazy(() =>
  import('../pages/TechniqueCheckPage').then((m) => ({ default: m.TechniqueCheckPage }))
);
export const AnalyticsDashboard = lazy(() => import('../components/analytics/AnalyticsDashboard'));
export const DatabaseAnalyticsDashboard = lazy(() => import('../components/analytics/DatabaseAnalyticsDashboard'));
export const LearningProfileDashboard = lazy(() => import('../components/analytics/LearningProfileDashboard'));
export const AdvancedLearningProfileDashboard = lazy(() => import('../components/analytics/AdvancedLearningProfileDashboard'));
export const UserFriendlyStatsDisplay = lazy(() => import('../components/analytics/UserFriendlyStatsDisplay'));
export const PracticePage = lazy(() => import('../pages/PracticePage').then((m) => ({ default: m.PracticePage })));
export const ProgressPage = lazy(() => import('../pages/ProgressPage').then((m) => ({ default: m.ProgressPage })));
