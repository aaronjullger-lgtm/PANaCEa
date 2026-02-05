/**
 * DDx Ranking Step Component
 * Sprint 6: Differential Diagnosis ranking for clinical reasoning enhancement
 *
 * Users rank differentials by likelihood before seeing the answer.
 * This promotes clinical reasoning patterns used in real practice.
 */

import React, { useState, useCallback } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  Brain,
  Lightbulb,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface DifferentialItem {
  id: string;
  name: string;
  isCorrectAnswer?: boolean; // True if this is THE answer (most likely)
  likelihood?: 'most_likely' | 'likely' | 'less_likely' | 'unlikely';
  reasoning?: string;
}

export interface DDxRankingStepProps {
  differentials: DifferentialItem[];
  correctAnswerId: string;
  onSubmit: (rankedIds: string[]) => void;
  onSkip?: () => void;
  disabled?: boolean;
  showHints?: boolean;
  caseSummary?: string;
}

export interface RankingResult {
  userRanking: string[];
  correctAnswerId: string;
  correctPosition: number; // 0-indexed position user placed correct answer
  score: number; // 0-100 based on ranking accuracy
  feedback: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DDxRankingStep({
  differentials,
  correctAnswerId,
  onSubmit,
  onSkip,
  disabled = false,
  showHints = true,
  caseSummary,
}: DDxRankingStepProps) {
  const [items, setItems] = useState<DifferentialItem[]>(differentials);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<RankingResult | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  // Handle reorder via drag
  const handleReorder = useCallback(
    (newOrder: DifferentialItem[]) => {
      if (!disabled && !isSubmitted) {
        setItems(newOrder);
      }
    },
    [disabled, isSubmitted]
  );

  // Move item up in ranking
  const moveUp = useCallback(
    (index: number) => {
      if (index === 0 || disabled || isSubmitted) return;
      const newItems = [...items];
      const prevItem = newItems[index - 1];
      const currentItem = newItems[index];
      // Guard for array access returning undefined
      if (!prevItem || !currentItem) return;
      newItems[index - 1] = currentItem;
      newItems[index] = prevItem;
      setItems(newItems);
    },
    [items, disabled, isSubmitted]
  );

  // Move item down in ranking
  const moveDown = useCallback(
    (index: number) => {
      if (index === items.length - 1 || disabled || isSubmitted) return;
      const newItems = [...items];
      const currentItem = newItems[index];
      const nextItem = newItems[index + 1];
      // Guard for array access returning undefined
      if (!currentItem || !nextItem) return;
      newItems[index] = nextItem;
      newItems[index + 1] = currentItem;
      setItems(newItems);
    },
    [items, disabled, isSubmitted]
  );

  // Calculate score based on ranking
  const calculateScore = (ranking: string[]): RankingResult => {
    const correctPosition = ranking.indexOf(correctAnswerId);
    const totalItems = ranking.length;

    // Score based on position (first = 100, last = 0)
    let score: number;
    let feedback: string;

    if (correctPosition === 0) {
      score = 100;
      feedback = 'Excellent! You correctly identified the most likely diagnosis.';
    } else if (correctPosition === 1) {
      score = 80;
      feedback = 'Good reasoning! The correct answer was your second choice.';
    } else if (correctPosition === 2) {
      score = 60;
      feedback =
        'The correct diagnosis was third on your list. Review the distinguishing features.';
    } else {
      score = Math.max(0, 40 - (correctPosition - 2) * 15);
      feedback =
        'The correct diagnosis ranked lower. Consider what findings you may have underweighted.';
    }

    return {
      userRanking: ranking,
      correctAnswerId,
      correctPosition,
      score,
      feedback,
    };
  };

  // Handle submission
  const handleSubmit = () => {
    const ranking = items.map((item) => item.id);
    const result = calculateScore(ranking);
    setResult(result);
    setIsSubmitted(true);
    onSubmit(ranking);
  };

  // Get item styling based on result - using design system colors
  const getItemStyle = (item: DifferentialItem, index: number) => {
    if (!isSubmitted) {
      return 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }

    if (item.id === correctAnswerId) {
      return 'bg-[var(--color-data-pass)]/10 border-[var(--color-data-pass)]';
    }

    // Wrong answers at top are more problematic
    if (index < result!.correctPosition) {
      return 'bg-[var(--color-data-fail)]/10 border-[var(--color-data-fail)]';
    }

    return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-5 w-5 text-[var(--color-accent)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Rank the Differential Diagnoses
          </h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Drag to reorder from most likely (#1) to least likely. Then submit your ranking.
        </p>
      </div>

      {/* Case Summary (if provided) */}
      {caseSummary && showHints && (
        <div className="mb-4 p-3 bg-[var(--color-data-provisional)]/10 rounded-lg border border-[var(--color-data-provisional)]">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-[var(--color-data-provisional)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[var(--color-data-provisional)]">
              <span className="font-medium">Key Features:</span> {caseSummary}
            </p>
          </div>
        </div>
      )}

      {/* Ranking List */}
      <div className="space-y-2">
        <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="space-y-2">
          <AnimatePresence>
            {items.map((item, index) => (
              <Reorder.Item
                key={item.id}
                value={item}
                dragListener={!disabled && !isSubmitted}
                className={`
                  relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                  ${getItemStyle(item, index)}
                  ${!disabled && !isSubmitted ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                `}
                whileDrag={{ scale: 1.02, boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Rank Number */}
                <div
                  className={`
                  flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                  ${
                    isSubmitted && item.id === correctAnswerId
                      ? 'bg-[var(--color-data-pass)] text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }
                `}
                >
                  {index + 1}
                </div>

                {/* Drag Handle */}
                {!isSubmitted && (
                  <div className="text-slate-400 dark:text-slate-500">
                    <GripVertical className="h-5 w-5" />
                  </div>
                )}

                {/* Item Name */}
                <div className="flex-grow">
                  <span
                    className={`
                    font-medium
                    ${
                      isSubmitted && item.id === correctAnswerId
                        ? 'text-[var(--color-data-pass)]'
                        : 'text-slate-800 dark:text-slate-200'
                    }
                  `}
                  >
                    {item.name}
                  </span>

                  {/* Show reasoning after submission */}
                  {isSubmitted && showReasoning && item.reasoning && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {item.reasoning}
                    </p>
                  )}
                </div>

                {/* Result Indicator */}
                {isSubmitted && (
                  <div className="flex-shrink-0">
                    {item.id === correctAnswerId ? (
                      <div className="flex items-center gap-1 text-[var(--color-data-pass)]">
                        <Check className="h-5 w-5" />
                        <span className="text-xs font-medium">Correct</span>
                      </div>
                    ) : index < result!.correctPosition ? (
                      <div className="flex items-center gap-1 text-[var(--color-data-fail)]">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Manual Up/Down Buttons */}
                {!isSubmitted && !disabled && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === items.length - 1}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </div>

      {/* Result Feedback */}
      {isSubmitted && result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`
            mt-6 p-4 rounded-xl border-2
            ${
              result.score >= 80
                ? 'bg-[var(--color-data-pass)]/10 border-[var(--color-data-pass)]'
                : result.score >= 60
                  ? 'bg-[var(--color-data-provisional)]/10 border-[var(--color-data-provisional)]'
                  : 'bg-[var(--color-data-fail)]/10 border-[var(--color-data-fail)]'
            }
          `}
        >
          <div className="flex items-start gap-3">
            <div
              className={`
              flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg
              ${
                result.score >= 80
                  ? 'bg-[var(--color-data-pass)] text-white'
                  : result.score >= 60
                    ? 'bg-[var(--color-data-provisional)] text-white'
                    : 'bg-[var(--color-data-fail)] text-white'
              }
            `}
            >
              {result.score}%
            </div>
            <div className="flex-grow">
              <h4
                className={`
                font-semibold mb-1
                ${
                  result.score >= 80
                    ? 'text-[var(--color-data-pass)]'
                    : result.score >= 60
                      ? 'text-[var(--color-data-provisional)]'
                      : 'text-[var(--color-data-fail)]'
                }
              `}
              >
                DDx Ranking Score
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">{result.feedback}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                You ranked the correct answer #{result.correctPosition + 1} out of {items.length}
              </p>
            </div>
          </div>

          {/* Toggle reasoning button */}
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="mt-3 text-sm text-[var(--color-accent)] hover:underline"
          >
            {showReasoning ? 'Hide' : 'Show'} detailed reasoning
          </button>
        </motion.div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3 justify-end">
        {onSkip && !isSubmitted && (
          <button
            onClick={onSkip}
            disabled={disabled}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            Skip ranking
          </button>
        )}
        {!isSubmitted && (
          <button
            onClick={handleSubmit}
            disabled={disabled}
            className="px-6 py-2 bg-[var(--color-accent)] text-white font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
          >
            Submit Ranking
          </button>
        )}
      </div>
    </div>
  );
}

export default DDxRankingStep;
