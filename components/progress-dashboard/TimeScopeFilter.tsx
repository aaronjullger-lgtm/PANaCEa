/**
 * Time Scope Filter Component
 *
 * Global control for filtering dashboard statistics by time period.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { springs } from '@/config/appViews';
import type { TimeScope } from './WidgetGrid';

interface TimeScopeFilterProps {
  value: TimeScope;
  onChange: (scope: TimeScope) => void;
}

const TIME_SCOPE_OPTIONS: { value: TimeScope; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '1wk', label: '1wk' },
  { value: '1mo', label: '1mo' },
];

const TimeScopeFilter: React.FC<TimeScopeFilterProps> = ({ value, onChange }) => {
  return (
    <div className="inline-flex items-center rounded-lg bg-[var(--color-bg-tertiary)] p-1 border border-[var(--color-border)]">
      {TIME_SCOPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === option.value
              ? 'text-[var(--color-text-inverse)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {value === option.value && (
            <motion.div
              layoutId="timeScopeIndicator"
              className="absolute inset-0 bg-[var(--color-accent)] rounded-md"
              transition={springs.snappy}
            />
          )}
          <span className="relative z-10">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default TimeScopeFilter;
