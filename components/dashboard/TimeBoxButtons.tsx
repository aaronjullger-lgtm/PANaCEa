/**
 * TimeBoxButtons - Quick-start presets for time-limited study sessions
 *
 * PA students often have 5-15 minute windows. These buttons provide
 * instant access to time-boxed sessions that auto-end at the limit.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Zap } from 'lucide-react';
import type { SessionSettings } from '@/types';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface TimeBoxButtonsProps {
  onStartSession: (settings: SessionSettings) => void;
  className?: string;
}

interface TimeBoxPreset {
  minutes: number;
  label: string;
  questionEstimate: number; // Rough estimate at 90s per question
  icon: typeof Clock | typeof Zap;
  gradient: string;
}

const TIME_PRESETS: TimeBoxPreset[] = [
  {
    minutes: 5,
    label: '5 min',
    questionEstimate: 3,
    icon: Zap,
    gradient: 'from-[var(--color-accent)]/15 to-[var(--color-accent)]/5',
  },
  {
    minutes: 10,
    label: '10 min',
    questionEstimate: 6,
    icon: Clock,
    gradient: 'from-[var(--color-accent)]/12 to-[var(--color-accent-light)]/50',
  },
  {
    minutes: 20,
    label: '20 min',
    questionEstimate: 13,
    icon: Clock,
    gradient: 'from-[var(--color-accent)]/10 to-[var(--color-accent-light)]/30',
  },
];

export const TimeBoxButtons: React.FC<TimeBoxButtonsProps> = ({
  onStartSession,
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();

  const handleTimeBox = (minutes: number, questionCount: number) => {
    const settings: SessionSettings = {
      questionCount,
      timeLimit: minutes * 60 * 1000, // Convert to milliseconds
      focus: 'all', // Mixed focus for variety
      systems: [], // All systems
      difficulty: 'medium',
    };
    onStartSession(settings);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Quick Start</h3>
      </div>

      {/* Time preset buttons — stacks to 1-col on very small screens, 3-col from sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="group" aria-label="Time-boxed session presets">
        {TIME_PRESETS.map((preset, index) => {
          const Icon = preset.icon;
          return (
            <motion.button
              key={preset.minutes}
              onClick={() => handleTimeBox(preset.minutes, preset.questionEstimate)}
              initial={prefersReducedMotion ? false : { y: 10 }}
              animate={{ y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.05 }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -2 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              aria-label={`Start ${preset.label} session — approximately ${preset.questionEstimate} questions`}
              className={`
                relative overflow-hidden
                p-4 rounded-xl border border-[var(--color-border)]
                bg-gradient-to-br ${preset.gradient}
                hover:shadow-md transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
                min-h-[44px]
                group
              `}
            >
              {/* Icon */}
              <div className="flex items-center justify-center mb-2" aria-hidden="true">
                <Icon className="w-6 h-6 text-[var(--color-accent)] group-hover:scale-110 transition-transform" />
              </div>

              {/* Label */}
              <div className="text-center">
                <div className="font-bold text-[var(--color-text-primary)] text-sm">
                  {preset.label}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  ~{preset.questionEstimate} questions
                </div>
              </div>

              {/* Hover indicator */}
              <div className="absolute inset-0 bg-[var(--color-accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          );
        })}
      </div>

      {/* Info text */}
      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Sessions auto-end at time limit with summary
      </p>
    </div>
  );
};

export default TimeBoxButtons;
