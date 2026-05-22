import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  X,
  MessageSquare,
  Send,
  User,
  Clock,
  Award,
  CheckCircle,
  XCircle,
  Globe,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Shield,
  Heart,
  ClipboardList,
  Stethoscope as StethoscopeIcon,
  Phone,
  Activity,
  Stethoscope,
  Microscope,
  FileText,
  Pill,
  ChevronRight,
  FlaskConical,
  AlertTriangle,
} from "lucide-react";
import type { PatientEncounterCase, PatientQuestion, EncounterSession } from "@/types/drill-modes";
import type { PlacedOrder, ExamFinding } from "@/types/osce-enhanced";
import {
  OrderPanel,
  ExamPanel,
  RapportMeter,
  OSCELiveSession,
  EncounterTimer,
  EncounterWorkstation,
} from "./osce";
import type { EncounterPhase } from "@/hooks/useEncounterReducer";
import type { PhysicalFinding, DiagnosticResult } from "@/hooks/useEncounterReducer";
import type { ClinicalFidelitySettings } from "@/hooks/useClinicalFidelitySettings";
import type { AVState } from "@/types/patient-av-state-machine";
import { ChatSkeleton, InlineButtonSpinner } from "@/components/loading";
import { Sparkline } from "@/components/ui/Sparkline";
import { formatPatientAgeShort } from "@/lib/utils/ageFormatter";
import { hapticSuccess, hapticError } from "@/lib/hapticFeedback";

export interface EncounterActiveViewProps {
  onExit?: () => void;
  currentCase: PatientEncounterCase;
  session: EncounterSession;
  phase: EncounterPhase;
  isPaused: boolean;
  encounterStartTime: number;
  currentQuestion: string;
  userDiagnosis: string;
  treatmentPlan: string;
  newDifferential: string;
  differentialDiagnoses: string[];
  physicalFindings: PhysicalFinding[];
  diagnosticResults: DiagnosticResult[];
  diagnosisFeedback: { isCorrect: boolean; correctDiagnosis?: string; score: number; feedback: string } | null;
  treatmentFeedback: { feedback: string; isAppropriate: boolean; score: number } | null;
  isLoading: boolean;
  isTyping: boolean;
  typingStatusIndex: number;
  languageMode: "english" | "spanish" | "side-by-side";
  isPatientInfoExpanded: boolean;
  showRapportMeter: boolean;
  showExamPanel: boolean;
  showOrderPanel: boolean;
  showLiveSession: boolean;
  emrTab: string;
  enhancedOSCE: any;
  currentVitals: { hr: number; sbp: number; dbp: number; rr: number; o2: number };
  vitalsHistory: { hr: number[]; sbp: number[]; dbp: number[]; rr: number[]; o2: number[] };
  isFidelityModeActive: boolean;
  clinicalFidelity: ClinicalFidelitySettings;
  currentAVState: AVState | null;
  loadingStatusIndex: number;
  setCurrentQuestion: (val: string) => void;
  setUserDiagnosis: (val: string) => void;
  setTreatmentPlan: (val: string) => void;
  setNewDifferential: (val: string) => void;
  setDifferentialDiagnoses: React.Dispatch<React.SetStateAction<string[]>>;
  setShowRapportMeter: React.Dispatch<React.SetStateAction<boolean>>;
  setShowExamPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowOrderPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLiveSession: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPatientInfoExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setEmrTab: React.Dispatch<React.SetStateAction<string>>;
  toggleLanguageMode: () => void;
  togglePause: () => void;
  handleAskQuestion: () => Promise<void>;
  handlePhysicalExam: () => Promise<void>;
  handleOrderTest: () => Promise<void>;
  handleAddDifferential: () => void;
  handleSubmitDiagnosis: () => Promise<void>;
  handleTreatmentSubmit: () => Promise<void>;
  handleEndEncounter: () => Promise<void>;
  advancePhase: (target?: EncounterPhase) => void;
  getTranslatedText: (text: string) => string;
  generateTrendData: (currentValueStr: string) => number[] | null;
  handlePhaseSelect: (p: EncounterPhase) => void;
  handleOrderPlace: (orders: PlacedOrder[]) => void;
  handleExamPerformed: (finding: ExamFinding) => void;
  handleCloseOrderPanel: () => void;
  handleCloseExamPanel: () => void;
}

const LOADING_STATUS_MESSAGES = [
  "Reviewing patient chart…",
  "Nurse is paging the patient…",
  "Pulling up vitals…",
  "Room is being prepared…",
];

const TYPING_STATUS_MESSAGES = [
  "Reading vitals…",
  "Reviewing your question…",
  "Patient is responding…",
  "Checking chart…",
];

const EncounterActiveView: React.FC<EncounterActiveViewProps> = ({
  onExit,
  currentCase,
  session,
  phase,
  isPaused,
  encounterStartTime,
  currentQuestion,
  userDiagnosis,
  treatmentPlan,
  newDifferential,
  differentialDiagnoses,
  physicalFindings,
  diagnosticResults,
  diagnosisFeedback,
  treatmentFeedback,
  isLoading,
  isTyping,
  typingStatusIndex,
  languageMode,
  isPatientInfoExpanded,
  showRapportMeter,
  showExamPanel,
  showOrderPanel,
  showLiveSession,
  emrTab,
  enhancedOSCE,
  currentVitals,
  vitalsHistory,
  isFidelityModeActive,
  clinicalFidelity,
  currentAVState,
  loadingStatusIndex,
  setCurrentQuestion,
  setUserDiagnosis,
  setTreatmentPlan,
  setNewDifferential,
  setDifferentialDiagnoses,
  setShowRapportMeter,
  setShowExamPanel,
  setShowOrderPanel,
  setShowLiveSession,
  setIsPatientInfoExpanded,
  setEmrTab,
  toggleLanguageMode,
  togglePause,
  handleAskQuestion,
  handlePhysicalExam,
  handleOrderTest,
  handleAddDifferential,
  handleSubmitDiagnosis,
  handleTreatmentSubmit,
  handleEndEncounter,
  advancePhase,
  getTranslatedText,
  generateTrendData,
  handlePhaseSelect,
  handleOrderPlace,
  handleExamPerformed,
  handleCloseOrderPanel,
  handleCloseExamPanel,
}) => {
  // Loading state
  if (!currentCase || !session) {
    return (
    return (
      <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-data-neutral-bg flex items-center justify-center shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] border border-data-neutral">
                <MessageSquare className="w-6 h-6 text-data-neutral" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-data-neutral">Virtual OSCE</h1>
                <p className="text-sm text-data-neutral">Preparing your encounter…</p>
              </div>
            </div>
            {onExit && (
              <Button
                variant="ghost"
                onClick={onExit}
                aria-label="Exit"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-data-neutral-bg rounded-xl border border-data-neutral overflow-hidden animate-pulse">
                <div className="p-4 md:p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-data-neutral-bg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-data-neutral-bg rounded" />
                    <div className="h-4 w-48 bg-data-neutral-bg rounded" />
                  </div>
                </div>
                <div className="px-4 pb-4 md:px-6 md:pb-6 space-y-3">
                  <div className="flex items-center gap-2 text-data-neutral">
                    <span className="w-2 h-2 rounded-full bg-data-neutral-bg animate-pulse" />
                    <span className="text-sm font-medium">
                      {LOADING_STATUS_MESSAGES[loadingStatusIndex]}
                    </span>
                  </div>
                  <div className="h-24 bg-data-neutral-bg rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-20 bg-data-neutral-bg rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral">
                <div className="h-4 w-24 bg-data-neutral-bg rounded mb-4" />
                <div className="flex gap-2">
                  <div className="flex-1 h-12 bg-data-neutral-bg rounded-lg" />
                  <div className="w-12 h-12 bg-data-neutral-bg rounded-lg" />
                </div>
              </div>
            </div>
            <div className="bg-data-neutral-bg rounded-xl border border-data-neutral p-4 md:p-6 min-h-[320px] flex flex-col items-center justify-center">
              <p className="text-data-neutral text-sm text-center max-w-xs">
                Conversation will appear here once the patient is ready.
              </p>
              <div className="flex items-center gap-2 mt-4 text-data-neutral">
                <div
                  className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
    );
  }

  // Active encounter - sidebar content
  const sidebarJsx = (
  if (viewState === 'active' && currentCase && session) {
    // Sidebar content for EncounterWorkstation (Rapport + Encounter Log)
    const sidebarJsx = (
      <>
        {showRapportMeter && enhancedOSCE.state.isSessionActive && (
          <motion.div initial={{ y: -10 }} animate={{ y: 0 }}>
            <RapportMeter
              meter={enhancedOSCE.state.rapportMeter}
              emotionalState={enhancedOSCE.state.emotionalState ?? undefined}
              personality={enhancedOSCE.state.personality ?? undefined}
              compact
            />
          </motion.div>
        )}
        <motion.div
          initial={{ x: 20 }}
          animate={{ x: 0 }}
          className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md h-[600px] flex flex-col min-w-[250px] break-words"
        >
          <h3 className="text-lg font-semibold mb-4 text-data-neutral">Encounter Log</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {session.questions.map((q: { questionText: string; response: string }, idx: number) => (
              <div key={`hist-${idx}`} className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
                <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                  <MessageSquare className="w-3 h-3" /> History
                </div>
                <p className="text-[var(--color-text-inverse)] font-semibold">Q: {q.questionText}</p>
                <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                  A: {getTranslatedText(q.response)}
                </p>
              </div>
            ))}
            {physicalFindings.map((f, idx) => (
              <div key={`phys-${idx}`} className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
                <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                  <Stethoscope className="w-3 h-3" /> Physical Exam
                </div>
                <p className="text-[var(--color-text-inverse)] font-semibold">Exam: {f.maneuver}</p>
                <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                  Finding: {f.finding}
                </p>
              </div>
            ))}
            {diagnosticResults.map((d, idx) => {
              const trendData = generateTrendData(d.result);
              return (
                <div key={`diag-${idx}`} className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
                  <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                    <ClipboardList className="w-3 h-3" /> Diagnostic
                  </div>
                  <p className="text-[var(--color-text-inverse)] font-semibold">{d.testName}</p>
                  {isFidelityModeActive && clinicalFidelity.rawLabValues && trendData && (
                    <div className="flex items-center gap-1 h-6 mt-1">
                      {trendData.map((val, ti) => (
                        <div
                          key={ti}
                          className="w-1.5 bg-[var(--color-accent)] rounded-full opacity-70"
                          style={{ height: `${Math.max(4, Math.min(24, (val / Math.max(...trendData)) * 24))}px` }}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                    {d.result} — {d.interpretation}
                  </p>
                </div>
              );
            })}
            {diagnosisFeedback && (
              <div className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                  style={{ color: diagnosisFeedback.isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>
                  <ClipboardList className="w-3 h-3" /> Diagnosis Submitted
                </div>
                <p className="text-[var(--color-text-inverse)] font-semibold">{userDiagnosis}</p>
                <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                  {diagnosisFeedback.isCorrect ? 'Correct!' : `Expected: ${diagnosisFeedback.correctDiagnosis ?? 'N/A'}`}
                </p>
              </div>
            )}
            {isTyping && (
              <div className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral animate-pulse">
                <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                  <MessageSquare className="w-3 h-3" />
                  {TYPING_STATUS_MESSAGES[typingStatusIndex]}
                </div>
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {isLoading && session.questions.length === 0 && (
              <ChatSkeleton />
            )}
            {session.questions.length === 0 && physicalFindings.length === 0 && diagnosticResults.length === 0 && !isLoading && (
              <p className="text-[var(--color-text-secondary)] text-center py-8 italic">
                Start the encounter by asking about the patient's history.
              </p>
            )}
          </div>
        </motion.div>
      </>
    );

    return (
      <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-data-neutral-bg flex items-center justify-center shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] border border-data-neutral">
                <MessageSquare className="w-6 h-6 text-data-neutral" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-data-neutral">Virtual OSCE</h1>
                <p className="text-sm text-data-neutral">
                  Phase: <span className="font-semibold text-data-neutral uppercase">{phase}</span>
                </p>
              </div>
            </div>

            {/* Phase Progress Indicator */}
            <div className="hidden md:flex items-center gap-2">
              {['history', 'physical', 'diagnostic', 'diagnosis', 'treatment'].map((p, idx) => {
                const phases = ['history', 'physical', 'diagnostic', 'diagnosis', 'treatment'];
                const currentIdx = phases.indexOf(phase);
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={p} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 
                      ${
                        isCompleted
                          ? 'bg-data-neutral-bg border-data-neutral text-[var(--color-text-inverse)]'
                          : isCurrent
                            ? 'bg-data-neutral-bg border-data-neutral text-[var(--color-text-inverse)]'
                            : 'bg-transparent border-data-neutral text-data-neutral'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    {idx < phases.length - 1 && (
                      <div
                        className={`w-8 h-0.5 ${isCompleted ? 'bg-data-pass' : 'bg-[var(--color-border)]'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Phase Indicator */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-data-neutral-bg animate-pulse" />
              <span className="text-xs font-bold text-data-neutral uppercase tracking-widest">
                {phase}
              </span>
              {session.id && (
                <button
                  onClick={() => setShowLiveSession(true)}
                  className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors"
                  title="Live voice patient"
                  aria-label="Live voice patient"
                >
                  <Phone className="w-4 h-4 text-data-neutral" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Pause Toggle */}
              <button
                onClick={togglePause}
                className={`p-1.5 rounded-md transition-colors border ${
                  isPaused
                    ? 'bg-[var(--color-data-provisional)]/20 border-[var(--color-data-provisional)]/40 text-[var(--color-data-provisional)]'
                    : 'border-transparent text-data-neutral hover:text-[var(--color-text-inverse)]'
                }`}
                title={isPaused ? 'Resume encounter' : 'Pause encounter'}
                aria-label={isPaused ? 'Resume encounter' : 'Pause encounter'}
              >
                {isPaused ? <ArrowRight className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </button>

              {/* Encounter Timer */}
              <EncounterTimer
                startTime={encounterStartTime}
                isActive={viewState === 'active'}
                isPaused={isPaused}
                pausedMs={pausedMs}
                targetMinutes={15}
                compact
              />

              {/* Enhanced OSCE Panel Toggles */}
              <div className="hidden md:flex items-center gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-1 border border-[var(--color-border)]">
                <button
                  onClick={() => setShowRapportMeter(!showRapportMeter)}
                  className={`p-2 rounded-md transition-colors ${showRapportMeter ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Rapport Meter"
                  aria-label="Toggle Rapport Meter"
                >
                  <Heart className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowExamPanel(!showExamPanel)}
                  className={`p-2 rounded-md transition-colors ${showExamPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Physical Exam Panel"
                  aria-label="Toggle Physical Exam Panel"
                >
                  <StethoscopeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowOrderPanel(!showOrderPanel)}
                  className={`p-2 rounded-md transition-colors ${showOrderPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Order Panel"
                  aria-label="Toggle Order Panel"
                >
                  <ClipboardList className="w-4 h-4" />
                </button>
                {session.id && (
                  <button
                    onClick={() => setShowLiveSession(true)}
                    className={`p-2 rounded-md transition-colors ${showLiveSession ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                    title="Live voice patient"
                    aria-label="Open live voice patient"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Clinical Fidelity Badge */}
              {isFidelityModeActive && (
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <Shield className="w-3.5 h-3.5 text-data-neutral" />
                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest">
                    Fidelity
                  </span>
                </div>
              )}
              <button
                onClick={toggleLanguageMode}
                aria-label="Toggle Language Mode"
                className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors flex items-center gap-2 border border-data-neutral"
                title="Toggle Language (English / Spanish / Side-by-Side)"
              >
                <Globe className="w-4 h-4 text-data-neutral" />
                <span className="text-xs font-medium text-data-neutral uppercase w-8 text-center">
                  {languageMode === 'side-by-side'
                    ? 'Dual'
                    : languageMode === 'spanish'
                      ? 'ES'
                      : 'EN'}
                </span>
              </button>
              {/* Timer is rendered by EncounterTimer component above */}
              {onExit && (
                <Button
                  variant="ghost"
                  onClick={onExit}
                  aria-label="Exit Encounter"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live Voice Patient overlay */}
        {showLiveSession && session.id && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4">
            <div className="relative max-w-md w-full">
              <OSCELiveSession
                sessionId={session.id}
                patientContext={
                  currentCase
                    ? {
                        patientName: currentCase.patientName,
                        age: typeof currentCase.age === 'number' ? currentCase.age : undefined,
                        sex: currentCase.sex,
                        chiefComplaint: currentCase.chiefComplaint,
                      }
                    : undefined
                }
                avState={currentAVState}
                onClose={() => setShowLiveSession(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content — Clinical Workstation Layout */}
        <EncounterWorkstation
          vitals={{
            hr: currentVitals.hr,
            sbp: currentVitals.sbp ?? 120,
            dbp: currentVitals.dbp ?? 80,
            rr: currentVitals.rr,
            o2: currentVitals.o2,
          }}
          vitalsHistory={vitalsHistory}
          phase={phase}
          onPhaseSelect={handlePhaseSelect}
          avState={currentAVState}
          showOrders={showOrderPanel}
          showExam={showExamPanel}
          onToggleOrders={() => setShowOrderPanel(!showOrderPanel)}
          onToggleExam={() => setShowExamPanel(!showExamPanel)}
          orderPanel={
            <OrderPanel
              isOpen={showOrderPanel}
              onOrderPlace={handleOrderPlace}
              placedOrders={enhancedOSCE.state.orders}
              onClose={handleCloseOrderPanel}
            />
          }
          examPanel={
            <ExamPanel
              onExamPerformed={handleExamPerformed}
              completedExams={enhancedOSCE.state.examFindings}
              suggestedRegions={enhancedOSCE.getSuggestedExams(
                currentCase?.chiefComplaint || ''
              )}
              caseData={
                currentCase
                  ? {
                      physicalExamData: currentCase.physicalExamData,
                      correctDiagnosis: currentCase.correctDiagnosis,
                    }
                  : undefined
              }
              onClose={handleCloseExamPanel}
            />
          }
          sidebarContent={sidebarJsx}
        >
              {/* Patient Card (Collapsible) */}
              <motion.div
                initial={{ x: -20 }}
                animate={{ x: 0 }}
                className="bg-data-neutral-bg rounded-xl border border-data-neutral shadow-md overflow-hidden"
              >
                <div
                  className="p-4 md:p-6 flex items-start gap-4 cursor-pointer hover:bg-data-neutral-bg/50 transition-colors"
                  onClick={() => setIsPatientInfoExpanded(!isPatientInfoExpanded)}
                >
                  <div className="w-12 h-12 rounded-xl bg-data-neutral-bg flex items-center justify-center border border-data-neutral flex-shrink-0">
                    <User className="w-6 h-6 text-data-neutral" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-data-neutral truncate">
                        {currentCase.patientName}
                      </h2>
                      <button
                        aria-label={isPatientInfoExpanded ? 'Collapse patient info' : 'Expand patient info'}
                        aria-expanded={isPatientInfoExpanded}
                        className="text-data-neutral p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {isPatientInfoExpanded ? (
                          <ChevronUp aria-hidden="true" className="w-5 h-5" />
                        ) : (
                          <ChevronDown aria-hidden="true" className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-data-neutral truncate text-sm">
                      {formatPatientAgeShort(currentCase.age)} {currentCase.sex} •{' '}
                      {currentCase.chiefComplaint.substring(0, 40)}
                      {currentCase.chiefComplaint.length > 40 ? '...' : ''}
                    </p>
                  </div>
                </div>

                <AnimatePresence>
                  {isPatientInfoExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 pb-4 md:px-6 md:pb-6 space-y-3"
                    >
                      {clinicalFidelity.emrInterface ? (
                        <>
                          <div
                            className="flex border-b border-data-neutral"
                            role="tablist"
                            aria-label="EMR sections"
                          >
                            {(['hpi', 'pmh', 'meds', 'vitals', 'labs'] as const).map((tab) => (
                              <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={emrTab === tab ? 'true' : 'false'}
                                onClick={() => setEmrTab(tab)}
                                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                  emrTab === tab
                                    ? 'border-[var(--color-accent)] text-[var(--color-text-inverse)]'
                                    : 'border-transparent text-data-neutral hover:text-data-neutral'
                                }`}
                              >
                                {tab === 'hpi'
                                  ? 'HPI'
                                  : tab === 'pmh'
                                    ? 'PMH'
                                    : tab === 'meds'
                                      ? 'Meds'
                                      : tab === 'vitals'
                                        ? 'Vitals'
                                        : 'Labs'}
                              </button>
                            ))}
                          </div>
                          <div
                            className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral min-h-[120px]"
                            role="tabpanel"
                          >
                            {emrTab === 'hpi' && (
                              <>
                                <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                                  Chief Complaint
                                </p>
                                <p className="text-lg font-semibold text-[var(--color-text-inverse)] whitespace-pre-wrap mb-4">
                                  {currentCase?.chiefComplaint
                                    ? getTranslatedText(currentCase.chiefComplaint)
                                    : '—'}
                                </p>
                                <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                                  History of Present Illness
                                </p>
                                <p className="text-sm text-data-neutral whitespace-pre-wrap">
                                  {currentCase?.historyData &&
                                  typeof currentCase.historyData === 'object'
                                    ? (currentCase.historyData['HPI'] ??
                                      currentCase.historyData['hpi'] ??
                                      currentCase.historyData['presentIllness'] ??
                                      (Object.entries(currentCase.historyData)
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join('\n\n') ||
                                        'No HPI documented.'))
                                    : 'No HPI documented.'}
                                </p>
                              </>
                            )}
                            {emrTab === 'pmh' && (
                              <p className="text-sm text-data-neutral whitespace-pre-wrap">
                                {currentCase?.historyData &&
                                typeof currentCase.historyData === 'object'
                                  ? (currentCase.historyData['pastMedicalHistory'] ??
                                    currentCase.historyData['PMH'] ??
                                    currentCase.historyData['pmh'] ??
                                    currentCase.historyData['Past Medical History'] ??
                                    (Object.entries(currentCase.historyData)
                                      .filter(([k]) => /pmh|past|medical|history/i.test(k))
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join('\n\n') ||
                                      'No PMH documented.'))
                                  : 'No PMH documented.'}
                              </p>
                            )}
                            {emrTab === 'meds' && (
                              <p className="text-sm text-data-neutral whitespace-pre-wrap">
                                {currentCase?.historyData &&
                                typeof currentCase.historyData === 'object'
                                  ? (currentCase.historyData['medications'] ??
                                    currentCase.historyData['meds'] ??
                                    currentCase.historyData['Meds'] ??
                                    currentCase.historyData['Medications'] ??
                                    (Object.entries(currentCase.historyData)
                                      .filter(([k]) => /med|drug|rx/i.test(k))
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join('\n\n') ||
                                      'No medications documented.'))
                                  : 'No medications documented.'}
                              </p>
                            )}
                            {emrTab === 'labs' && (
                              <div className="text-sm text-data-neutral space-y-1">
                                {currentCase?.labData &&
                                typeof currentCase.labData === 'object' &&
                                Object.keys(currentCase.labData).length > 0
                                  ? Object.entries(currentCase.labData).map(([k, v]) => (
                                      <div
                                        key={k}
                                        className="flex justify-between gap-4 py-1 border-b border-data-neutral last:border-0"
                                      >
                                        <span className="font-medium text-data-neutral">{k}</span>
                                        <span className="font-mono">{String(v)}</span>
                                      </div>
                                    ))
                                  : 'No labs documented.'}
                              </div>
                            )}
                            {emrTab === 'vitals' && (
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">Blood Pressure</span>
                                  <span className="text-2xl font-mono font-bold text-[var(--color-text-inverse)]">{Math.round(currentVitals.sbp ?? 0)}/{Math.round(currentVitals.dbp ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">mmHg</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">Heart Rate</span>
                                  <span className="text-2xl font-mono font-bold text-[var(--color-text-inverse)]">{Math.round(currentVitals.hr ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">bpm</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">Respiratory Rate</span>
                                  <span className="text-2xl font-mono font-bold text-[var(--color-text-inverse)]">{Math.round(currentVitals.rr ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">/min</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">O₂ Saturation</span>
                                  <span className="text-2xl font-mono font-bold text-[var(--color-text-inverse)]">{Math.round(currentVitals.o2 ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                          <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                            Chief Complaint
                          </p>
                          <p className="text-lg font-semibold text-[var(--color-text-inverse)] whitespace-pre-wrap">
                            {currentCase?.chiefComplaint ? (
                              getTranslatedText(currentCase.chiefComplaint)
                            ) : (
                              <span className="inline-block w-32 h-4 bg-data-neutral-bg rounded animate-pulse"></span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* When EMR interface is OFF, show always-visible vitals monitor; when ON, vitals are in Vitals tab only */}
                      {!clinicalFidelity.emrInterface && (
                      <div className="rounded-lg p-4 border border-data-neutral space-y-3 bg-data-neutral-bg">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-data-neutral uppercase tracking-widest">
                            EMR Monitor
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-data-neutral flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-data-neutral-bg animate-pulse" />
                              Live
                            </span>
                            <button
                              type="button"
                              onClick={() => enhancedOSCE.timeTravel()}
                              className="text-[10px] font-bold uppercase tracking-widest text-data-neutral hover:text-data-neutral border border-data-neutral px-1 py-0.5 rounded"
                            >
                              Sim 24h
                            </button>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          {/* Blood Pressure Card */}
                          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                            <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">
                              Blood Pressure
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-[var(--color-text-inverse)] tabular-nums">
                                {Math.round(currentVitals.sbp ?? 0)}/
                                {Math.round(currentVitals.dbp ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-data-neutral">mmHg</span>
                            </div>
                            <div className="mt-3">
                              <Sparkline
                                data={vitalsHistory.sbp}
                                width={180}
                                height={40}
                                referenceRange={[90, 140]}
                                showDots={false}
                                fillArea
                              />
                            </div>
                          </div>

                          {/* Heart Rate Card */}
                          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                            <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">
                              Heart Rate
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-[var(--color-text-inverse)] tabular-nums">
                                {Math.round(currentVitals.hr ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-data-neutral">bpm</span>
                            </div>
                            <div className="mt-3">
                              <Sparkline
                                data={vitalsHistory.hr}
                                width={180}
                                height={40}
                                referenceRange={[60, 100]}
                                showDots={false}
                                fillArea
                              />
                            </div>
                          </div>

                          {/* Respiratory Rate Card */}
                          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                            <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">
                              Respiratory Rate
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-[var(--color-text-inverse)] tabular-nums">
                                {Math.round(currentVitals.rr ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-data-neutral">/min</span>
                            </div>
                            <div className="mt-3">
                              <Sparkline
                                data={vitalsHistory.rr}
                                width={180}
                                height={40}
                                referenceRange={[12, 20]}
                                showDots={false}
                                fillArea
                              />
                            </div>
                          </div>

                          {/* O₂ Saturation Card */}
                          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                            <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">
                              O₂ Saturation
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-[var(--color-text-inverse)] tabular-nums">
                                {Math.round(currentVitals.o2 ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-data-neutral">%</span>
                            </div>
                            <div className="mt-3">
                              <Sparkline
                                data={vitalsHistory.o2}
                                width={180}
                                height={40}
                                referenceRange={[94, 100]}
                                showDots={false}
                                fillArea
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Phase Specific Inputs */}

              {/* HISTORY PHASE */}
              {phase === 'history' && (
                <motion.div
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">Ask a Question</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="e.g., When did the chest pain start?"
                      className="flex-1 px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg 
                               text-data-neutral placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                      autoComplete="off"
                    />
                    <Button
                      variant="ghost"
                      onClick={handleAskQuestion}
                      disabled={!currentQuestion.trim()}
                      aria-label="Send Question"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => advancePhase('physical')}
                    >
                      Move to Physical Exam <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* PHYSICAL EXAM PHASE */}
              {phase === 'physical' && (
                <motion.div
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">
                    Perform Physical Exam
                  </h3>
                  <p className="text-sm text-data-neutral mb-3">
                    Describe the maneuver you want to perform (e.g., "Auscultate heart", "Palpate
                    abdomen").
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handlePhysicalExam()}
                      placeholder="e.g., Auscultate lungs"
                      className="flex-1 px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg 
                               text-data-neutral placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                      autoComplete="off"
                    />
                    <button
                      onClick={() => setShowRapportMeter(!showRapportMeter)}
                      className={`p-2 rounded-md transition-colors ${showRapportMeter ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Rapport Meter"
                      aria-label="Toggle Rapport Meter"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowExamPanel(!showExamPanel)}
                      className={`p-2 rounded-md transition-colors ${showExamPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Physical Exam Panel"
                      aria-label="Toggle Physical Exam Panel"
                    >
                      <StethoscopeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowOrderPanel(!showOrderPanel)}
                      className={`p-2 rounded-md transition-colors ${showOrderPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Order Panel"
                      aria-label="Toggle Order Panel"
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* DIAGNOSTIC PHASE */}
              {phase === 'diagnostic' && (
                <motion.div
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">Order Diagnostics</h3>
                  <p className="text-sm text-data-neutral mb-3">
                    Order labs or imaging (e.g., "CBC", "Chest X-Ray").
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleOrderTest()}
                      placeholder="e.g., CBC, BMP, CXR"
                      className="flex-1 px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg 
                               text-data-neutral placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                      autoComplete="off"
                    />
                    <Button
                      variant="ghost"
                      onClick={handleOrderTest}
                      disabled={!currentQuestion.trim() || isLoading}
                      aria-label="Order Diagnostic Test"
                    >
                      {isLoading ? (
                        <InlineButtonSpinner />
                      ) : (
                        <Activity className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => advancePhase('diagnosis')}
                    >
                      Move to Diagnosis <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* DIAGNOSIS PHASE */}
              {phase === 'diagnosis' && (
                <motion.div
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">Final Diagnosis</h3>
                  <input
                    type="text"
                    value={userDiagnosis}
                    onChange={(e) => setUserDiagnosis(e.target.value)}
                    placeholder="Enter your primary diagnosis..."
                    aria-label="Enter your primary diagnosis"
                    className="w-full px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg mb-4
                             text-data-neutral placeholder-data-neutral
                             focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                    autoComplete="off"
                  />

                  {/* Differential Diagnoses */}
                  <div className="mb-4">
                    <label className="text-sm font-medium text-data-neutral/80 mb-2 block">
                      Differential Diagnoses <span className="text-data-neutral/50">(optional, up to 10)</span>
                    </label>
                    {differentialDiagnoses.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {differentialDiagnoses.map((dx, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm
                                     bg-data-neutral/10 border border-data-neutral/30 text-data-neutral"
                          >
                            {dx}
                            <button
                              type="button"
                              onClick={() => setDifferentialDiagnoses((prev) => prev.filter((_, i) => i !== idx))}
                              className="ml-1 text-data-neutral/50 hover:text-data-fail transition-colors"
                              aria-label={`Remove ${dx}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {differentialDiagnoses.length < 10 && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDifferential}
                          onChange={(e) => setNewDifferential(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newDifferential.trim()) {
                              e.preventDefault();
                              handleAddDifferential();
                            }
                          }}
                          placeholder="Add a differential..."
                          aria-label="Add a differential diagnosis"
                          className="flex-1 px-3 py-2 bg-data-neutral-bg border border-data-neutral/40 rounded-lg text-sm
                                   text-data-neutral placeholder-data-neutral/50
                                   focus:outline-none focus:ring-1 focus:ring-data-neutral focus:border-transparent"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={handleAddDifferential}
                          disabled={!newDifferential.trim()}
                          className="px-3 py-2 bg-data-neutral/10 border border-data-neutral/30 rounded-lg text-sm
                                   text-data-neutral hover:bg-data-neutral/20 disabled:opacity-40
                                   disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleSubmitDiagnosis}
                    disabled={!userDiagnosis.trim() || isLoading}
                    className="w-full min-h-[44px] py-3"
                  >
                    {isLoading ? (
                      <>
                        <InlineButtonSpinner size="sm" />
                        Evaluating...
                      </>
                    ) : (
                      'Submit Diagnosis'
                    )}
                  </Button>
                </motion.div>
              )}

              {/* TREATMENT PHASE */}
              {phase === 'treatment' && (
                <motion.div
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md space-y-4"
                >
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-data-neutral">Treatment Plan</h3>
                    <p className="text-sm text-data-neutral mb-3">
                      Outline your management plan (medications, disposition, follow-up).
                    </p>
                    <textarea
                      value={treatmentPlan}
                      onChange={(e) => setTreatmentPlan(e.target.value)}
                      placeholder="e.g., Admit to telemetry, start Aspirin 325mg, Heparin drip..."
                      className="w-full px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg
                               text-[var(--color-text-inverse)] placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] min-h-[120px]"
                    />
                  </div>

                  {treatmentFeedback && (
                    <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                      <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                        Treatment Feedback
                      </p>
                      <p className="text-sm text-data-neutral">{treatmentFeedback.feedback}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {!treatmentFeedback && (
                      <button
                        onClick={handleTreatmentSubmit}
                        disabled={!treatmentPlan.trim() || isLoading}
                        className="flex-1 bg-data-neutral-bg hover:bg-data-neutral-bg disabled:bg-data-neutral-bg
                                 disabled:cursor-not-allowed min-h-[44px] py-3 rounded-lg font-semibold text-[var(--color-text-inverse)]
                                 transition-colors shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <InlineButtonSpinner size="sm" />
                            Evaluating...
                          </>
                        ) : (
                          'Submit Treatment Plan'
                        )}
                      </button>
                    )}

                    <button
                      onClick={handleEndEncounter}
                      disabled={isLoading}
                      className="flex-1 bg-data-neutral-bg hover:bg-data-neutral-bg disabled:bg-data-neutral-bg 
                               disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-[var(--color-text-inverse)]
                               transition-colors shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <InlineButtonSpinner size="sm" />
                          Consulting Preceptor...
                        </>
                      ) : (
                        <>
                          <Award className="w-5 h-5" />
                          End Encounter & Get Feedback
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
        </EncounterWorkstation>
      </div>
  );
};

export default EncounterActiveView;
