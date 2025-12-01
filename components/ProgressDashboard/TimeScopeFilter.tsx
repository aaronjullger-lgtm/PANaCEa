/**
 * Time Scope Filter Component
 * 
 * Global control for filtering dashboard statistics by time period.
 */

import React from 'react';
import { motion } from 'framer-motion';
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
    <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
      {TIME_SCOPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === option.value
              ? 'text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          {value === option.value && (
            <motion.div
              layoutId="timeScopeIndicator"
              className="absolute inset-0 bg-slate-900 dark:bg-slate-100 rounded-md"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className={`relative z-10 ${value === option.value ? 'text-white dark:text-slate-900' : ''}`}>{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default TimeScopeFilter;
