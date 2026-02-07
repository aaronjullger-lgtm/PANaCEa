/**
 * Confidence Rating Component
 * 2026 PA Student Optimization - Confidence-based learning
 * 
 * Allows users to rate their confidence (1-5) after answering a question
 * This helps the FSRS algorithm better schedule reviews based on both correctness and confidence
 */

import React from 'react';
import { motion } from 'framer-motion';

interface ConfidenceRatingProps {
  onRatingSelected: (rating: 1 | 2 | 3 | 4 | 5) => void;
  isCorrect: boolean;
}

const confidenceLevels = [
  { value: 1 as const, label: 'Guessing', emoji: '🤷', color: 'text-red-500 dark:text-red-400' },
  { value: 2 as const, label: 'Unsure', emoji: '😕', color: 'text-orange-500 dark:text-orange-400' },
  { value: 3 as const, label: 'Somewhat', emoji: '🤔', color: 'text-yellow-500 dark:text-yellow-400' },
  { value: 4 as const, label: 'Confident', emoji: '😊', color: 'text-lime-500 dark:text-lime-400' },
  { value: 5 as const, label: 'Certain', emoji: '💯', color: 'text-green-500 dark:text-green-400' },
];

export const ConfidenceRating: React.FC<ConfidenceRatingProps> = ({
  onRatingSelected,
  isCorrect,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-4 mb-4"
    >
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
          How confident were you?
        </h4>
        <p className="text-xs text-[var(--color-text-muted)]">
          {isCorrect
            ? 'Great job! Rate your confidence to help optimize your review schedule.'
            : 'Help us understand your thought process for better personalized learning.'}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {confidenceLevels.map((level) => (
          <button
            key={level.value}
            onClick={() => onRatingSelected(level.value)}
            className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all group"
          >
            <span className="text-2xl mb-1">{level.emoji}</span>
            <span className="text-xs font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
              {level.label}
            </span>
            <span className={`text-xs font-bold ${level.color}`}>{level.value}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 text-xs text-[var(--color-text-muted)] text-center">
        Press <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-[10px] font-mono">1-5</kbd> on keyboard
      </div>
    </motion.div>
  );
};

export default ConfidenceRating;
