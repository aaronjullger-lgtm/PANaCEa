// AppRoutes.tsx — All <Routes> / <Route> definitions extracted from App.tsx.
// Imported and rendered by App.tsx inside the provider tree.
import React, { Suspense, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Shield, User, HelpCircle } from 'lucide-react';
import { ROUTES } from './routes';
import { type View, pageVariants } from './appViews';
import { NavRail } from '../components/layout/NavRail';
import { AppBrand } from '../components/layout/AppBrand';
import { DrillViewRouter } from '../components/layout/DrillViewRouter';
import {
  QuizViewWithErrorBoundary,
  SessionRunner,
  MenuView,
  SettingsStatsModal,
  KeyboardShortcutsModal,
  CommandPalette,
  UserProfileModal,
  BaselineAssessment,
  OnboardingYourPlan,
  ToolkitHub,
  GapAnalysisDashboard,
  CommandCenterHub,
  TrainingMenu,
  SimulationPage,
  CommandCenterPage,
  KnowledgeBaseHub,
  MyLibraryPage,
  TutorChatPage,
  StudyCompanionPage,
  SrsFlashcardView,
  CustomStudyMode,
  ClinicalProfileDashboard,
  AdminDashboard,
  TaxonomiesPage,
  SystemMappingsPage,
  QuestionGeneratorPage,
  RefineryPage,
  QuestionCurationPanel,
  MyPearlsPanel,
  ClinicalEyePage,
  VisualizerPage,
  CrossSystemExplorer,
  MedicalDatabaseSearch,
  LiveStudySession,
  PracticePage,
  ProgressPage,
  DailyChallengesHub,
  StudyPathDashboard,
} from './lazyComponents';
import { BehavioralTrackerProvider } from '@/components/quiz/Tracker';
import { Loader, CommandCenterSkeleton, DrillLoadingState } from '../components/loading';
import { EnhancedErrorMessage } from '../components/shared/EnhancedErrorMessage';
import { NotFoundPage } from '../components/error/NotFoundPage';
import ThemeToggleButton from '../components/ui/ThemeToggleButton';
import { MasteryHeatmapToggle } from '../components/ui/MasteryHeatmapToggle';
import { OfflineSyncIndicator } from '../components/offline/OfflineSyncIndicator';
import { ProductTour } from '../components/onboarding/ProductTour';
import { WithGeminiErrorBoundary, ErrorBoundary } from '../components/error/ErrorBoundary';
import type {
  Question as QuizQuestion,
  PerformanceRecord,
  SessionSettings,
  ErrorTag,
  UserProfile,
} from '../types';

// Re-export SimulationFocus type so callers can reference it
export type SimulationFocus = 'all' | 'growth' | 'flagged' | 'due';
type OnboardingStep = 'profile' | 'baseline' | 'your_plan';

export interface AppRoutesProps {
  // View state
  view: View;
  setView: (v: View) => void;
  showNotFound: boolean;

  // Loading / error
  isLoading: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  setIsLoading: (v: boolean) => void;

  // Session state
  sessionSettings: SessionSettings | null;
  questionQueue: QuizQuestion[];
  setQuestionQueue: React.Dispatch<React.SetStateAction<QuizQuestion[]>>;
  quizKey: number;
  hasActiveSession: boolean;

  // Performance / question data
  performanceData: PerformanceRecord[];
  heatmapPerformance: PerformanceRecord[];
  missedQuestions: QuizQuestion[];
  flaggedQuestions: QuizQuestion[];
  dueQuestionsCount: number;
  growthAreas: string[];
  isSyncing: boolean;
  isStatsLoading: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;

  // Font size
  fontSizeAdjustment: number;
  setFontSizeAdjustment: React.Dispatch<React.SetStateAction<number>>;

  // Modal state
  isModalOpen: boolean;
  setIsModalOpen: (v: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (v: boolean) => void;
  isShortcutsModalOpen: boolean;
  setIsShortcutsModalOpen: (v: boolean) => void;
  isHelpModalOpen: boolean;
  setIsHelpModalOpen: (v: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (v: boolean) => void;
  isOnboardingModalOpen: boolean;
  onboardingStep: OnboardingStep | null;
  onboardingWeakestSystems: string[];
  onboardingExamDate: string | null;
  setOnboardingExamDate: (d: string) => void;
  showProductTour: boolean;
  setShowProductTour: (v: boolean) => void;
  showProTip: boolean;
  setShowProTip: (v: boolean) => void;

  // Navigation handlers
  handleNavigateToDrillMode: (modeId: string) => void;
  _handleNavigateToDrillWithSystem: (modeId: string, system: string) => void;
  handleNavigateToSimulation: (settings?: { initialFocus?: SimulationFocus }) => void;
  handleNavigateToModeRoute: (route: string, modeId: string) => void;
  handleNavigateToCustomStudy: () => void;
  handleNavigateToStudyPathDashboard: () => void;

  // Session handlers
  handleStartSession: (settings?: SessionSettings) => void;
  handleConfirmSession: (settings: SessionSettings, preloadedQueue?: QuizQuestion[]) => void;
  handleEndSession: () => void;
  handleBackToQuiz: () => void;
  handleReviewMissed: (() => void) | undefined;
  handleTrainingMenuStart: (modeId: string, focus?: SimulationFocus) => void;

  // Performance callbacks
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: QuizQuestion) => void;
  updateReviewQuestion: (question: QuizQuestion, wasCorrect: boolean) => void;
  removeDueConcept: (conditionId: string, taskType: string | null) => void;
  updateLastPerformanceErrorTag: (tag: ErrorTag) => void;
  addFlaggedQuestion: (question: QuizQuestion) => void;
  removeFlaggedQuestion: (question: QuizQuestion) => void;
  updateQuestionNote: (question: QuizQuestion, note: string) => void;
  handleRemoveBookmark: (question: QuizQuestion) => void;
  clearPerformanceData: () => void;
  clearMissedQuestionsData: () => void;
  clearFlaggedQuestionsData: () => void;

  // Onboarding handlers
  handleOnboardingComplete: (profile: UserProfile) => void;
  handleOnboardingSkip: () => void;
  handleBaselineComplete: (results: { weakestSystems: string[] }) => void;
  handleBaselineSkip: () => void;
  handleYourPlanStartSession: () => void;
  handleYourPlanSkip: () => void;

  // Misc
  theme: string;
  setTheme: (t: string) => void;
  examLabel: string;
  commandCenterInitialTab: 'training' | 'resources' | 'analytics' | undefined;
  simulationInitialFocus: SimulationFocus;
  initialDrillSystem: string | null;
  pageTransition: object;
  startViewTransition: (fn: () => void) => void;
  showGuestModeBanner: boolean;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
  view,
  setView,
  showNotFound,
  isLoading,
  error,
  setError,
  setIsLoading,
  sessionSettings,
  questionQueue,
  setQuestionQueue,
  quizKey,
  hasActiveSession,
  performanceData,
  heatmapPerformance,
  missedQuestions,
  flaggedQuestions,
  dueQuestionsCount,
  growthAreas,
  isSyncing,
  isStatsLoading,
  lastSyncTime,
  syncError,
  fontSizeAdjustment,
  setFontSizeAdjustment,
  isModalOpen,
  setIsModalOpen,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  isShortcutsModalOpen,
  setIsShortcutsModalOpen,
  isHelpModalOpen,
  setIsHelpModalOpen,
  isCommandPaletteOpen,
  setIsCommandPaletteOpen,
  isOnboardingModalOpen,
  onboardingStep,
  onboardingWeakestSystems,
  onboardingExamDate,
  setOnboardingExamDate,
  showProductTour,
  setShowProductTour,
  showProTip,
  setShowProTip,
  handleNavigateToDrillMode,
  _handleNavigateToDrillWithSystem,
  handleNavigateToSimulation,
  handleNavigateToModeRoute,
  handleNavigateToCustomStudy,
  handleNavigateToStudyPathDashboard,
  handleStartSession,
  handleConfirmSession,
  handleEndSession,
  handleBackToQuiz,
  handleReviewMissed,
  handleTrainingMenuStart,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
  removeDueConcept,
  updateLastPerformanceErrorTag,
  addFlaggedQuestion,
  removeFlaggedQuestion,
  updateQuestionNote,
  handleRemoveBookmark,
  clearPerformanceData,
  clearMissedQuestionsData,
  clearFlaggedQuestionsData,
  handleOnboardingComplete,
  handleOnboardingSkip,
  handleBaselineComplete,
  handleBaselineSkip,
  handleYourPlanStartSession,
  handleYourPlanSkip,
  theme,
  setTheme,
  examLabel,
  commandCenterInitialTab,
  simulationInitialFocus,
  initialDrillSystem,
  pageTransition,
  startViewTransition,
  showGuestModeBanner,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>

    <Routes>
      <Route
        path="/practice"
        element={
          <Suspense fallback={<Loader message="Loading practice modes..." />}>
            <ErrorBoundary variant="page">
              <PracticePage
                onNavigateToDrillMode={handleNavigateToDrillMode}
                onNavigateToDrillWithSystem={_handleNavigateToDrillWithSystem}
              />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/progress"
        element={
          <Suspense fallback={<Loader message="Loading analytics..." />}>
            <ErrorBoundary variant="page">
              <ProgressPage
                performanceData={heatmapPerformance}
                dueCount={dueQuestionsCount}
              />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/daily-challenges"
        element={
          <Suspense fallback={<Loader message="Loading daily challenges..." />}>
            <ErrorBoundary variant="page">
              <DailyChallengesHub />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <Suspense fallback={<Loader message="Loading admin…" />}>
            <ErrorBoundary variant="page">
              <AdminDashboard onClose={() => navigate(ROUTES.STUDY)} />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/admin/curation"
        element={
          <Suspense fallback={<Loader message="Loading curation…" />}>
            <ErrorBoundary variant="page">
              <QuestionCurationPanel />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/admin/refinery"
        element={
          <Suspense fallback={<Loader message="Loading refinery…" />}>
            <ErrorBoundary variant="page">
              <RefineryPage onClose={() => navigate(ROUTES.STUDY)} />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/admin/taxonomies"
        element={
          <Suspense fallback={<Loader message="Loading taxonomies…" />}>
            <ErrorBoundary variant="page">
              <TaxonomiesPage />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/admin/system-mappings"
        element={
          <Suspense fallback={<Loader message="Loading system mappings…" />}>
            <ErrorBoundary variant="page">
              <SystemMappingsPage />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/admin/question-generator"
        element={
          <Suspense fallback={<Loader message="Loading question generator…" />}>
            <ErrorBoundary variant="page">
              <QuestionGeneratorPage />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/clinical-eye"
        element={
          <Suspense fallback={<Loader message="Loading Clinical Eye…" />}>
            <ErrorBoundary variant="page">
              <ClinicalEyePage onBack={() => navigate(ROUTES.STUDY)} />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="/visualizer"
        element={
          <Suspense fallback={<Loader message="Loading visualizer…" />}>
            <ErrorBoundary variant="page">
              <VisualizerPage onBack={() => navigate(ROUTES.STUDY)} />
            </ErrorBoundary>
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <>
            {showNotFound ? (
              <React.Fragment key="not-found">
                <NotFoundPage
                  currentPath={location.pathname}
                  onGoToDashboard={() => navigate(ROUTES.STUDY)}
                  onNavigateToPractice={() => navigate(ROUTES.PRACTICE)}
                  onNavigateToKnowledge={() => navigate(ROUTES.STUDY_KNOWLEDGE)}
                />
              </React.Fragment>
            ) : (
              <React.Fragment key="main">
                {/* Skip to Main Content - hidden until focused via keyboard (screen reader + a11y) */}
                <a
                  href="#main-content"
                  className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-[var(--color-accent)] focus-visible:text-[var(--color-text-inverse)] focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-accent)]"
                >
                  Skip to main content
                </a>
                {/* Header - fixed height so NavRail (sidebar) starts below it; z-50 above rail */}
                <header
                  className="sticky top-0 z-50 h-16 shrink-0 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] transition-all duration-300 shadow-sm backdrop-blur-md bg-opacity-95 dark:bg-opacity-95"
                  style={{ height: 'var(--header-height, 4rem)' }}
                >
                  <div className="h-full w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-[100vw]">
                    <AppBrand
                      size="sm"
                      asLink
                      onClick={() => {
                        navigate(ROUTES.STUDY);
                        setView('command_center');
                      }}
                    >
                      <OfflineSyncIndicator />
                      <Link
                        to={ROUTES.ADMIN}
                        className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/70 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                        aria-label="Admin Dashboard"
                      >
                        <Shield className="w-5 h-5" />
                      </Link>
                      <motion.button
                        ref={settingsButtonRef}
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/70 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                        aria-label="Settings and Stats"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Settings className="w-5 h-5" />
                      </motion.button>
                      <MasteryHeatmapToggle compact className="hidden sm:inline-flex" />
                      <button
                        type="button"
                        onClick={() => setIsHelpModalOpen(true)}
                        className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/70 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                        aria-label="Help and getting started"
                      >
                        <HelpCircle className="w-5 h-5" />
                      </button>
                      <ThemeToggleButton />
                    </AppBrand>
                  </div>
                </header>

                {/* Settings/Stats Modal */}
                <Suspense fallback={null}>
                  <SettingsStatsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => {
                      setIsSettingsModalOpen(false);
                      requestAnimationFrame(() => {
                        settingsButtonRef.current?.focus?.();
                      });
                    }}
                    performanceData={performanceData}
                    clearPerformanceData={clearPerformanceData}
                    clearMissedQuestionsData={clearMissedQuestionsData}
                    clearFlaggedQuestionsData={clearFlaggedQuestionsData}
                    missedQuestionsCount={missedQuestions.length}
                    flaggedQuestionsCount={flaggedQuestions.length}
                    isSyncing={isSyncing}
                    lastSyncTime={lastSyncTime}
                    syncError={syncError}
                    isLoadingStats={isStatsLoading}
                    theme={theme}
                    onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    onStartFirstSession={() => {
                      setIsSettingsModalOpen(false);
                      setIsModalOpen(true);
                    }}
                  />
                </Suspense>

                {/* Keyboard Shortcuts Modal */}
                <Suspense fallback={null}>
                  <KeyboardShortcutsModal
                    isOpen={isShortcutsModalOpen}
                    onClose={() => setIsShortcutsModalOpen(false)}
                  />
                </Suspense>

                {/* Help / Getting started modal */}
                {isHelpModalOpen && (
                  <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-sm"
                    onClick={() => setIsHelpModalOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="help-modal-title"
                  >
                    <div
                      className="bg-[var(--color-bg-primary)] rounded-2xl shadow-xl border border-[var(--color-border)] max-w-md w-full p-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h2
                          id="help-modal-title"
                          className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2"
                        >
                          <HelpCircle className="w-5 h-5 text-[var(--color-accent)]" />
                          Getting started
                        </h2>
                        <button
                          type="button"
                          onClick={() => setIsHelpModalOpen(false)}
                          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                          aria-label="Close"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <ul className="space-y-3 text-[var(--color-text-secondary)] text-sm mb-6">
                        <li>
                          <strong className="text-[var(--color-text-primary)]">Start a session</strong> — From the dashboard, click &quot;Start practice session&quot; or open the Practice tab to choose a mode.
                        </li>
                        <li>
                          <strong className="text-[var(--color-text-primary)]">Command palette</strong> — Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-xs">⌘K</kbd> (or Ctrl+K) to jump to any mode or page.
                        </li>
                        <li>
                          <strong className="text-[var(--color-text-primary)]">Grand Rounds</strong> — Try the daily challenge from Practice or the dashboard.
                        </li>
                        <li>
                          <strong className="text-[var(--color-text-primary)]">Toolkit</strong> — Use the Tools tab for calculators, generators, and reference tools.
                        </li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => setIsHelpModalOpen(false)}
                        className="w-full py-2.5 px-4 rounded-xl font-medium bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] hover:opacity-90 transition-opacity"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                )}

                {/* Full-screen views that break out of max-w-4xl constraint */}
                {view === 'reference_library' && (
                  <div
                    className="w-full min-w-0 overflow-hidden flex-1"
                    style={{ marginLeft: 'var(--nav-rail-width, 56px)' }}
                  >
                    <Suspense fallback={<Loader message="Loading knowledge base…" />}>
                      <ErrorBoundary variant="inline">
                        <KnowledgeBaseHub
                          onClose={() => {
                            setView('command_center');
                            navigate('/study');
                          }}
                        />
                      </ErrorBoundary>
                    </Suspense>
                  </div>
                )}

                {view === 'my_library' && (
                  <div
                    className="w-full min-w-0 overflow-hidden flex-1"
                    style={{ marginLeft: 'var(--nav-rail-width, 56px)' }}
                  >
                    <Suspense fallback={<Loader message="Loading library…" />}>
                      <ErrorBoundary variant="inline">
                        <MyLibraryPage onExit={() => setView('command_center')} />
                      </ErrorBoundary>
                    </Suspense>
                  </div>
                )}

                {view === 'pearl_deck' && (
                  <div
                    className="w-full min-w-0 overflow-hidden flex-1"
                    style={{ marginLeft: 'var(--nav-rail-width, 56px)' }}
                  >
                    <Suspense fallback={<Loader message="Loading pearl deck…" />}>
                      <ErrorBoundary variant="inline">
                        <MyPearlsPanel
                          onClose={() => setView('command_center')}
                          initialFilter="saved"
                        />
                      </ErrorBoundary>
                    </Suspense>
                  </div>
                )}

                {/* Glassmorphism quick-actions rail (persists across study views) */}
                <NavRail />

                {/* Standard views with max-w-4xl constraint */}
                {view !== 'reference_library' &&
                  view !== 'my_library' &&
                  view !== 'pearl_deck' && (
                    <main
                      id="main-content"
                      className="main-content-area min-h-screen min-w-0 max-w-full overflow-visible transition-all duration-300"
                      style={{
                        marginLeft: 'var(--nav-rail-width, 56px)',
                        paddingTop: 'var(--header-height, 4rem)',
                      }}
                    >
                      <div
                        className={`mx-auto min-w-0 max-w-full overflow-x-hidden px-4 sm:px-6 lg:px-8 ${view === 'command_center' || view === 'menu' ? 'max-w-6xl' : 'max-w-4xl'}`}
                      >
                        {isLoading &&
                          (sessionSettings ? (
                            <DrillLoadingState
                              message="Loading questions…"
                              variant="question"
                              showTimer={false}
                            />
                          ) : (
                            <Loader
                              message="Loading questions…"
                              forceDark={view === 'imaging_drill'}
                            />
                          ))}
                        {error && (
                          <EnhancedErrorMessage
                            title="Session Error"
                            description={error}
                            severity="error"
                            category="system"
                            dismissible
                            onDismiss={() => setError(null)}
                            showRetry={false}
                            className="mb-4"
                          />
                        )}

                        {/* Removed mode="wait" to allow overlapping transitions for faster perceived navigation */}
                        <AnimatePresence>
                          {view === 'command_center' && (
                            <motion.div
                              key="command_center"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <Suspense fallback={<CommandCenterSkeleton />}>
                                <ErrorBoundary variant="page">
                                <CommandCenterHub
                                  performanceData={heatmapPerformance}
                                  missedQuestions={missedQuestions}
                                  flaggedQuestions={flaggedQuestions}
                                  dueCount={dueQuestionsCount}
                                  isLoadingStats={isStatsLoading}
                                  initialStudyToolsTab={commandCenterInitialTab}
                                  onOpenSettings={() => setIsSettingsModalOpen(true)}
                                  onStartSession={handleStartSession}
                                  onNavigateToDrillMode={handleNavigateToDrillMode}
                                  onNavigateToDrillWithSystem={
                                    _handleNavigateToDrillWithSystem
                                  }
                                  onNavigateToToolkit={() => navigate(ROUTES.STUDY_TOOLKIT)}
                                  onNavigateToGapAnalysis={() =>
                                    startViewTransition(() => setView('gap_analysis'))
                                  }
                                  onNavigateToClinicalProfile={() =>
                                    setView('clinical_profile')
                                  }
                                  onNavigateToIntegrations={() => setView('integrations')}
                                  onNavigateToSimulation={handleNavigateToSimulation}
                                  onNavigateToReference={() =>
                                    navigate(ROUTES.STUDY_REFERENCE)
                                  }
                                  onNavigateToMyLibrary={() => setView('my_library')}
                                  onNavigateToCustomStudy={handleNavigateToCustomStudy}
                                  onNavigateToTutorChat={() => setView('tutor_chat')}
                                  onNavigateToStudyCompanion={() =>
                                    setView('study_companion')
                                  }
                                  // FSRS variant review: presents due variant PANCE MCQ questions; rating is fully implicit.
                                  onNavigateToSrsReview={() => setView('srs_review')}
                                  onNavigateToPearlDeck={() => setView('pearl_deck')}
                                  onNavigateToStudyPathDashboard={handleNavigateToStudyPathDashboard}
                                  growthAreas={growthAreas}
                                  examLabel={examLabel ?? 'PANCE'}
                                  hasActiveSession={hasActiveSession}
                                  onResumeSession={handleBackToQuiz}
                                  resumeContext={
                                    hasActiveSession &&
                                    sessionSettings?.count != null &&
                                    sessionSettings.count > 0 &&
                                    questionQueue.length > 0
                                      ? {
                                          remaining: questionQueue.length,
                                          total: sessionSettings.count,
                                          current: Math.max(
                                            1,
                                            sessionSettings.count - questionQueue.length + 1
                                          ),
                                        }
                                      : undefined
                                  }
                                />
                                </ErrorBoundary>
                              </Suspense>
                            </motion.div>
                          )}

                          {view === 'menu' && (
                            <motion.div
                              key="menu"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <Suspense fallback={<Loader message="Loading menu…" />}>
                                <MenuView
                                  performanceData={heatmapPerformance}
                                  missedQuestions={missedQuestions}
                                  flaggedQuestions={flaggedQuestions}
                                  onBackToQuiz={handleBackToQuiz}
                                  hasActiveSession={hasActiveSession}
                                  setIsLoading={setIsLoading}
                                  setError={setError}
                                  onStartSession={handleStartSession}
                                  onConfirmSession={handleConfirmSession}
                                  onRemoveBookmark={handleRemoveBookmark}
                                  growthAreas={growthAreas}
                                  onNavigateToDrillMode={handleNavigateToDrillMode}
                                  onNavigateToIntegrations={() => setView('integrations')}
                                  // HIDDEN: Social feature disabled until API implemented
                                  // onNavigateToSocial={() => setView('social_dashboard')}
                                  onNavigateToToolkit={() => navigate(ROUTES.STUDY_TOOLKIT)}
                                  onNavigateToGapAnalysis={() =>
                                    startViewTransition(() => setView('gap_analysis'))
                                  }
                                  onNavigateToSimulation={handleNavigateToSimulation}
                                  isSyncing={isSyncing}
                                  lastSyncTime={lastSyncTime}
                                  syncError={syncError}
                                />
                              </Suspense>
                            </motion.div>
                          )}

                          {view === 'quiz' && sessionSettings && (
                            <motion.div
                              key={`quiz-${quizKey}`}
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="quiz"
                                onRetry={() => setView('quiz')}
                              >
                                <Suspense fallback={<Loader message="Loading session…" />}>
                                  <BehavioralTrackerProvider>
                                    <QuizViewWithErrorBoundary
                                      modeLabel="Practice → Adaptive Questions"
                                      initialQueue={questionQueue}
                                      setParentQueue={setQuestionQueue}
                                      addPerformanceRecord={addPerformanceRecord}
                                      addMissedQuestion={addMissedQuestion}
                                      updateReviewQuestion={updateReviewQuestion}
                                      removeDueConcept={removeDueConcept}
                                      updateLastPerformanceErrorTag={
                                        updateLastPerformanceErrorTag
                                      }
                                      setIsLoading={setIsLoading}
                                      setError={setError}
                                      sessionSettings={sessionSettings}
                                      growthAreas={growthAreas}
                                      onEndSession={handleEndSession}
                                      onShowMenu={() => setView('command_center')}
                                      performanceData={performanceData}
                                      fontSizeAdjustment={fontSizeAdjustment}
                                      setFontSizeAdjustment={setFontSizeAdjustment}
                                      flaggedQuestions={flaggedQuestions}
                                      addFlaggedQuestion={addFlaggedQuestion}
                                      removeFlaggedQuestion={removeFlaggedQuestion}
                                      updateQuestionNote={updateQuestionNote}
                                      onReviewMissed={
                                        performanceData.some((p) => !p.isCorrect)
                                          ? handleReviewMissed
                                          : undefined
                                      }
                                    />
                                  </BehavioralTrackerProvider>
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'session_runner' && (
                            <WithGeminiErrorBoundary
                              viewName="session_runner"
                              onRetry={() => setView('session_runner')}
                            >
                              <Suspense fallback={<Loader message="Loading session…" />}>
                                <SessionRunner
                                  onExit={() => setView('command_center')}
                                  addPerformanceRecord={addPerformanceRecord}
                                  addMissedQuestion={addMissedQuestion}
                                  updateReviewQuestion={updateReviewQuestion}
                                  removeDueConcept={removeDueConcept}
                                  updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
                                  performanceData={performanceData}
                                  fontSizeAdjustment={fontSizeAdjustment}
                                  setFontSizeAdjustment={setFontSizeAdjustment}
                                  flaggedQuestions={flaggedQuestions}
                                  addFlaggedQuestion={addFlaggedQuestion}
                                  removeFlaggedQuestion={removeFlaggedQuestion}
                                  updateQuestionNote={updateQuestionNote}
                                />
                              </Suspense>
                            </WithGeminiErrorBoundary>
                          )}

                          <DrillViewRouter
                            view={view}
                            setView={setView}
                            addPerformanceRecord={addPerformanceRecord}
                            addMissedQuestion={addMissedQuestion}
                            updateReviewQuestion={updateReviewQuestion}
                            updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
                            performanceData={performanceData}
                            fontSizeAdjustment={fontSizeAdjustment}
                            setFontSizeAdjustment={setFontSizeAdjustment}
                            flaggedQuestions={flaggedQuestions}
                            addFlaggedQuestion={addFlaggedQuestion}
                            removeFlaggedQuestion={removeFlaggedQuestion}
                            updateQuestionNote={updateQuestionNote}
                            initialDrillSystem={initialDrillSystem}
                            missedQuestions={missedQuestions}
                          />

                          {view === 'toolkit' && (
                            <motion.div
                              key="toolkit"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="toolkit"
                                onRetry={() => setView('toolkit')}
                              >
                                <Suspense fallback={<Loader message="Loading toolkit…" />}>
                                  <ToolkitHub
                                    onClose={() => {
                                      navigate(ROUTES.STUDY);
                                      setView('command_center');
                                    }}
                                    onNavigateToItem={handleNavigateToDrillMode}
                                  />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'gap_analysis' && (
                            <motion.div
                              key="gap_analysis"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="gap_analysis"
                                onRetry={() => setView('gap_analysis')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <GapAnalysisDashboard
                                    onStudySystem={(systemName: string) => {
                                      setView('command_center');
                                      handleConfirmSession({
                                        focus: 'topic',
                                        topic: systemName,
                                        count: 50,
                                      });
                                    }}
                                  />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'clinical_profile' && (
                            <motion.div
                              key="clinical_profile"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="clinical_profile"
                                onRetry={() => setView('clinical_profile')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <ClinicalProfileDashboard />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'training_menu' && (
                            <motion.div
                              key="training_menu"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="training_menu"
                                onRetry={() => setView('training_menu')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <TrainingMenu
                                    onClose={() => setView('command_center')}
                                    onNavigateToMode={(route, mode) =>
                                      handleNavigateToModeRoute(route, mode.id)
                                    }
                                    onStartSession={handleTrainingMenuStart}
                                    dueQuestionsCount={dueQuestionsCount}
                                    flaggedQuestionsCount={flaggedQuestions.length}
                                    growthAreasCount={growthAreas.length}
                                  />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'simulation_page' && (
                            <motion.div
                              key="simulation_page"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="simulation_page"
                                onRetry={() => setView('simulation_page')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <SimulationPage
                                    onStartSession={handleConfirmSession}
                                    onBack={() => setView('command_center')}
                                    performanceData={heatmapPerformance}
                                    flaggedQuestions={flaggedQuestions}
                                    growthAreas={growthAreas}
                                    examLabel={examLabel ?? 'PANCE'}
                                    initialFocus={simulationInitialFocus}
                                  />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'command_center_page' && (
                            <motion.div
                              key="command_center_page"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="command_center_page"
                                onRetry={() => setView('command_center_page')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <CommandCenterPage
                                    performanceData={heatmapPerformance}
                                    missedQuestions={missedQuestions}
                                    flaggedQuestions={flaggedQuestions}
                                    growthAreas={growthAreas}
                                    dueCount={dueQuestionsCount}
                                    examLabel={examLabel ?? 'PANCE'}
                                    onStartSession={handleStartSession}
                                    onNavigateToDrillMode={handleNavigateToDrillMode}
                                    onNavigateToToolkit={() =>
                                      navigate(ROUTES.STUDY_TOOLKIT)
                                    }
                                    onNavigateToGapAnalysis={() =>
                                      startViewTransition(() => setView('gap_analysis'))
                                    }
                                    onNavigateToIntegrations={() => setView('integrations')}
                                    onNavigateToReference={() =>
                                      navigate(ROUTES.STUDY_REFERENCE)
                                    }
                                    onNavigateToMyLibrary={() => setView('my_library')}
                                    onNavigateToStudyCompanion={() =>
                                      setView('study_companion')
                                    }
                                    onNavigateToSrsReview={() => setView('srs_review')}
                                    onBack={() => setView('command_center')}
                                  />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'custom_study' && (
                            <motion.div
                              key="custom_study"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="custom_study"
                                onRetry={() => setView('custom_study')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <CustomStudyMode
                                    onBack={() => setView('command_center')}
                                  />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'study_path_dashboard' && (
                            <motion.div
                              key="study_path_dashboard"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="study_path_dashboard"
                                onRetry={() => setView('study_path_dashboard')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <StudyPathDashboard />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'tutor_chat' && (
                            <motion.div
                              key="tutor_chat"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="tutor_chat"
                                onRetry={() => setView('tutor_chat')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <TutorChatPage onExit={() => setView('command_center')} />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'study_companion' && (
                            <motion.div
                              key="study_companion"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <WithGeminiErrorBoundary
                                viewName="study_companion"
                                onRetry={() => setView('study_companion')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <StudyCompanionPage
                                    onExit={() => setView('command_center')}
                                  />
                                </Suspense>
                              </WithGeminiErrorBoundary>
                            </motion.div>
                          )}

                          {view === 'srs_review' && (
                            <motion.div
                              key="srs_review"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <Suspense fallback={<Loader />}>
                                <SrsFlashcardView
                                  onExit={() => setView('command_center')}
                                />
                              </Suspense>
                            </motion.div>
                          )}

                          {view === 'medical_database' && (
                            <motion.div
                              key="medical_database"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <Suspense
                                fallback={
                                  <Loader message="Loading medical database search..." />
                                }
                              >
                                <MedicalDatabaseSearch
                                  onClose={() => setView('command_center')}
                                />
                              </Suspense>
                            </motion.div>
                          )}

                          {view === 'live_collaboration' && (
                            <motion.div
                              key="live_collaboration"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <Suspense
                                fallback={
                                  <Loader message="Loading live study session..." />
                                }
                              >
                                <LiveStudySession
                                  onClose={() => setView('command_center')}
                                />
                              </Suspense>
                            </motion.div>
                          )}

                          {view === 'cross_system_explorer' && (
                            <motion.div
                              key="cross_system_explorer"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                            >
                              <Suspense
                                fallback={
                                  <Loader message="Loading cross‑system explorer..." />
                                }
                              >
                                <CrossSystemExplorer
                                  onClose={() => setView('command_center')}
                                />
                              </Suspense>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </main>
                  )}

                {/* Command Palette */}
                <Suspense fallback={null}>
                  <CommandPalette
                    isOpen={isCommandPaletteOpen}
                    onClose={() => setIsCommandPaletteOpen(false)}
                    onNavigate={handleNavigateToDrillMode}
                    onNavigatePath={(path) => navigate(path)}
                  />
                </Suspense>

                {/* Global Session Setup Modal */}
                <AnimatePresence>
                  {isModalOpen && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
                      onClick={() => setIsModalOpen(false)}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] p-4 md:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                            Training Command Center
                          </h2>
                          <button
                            onClick={() => setIsModalOpen(false)}
                            className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                            aria-label="Close modal"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                        <Suspense fallback={<Loader />}>
                          <TrainingMenu
                            onStartSession={handleTrainingMenuStart}
                            onNavigateToMode={(route, mode) => {
                              setIsModalOpen(false);
                              handleNavigateToModeRoute(route, mode.id);
                            }}
                            onClose={() => setIsModalOpen(false)}
                            dueQuestionsCount={dueQuestionsCount}
                            flaggedQuestionsCount={flaggedQuestions.length}
                            growthAreasCount={growthAreas.length}
                          />
                        </Suspense>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Onboarding: Profile → Baseline (optional) → Your plan */}
                <Suspense fallback={null}>
                  {isOnboardingModalOpen &&
                    (onboardingStep === 'profile' || onboardingStep === null) && (
                      <UserProfileModal
                        isOpen={true}
                        onComplete={handleOnboardingComplete}
                        onSkip={handleOnboardingSkip}
                        canSkip={true}
                      />
                    )}
                  {isOnboardingModalOpen && onboardingStep === 'baseline' && (
                    <BaselineAssessment
                      onComplete={handleBaselineComplete}
                      onSkip={handleBaselineSkip}
                    />
                  )}
                  {isOnboardingModalOpen && onboardingStep === 'your_plan' && (
                    <OnboardingYourPlan
                      weakestSystems={onboardingWeakestSystems}
                      examDate={onboardingExamDate ?? undefined}
                      onStartSession={handleYourPlanStartSession}
                      onSetExamDate={(date) => setOnboardingExamDate(date)}
                      onSkip={handleYourPlanSkip}
                    />
                  )}
                </Suspense>

                {/* Post-onboarding product tour */}
                <ProductTour
                  isOpen={showProductTour}
                  onClose={() => setShowProductTour(false)}
                />

                {/* One-time pro tip after onboarding */}
                {showProTip && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] max-w-md mx-4 px-4 py-3 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] shadow-lg flex items-center gap-3">
                    <p className="text-sm text-[var(--color-text-primary)]">
                      Pro tip: Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs">⌘K</kbd> to open the command palette and jump to any mode.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('hasSeenAIPrompt', '1');
                        }
                        setShowProTip(false);
                      }}
                      className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] hover:opacity-90"
                    >
                      Got it
                    </button>
                  </div>
                )}
              </React.Fragment>
            )}
          </>
        }
      />
    </Routes>
    </>
  );
};
