/**
 * ConfusionPairCard — Dashboard widget showing conditions the student frequently confuses.
 *
 * Surfaces top confusion pairs (from incorrect answers) and offers "Drill This"
 * buttons to launch targeted contrastive drills. Based on the desirable difficulty
 * principle (Bjork, 1994): drilling where confusion exists produces stronger encoding.
 *
 * @see hooks/useConfusionPairs.ts
 * @see functions/api/analytics/confusion-pairs.ts
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Repeat2, AlertTriangle } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ConfusionPairData } from '@/hooks/useConfusionPairs';

interface ConfusionPairCardProps {
  pairs: ConfusionPairData[];
  /** Callback when student clicks "Drill This" — receives the two condition IDs */
  onDrillPair?: (correctConditionId: string, selectedConditionId: string) => void;
  className?: string;
  /** Max pairs to display (default 3) */
  maxPairs?: number;
}

/**
 * Shorten a condition ID or name to a display-friendly label.
 * If the pair has resolved names, use those; otherwise show truncated IDs.
 */
function displayName(pair: ConfusionPairData, which: 'correct' | 'selected'): string {
  if (which === 'correct') {
    return pair.correctConditionName || formatId(pair.correctConditionId);
  }
  return pair.selectedConditionName || formatId(pair.selectedConditionId);
}

function formatId(id: string): string {
  // CUIDs and UUIDs look ugly — show first 8 chars or just the ID if short
  if (id.length > 20) return id.slice(0, 8) + '…';
  return id;
}

export function ConfusionPairCard({
  pairs,
  onDrillPair,
  className = '',
  maxPairs = 3,
}: ConfusionPairCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const displayPairs = pairs.slice(0, maxPairs);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  };

  // Empty state
  if (pairs.length === 0) {
    return (
      <div
        className={`rounded-lg p-5 ${className}`}
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <h3
          className="text-base font-semibold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Confusion Pairs
        </h3>
        <p
          className="text-xs text-center py-4"
          style={{ color: 'var(--color-text-muted)' }}
        >
          No confusion patterns detected yet. Keep studying — they'll appear as you answer more questions.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg p-5 ${className}`}
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Repeat2
            className="w-4 h-4"
            style={{ color: 'var(--color-data-provisional, #f59e0b)' }}
            aria-hidden="true"
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Confusion Pairs
          </h3>
        </div>
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {pairs.length} pair{pairs.length !== 1 ? 's' : ''} detected
        </span>
      </div>

      {/* Pair list */}
      <motion.div
        className="space-y-2.5"
        variants={containerVariants}
        initial={prefersReducedMotion ? 'visible' : 'hidden'}
        animate="visible"
      >
        {displayPairs.map((pair) => (
          <motion.div
            key={pair.id}
            variants={itemVariants}
            className="flex items-center gap-3 p-3 rounded-lg border transition-colors hover:border-[var(--color-accent)]/30"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Frequency indicator */}
            <div className="flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: pair.frequency >= 5
                    ? 'var(--color-data-fail, #ef4444)'
                    : pair.frequency >= 3
                    ? 'var(--color-data-provisional, #f59e0b)'
                    : 'var(--color-bg-tertiary)',
                  color: pair.frequency >= 3 ? 'white' : 'var(--color-text-secondary)',
                }}
              >
                {pair.frequency}
              </div>
            </div>

            {/* Pair description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className="font-medium truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                  title={displayName(pair, 'correct')}
                >
                  {displayName(pair, 'correct')}
                </span>
                <AlertTriangle
                  className="w-3 h-3 flex-shrink-0"
                  style={{ color: 'var(--color-data-provisional, #f59e0b)' }}
                  aria-hidden="true"
                />
                <span
                  className="font-medium truncate"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title={displayName(pair, 'selected')}
                >
                  {displayName(pair, 'selected')}
                </span>
              </div>
              {pair.system && (
                <span
                  className="text-[10px] mt-0.5 block"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {pair.system}
                </span>
              )}
            </div>

            {/* Drill button */}
            {onDrillPair && (
              <button
                onClick={() => onDrillPair(pair.correctConditionId, pair.selectedConditionId)}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 hover:opacity-90 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                }}
              >
                Drill
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Footer hint */}
      {pairs.length > maxPairs && (
        <p
          className="text-xs mt-3 text-center"
          style={{ color: 'var(--color-text-muted)' }}
        >
          +{pairs.length - maxPairs} more pair{pairs.length - maxPairs > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export default ConfusionPairCard;
