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
    return <div className="p-8 text-center text-slate-500">Generating scenario...</div>;
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
      <div className="flex justify-between items-center text-sm text-slate-500">
        <span>
          Problem {stats.total + 1} of {set.conditions.length}
        </span>
        <span>Score: {stats.correct}</span>
      </div>

      {/* Vignette Card */}
      <div className="bg-white shadow rounded-xl p-6 border border-slate-100">
        <p className="text-lg leading-relaxed text-slate-800">{currentQuestion?.vignette}</p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {set.conditions.map((condition) => {
          const isSelected = selectedOption === condition;
          const isCorrect = lastResult?.correctCondition === condition;
          const isWrongSelection = hasAnswered && isSelected && !lastResult?.isCorrect;

          // Use design system colors: data-pass, data-fail, and accent
          let bgClass = 'bg-white hover:bg-slate-50';
          let borderClass = 'border-slate-200';

          if (hasAnswered) {
            if (isCorrect) {
              bgClass = 'bg-data-pass/10';
              borderClass = 'border-data-pass';
            } else if (isWrongSelection) {
              bgClass = 'bg-data-fail/10';
              borderClass = 'border-data-fail';
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
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition"
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
                className="bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-700 transition"
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
