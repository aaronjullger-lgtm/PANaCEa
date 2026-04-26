/**
 * AnswerFeedback — Extracted from QuizView.tsx
 *
 * Renders the post-answer feedback panel:
 * - Error tagger (when incorrect)
 * - ExplanationPanel (structured or legacy rationale)
 * - Add to review + reference actions
 * - "Explain Differently" + "Tutor Me" buttons
 * - Alternate rationale (AI-generated)
 * - Clinical pearls section
 * - Notes section
 */

import React, { memo } from 'react';
import ExplanationPanel, { type StructuredRationale } from '@/components/questions/ExplanationPanel';
import ErrorTagger from '@/components/quiz/ErrorTagger';
import { CausalChainDisplay } from '@/components/session/CausalChainDisplay';
import { sanitizeForRationale } from '@/lib/sanitizeHtml';
import { BookOpen, Flag, MessageCircle, PenLine } from 'lucide-react';
import type { Question, ErrorTag } from '@/types';
import type { CausalChain, CausalChainDisplayLevel } from '@/types/causalChain';

export interface AnswerFeedbackProps {
  currentQuestion: Question;
  selectedAnswerIndex: number;
  isExamSimulator: boolean;
  fontSizeAdjustment: number;
  updateLastPerformanceErrorTag: (tag: ErrorTag) => void;
  onExplainDifferently: () => void;
  isExplainerLoading: boolean;
  alternateRationale: string | null;
  onShowSocraticTutor: () => void;
  localNote: string;
  showNotes: boolean;
  setShowNotes: (show: boolean) => void;
  onNoteChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isFlagged: boolean;
  onToggleFlag: () => void;
  onOpenReference?: () => void;
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
  updateLastPerformanceErrorTag,
  onExplainDifferently,
  isExplainerLoading,
  alternateRationale,
  onShowSocraticTutor,
  localNote,
  showNotes,
  setShowNotes,
  onNoteChange,
  isFlagged,
  onToggleFlag,
  onOpenReference,
  causalChain,
  causalChainDisplayLevel,
}) => {
  if (isExamSimulator) return null;

  const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;

  return (
    <section className="mt-6 animate-fade-in space-y-4" aria-label="Answer feedback">
      <div className="feedback-content space-y-4">
        {/* Error Tagger - Only show when incorrect */}
        {!isCorrect && (
          <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
            <ErrorTagger onTagError={updateLastPerformanceErrorTag} />
          </div>
        )}

        {/* Core PANCE: rationale – structured (5-section) or legacy, via ExplanationPanel */}
        <ExplanationPanel
          rationale={(() => {
            const r = currentQuestion.rationale;
            if (typeof r === 'object' && r !== null && 'whyCorrect' in r) return r as unknown as StructuredRationale;
            if (typeof r === 'string') {
              try {
                const parsed = JSON.parse(r) as unknown;
                if (parsed && typeof parsed === 'object' && 'whyCorrect' in parsed)
                  return parsed as StructuredRationale;
              } catch {
                /* not JSON — rationale is a plain string, not structured */
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
            currentQuestion.groundingSources ??
            (typeof currentQuestion.rationale === 'object' && currentQuestion.rationale !== null
              ? (currentQuestion.rationale as unknown as StructuredRationale).groundingSources
              : undefined)
          }
          pubmedCitations={
            typeof currentQuestion.rationale === 'object' && currentQuestion.rationale !== null
              ? (currentQuestion.rationale as unknown as StructuredRationale).pubmedCitations
              : undefined
          }
          onViewCondition={
            onOpenReference && currentQuestion.conditionId
              ? (_slug: string) => onOpenReference()
              : undefined
          }
        />

        <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
          <button
            type="button"
            onClick={onToggleFlag}
            className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              isFlagged
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
            {isFlagged ? 'Added to review' : 'Add to review'}
          </button>
          {onOpenReference && (
            <button
              type="button"
              onClick={onOpenReference}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3.5 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Open reference
            </button>
          )}
        </div>

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
