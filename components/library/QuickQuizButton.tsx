/**
 * QuickQuizButton - Jump to drill questions for a specific condition
 *
 * Small button that appears on condition cards to start a focused quiz
 */

import React from 'react';
import { Zap, Brain, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface QuickQuizButtonProps {
  conditionId: string;
  conditionName: string;
  system?: string;
  /** Number of available questions for this condition */
  questionCount?: number;
  /** Called when user wants to start a quiz */
  onStartQuiz: (conditionId: string, mode: 'rapid' | 'deep' | 'mixed') => void;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show expanded menu on hover */
  showModes?: boolean;
}

export const QuickQuizButton: React.FC<QuickQuizButtonProps> = ({
  conditionId,
  conditionName,
  system,
  questionCount,
  onStartQuiz,
  size = 'sm',
  showModes = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  // Simple single-click version
  if (!showModes) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStartQuiz(conditionId, 'mixed');
        }}
        className={`
          inline-flex items-center gap-1 rounded-lg
          bg-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/30
          text-[var(--color-accent)] border border-[var(--color-accent)]/30
          transition-all hover:scale-105 active:scale-95
          ${sizeClasses[size]}
        `}
        title={`Start quiz on ${conditionName}`}
      >
        <Zap className={iconSizes[size]} />
        <span>Quiz</span>
        {questionCount !== undefined && questionCount > 0 && (
          <span className="opacity-70">({questionCount})</span>
        )}
      </button>
    );
  }

  // Expanded version with mode selection
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        className={`
          inline-flex items-center gap-1 rounded-lg
          bg-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/30
          text-[var(--color-accent)] border border-[var(--color-accent)]/30
          transition-all
          ${sizeClasses[size]}
        `}
      >
        <Zap className={iconSizes[size]} />
        <span>Quiz</span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 mt-1 z-50 min-w-[160px]"
        >
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--color-border)]">
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
                Quiz Mode
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartQuiz(conditionId, 'rapid');
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)]/80 flex items-center gap-2 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-data-provisional" />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">Rapid Recall</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">Quick buzzword drill</p>
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartQuiz(conditionId, 'deep');
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)]/80 flex items-center gap-2 transition-colors"
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">Deep Dive</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">Clinical scenarios</p>
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartQuiz(conditionId, 'mixed');
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)]/80 flex items-center gap-2 transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5 text-data-pass" />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">
                  Mixed Practice
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">All question types</p>
              </div>
            </button>

            {questionCount !== undefined && (
              <div className="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/50">
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {questionCount} questions available
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default QuickQuizButton;
