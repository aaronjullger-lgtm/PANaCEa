import React from 'react';
import { X } from 'lucide-react';

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
 * AnswerChoice - A multiple choice answer button with elimination support.
 * 
 * Features:
 * - Click text to select the answer
 * - Click X icon to eliminate the answer (toggle)
 * - Visual states for selected, correct, incorrect, and eliminated
 * - Keyboard shortcut hint (1-4 to select, Shift+1-4 to eliminate)
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
      // Don't select if the answer is eliminated or already answered
      if (isAnswered || isEliminated) return;
      onSelect(index);
    };

    const handleEliminateClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent triggering the main click
      if (isAnswered) return; // Can't eliminate after answering
      onToggleEliminate(index);
    };

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
          ' !bg-green-600 !text-white !border-transparent font-bold shadow-md';
      } else if (isSelected) {
        buttonClasses +=
          ' !bg-red-600 !text-white !border-transparent font-bold shadow-md';
        animationClass = 'animate-shake';
      } else {
        buttonClasses +=
          ' bg-[var(--color-card-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] opacity-60 shadow-sm';
      }
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
        aria-label={`Option ${index + 1}: ${text}${isEliminated ? ' (eliminated)' : ''}`}
      >
        <span
          className={`flex items-center justify-between ${
            isEliminated && !isAnswered ? 'line-through' : ''
          }`}
        >
          <span className="flex-1 pr-8">
            <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
            {text}
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
                    ? 'text-red-500 opacity-100'
                    : 'text-slate-400 opacity-50 hover:opacity-100 hover:text-red-500 hover:bg-red-50'
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
