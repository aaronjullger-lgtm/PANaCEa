// AppRoutes.tsx — All <Routes> / <Route> definitions extracted from App.tsx.
// Imported and rendered by App.tsx inside the provider tree.
import React, { Suspense, useRef, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle } from 'lucide-react';
import { ROUTES } from './routes';
import { type View, pageVariants } from './appViews';
import { AppLayout } from '../components/layout/AppLayout';
import { DrillViewRouter } from '../components/layout/DrillViewRouter';
import {
  QuizViewWithErrorBoundary,
  SessionRunner,
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
  AgentChat,
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
  MedicalDatabaseWorkspacePage,
  ExplorerWorkspacePage,
  LiveCollaborationWorkspacePage,
  PracticePage,
  ProgressPage,
  DailyChallengesHub,
  StudyPathDashboard,
  LectureConverterPage,
  TechniqueCheckPage,
} from './lazyComponents';
import { BehavioralTrackerProvider } from '@/components/quiz/Tracker';
import { Loader, CommandCenterSkeleton, DrillLoadingState } from '../components/loading';
import { EnhancedErrorMessage } from '../components/shared/EnhancedErrorMessage';
import { StudyTimerOverlay } from '../components/shared/StudyTimerOverlay';
import { NotFoundPage } from '../components/error/NotFoundPage';
import { AdminRoute } from '../components/auth/AdminRoute';
import { AuthenticatedRoute } from '../components/auth/AuthenticatedRoute';
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
  const normalizedView = view === 'menu' ? 'command_center' : view;
  const contentMaxWidth =
    normalizedView === 'command_center' ||
    normalizedView === 'my_library' ||
    normalizedView === 'study_companion' ||
    normalizedView === 'pearl_deck' ||
    normalizedView === 'agent_chat'
      ? '80rem'
      : normalizedView === 'quiz' || normalizedView === 'session_runner'
        ? '64rem'
        : '56rem';

  // Scroll to top on route change (replaces ScrollRestoration which requires data router)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <ErrorBoundary key={location.key} variant="global">
      <Routes>
      <Route
        path="/practice"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="80rem">
              <Suspense fallback={<Loader message="Loading practice modes..." />}>
                <ErrorBoundary variant="page">
                  <PracticePage
                    onNavigateToDrillMode={handleNavigateToDrillMode}
                    onNavigateToDrillWithSystem={_handleNavigateToDrillWithSystem}
                  />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/progress"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="80rem">
              <Suspense fallback={<Loader message="Loading analytics..." />}>
                <ErrorBoundary variant="page">
                  <ProgressPage
                    performanceData={heatmapPerformance}
                    dueCount={dueQuestionsCount}
                  />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/daily-challenges"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading daily challenges..." />}>
                <ErrorBoundary variant="page">
                  <DailyChallengesHub />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      {/* ── Migrated view-state routes (self-contained, no heavy session state) ── */}
      <Route
        path="/study/knowledge"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading knowledge base…" />}>
                <ErrorBoundary variant="page">
                  <KnowledgeBaseHub
                    onClose={() => navigate(ROUTES.STUDY)}
                  />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/study/utilities"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading toolkit…" />}>
                <ErrorBoundary variant="page">
                  <ToolkitHub
                    onClose={() => navigate(ROUTES.STUDY)}
                    onNavigateToItem={handleNavigateToDrillMode}
                  />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/study/path"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading study path…" />}>
                <ErrorBoundary variant="page">
                  <StudyPathDashboard />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/gap-analysis"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader />}>
                <ErrorBoundary variant="page">
                  <GapAnalysisDashboard
                    onStudySystem={(systemName: string) => {
                      handleConfirmSession({
                        focus: 'topic',
                        topic: systemName,
                        count: 50,
                      });
                      navigate(ROUTES.STUDY);
                    }}
                  />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/clinical-profile"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader />}>
                <ErrorBoundary variant="page">
                  <ClinicalProfileDashboard />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/medical-database"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading medical database search..." />}>
                <ErrorBoundary variant="page">
                  <MedicalDatabaseWorkspacePage />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/live-collaboration"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading live study session..." />}>
                <ErrorBoundary variant="page">
                  <LiveCollaborationWorkspacePage />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/explorer"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading cross‑system explorer..." />}>
                <ErrorBoundary variant="page">
                  <ExplorerWorkspacePage />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      {/* ── Admin routes — client-side guarded by AdminRoute ── */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Suspense fallback={<Loader message="Loading admin…" />}>
              <ErrorBoundary variant="page">
                <AdminDashboard onClose={() => navigate(ROUTES.STUDY)} />
              </ErrorBoundary>
            </Suspense>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/curation"
        element={
          <AdminRoute>
            <Suspense fallback={<Loader message="Loading curation…" />}>
              <ErrorBoundary variant="page">
                <QuestionCurationPanel />
              </ErrorBoundary>
            </Suspense>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/refinery"
        element={
          <AdminRoute>
            <Suspense fallback={<Loader message="Loading refinery…" />}>
              <ErrorBoundary variant="page">
                <RefineryPage onClose={() => navigate(ROUTES.STUDY)} />
              </ErrorBoundary>
            </Suspense>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/taxonomies"
        element={
          <AdminRoute>
            <Suspense fallback={<Loader message="Loading taxonomies…" />}>
              <ErrorBoundary variant="page">
                <TaxonomiesPage />
              </ErrorBoundary>
            </Suspense>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/system-mappings"
        element={
          <AdminRoute>
            <Suspense fallback={<Loader message="Loading system mappings…" />}>
              <ErrorBoundary variant="page">
                <SystemMappingsPage />
              </ErrorBoundary>
            </Suspense>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/question-generator"
        element={
          <AdminRoute>
            <Suspense fallback={<Loader message="Loading question generator…" />}>
              <ErrorBoundary variant="page">
                <QuestionGeneratorPage />
              </ErrorBoundary>
            </Suspense>
          </AdminRoute>
        }
      />
      <Route
        path="/clinical-eye"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading Clinical Eye…" />}>
                <ErrorBoundary variant="page">
                  <ClinicalEyePage onBack={() => navigate(ROUTES.STUDY)} />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/visualizer"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading visualizer…" />}>
                <ErrorBoundary variant="page">
                  <VisualizerPage onBack={() => navigate(ROUTES.STUDY)} />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/lecture-converter"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading lecture converter…" />}>
                <ErrorBoundary variant="page">
                  <LectureConverterPage onBack={() => navigate(ROUTES.STUDY)} />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
        }
      />
      <Route
        path="/technique-check"
        element={
          <AuthenticatedRoute>
            <AppLayout contentMaxWidth="88rem">
              <Suspense fallback={<Loader message="Loading technique check…" />}>
                <ErrorBoundary variant="page">
                  <TechniqueCheckPage onBack={() => navigate(ROUTES.STUDY)} />
                </ErrorBoundary>
              </Suspense>
            </AppLayout>
          </AuthenticatedRoute>
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

                <AppLayout
                  onSettingsClick={() => setIsSettingsModalOpen(true)}
                  onHelpClick={() => setIsHelpModalOpen(true)}
                  contentMaxWidth={contentMaxWidth}
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

                  <AnimatePresence mode="popLayout">
                    {normalizedView === 'my_library' && (
                      <motion.div
                        key="my_library"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                      >
                        <Suspense fallback={<Loader message="Loading library…" />}>
                          <ErrorBoundary variant="inline">
                            <MyLibraryPage onExit={() => setView('command_center')} />
                          </ErrorBoundary>
                        </Suspense>
                      </motion.div>
                    )}

                    {normalizedView === 'pearl_deck' && (
                      <motion.div
                        key="pearl_deck"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                      >
                        <Suspense fallback={<Loader message="Loading pearl deck…" />}>
                          <ErrorBoundary variant="inline">
                            <MyPearlsPanel
                              onClose={() => setView('command_center')}
                              initialFilter="saved"
                            />
                          </ErrorBoundary>
                        </Suspense>
                      </motion.div>
                    )}

                    {normalizedView === 'command_center' && (
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
                              onNavigateToDrillWithSystem={_handleNavigateToDrillWithSystem}
                              onNavigateToToolkit={() => navigate(ROUTES.STUDY_UTILITIES)}
                              onNavigateToGapAnalysis={() =>
                                startViewTransition(() => setView('gap_analysis'))
                              }
                              onNavigateToClinicalProfile={() => setView('clinical_profile')}
                              onNavigateToIntegrations={() => setView('integrations')}
                              onNavigateToSimulation={handleNavigateToSimulation}
                              onNavigateToReference={() => navigate(ROUTES.STUDY_KNOWLEDGE)}
                              onNavigateToMyLibrary={() => setView('my_library')}
                              onNavigateToCustomStudy={handleNavigateToCustomStudy}
                              onNavigateToTutorChat={() => setView('tutor_chat')}
                              onNavigateToStudyCompanion={() => setView('study_companion')}
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

                          {/* Study timer overlay for session and drill views */}
                          {(view === 'session_runner' || view === 'quiz' || view === 'srs_review') && (
                            <StudyTimerOverlay />
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
                                      navigate(ROUTES.STUDY_UTILITIES)
                                    }
                                    onNavigateToGapAnalysis={() =>
                                      startViewTransition(() => setView('gap_analysis'))
                                    }
                                    onNavigateToIntegrations={() => setView('integrations')}
                                    onNavigateToReference={() =>
                                      navigate(ROUTES.STUDY_KNOWLEDGE)
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

                          {view === 'agent_chat' && (
                            <motion.div
                              key="agent_chat"
                              variants={pageVariants}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={pageTransition}
                              className="h-full min-h-0"
                            >
                              <WithGeminiErrorBoundary
                                viewName="agent_chat"
                                onRetry={() => setView('agent_chat')}
                              >
                                <Suspense fallback={<Loader />}>
                                  <AgentChat onExit={() => setView('command_center')} />
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
                  </AnimatePresence>
                </AppLayout>

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
    </ErrorBoundary>
  );
};
