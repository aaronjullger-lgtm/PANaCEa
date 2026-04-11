/**
 * AnswerFeedback — Extracted from QuizView.tsx
 *
 * Renders the post-answer feedback panel:
 * - Topic accuracy stats bar
 * - Error tagger (when incorrect)
 * - Peer selection stats ("42% of students also chose B")
 * - ExplanationPanel (structured or legacy rationale)
 * - "Explain Differently" + "Tutor Me" buttons
 * - Alternate rationale (AI-generated)
 * - Clinical pearls section
 * - Notes section
 */

import React, { memo } from 'react';
import ExplanationPanel from '@/components/questions/ExplanationPanel';
import ErrorTagger from '@/components/quiz/ErrorTagger';
import { CalibrationFeedbackBadge } from '@/components/session/CalibrationFeedbackBadge';
import { CausalChainDisplay } from '@/components/session/CausalChainDisplay';
import { sanitizeForRationale } from '@/lib/sanitizeHtml';
import { getAccuracyBarClass } from '@/lib/accuracyColorUtils';
import { MessageCircle, PenLine } from 'lucide-react';
import type { Question, ErrorTag } from '@/types';
import type { CausalChain, CausalChainDisplayLevel } from '@/types/causalChain';

export interface AnswerFeedbackProps {
  currentQuestion: Question;
  selectedAnswerIndex: number;
  isExamSimulator: boolean;
  fontSizeAdjustment: number;
  topicStats: { score: number; correct: number; total: number } | null;
  answerDistribution:
    | { optionLetter: string; count: number; percent: number }[]
    | null;
  updateLastPerformanceErrorTag: (tag: ErrorTag) => void;
  onExplainDifferently: () => void;
  isExplainerLoading: boolean;
  alternateRationale: string | null;
  onShowSocraticTutor: () => void;
  localNote: string;
  showNotes: boolean;
  setShowNotes: (show: boolean) => void;
  onNoteChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Implicit confidence score (0-1) from behavioral telemetry. If provided, shows calibration feedback. */
  implicitConfidence?: number;
  /** Causal reasoning chain for mechanistic explanation (tier1 Item 4). */
  causalChain?: CausalChain | null;
  /** Display level for the causal chain, driven by expertise-adaptive scaffolding. */
  causalChainDisplayLevel?: CausalChainDisplayLevel;
}

const AnswerFeedback: React.FC<AnswerFeedbackProps> = ({
  currentQuestion,
  selectedAnswerIndex,
  isExamSimulator,
  fontSizeAdjustment,
  topicStats,
  answerDistribution,
  updateLastPerformanceErrorTag,
  onExplainDifferently,
  isExplainerLoading,
  alternateRationale,
  onShowSocraticTutor,
  localNote,
  showNotes,
  setShowNotes,
  onNoteChange,
  implicitConfidence,
  causalChain,
  causalChainDisplayLevel,
}) => {
  if (isExamSimulator) return null;

  const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;
  const getBarColor = (score: number): string => getAccuracyBarClass(score);

  return (
    <section className="mt-6 animate-fade-in space-y-3" aria-label="Answer feedback">
      {/* Result meta: calibration + topic stats */}
      {(implicitConfidence !== undefined || topicStats) && (
        <div className="pb-3 mb-4 border-b border-[var(--color-border)]">
          {implicitConfidence !== undefined && (
            <CalibrationFeedbackBadge
              wasCorrect={isCorrect}
              confidence={implicitConfidence}
            />
          )}

          {topicStats && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-1 text-sm">
                <span className="font-semibold text-[var(--color-text-secondary)]">
                  {currentQuestion.topic}
                </span>
                <span className="font-medium text-[var(--color-text-muted)]">
                  {topicStats.score.toFixed(0)}% ({topicStats.correct}/{topicStats.total})
                </span>
              </div>
              <div
                className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2"
                role="progressbar"
                aria-valuenow={Math.round(topicStats.score)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${currentQuestion.topic} accuracy: ${topicStats.score.toFixed(0)}%`}
              >
                <div
                  className={`h-2 rounded-full ${getBarColor(
                    topicStats.score
                  )} transition-all duration-500 ease-out`}
                  style={{ width: `${topicStats.score}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="feedback-content space-y-4">
        {/* Error Tagger - Only show when incorrect */}
        {!isCorrect && (
          <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
            <ErrorTagger onTagError={updateLastPerformanceErrorTag} />
          </div>
        )}

        {/* Peer selection stats: "42% of students also chose B" */}
        {answerDistribution &&
          (() => {
            const letter = ['A', 'B', 'C', 'D', 'E'][selectedAnswerIndex];
            const entry = answerDistribution.find((d) => d.optionLetter === letter);
            if (!entry || entry.count === 0) return null;
            return (
              <p className="mb-3 text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]/50 rounded-md px-3 py-2">
                <span className="font-medium text-[var(--color-text-secondary)]">
                  {entry.percent}% of students also chose {letter}.
                </span>
                {!isCorrect && (
                  <> This was a tricky distractor — you&apos;re not alone.</>
                )}
              </p>
            );
          })()}

        {/* Core PANCE: rationale – structured (5-section) or legacy, via ExplanationPanel */}
        <ExplanationPanel
          rationale={(() => {
            const r = currentQuestion.rationale;
            if (typeof r === 'object' && r !== null && 'whyCorrect' in r) return r as any;
            if (typeof r === 'string') {
              try {
                const parsed = JSON.parse(r) as unknown;
                if (parsed && typeof parsed === 'object' && 'whyCorrect' in parsed)
                  return parsed as any;
              } catch {
                /* not JSON */
              }
              return r;
            }
            return '';
          })()}
          condition={currentQuestion.condition ?? 'Unknown'}
          conditionSlug={currentQuestion.conditionId}
          isCorrect={isCorrect}
          correctAnswer={currentQuestion.options[currentQuestion.correctAnswerIndex] ?? ''}
          userAnswer={currentQuestion.options[selectedAnswerIndex] ?? ''}
          correctAnswerIndex={currentQuestion.correctAnswerIndex}
          userAnswerIndex={selectedAnswerIndex}
          options={currentQuestion.options}
          questionId={currentQuestion.id}
          fontSizeAdjustment={fontSizeAdjustment}
          contentSource={currentQuestion.contentSource}
          contentSourceTitle={currentQuestion.contentSourceTitle}
          groundingSources={
            (currentQuestion as any).groundingSources ||
            (typeof currentQuestion.rationale === 'object' && currentQuestion.rationale !== null
              ? (currentQuestion.rationale as any).groundingSources
              : undefined)
          }
          pubmedCitations={
            (currentQuestion as any).pubmedCitations ||
            (typeof currentQuestion.rationale === 'object' && currentQuestion.rationale !== null
              ? (currentQuestion.rationale as any).pubmedCitations
              : undefined)
          }
        />

        {/* Causal Reasoning Chain — mechanistic "Why This Happens" display
            Research: Woods et al. (2005), Chi et al. (1994) — causal chains
            produce d=0.63–0.95 vs passive reading for diagnostic transfer */}
        {causalChain && (
          <CausalChainDisplay
            chain={causalChain}
            displayLevel={causalChainDisplayLevel ?? 'collapsed'}
            fontSizeAdjustment={fontSizeAdjustment}
          />
        )}

        {!isCorrect && (
          <div className="mt-5 pt-4 border-t border-[var(--color-border)]/60 flex flex-wrap gap-2">
            <button
              onClick={onExplainDifferently}
              disabled={isExplainerLoading}
              className="btn-glass px-4 py-2 text-sm"
            >
              {isExplainerLoading ? 'Thinking...' : 'Explain this differently'}
            </button>
            <button
              type="button"
              onClick={onShowSocraticTutor}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] font-medium text-sm hover:bg-[var(--color-accent)]/20 transition-colors"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Tutor Me
            </button>
          </div>
        )}

        {isExplainerLoading && (
          <div className="mt-4 flex items-center space-x-2 text-[var(--color-text-secondary)]" role="status" aria-live="polite">
            <div className="w-2 h-2 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse" aria-hidden="true"></div>
            <div
              className="w-2 h-2 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse"
              style={{ animationDelay: '0.2s' }}
              aria-hidden="true"
            ></div>
            <div
              className="w-2 h-2 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse"
              style={{ animationDelay: '0.4s' }}
              aria-hidden="true"
            ></div>
            <span className="text-sm">Generating new explanation...</span>
          </div>
        )}

        {alternateRationale && !isExplainerLoading && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] animate-fade-in">
            <h2 className="font-bold text-md mb-2 text-[var(--color-text-primary)]">
              Alternate Explanation
            </h2>
            <p className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
              {alternateRationale}
            </p>
          </div>
        )}

        {/* Clinical Pearls Section */}
        {currentQuestion.pearls && currentQuestion.pearls.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]/60">
            <h2 className="font-semibold text-base mb-2 text-[var(--color-text-primary)]">
              Key Pearls: {currentQuestion.condition}
            </h2>
            <ul className="list-disc list-inside space-y-1.5 text-[var(--color-text-secondary)] text-sm leading-relaxed">
              {currentQuestion.pearls.map((pearl, index) => (
                <li
                  key={`${currentQuestion.id}-pearl-${index}`}
                  dangerouslySetInnerHTML={{ __html: sanitizeForRationale(pearl) }}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--color-border)]/60">
          {!showNotes && !localNote ? (
            <button
              onClick={() => setShowNotes(true)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors py-1"
            >
              <PenLine className="w-4 h-4" />
              Add Note
            </button>
          ) : (
            <>
              <h2 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">
                My Notes
              </h2>
              <textarea
                value={localNote}
                onChange={onNoteChange}
                placeholder="Type your notes here... They will be saved automatically."
                aria-label="Personal notes for this question"
                className="w-full p-2 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-md text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                rows={3}
                autoFocus={showNotes && !localNote}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default memo(AnswerFeedback);
