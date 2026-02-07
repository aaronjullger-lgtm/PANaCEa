/**
 * WelcomeBackCard - Shows last session summary and suggests next action
 * 
 * Reduces cognitive load for returning students by providing context
 * and a clear "continue" path without decision fatigue.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, TrendingUp, TrendingDown, X, RotateCcw } from 'lucide-react';
import { formatRelativeTime, type LastSessionData } from '@/lib/utils/sessionStorage';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';

interface WelcomeBackCardProps {
  lastSession: LastSessionData;
  onResume: () => void;
  onDismiss: () => void;
  className?: string;
}

export const WelcomeBackCard: React.FC<WelcomeBackCardProps> = ({
  lastSession,
  onResume,
  onDismiss,
  className = '',
}) => {
  const accuracy = lastSession.accuracy;
  const isGoodSession = accuracy >= 0.75;
  const weakSystemName = lastSession.weakSystemName || 
    (lastSession.weakSystem ? ABBREVIATION_TO_TOPIC_MAP[lastSession.weakSystem] : null);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        relative overflow-hidden rounded-xl 
        border border-[var(--color-border)] 
        bg-gradient-to-br from-[var(--color-accent)]/5 via-[var(--color-bg-secondary)] to-[var(--color-accent)]/5
        p-5
        ${className}
      `}
    >
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
        aria-label="Dismiss welcome card"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-bold text-[var(--color-text-primary)]">Welcome back!</h3>
      </div>

      {/* Last session stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">
            {formatRelativeTime(lastSession.timestamp)}
          </span>
          <span className="text-[var(--color-text-muted)]">•</span>
          <span className="text-sm text-[var(--color-text-muted)]">
            {lastSession.questionsCompleted} questions
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isGoodSession ? (
            <TrendingUp className="w-4 h-4 text-[var(--color-data-pass)]" />
          ) : (
            <TrendingDown className="w-4 h-4 text-[var(--color-data-provisional)]" />
          )}
          <span className={`text-sm font-semibold ${
            isGoodSession ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-provisional)]'
          }`}>
            {Math.round(accuracy * 100)}%
          </span>
        </div>
      </div>

      {/* Weak area suggestion */}
      {weakSystemName && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {accuracy < 0.7 ? (
            <>
              Missed some <span className="font-semibold text-[var(--color-text-primary)]">{weakSystemName}</span> questions. 
              Ready to review?
            </>
          ) : (
            <>
              Continue building on <span className="font-semibold text-[var(--color-text-primary)]">{weakSystemName}</span>
            </>
          )}
        </p>
      )}

      {/* Resume button */}
      <button
        onClick={onResume}
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg font-semibold hover:bg-[var(--color-accent-hover)] transition-colors group"
      >
        <span>Continue where you left off</span>
        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>
    </motion.div>
  );
};

export default WelcomeBackCard;
