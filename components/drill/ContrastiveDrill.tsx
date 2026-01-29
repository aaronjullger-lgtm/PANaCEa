import React, { useEffect, useState } from 'react';
import { useContrastiveDrill, ContrastiveSet } from '../../hooks/game/use-contrastive-drill';
import { ContrastiveComparisonTable } from './ContrastiveComparisonTable';

interface ContrastiveDrillProps {
  set: ContrastiveSet;
  drillId: string;
  onComplete: (stats: any) => void;
}

export function ContrastiveDrill({ set, drillId, onComplete }: ContrastiveDrillProps) {
  const {
    currentQuestion,
    isLoadingQuestion,
    isDrillComplete,
    stats,
    generateQuestion,
    submitAnswer,
    nextQuestion,
  } = useContrastiveDrill(drillId, set);

  const [hasAnswered, setHasAnswered] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    generateQuestion(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isDrillComplete) {
      onComplete(stats);
    }
  }, [isDrillComplete, onComplete, stats]);

  const handleOptionSelect = (condition: string) => {
    if (hasAnswered) return;
    setSelectedOption(condition);
  };

  const handleSubmit = async () => {
    if (!selectedOption || hasAnswered) return;

    const result = await submitAnswer(selectedOption, 0); // TODO: track time
    setLastResult(result);
    setHasAnswered(true);
  };

  const handleNext = () => {
    setHasAnswered(false);
    setSelectedOption(null);
    setLastResult(null);
    nextQuestion();
  };

  if (isLoadingQuestion && !currentQuestion) {
    return (
      <div className="p-8 text-center text-[var(--color-text-muted)]">
        Generating scenario...
      </div>
    );
  }

  if (isDrillComplete) {
    return (
      <div className="p-8 text-center">
        Drill Complete! Score: {stats.correct}/{stats.total}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Progress Header */}
      <div className="flex justify-between items-center text-sm text-[var(--color-text-muted)]">
        <span>
          Problem {stats.total + 1} of {set.conditions.length}
        </span>
        <span>Score: {stats.correct}</span>
      </div>

      {/* Vignette Card */}
      <div className="bg-[var(--color-bg-secondary)] shadow rounded-xl p-6 border border-[var(--color-border)]">
        <p className="text-lg leading-relaxed text-[var(--color-text-primary)]">
          {currentQuestion?.vignette}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {set.conditions.map((condition) => {
          const isSelected = selectedOption === condition;
          const isCorrect = lastResult?.correctCondition === condition;
          const isWrongSelection = hasAnswered && isSelected && !lastResult?.isCorrect;

          // Use design system colors: data-pass, data-fail, and accent
          let bgClass =
            'bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)]';
          let borderClass = 'border-[var(--color-border)]';

          if (hasAnswered) {
            if (isCorrect) {
              bgClass = 'bg-[var(--color-data-pass)]/10';
              borderClass = 'border-[var(--color-data-pass)]';
            } else if (isWrongSelection) {
              bgClass = 'bg-[var(--color-data-fail)]/10';
              borderClass = 'border-[var(--color-data-fail)]';
            }
          } else if (isSelected) {
            bgClass = 'bg-[var(--color-accent)]/10';
            borderClass = 'border-[var(--color-accent)]';
          }

          return (
            <button
              key={condition}
              onClick={() => handleOptionSelect(condition)}
              disabled={hasAnswered}
              className={`w-full text-left p-4 rounded-lg border transition-all ${bgClass} ${borderClass}`}
            >
              <span className="font-medium">{condition}</span>
            </button>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="mt-6 flex justify-end">
        {!hasAnswered ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedOption}
            className="bg-[var(--color-accent)] text-[var(--color-text-inverse)] px-6 py-2 rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition"
          >
            Submit Answer
          </button>
        ) : (
          <div className="w-full">
            <ContrastiveComparisonTable
              targetCondition={lastResult?.correctCondition || ''}
              selectedCondition={selectedOption || ''}
              distinguishers={lastResult?.distinguishers || []}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleNext}
                className="bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] px-6 py-2 rounded-lg font-medium hover:bg-[var(--color-bg-tertiary)]/80 transition"
              >
                Next Question →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
