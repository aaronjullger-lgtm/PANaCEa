/**
 * BreakTimer — Full-screen timed break overlay
 *
 * Shows a countdown timer during a study break. Frames rest as strategy:
 * "Your brain is consolidating what you just studied."
 *
 * Features:
 * - Animated circular progress ring
 * - "Return early" button (always available)
 * - Auto-resumes when timer hits 0
 * - Calming, minimal UI — no overwhelming animations
 *
 * @module components/session/BreakTimer
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Coffee } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface BreakTimerProps {
  /** Whether the break is active */
  isActive: boolean;
  /** Seconds remaining */
  secondsLeft: number;
  /** Total break duration in seconds (for progress ring) */
  totalSeconds: number;
  /** Called when user returns early */
  onReturn: () => void;
  /** Questions answered so far (for encouragement) */
  questionsAnswered?: number;
  /** Session accuracy so far */
  accuracy?: number;
}

const BREAK_TIPS = [
  'Your brain is consolidating what you just studied.',
  'Spaced breaks improve long-term retention by 20-30%.',
  'Even a short rest resets your working memory capacity.',
  'Top-performing students take more breaks, not fewer.',
  'Your hippocampus replays recent learning during rest periods.',
];

export const BreakTimer: React.FC<BreakTimerProps> = ({
  isActive,
  secondsLeft,
  totalSeconds,
  onReturn,
  questionsAnswered = 0,
  accuracy = 0,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;

  // Pick a stable tip based on total seconds (so it doesn't change during the break)
  const tip = useMemo(
    () => BREAK_TIPS[totalSeconds % BREAK_TIPS.length],
    [totalSeconds]
  );

  // SVG circle math
  const RADIUS = 80;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
          className="fixed inset-0 z-[40] flex items-center justify-center bg-[var(--color-bg-primary)]/95 backdrop-blur-sm"
          role="dialog"
          aria-label="Study break timer"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-8 px-6 max-w-sm text-center">
            {/* Coffee icon */}
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2, duration: 0.3 }}
            >
              <Coffee className="w-8 h-8 text-[var(--color-accent)]" />
            </motion.div>

            {/* Timer ring */}
            <div className="relative w-48 h-48">
              <svg className="w-48 h-48 -rotate-90" viewBox="0 0 200 200">
                {/* Background ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={RADIUS}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeWidth="6"
                />
                {/* Progress ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={RADIUS}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              {/* Time display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-mono font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] mt-1">remaining</span>
              </div>
            </div>

            {/* Tip */}
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {tip}
            </p>

            {/* Session stats — validates effort */}
            {questionsAnswered > 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">
                {questionsAnswered} questions &middot; {Math.round(accuracy * 100)}% accuracy so far
              </p>
            )}

            {/* Return early button */}
            <button
              onClick={onReturn}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <Play className="w-4 h-4" />
              Resume studying
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BreakTimer;
