// components/modes/osce/EncounterLogSidebar.tsx
// Presentational sidebar for the active OSCE encounter: an optional Rapport
// meter plus the chronological "Encounter Log" (history Q&A, physical-exam
// findings, diagnostic results, submitted diagnosis, and typing/loading/empty
// states). Extracted verbatim from PatientEncounterMode's inline `sidebarJsx`
// to shrink that monolith. Purely presentational and read-only — no local
// state, no setters, no side effects — so it is safe to render in isolation.

import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Stethoscope, ClipboardList } from 'lucide-react';
import { RapportMeter } from './RapportMeter';
import { ChatSkeleton } from '@/components/loading';
import { getTranslatedText, generateTrendData } from '@/lib/utils/encounterHelpers';
import type {
  RapportMeter as RapportMeterType,
  EmotionalState,
  PatientPersonalityMatrix,
} from '@/types/osce-enhanced';
import type {
  EncounterSession,
  PhysicalFinding,
  DiagnosticResult,
  DiagnosisFeedback,
  SpanishMode,
} from '@/hooks/useEncounterReducer';
import type { ClinicalFidelitySettings } from '@/hooks/useClinicalFidelitySettings';

export interface EncounterLogSidebarProps {
  /** Whether to render the Rapport meter (i.e. `showRapportMeter && session active`). */
  showRapport: boolean;
  rapportMeter: RapportMeterType;
  rapportEmotionalState?: EmotionalState;
  rapportPersonality?: PatientPersonalityMatrix;
  session: EncounterSession;
  physicalFindings: PhysicalFinding[];
  diagnosticResults: DiagnosticResult[];
  languageMode: SpanishMode;
  isFidelityModeActive: boolean;
  clinicalFidelity: ClinicalFidelitySettings;
  diagnosisFeedback: DiagnosisFeedback | null;
  userDiagnosis: string;
  isTyping: boolean;
  /** Resolved typing-status message (e.g. TYPING_STATUS_MESSAGES[typingStatusIndex]). */
  typingStatusMessage: string;
  isLoading: boolean;
}

export const EncounterLogSidebar: React.FC<EncounterLogSidebarProps> = ({
  showRapport,
  rapportMeter,
  rapportEmotionalState,
  rapportPersonality,
  session,
  physicalFindings,
  diagnosticResults,
  languageMode,
  isFidelityModeActive,
  clinicalFidelity,
  diagnosisFeedback,
  userDiagnosis,
  isTyping,
  typingStatusMessage,
  isLoading,
}) => {
  return (
    <>
      {showRapport && (
        <motion.div initial={{ y: -10 }} animate={{ y: 0 }}>
          <RapportMeter
            meter={rapportMeter}
            emotionalState={rapportEmotionalState}
            personality={rapportPersonality}
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
                A: {getTranslatedText(q.response, languageMode)}
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
                {typingStatusMessage}
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
};
