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
        'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/20',
    },
    {
      tag: 'misread_question',
      label: 'Misread Question',
      icon: <Eye className="w-4 h-4" />,
      color:
        'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/20',
    },
    {
      tag: 'guessing',
      label: 'Guessing',
      icon: <HelpCircle className="w-4 h-4" />,
      color:
        'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10 border-[var(--color-data-provisional)]/20 hover:bg-[var(--color-data-provisional)]/20',
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
        initial={{ y: -5 }}
        animate={{ y: 0 }}
        className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"
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
      initial={{ y: -5 }}
      animate={{ y: 0 }}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-xs text-[var(--color-text-muted)]">Why did you miss it?</span>
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
