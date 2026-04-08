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

    // Base button classes — cinematic answer card with premium easing
    let buttonClasses =
      'w-full text-left p-4 min-h-[48px] rounded-xl transition-all duration-200 disabled:cursor-not-allowed active:scale-[0.98] font-medium relative group';
    let animationClass = '';

    // Eliminated state styling
    if (isEliminated && !isAnswered) {
      buttonClasses +=
        ' opacity-40 grayscale bg-[var(--color-card-bg)]';
    } else if (isAnswered) {
      // After answering states — bold feedback with depth
      if (isCorrect) {
        buttonClasses +=
          ' !bg-[var(--color-data-pass)] !text-[var(--color-text-inverse)] !border-transparent font-semibold';
      } else if (isSelected) {
        buttonClasses +=
          ' !bg-[var(--color-data-fail)] !text-[var(--color-text-inverse)] !border-transparent font-semibold';
        animationClass = 'animate-shake';
      } else {
        buttonClasses +=
          ' bg-[var(--color-card-bg)] text-[var(--color-text-primary)] opacity-50';
      }
    } else if (isSelected && !isAnswered) {
      // Selected but not yet submitted — elevated blue ring
      buttonClasses +=
        ' bg-[var(--color-accent)]/8 text-[var(--color-text-primary)] font-semibold';
    } else {
      // Default hoverable state — subtle lift with cinematic shadow
      buttonClasses +=
        ' bg-[var(--color-card-bg)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] hover:-translate-y-0.5';
    }

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={handleMainClick}
        disabled={isAnswered}
        className={`${buttonClasses} ${animationClass}`}
        style={{
          fontSize: `calc(1rem + ${fontSizeAdjustment * 0.1}rem)`,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          ...(!isAnswered && isSelected
            ? { boxShadow: '0 0 0 2px var(--color-accent), 0 0 12px -2px rgba(59, 130, 246, 0.2), 0 4px 12px -4px rgba(0, 0, 0, 0.08)' }
            : isAnswered && (isCorrect || isSelected)
              ? { boxShadow: isCorrect ? '0 0 16px -4px rgba(34, 197, 94, 0.3)' : '0 0 16px -4px rgba(239, 68, 68, 0.3)' }
              : { boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.04)' }),
        }}
        aria-label={`Option ${String.fromCharCode(65 + index)}: ${displayText}${isEliminated ? ' (eliminated)' : ''}${isAnswered && isCorrect ? ' (correct answer)' : ''}${isAnswered && isSelected && !isCorrect ? ' (your incorrect answer)' : ''}`}
      >
        <span
          className={`flex items-center justify-between ${
            isEliminated && !isAnswered ? 'line-through' : ''
          } ${isAnswered && !isCorrect ? 'line-through' : ''}`}
        >
          <span className="flex-1 pr-8 flex items-center">
            <kbd
              className="inline-flex items-center justify-center min-w-[26px] h-[26px] px-1.5 mr-3 rounded-lg text-xs font-mono font-bold"
              style={{
                background: 'var(--color-bg-tertiary)',
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.06), 0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
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
                absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md
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

export default React.memo(AnswerChoice);
