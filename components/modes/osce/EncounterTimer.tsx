import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Timer } from 'lucide-react';

interface EncounterTimerProps {
  startTime: number;
  isActive: boolean;
  isPaused?: boolean;
  /** Accumulated milliseconds spent paused — subtracted from elapsed time */
  pausedMs?: number;
  targetMinutes?: number;
  compact?: boolean;
}

// ─── Time Thresholds (seconds) ──────────────────────────────────────────────
/** Seconds remaining before "approaching deadline" pulse animation triggers */
const APPROACHING_THRESHOLD_SEC = 120;
/** Time boundary for green → yellow color transition (minutes) */
const COMFORTABLE_MINUTES = 10;
/** Time boundary for orange → red color transition (minutes) */
const OVERTIME_WARNING_MINUTES = 20;

export const EncounterTimer: React.FC<EncounterTimerProps> = ({
  startTime,
  isActive,
  isPaused = false,
  pausedMs = 0,
  targetMinutes = 15,
  compact = false,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || isPaused) return;

    const interval = setInterval(() => {
      const activeMs = Date.now() - startTime - pausedMs;
      setElapsed(Math.max(0, Math.floor(activeMs / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, startTime, pausedMs]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const targetSeconds = targetMinutes * 60;
  const secondsRemaining = Math.max(0, targetSeconds - elapsed);
  const isApproaching = secondsRemaining <= APPROACHING_THRESHOLD_SEC && secondsRemaining > 0;
  const isOver = elapsed > targetSeconds;

  // Color based on time
  const getColor = () => {
    if (elapsed < COMFORTABLE_MINUTES * 60) return 'text-[var(--color-data-pass)]';
    if (elapsed < targetSeconds) return 'text-[var(--color-data-provisional)]';
    if (elapsed < OVERTIME_WARNING_MINUTES * 60) return 'text-[var(--color-data-provisional)]';
    return 'text-[var(--color-data-fail)]';
  };

  const getProgressColor = () => {
    if (elapsed < COMFORTABLE_MINUTES * 60) return 'from-green-500 to-green-600';
    if (elapsed < targetSeconds) return 'from-yellow-500 to-yellow-600';
    if (elapsed < OVERTIME_WARNING_MINUTES * 60) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  // Compact inline display
  if (compact) {
    return (
      <motion.div
        animate={isApproaching ? { scale: [1, 1.05, 1] } : {}}
        transition={isApproaching ? { repeat: Infinity, duration: 1.5 } : {}}
        className={`font-mono text-sm font-semibold ${getColor()}`}
      >
        {timeString}
      </motion.div>
    );
  }

  // Full display with progress ring
  const circumference = 2 * Math.PI * 45;
  const progress = Math.min(elapsed / targetSeconds, 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <motion.div
      animate={isApproaching ? { scale: [1, 1.02, 1] } : {}}
      transition={isApproaching ? { repeat: Infinity, duration: 1.5 } : {}}
      className="flex flex-col items-center gap-2 p-4 bg-data-neutral-bg rounded-lg border border-data-neutral"
    >
      {/* Icon and label */}
      <div className="flex items-center gap-2 text-data-neutral-foreground">
        <Timer className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {isOver ? 'Time Over' : 'Elapsed'}
        </span>
      </div>

      {/* Time display with progress ring */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="absolute w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="64"
            cy="64"
            r="45"
            fill="none"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <motion.circle
            cx="64"
            cy="64"
            r="45"
            fill="none"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            stroke="currentColor"
            className={`transition-all duration-300 ${getColor()}`}
          />
        </svg>

        {/* Time text */}
        <div className={`text-center font-mono ${getColor()}`}>
          <div className="text-3xl font-bold">{timeString}</div>
          {!isOver && (
            <div className="text-xs text-data-neutral-500 mt-1">
              of {targetMinutes}:00
            </div>
          )}
        </div>
      </div>

      {/* Status indicator */}
      {isApproaching && !isOver && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-xs font-semibold text-[var(--color-data-provisional)]"
        >
          Approaching target
        </motion.div>
      )}
      {isOver && (
        <div className="text-xs font-semibold text-[var(--color-data-fail)]">
          +{Math.floor((elapsed - targetSeconds) / 60)}:{String((elapsed - targetSeconds) % 60).padStart(2, '0')}
        </div>
      )}
    </motion.div>
  );
};
