/**
 * CalibrationFeedbackBadge
 *
 * A compact, non-intrusive badge shown after each answer to build
 * metacognitive awareness. Maps the 2×2 confidence-accuracy quadrant
 * into a single encouraging line of feedback.
 *
 * Research: Kruger & Dunning (1999), Koriat (1997)
 * - Students who receive calibration feedback improve faster
 * - Feedback must be encouraging, not punitive
 *
 * Design: Appears as a small pill-shaped badge below the answer result.
 * Uses subtle color coding (not red/green) to avoid anxiety.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  getCalibrationFeedback,
  type CalibrationState,
} from '@/lib/services/calibrationEngine';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TOOLTIP_IMPLICIT_CONFIDENCE } from '@/lib/constants/copy';

interface CalibrationFeedbackBadgeProps {
  /** Whether the student got the answer correct */
  wasCorrect: boolean;
  /** Implicit confidence score (0-1) derived from behavior */
  confidence: number;
  /** Optional: override reduced motion */
  reducedMotion?: boolean;
}

const STATE_STYLES: Record<CalibrationState, string> = {
  mastered:
    'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)] border-[var(--color-data-pass)]/20',
  dangerous_misconception:
    'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)] border-[var(--color-data-provisional)]/20',
  underconfident_mastery:
    'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20',
  acknowledged_gap:
    'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)] border-[var(--color-text-secondary)]/20',
};

export const CalibrationFeedbackBadge: React.FC<CalibrationFeedbackBadgeProps> = ({
  wasCorrect,
  confidence,
  reducedMotion = false,
}) => {
  const { state, message, emoji } = getCalibrationFeedback(wasCorrect, confidence);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.2 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${STATE_STYLES[state]}`}
      role="status"
      aria-label={`Calibration feedback: ${message}`}
    >
      <span aria-hidden="true">{emoji}</span>
      <span>{message}</span>
      <InfoTooltip text={TOOLTIP_IMPLICIT_CONFIDENCE} size={12} />
    </motion.div>
  );
};

export default CalibrationFeedbackBadge;
