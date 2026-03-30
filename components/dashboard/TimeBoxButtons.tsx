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
    gradient: 'from-[var(--color-accent)]/12 to-[var(--color-accent)]/4',
  },
  {
    minutes: 10,
    label: '10 min',
    questionEstimate: 6,
    icon: Clock,
    gradient: 'from-[var(--color-accent-secondary)]/10 to-[var(--color-accent-secondary)]/3',
  },
  {
    minutes: 20,
    label: '20 min',
    questionEstimate: 13,
    icon: Clock,
    gradient: 'from-[var(--color-warning)]/8 to-[var(--color-warning)]/2',
  },
];

export const TimeBoxButtons: React.FC<TimeBoxButtonsProps> = ({
  onStartSession,
  className = '',
}) => {
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
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">Quick Start</h3>
        <span className="text-xs text-[var(--color-text-muted)]">— pick a time window</span>
      </div>

      {/* Time preset buttons */}
      <div className="grid grid-cols-3 gap-4">
        {TIME_PRESETS.map((preset, index) => {
          const Icon = preset.icon;
          return (
            <motion.button
              key={preset.minutes}
              onClick={() => handleTimeBox(preset.minutes, preset.questionEstimate)}
              initial={{ y: 10 }}
              animate={{ y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.03, y: -3 }}
              whileTap={{ scale: 0.97 }}
              className={`
                relative overflow-hidden
                p-5 rounded-2xl border border-[var(--color-border)]
                bg-gradient-to-br ${preset.gradient}
                bg-[var(--color-bg-secondary)]
                hover:shadow-lg hover:border-[var(--color-accent)]/30 transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
                group cursor-pointer
              `}
            >
              {/* Icon */}
              <div className="flex items-center justify-center mb-3">
                <div className="p-2.5 rounded-xl bg-[var(--color-accent)]/10 group-hover:bg-[var(--color-accent)]/15 transition-colors">
                  <Icon className="w-6 h-6 text-[var(--color-accent)] group-hover:scale-110 transition-transform" />
                </div>
              </div>

              {/* Label */}
              <div className="text-center">
                <div className="font-bold text-[var(--color-text-primary)] text-lg">
                  {preset.label}
                </div>
                <div className="text-sm text-[var(--color-text-muted)] mt-1">
                  ~{preset.questionEstimate} questions
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Info text */}
      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Sessions auto-end at the time limit with a full summary
      </p>
    </div>
  );
};

export default TimeBoxButtons;
