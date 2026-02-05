import React from 'react';
import { X } from 'lucide-react';
import { feedback } from '@/services/core/feedbackService';

interface AnswerChoiceProps {
  /** The answer text content */
  text: string;
  /** 0-based index of this answer option */
  index: number;
  /** Whether this answer is currently selected */
  isSelected: boolean;
  /** Whether this is the correct answer (only relevant after answering) */
  isCorrect: boolean;
  /** Whether the question has been answered */
  isAnswered: boolean;
  /** Whether this answer has been eliminated by the user */
  isEliminated: boolean;
  /** Callback when the answer text is clicked (to select it) */
  onSelect: (index: number) => void;
  /** Callback when the X icon is clicked (to toggle elimination) */
  onToggleEliminate: (index: number) => void;
  /** Font size adjustment value */
  fontSizeAdjustment?: number;
}

/**
 * Capitalize the first letter of a string.
 * Used for answer choices to ensure consistent formatting.
 */
function capitalizeFirst(str: string): string {
  if (!str || str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * AnswerChoice - A multiple choice answer button with elimination support.
 *
 * Features:
 * - Click text to select the answer
 * - Click X icon to eliminate the answer (toggle)
 * - Visual states for selected, correct, incorrect, and eliminated
 * - Keyboard shortcut hint (1-4 to select, Shift+1-4 to eliminate)
 * - Auto-capitalizes answer text for consistent display
 */
const AnswerChoice = React.forwardRef<HTMLButtonElement, AnswerChoiceProps>(
  (
    {
      text,
      index,
      isSelected,
      isCorrect,
      isAnswered,
      isEliminated,
      onSelect,
      onToggleEliminate,
      fontSizeAdjustment = 0,
    },
    ref
  ) => {
    const handleMainClick = (e: React.MouseEvent) => {
      // Don't select if already answered or if the answer is eliminated
      if (isAnswered || isEliminated) return;
      feedback.selection();
      onSelect(index);
    };

    const handleEliminateClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent triggering the main click
      if (isAnswered) return; // Can't eliminate after answering
      onToggleEliminate(index);
    };

    // Capitalize the first letter of the answer text
    const displayText = capitalizeFirst(text);

    // Base button classes
    let buttonClasses =
      'w-full text-left p-4 rounded-xl transition-all duration-200 ease-in-out disabled:cursor-not-allowed active:scale-[0.98] font-medium relative group';
    let animationClass = '';

    // Eliminated state styling
    if (isEliminated && !isAnswered) {
      buttonClasses +=
        ' opacity-50 grayscale bg-[var(--color-card-bg)] border border-[var(--color-border)] shadow-sm';
    } else if (isAnswered) {
      // After answering states
      if (isCorrect) {
        buttonClasses +=
          ' !bg-[var(--color-data-pass)] !text-white !border-transparent font-bold shadow-md';
      } else if (isSelected) {
        buttonClasses +=
          ' !bg-[var(--color-data-fail)] !text-white !border-transparent font-bold shadow-md';
        animationClass = 'animate-shake';
      } else {
        buttonClasses +=
          ' bg-[var(--color-card-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] opacity-60 shadow-sm';
      }
    } else if (isSelected && !isAnswered) {
      // Selected but not yet submitted - show highlighted state
      buttonClasses +=
        ' bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)] shadow-md text-[var(--color-text-primary)] font-semibold';
    } else {
      // Default hoverable state - use CSS variable for hover background to work in both light and dark mode
      buttonClasses +=
        ' bg-[var(--color-card-bg)] border border-[var(--color-border)] shadow-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:shadow-lg hover:-translate-y-px';
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleMainClick}
        disabled={isAnswered}
        className={`${buttonClasses} ${animationClass}`}
        style={{ fontSize: `calc(1rem + ${fontSizeAdjustment * 0.1}rem)` }}
        aria-label={`Option ${index + 1}: ${displayText}${isEliminated ? ' (eliminated)' : ''}`}
        aria-pressed={isSelected}
      >
        <span
          className={`flex items-center justify-between ${
            isEliminated && !isAnswered ? 'line-through' : ''
          }`}
        >
          <span className="flex-1 pr-8 flex items-center">
            <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 mr-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] border-b-2 text-xs font-mono font-bold shadow-sm">
              {String.fromCharCode(65 + index)}
            </kbd>
            <span>{displayText}</span>
          </span>

          {/* X icon for elimination - only show before answering */}
          {!isAnswered && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleEliminateClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleEliminate(index);
                }
              }}
              className={`
                absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md
                transition-all duration-150
                ${
                  isEliminated
                    ? 'text-[var(--color-data-fail)] opacity-100'
                    : 'text-[var(--color-text-muted)] opacity-50 hover:opacity-100 hover:text-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/10'
                }
                group-hover:opacity-75
              `}
              aria-label={isEliminated ? 'Restore this option' : 'Eliminate this option'}
            >
              <X className="w-4 h-4" />
            </span>
          )}
        </span>
      </button>
    );
  }
);

AnswerChoice.displayName = 'AnswerChoice';

export default AnswerChoice;
