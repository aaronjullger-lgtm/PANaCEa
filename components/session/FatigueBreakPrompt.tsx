/**
 * FatigueBreakPrompt — Inline proactive break suggestion
 *
 * Appears between answer feedback and the "Next Question" button when the
 * proactive fatigue detector reaches 'break_suggested' level. Unlike the
 * SessionPacer (which is a floating toast for hard stops), this is an
 * inline element that integrates into the question flow.
 *
 * Design:
 * - Subtle, non-alarming styling — no red/danger colors
 * - "Take a 5-minute break" as primary action
 * - "Keep going" always available and never judged
 * - Shows concrete numbers (accuracy trend, time studied)
 *
 * @module components/session/FatigueBreakPrompt
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Coffee, ChevronRight } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ProactiveFatigueCheck } from '@/lib/services/wellnessEngine';

interface FatigueBreakPromptProps {
  /** The proactive fatigue check result */
  fatigue: ProactiveFatigueCheck;
  /** Whether the user has dismissed this nudge */
  dismissed: boolean;
  /** Called when user chooses to take a break */
  onTakeBreak: (minutes: number) => void;
  /** Called when user dismisses (keeps going) */
  onDismiss: () => void;
  /** Whether the hard-stop SessionPacer is already showing */
  hardStopVisible?: boolean;
}

export const FatigueBreakPrompt: React.FC<FatigueBreakPromptProps> = ({
  fatigue,
  dismissed,
  onTakeBreak,
  onDismiss,
  hardStopVisible = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  // Only show when break is suggested, not dismissed, and hard stop isn't already visible
  const visible =
    fatigue.fatigueLevel === 'break_suggested' &&
    !dismissed &&
    !hardStopVisible &&
    fatigue.nudgeMessage != null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="mx-auto max-w-2xl mt-4 mb-2 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="p-2 rounded-lg bg-[var(--color-data-provisional)]/10 shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-[var(--color-data-provisional)]" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {fatigue.nudgeMessage}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => onTakeBreak(fatigue.suggestedBreakMinutes)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-sm font-medium hover:bg-[var(--color-accent)]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    {fatigue.suggestedBreakMinutes}-minute break
                  </button>
                  <button
                    onClick={onDismiss}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    Keep going
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FatigueBreakPrompt;
