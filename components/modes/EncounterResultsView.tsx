import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  X, Award, MessageSquare, Stethoscope, FileText, Pill, User,
  CheckCircle, ArrowRight, XCircle, AlertTriangle, ClipboardList,
  Heart, Shield, ChevronRight,
} from 'lucide-react';
import { ScoreReport } from './osce';
import { getScoreColor } from '@/lib/utils/encounterHelpers';
import { generateOSCEMarkdown, downloadOSCEReport } from '@/lib/utils/osceExport';
import type { PreceptorFeedback } from '@/services/ai';
import type { OsceGradeResult } from '@/services/domain';
import type { PatientEncounterCase, EncounterSession } from '@/types/drill-modes';

export interface EncounterResultsViewProps {
  onExit?: () => void;
  preceptorFeedback: PreceptorFeedback | null;
  gradeResult: OsceGradeResult | null;
  gradeResultLoading: boolean;
  isStreamingDebrief: boolean;
  streamedDebriefText: string;
  enhancedScoreReport?: Record<string, unknown> | null;
  differentialDiagnoses: string[];
  session: EncounterSession | null;
  currentCase: PatientEncounterCase;
  handleRetryGrading: () => void;
  handleNewCase: () => void;
  handleEndEncounter: () => void;
}

export const EncounterResultsView: React.FC<EncounterResultsViewProps> = ({
  onExit,
  preceptorFeedback,
  gradeResult,
  gradeResultLoading,
  isStreamingDebrief,
  streamedDebriefText,
  enhancedScoreReport,
  differentialDiagnoses,
  session,
  currentCase,
  handleRetryGrading,
  handleNewCase,
  handleEndEncounter,
}) => {
  const showStreaming = isStreamingDebrief || streamedDebriefText.length > 0;

  // Streaming debrief (AI still evaluating)
  if (showStreaming && !preceptorFeedback) {
    return (
      <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-data-neutral" />
              <div>
                <h1 className="text-2xl font-bold">Virtual Preceptor Debrief</h1>
                <p className="text-sm text-data-neutral">AI is evaluating your encounter...</p>
              </div>
            </div>
            {onExit && <Button variant="ghost" onClick={onExit} aria-label="Exit debrief"><X className="w-5 h-5" /></Button>}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
            <p className="text-data-neutral text-sm mb-2">Streaming evaluation (token-by-token):</p>
            <pre className="text-[var(--color-text-inverse)] font-mono text-sm whitespace-pre-wrap break-words min-h-[120px]">
              {streamedDebriefText || <span className="text-data-neutral">Waiting for first tokens...</span>}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // No preceptor feedback yet — loader
  if (!preceptorFeedback) {
    return (
      <div className="min-h-screen bg-data-neutral-bg text-data-neutral flex items-center justify-center">
        <div className="text-center space-y-4">
          <Award className="w-16 h-16 text-data-neutral mx-auto animate-pulse" />
          <p className="text-xl">Generating your debrief...</p>
          <p className="text-sm text-data-neutral">The virtual preceptor is reviewing your performance.</p>
        </div>
      </div>
    );
  }

  // Main results view
  return (
    <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-data-neutral" />
            <div>
              <h1 className="text-2xl font-bold">Virtual Preceptor Debrief</h1>
              <p className="text-sm text-data-neutral">Performance Evaluation</p>
            </div>
          </div>
          {onExit && <Button variant="ghost" onClick={onExit} aria-label="Exit debrief"><X className="w-5 h-5" /></Button>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Overall Score Hero */}
        {(() => {
          const rubricAvailable = gradeResult && typeof gradeResult.score === 'number';
          const displayScore = rubricAvailable ? gradeResult.score : preceptorFeedback.score;
          return (
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/80 rounded-2xl p-8 text-[var(--color-text-inverse)] shadow-xl text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[var(--color-bg-primary)]/20 backdrop-blur-sm mb-4">
                <Award className="w-12 h-12" />
              </div>
              <h2 className="text-5xl font-bold mb-2">{Math.round(displayScore)}%</h2>
              <p className="text-xl opacity-90">{rubricAvailable ? 'AI-Graded Score' : 'Estimated Score (rubric unavailable)'}</p>
            </motion.div>
          );
        })()}

        {/* Clinical Reasoning Breakdown */}
        <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.1 }} className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral shadow-md">
          <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-inverse)]">Clinical Competencies</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: 'History-Taking', score: preceptorFeedback?.clinicalReasoning?.historyTaking ?? 0, icon: MessageSquare },
              { label: 'Physical Exam', score: preceptorFeedback?.clinicalReasoning?.physicalExam ?? 0, icon: Stethoscope },
              { label: 'Diagnosis', score: preceptorFeedback?.clinicalReasoning?.diagnosis ?? 0, icon: FileText },
              { label: 'Management', score: preceptorFeedback?.clinicalReasoning?.management ?? 0, icon: Pill },
            ].map((item, idx) => {
              const percentage = ((item.score ?? 0) / 10) * 100;
              const Icon = item.icon;
              return (
                <div key={idx} className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-data-neutral" />
                      <span className="font-semibold text-[var(--color-text-inverse)]">{item.label}</span>
                    </div>
                    <span className={`text-2xl font-bold ${getScoreColor(percentage)}`}>{item.score}/10</span>
                  </div>
                  <div className="w-full bg-data-neutral-bg rounded-full h-2 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8, delay: 0.2 + idx * 0.1 }} className={`h-full rounded-full ${
                      percentage >= 80 ? 'bg-data-pass' : percentage >= 60 ? 'bg-data-provisional' : 'bg-data-fail'
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Preceptor Narrative Feedback */}
        <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.2 }} className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-data-neutral-bg border border-data-neutral flex items-center justify-center">
              <User className="w-6 h-6 text-data-neutral" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-text-inverse)]">Your Preceptor's Feedback</h3>
              <p className="text-sm text-data-neutral">Clinical reasoning assessment</p>
            </div>
          </div>
          <div className="bg-data-neutral-bg rounded-lg p-5 border border-data-neutral">
            <p className="text-[var(--color-text-inverse)] leading-relaxed italic">"{preceptorFeedback.feedback}"</p>
          </div>
        </motion.div>

        {/* Strengths & Areas for Improvement */}
        <div className="grid md:grid-cols-2 gap-6">
          {preceptorFeedback.strengths.length > 0 && (
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.3 }} className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
              <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2"><CheckCircle className="w-5 h-5 text-data-neutral" /> Strengths</h3>
              <ul className="space-y-2">
                {preceptorFeedback.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-data-neutral"><span className="text-data-neutral mt-0.5">•</span><span>{strength}</span></li>
                ))}
              </ul>
            </motion.div>
          )}
          {preceptorFeedback.areasForImprovement.length > 0 && (
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.4 }} className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
              <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2"><ArrowRight className="w-5 h-5 text-data-neutral" /> Areas for Improvement</h3>
              <ul className="space-y-2">
                {preceptorFeedback.areasForImprovement.map((area, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-data-neutral"><span className="text-data-neutral mt-0.5">•</span><span>{area}</span></li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>

        {/* Missed Critical Cues */}
        {preceptorFeedback.missedCriticalCues.length > 0 && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.5 }} className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
            <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2"><XCircle className="w-5 h-5 text-data-neutral" /> Missed Critical Cues</h3>
            <p className="text-sm text-data-neutral mb-3">The patient mentioned these important details that you didn't follow up on:</p>
            <ul className="space-y-2">
              {preceptorFeedback.missedCriticalCues.map((cue, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-data-neutral bg-data-neutral-bg rounded p-3 border border-data-neutral">
                  <span className="text-data-neutral font-bold mt-0.5">!</span><span>{cue}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Dangerous Actions */}
        {preceptorFeedback.dangerousActions?.length > 0 && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.51 }} className="bg-data-neutral-bg rounded-xl p-6 border border-data-fail/50">
            <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-data-fail" /> Dangerous or Inappropriate Actions</h3>
            <p className="text-sm text-data-neutral mb-3">The preceptor identified the following safety or appropriateness concerns:</p>
            <ul className="space-y-2">
              {preceptorFeedback.dangerousActions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-data-neutral bg-data-neutral-bg rounded p-3 border border-data-neutral">
                  <AlertTriangle className="w-4 h-4 text-data-fail flex-shrink-0 mt-0.5" /><span>{action}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* AI-Graded Rubric */}
        <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.52 }} className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
          <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2"><ClipboardList className="w-5 h-5 text-data-neutral" /> AI-Graded Rubric</h3>
          {gradeResultLoading ? (
            <div className="space-y-2" aria-busy="true">
              <div className="h-4 bg-data-neutral-bg rounded animate-pulse w-3/4" />
              <div className="h-4 bg-data-neutral-bg rounded animate-pulse w-1/2" />
              <div className="h-4 bg-data-neutral-bg rounded animate-pulse w-5/6" />
              <p className="text-sm text-data-neutral mt-2">Grading…</p>
            </div>
          ) : gradeResult ? (
            <>
              <div className="flex items-center gap-4 mb-4 p-3 bg-data-neutral-bg rounded-lg border border-data-neutral">
                <div className="flex-1 text-center">
                  <p className="text-xs text-data-neutral uppercase tracking-wider">Score</p>
                  <p className="text-2xl font-bold text-data-neutral">{gradeResult.score}</p>
                  <p className="text-xs text-data-neutral">out of 100</p>
                </div>
                <div className="h-10 w-px bg-data-neutral-bg" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-data-neutral uppercase tracking-wider">Clinical Reasoning</p>
                  <p className="text-2xl font-bold text-data-neutral">{gradeResult.clinicalReasoningScore}</p>
                  <p className="text-xs text-data-neutral">out of 100</p>
                </div>
              </div>
              {/* Extended scoring */}
              {(gradeResult.communicationScore != null || gradeResult.differentialScore != null) && (
                <div className="flex items-center gap-4 mb-4 p-3 bg-data-neutral-bg rounded-lg border border-data-neutral">
                  {gradeResult.communicationScore != null && (
                    <div className="flex-1 text-center">
                      <p className="text-xs text-data-neutral uppercase tracking-wider">Communication</p>
                      <p className={`text-xl font-bold ${gradeResult.communicationScore >= 80 ? 'text-data-pass' : gradeResult.communicationScore >= 60 ? 'text-data-provisional' : 'text-data-fail'}`}>{gradeResult.communicationScore}</p>
                      <p className="text-xs text-data-neutral">out of 100</p>
                    </div>
                  )}
                  {gradeResult.communicationScore != null && gradeResult.differentialScore != null && <div className="h-10 w-px bg-data-neutral-bg" />}
                  {gradeResult.differentialScore != null && (
                    <div className="flex-1 text-center">
                      <p className="text-xs text-data-neutral uppercase tracking-wider">Differentials</p>
                      <p className={`text-xl font-bold ${gradeResult.differentialScore >= 80 ? 'text-data-pass' : gradeResult.differentialScore >= 60 ? 'text-data-provisional' : 'text-data-fail'}`}>{gradeResult.differentialScore}</p>
                      <p className="text-xs text-data-neutral">out of 100</p>
                    </div>
                  )}
                </div>
              )}
              {/* Checklist */}
              {gradeResult.checklist?.length > 0 ? (
                <ul className="space-y-2 mb-4">
                  {gradeResult.checklist.map((item, idx) => (
                    <li key={idx} className={`flex items-start gap-2 text-sm rounded p-3 border ${item.status === 'PASS' ? 'bg-data-pass/30 border-data-pass text-data-neutral' : 'bg-data-neutral-bg border-data-neutral text-data-neutral'}`}>
                      {item.status === 'PASS' ? <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-data-fail flex-shrink-0 mt-0.5" />}
                      <span className="font-medium">{item.item}</span>
                      {item.feedback && <span className="text-data-neutral text-xs block mt-1 pl-6">{item.feedback}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4 mb-4">
                  <p className="font-medium text-[var(--color-text-primary)]">No critical actions tracked</p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">This case did not include a specific rubric checklist.</p>
                </div>
              )}
              {gradeResult.redFlagsMissed?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-data-fail mb-2">Red flags missed:</p>
                  <ul className="space-y-1">
                    {gradeResult.redFlagsMissed.map((flag, idx) => (
                      <li key={idx} className="text-sm text-data-neutral flex items-center gap-2"><XCircle className="w-3.5 h-3.5 text-data-fail flex-shrink-0" />{flag}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
              <p className="font-medium text-[var(--color-text-primary)]">Rubric unavailable for this case</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Grading could not be completed. You can retry below or use the Preceptor feedback.</p>
              {session?.id && <Button variant="primary" size="sm" onClick={handleRetryGrading} disabled={gradeResultLoading}>{gradeResultLoading ? 'Grading…' : 'Retry grading'}</Button>}
            </div>
          )}
        </motion.div>

        {/* Bedside Manner */}
        {gradeResult?.softSkillsReport && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.53 }} className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
            <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2"><Heart className="w-5 h-5 text-data-neutral" /> Bedside Manner</h3>
            <div className="grid gap-3">
              {(['empathy', 'professionalism', 'pacing'] as const).map((key) => {
                const item = gradeResult.softSkillsReport![key];
                if (!item) return null;
                const pct = (item.score / 5) * 100;
                return (
                  <div key={key} className="bg-data-neutral-bg rounded-lg p-3 border border-data-neutral">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-data-neutral capitalize">{key}</span>
                      <span className={`text-sm font-bold ${pct >= 80 ? 'text-data-pass' : pct >= 60 ? 'text-data-provisional' : 'text-data-fail'}`}>{item.score}/5</span>
                    </div>
                    <p className="text-xs text-data-neutral">{item.feedback}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Score Report fallback */}
        {enhancedScoreReport && gradeResult && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.55 }}>
            <div className="mb-2 px-1"><p className="text-xs text-data-neutral italic">Quick Preview — estimated from detected actions. The AI-graded rubric above is the authoritative assessment.</p></div>
            <ScoreReport report={{ ...enhancedScoreReport, ...(differentialDiagnoses.length > 0 ? { submittedDifferentials: differentialDiagnoses } : {}) }} />
          </motion.div>
        )}
        {enhancedScoreReport && !gradeResult && !gradeResultLoading && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.55 }}>
            <ScoreReport report={{ ...enhancedScoreReport, ...(differentialDiagnoses.length > 0 ? { submittedDifferentials: differentialDiagnoses } : {}) }} />
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ delay: 0.6 }} className="flex flex-wrap justify-center gap-4 pt-4">
          <Button onClick={() => { const md = generateOSCEMarkdown(preceptorFeedback, gradeResult, currentCase); downloadOSCEReport(md); }} variant="secondary"><FileText className="w-4 h-4" /> Download Report</Button>
          <Button onClick={handleNewCase} variant="primary"><MessageSquare className="w-4 h-4" /> New Case</Button>
          <Button onClick={handleEndEncounter} variant="ghost"><X className="w-4 h-4" /> Exit</Button>
        </motion.div>
      </div>
    </div>
  );
};

export default EncounterResultsView;
