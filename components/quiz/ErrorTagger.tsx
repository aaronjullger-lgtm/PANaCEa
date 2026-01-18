/**
 * ErrorTagger Component
 *
 * A non-intrusive meta-cognition tool that appears only when users answer incorrectly.
 * Helps users tag their error type to understand failure patterns.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Eye, HelpCircle } from 'lucide-react';
import type { ErrorTag } from '../../types';

export interface ErrorTaggerProps {
  /** Callback when an error tag is selected */
  onTagError: (tag: ErrorTag) => void;
  /** Whether a tag has already been saved */
  disabled?: boolean;
}

const ERROR_TAG_OPTIONS: { tag: ErrorTag; label: string; icon: React.ReactNode; color: string }[] =
  [
    {
      tag: 'knowledge_gap',
      label: 'Knowledge Gap',
      icon: <Brain className="w-4 h-4" />,
      color:
        'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100 dark:text-purple-300 dark:bg-purple-900/30 dark:border-purple-700 dark:hover:bg-purple-900/50',
    },
    {
      tag: 'misread_question',
      label: 'Misread Question',
      icon: <Eye className="w-4 h-4" />,
      color:
        'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-700 dark:hover:bg-blue-900/50',
    },
    {
      tag: 'guessing',
      label: 'Guessing',
      icon: <HelpCircle className="w-4 h-4" />,
      color:
        'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-700 dark:hover:bg-amber-900/50',
    },
  ];

const ErrorTagger: React.FC<ErrorTaggerProps> = ({ onTagError, disabled = false }) => {
  const [selectedTag, setSelectedTag] = useState<ErrorTag | null>(null);

  const handleTagClick = (tag: ErrorTag) => {
    if (disabled || selectedTag) return;
    setSelectedTag(tag);
    onTagError(tag);
  };

  if (selectedTag) {
    const selected = ERROR_TAG_OPTIONS.find((o) => o.tag === selectedTag);
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
      >
        <span>Tagged as</span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${selected?.color}`}
        >
          {selected?.icon}
          {selected?.label}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-xs text-slate-500 dark:text-slate-400">Why did you miss it?</span>
      {ERROR_TAG_OPTIONS.map((option) => (
        <button
          key={option.tag}
          onClick={() => handleTagClick(option.tag)}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${option.color} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </motion.div>
  );
};

export default ErrorTagger;
