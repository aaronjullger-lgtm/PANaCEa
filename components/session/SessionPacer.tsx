/**
 * SessionPacer
 *
 * A non-intrusive overlay that appears when the wellness engine
 * detects diminishing returns. Frames rest as STRATEGY, never as
 * health advice or a lecture.
 *
 * Design principles:
 * - Never blocks the screen — appears as a bottom sheet / toast
 * - Shows concrete stats (accuracy, time studied) to validate effort
 * - "Continue anyway" is always available and respected
 * - After dismissal, won't re-appear for RECHECK_INTERVAL more questions
 *   unless performance continues declining
 *
 * @module components/session/SessionPacer
 */

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, TrendingUp, ArrowRight, X } from 'lucide-react';
import type { SessionWellnessCheck, StopReason } from '@/lib/services/wellnessEngine';

interface SessionPacerProps {
  /** The current wellness check from useSessionWellness */
  check: SessionWellnessCheck;
  /** Whether the user has dismissed this nudge */
  dismissed: boolean;
  /** Called when user dismisses the nudge */
  onDismiss: () => void;
  /** Called when user chooses to end the session */
  onEndSession: () => void;
  /** Reduced motion preference */
  reducedMotion?: boolean;
}

const REASON_ICONS: Record<StopReason, React.ReactNode> = {
  accuracy_declining: <TrendingUp className="w-5 h-5 rotate-180" />,
  response_time_increasing: <Clock className="w-5 h-5" />,
  session_too_long: <Clock className="w-5 h-5" />,
  daily_limit_reached: <TrendingUp className="w-5 h-5" />,
  optimal_session_complete: <TrendingUp className="w-5 h-5" />,
};

const SessionPacerBase: React.FC<SessionPacerProps> = ({
  check,
  dismissed,
  onDismiss,
  onEndSession,
  reducedMotion = false,
}) => {
  const visible = check.shouldStop && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50"
          role="complementary"
          aria-label="Study session status"
        >
          <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-xl p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                  {check.reason ? REASON_ICONS[check.reason] : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Good stopping point
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {Math.round(check.stats.sessionDurationMinutes)} min &middot;{' '}
                    {check.stats.questionsAnswered} questions &middot;{' '}
                    {Math.round(check.stats.accuracy * 100)}% accuracy
                  </p>
                </div>
              </div>
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* Message — framed as strategy */}
            <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
              {check.message}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={onEndSession}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              >
                End session
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onDismiss}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              >
                Keep going
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const SessionPacer = memo(SessionPacerBase);
export default SessionPacer;
