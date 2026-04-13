/**
 * StudyTimer — Pomodoro-style study timer component
 *
 * Visual circular timer with work/break phase management, fatigue warnings,
 * and post-session summary. Designed for the PANaCEa study interface.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, RotateCcw, Brain, Clock, Target, Zap } from 'lucide-react';
import { springs } from '@/config/appViews';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import type { UseStudyTimerOptions, SessionSummary } from '@/hooks/useStudyTimer';
import type { SessionDataPoint } from '@/lib/services/studyTimerService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StudyTimerProps {
  /** Hook options forwarded to useStudyTimer */
  timerOptions?: Omit<UseStudyTimerOptions, 'onFatigueDetected'>;
  /** Record a question answer (call from parent on each answer) */
  onRecordAnswer?: (record: (dp: SessionDataPoint) => void) => void;
  /** Whether to show compact mode (minimal footprint) */
  compact?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CircularProgress({ progress, phase, remainingMs }: {
  progress: number;
  phase: string;
  remainingMs: number;
}) {
  const size = 160;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const trackColor = 'var(--color-bg-tertiary)';
  const strokeColor =
    phase === 'work'
      ? 'var(--color-category-knowledge, #6366f1)'
      : phase === 'break'
        ? 'var(--color-category-practice, #10b981)'
        : 'var(--color-accent, #8b5cf6)';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">
          {formatTime(remainingMs)}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] mt-1">
          {phase}
        </span>
      </div>
    </div>
  );
}

function FatigueWarning({ message, onDismiss }: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={springs.snappy}
      className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-warning-bg, #fef3c7)] border border-[var(--color-warning-border, #f59e0b33)]"
      role="alert"
    >
      <Brain className="w-5 h-5 text-[var(--color-warning-text, #92400e)] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-warning-text, #92400e)]">
          Fatigue Detected
        </p>
        <p className="text-xs text-[var(--color-warning-text, #92400e)] opacity-80 mt-0.5">
          {message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded hover:bg-[var(--color-warning-border, #f59e0b33)] transition-colors flex-shrink-0"
        aria-label="Dismiss fatigue warning"
      >
        <span className="text-sm text-[var(--color-warning-text, #92400e)]">&times;</span>
      </button>
    </motion.div>
  );
}

function SessionSummaryCard({ summary }: { summary: SessionSummary }) {
  const items = [
    { icon: Clock, label: 'Duration', value: `${formatMinutes(summary.durationMs)} min` },
    { icon: Target, label: 'Accuracy', value: `${Math.round(summary.accuracy * 100)}%` },
    { icon: Zap, label: 'Retention', value: `${Math.round(summary.retentionEstimate * 100)}%` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.gentle}
      className="space-y-4"
    >
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] text-center">
        Session Complete
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center p-3 rounded-lg bg-[var(--color-bg-secondary)]"
          >
            <Icon className="w-5 h-5 text-[var(--color-accent)] mb-1" />
            <span className="text-lg font-bold text-[var(--color-text-primary)]">{value}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-1 text-xs text-[var(--color-text-secondary)]">
        <span>{summary.questionsAnswered} questions answered</span>
        <span>{summary.workBlocksCompleted} work blocks</span>
        {summary.fatigueDetected && (
          <span className="text-[var(--color-warning-text, #92400e)]">Fatigue noted</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function StudyTimer({
  timerOptions,
  onRecordAnswer,
  compact = false,
}: StudyTimerProps) {
  const {
    phase,
    remainingMs,
    progress,
    isRunning,
    isPaused,
    session,
    fatigueAlert,
    summary,
    start,
    pause,
    skip,
    recordAnswer,
    reset,
  } = useStudyTimer({
    ...timerOptions,
  });

  // Expose recordAnswer to parent via callback ref pattern
  const recordAnswerRef = React.useRef(recordAnswer);
  recordAnswerRef.current = recordAnswer;

  React.useEffect(() => {
    if (onRecordAnswer) {
      onRecordAnswer((dp) => recordAnswerRef.current(dp));
    }
    // Only wire on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case 'work': return 'Work';
      case 'break': return 'Break';
      case 'complete': return 'Complete';
    }
  }, [phase]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            phase === 'work'
              ? 'bg-[var(--color-category-knowledge, #6366f1)]'
              : phase === 'break'
                ? 'bg-[var(--color-category-practice, #10b981)]'
                : 'bg-[var(--color-accent, #8b5cf6)]'
          }`}
        />
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          {phaseLabel}
          {phase !== 'complete' && (
            <span className="ml-1 text-xs text-[var(--color-text-tertiary)]">
              &middot; Block {session.workBlocksCompleted + 1}
            </span>
          )}
        </span>
      </div>

      {/* Timer display */}
      {phase !== 'complete' ? (
        <CircularProgress progress={progress} phase={phase} remainingMs={remainingMs} />
      ) : summary ? (
        <SessionSummaryCard summary={summary} />
      ) : null}

      {/* Controls */}
      {phase !== 'complete' && !compact && (
        <div className="flex items-center gap-2">
          {isPaused ? (
            <button
              onClick={start}
              className="p-2.5 rounded-full bg-[var(--color-category-knowledge, #6366f1)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity"
              aria-label="Resume timer"
            >
              <Play className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={pause}
              className="p-2.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label="Pause timer"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={skip}
            className="p-2.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Skip to next phase"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={reset}
            className="p-2.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Reset session"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Compact: just play/pause */}
      {phase !== 'complete' && compact && (
        <button
          onClick={isPaused ? start : pause}
          className="p-2 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      )}

      {/* Reset button when complete */}
      {phase === 'complete' && (
        <button
          onClick={reset}
          className="mt-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] font-medium hover:opacity-90 transition-opacity"
        >
          Start New Session
        </button>
      )}

      {/* Fatigue warning */}
      <AnimatePresence>
        {fatigueAlert?.detected && fatigueAlert.message && (
          <FatigueWarning
            message={fatigueAlert.message}
            onDismiss={() => {/* Clear on next render cycle */}}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
