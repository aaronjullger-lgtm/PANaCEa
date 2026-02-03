/**
 * Lazy-loaded components for code splitting
 * Centralized to reduce App.tsx size and improve maintainability
 */

import { lazy } from 'react';

export const QuizView = lazy(() => import('../components/session/QuizView'));
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
  import('../components/onboarding/BaselineAssessment').then((m) => ({ default: m.BaselineAssessment }))
);
export const OnboardingYourPlan = lazy(() =>
  import('../components/onboarding/OnboardingYourPlan').then((m) => ({ default: m.OnboardingYourPlan }))
);
export const MediaApproval = lazy(() => import('../pages/admin/MediaApproval'));
export const StudyGroupDashboard = lazy(() => import('../components/social/StudyGroupDashboard'));
export const ToolkitHub = lazy(() => import('../components/toolkit/ToolkitHub'));
export const GapAnalysisDashboard = lazy(
  () => import('../components/dashboard/GapAnalysisDashboard')
);
export const CommandCenterHub = lazy(() => import('../components/navigation/CommandCenterHub'));
export const TrainingMenu = lazy(() => import('../components/dashboard/TrainingMenu'));
export const SimulationPage = lazy(() =>
  import('../pages/SimulationPage').then((m) => ({ default: m.SimulationPage }))
);
export const CommandCenterPage = lazy(() =>
  import('../pages/CommandCenterPage').then((m) => ({ default: m.CommandCenterPage }))
);
export const ClinicalReferenceLibrary = lazy(
  () => import('../components/library/ClinicalReferenceLibrary')
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
export const MyPearlsPanel = lazy(() => import('../components/pearls/MyPearlsPanel'));
export const ClinicalEyePage = lazy(() =>
  import('../pages/ClinicalEyePage').then((m) => ({ default: m.ClinicalEyePage }))
);
export const VisualizerPage = lazy(() =>
  import('../pages/VisualizerPage').then((m) => ({ default: m.VisualizerPage }))
);