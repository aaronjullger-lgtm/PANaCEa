import React, { memo, useMemo, useState } from 'react';
import { Brain, CheckCircle2, Lightbulb, MessageSquareText } from 'lucide-react';
import type { Question } from '@/types';
import {
  buildScaffoldedExplanation,
  buildStudyHintSet,
  type StudyGuidanceLevel,
} from '@/lib/study/studyModeScaffolding';

const LEVELS: Array<{ id: StudyGuidanceLevel; label: string }> = [
  { id: 'foundational', label: 'Build basics' },
  { id: 'developing', label: 'Connect clues' },
  { id: 'confident', label: 'Challenge me' },
];

interface PreAnswerStudyScaffoldProps {
  question: Question;
  guidanceLevel: StudyGuidanceLevel;
  onGuidanceLevelChange: (level: StudyGuidanceLevel) => void;
  learnerReflection: string;
  onLearnerReflectionChange: (value: string) => void;
  hintsViewed: number;
  onHintsViewedChange: (value: number) => void;
}

export const PreAnswerStudyScaffold = memo(function PreAnswerStudyScaffold({
  question,
  guidanceLevel,
  onGuidanceLevelChange,
  learnerReflection,
  onLearnerReflectionChange,
  hintsViewed,
  onHintsViewedChange,
}: PreAnswerStudyScaffoldProps) {
  const hintSet = useMemo(
    () => buildStudyHintSet(question, guidanceLevel),
    [question, guidanceLevel]
  );
  const visibleHints = hintSet.hints.slice(0, hintsViewed);

  return (
    <section
      aria-label="Guided study"
      className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <Brain className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
            Guided study
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {hintSet.metacognitivePrompt}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1">
          {LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => onGuidanceLevelChange(level.id)}
              className={`min-h-[36px] rounded-md px-3 text-xs font-medium transition-colors ${
                guidanceLevel === level.id
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
              aria-pressed={guidanceLevel === level.id}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        First clue
      </label>
      <textarea
        value={learnerReflection}
        onChange={(event) => onLearnerReflectionChange(event.target.value)}
        rows={2}
        className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        placeholder="What do you already know from the vignette?"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onHintsViewedChange(Math.min(hintSet.hints.length, hintsViewed + 1))}
          disabled={hintsViewed >= hintSet.hints.length}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
          {hintsViewed === 0 ? 'Show hint' : 'Next hint'}
        </button>
        {hintsViewed > 0 && (
          <button
            type="button"
            onClick={() => onHintsViewedChange(0)}
            className="min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Reset hints
          </button>
        )}
      </div>

      {visibleHints.length > 0 && (
        <div className="mt-3 space-y-2">
          {visibleHints.map((hint, index) => (
            <div
              key={`${question.id ?? question.question}-hint-${index}`}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
            >
              <span className="font-semibold text-[var(--color-text-primary)]">
                Hint {index + 1}.
              </span>{' '}
              {hint}
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

interface GuidedFeedbackScaffoldProps {
  question: Question;
  selectedAnswerIndex: number;
  guidanceLevel: StudyGuidanceLevel;
  learnerReflection: string;
  hintsViewed: number;
}

export const GuidedFeedbackScaffold = memo(function GuidedFeedbackScaffold({
  question,
  selectedAnswerIndex,
  guidanceLevel,
  learnerReflection,
  hintsViewed,
}: GuidedFeedbackScaffoldProps) {
  const [showCheckReveal, setShowCheckReveal] = useState(false);
  const scaffold = useMemo(
    () =>
      buildScaffoldedExplanation(question, selectedAnswerIndex, {
        guidanceLevel,
        learnerReflection,
        hintsViewed,
      }),
    [question, selectedAnswerIndex, guidanceLevel, learnerReflection, hintsViewed]
  );
  const isCorrect = selectedAnswerIndex === question.correctAnswerIndex;

  return (
    <section
      aria-label="Guided explanation"
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
          <MessageSquareText className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
          Guided explanation
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
          {guidanceLevel}
        </span>
        {hintsViewed > 0 && (
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
            {hintsViewed} hint{hintsViewed === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {learnerReflection.trim() && (
        <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text-primary)]">Your clue:</span>{' '}
          {learnerReflection.trim()}
        </div>
      )}

      <div className="space-y-2">
        {scaffold.chunks.map((chunk) => (
          <div
            key={chunk.title}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2"
          >
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              {chunk.title === 'Repair the miss' || chunk.title === 'Why it holds' ? (
                <CheckCircle2
                  className={`h-4 w-4 ${
                    isCorrect
                      ? 'text-[var(--color-data-pass)]'
                      : 'text-[var(--color-data-provisional)]'
                  }`}
                  aria-hidden="true"
                />
              ) : null}
              {chunk.title}
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {chunk.body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Knowledge check</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {scaffold.knowledgeCheck.prompt}
        </p>
        <button
          type="button"
          onClick={() => setShowCheckReveal((prev) => !prev)}
          className="mt-2 min-h-[36px] rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
        >
          {showCheckReveal ? 'Hide check' : 'Reveal check'}
        </button>
        {showCheckReveal && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {scaffold.knowledgeCheck.reveal}
          </p>
        )}
      </div>
    </section>
  );
});
