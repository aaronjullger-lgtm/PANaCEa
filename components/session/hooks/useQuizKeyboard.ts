import { useState, useCallback, useEffect, useRef } from 'react';
import { useShortcut } from '@/contexts/ShortcutContext';
import type { Question } from '@/types';

export interface UseQuizKeyboardParams {
  isAnswered: boolean;
  selectedAnswerIndex: number | null;
  currentQuestion: Question | null;
  onShowMenu: () => void;
  onSubmitAnswer: () => void;
  onToggleRationale: () => void;
  optionButtonsRef: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  nextButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
}

export interface UseQuizKeyboardReturn {
  eliminatedAnswers: Set<number>;
  setEliminatedAnswers: React.Dispatch<React.SetStateAction<Set<number>>>;
  handleToggleEliminate: (index: number) => void;
  eliminationTimestampsRef: React.MutableRefObject<number[]>;
  resetElimination: () => void;
}

/**
 * Keyboard shortcuts and answer elimination logic for the quiz session.
 *
 * Owns elimination state and provides keyboard shortcuts:
 * - A/B/C/D: Select answer option
 * - Shift+A/B/C/D: Toggle answer elimination
 * - Enter: Submit selected answer
 * - Escape: Return to menu
 * - FLIP_CARD shortcut: Toggle rationale
 * - NEXT_QUESTION shortcut: Advance to next question
 */
export function useQuizKeyboard({
  isAnswered,
  selectedAnswerIndex,
  currentQuestion,
  onShowMenu,
  onSubmitAnswer,
  onToggleRationale,
  optionButtonsRef,
  nextButtonRef,
}: UseQuizKeyboardParams): UseQuizKeyboardReturn {
  // ---- ELIMINATION STATE ----
  const [eliminatedAnswers, setEliminatedAnswers] = useState<Set<number>>(new Set());
  const eliminationTimestampsRef = useRef<number[]>([]);

  const handleToggleEliminate = useCallback(
    (index: number) => {
      if (isAnswered) return;
      setEliminatedAnswers((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
          eliminationTimestampsRef.current.push(Date.now());
        }
        return next;
      });
    },
    [isAnswered]
  );

  const resetElimination = useCallback(() => {
    setEliminatedAnswers(new Set());
    eliminationTimestampsRef.current = [];
  }, []);

  // Global shortcut: FLIP_CARD — toggle rationale visibility
  useShortcut(
    'FLIP_CARD',
    () => {
      if (isAnswered) onToggleRationale();
    },
    { enabled: isAnswered }
  );

  // Global shortcut: NEXT_QUESTION — click the next button
  useShortcut(
    'NEXT_QUESTION',
    () => {
      if (isAnswered) nextButtonRef.current?.click();
    },
    { enabled: isAnswered }
  );

  // Quiz-specific keyboard shortcuts (A/B/C/D, Shift+A/B/C/D, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTypingTarget =
        target?.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select';

      // Don't capture quiz shortcuts while the user is typing.
      if (isTypingTarget) return;

      // Escape key to go back to menu
      if (event.key === 'Escape') {
        event.preventDefault();
        onShowMenu();
        return;
      }

      const letterToIndex: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };

      // Shift + A/B/C/D to toggle elimination
      if (!isAnswered && event.shiftKey) {
        const eliminateIndex = letterToIndex[event.key.toLowerCase()];
        if (eliminateIndex !== undefined && currentQuestion?.options[eliminateIndex]) {
          event.preventDefault();
          handleToggleEliminate(eliminateIndex);
          return;
        }
      }

      // Regular A/B/C/D to select (only if not eliminated)
      if (!isAnswered && !event.shiftKey) {
        const index = letterToIndex[event.key.toLowerCase()];
        if (index !== undefined && !eliminatedAnswers.has(index)) {
          event.preventDefault();
          optionButtonsRef.current[index]?.click();
        }
      }

      // Enter to submit selected answer
      if (!isAnswered && selectedAnswerIndex !== null && event.key === 'Enter') {
        event.preventDefault();
        onSubmitAnswer();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    currentQuestion,
    eliminatedAnswers,
    handleToggleEliminate,
    isAnswered,
    onShowMenu,
    onSubmitAnswer,
    optionButtonsRef,
    selectedAnswerIndex,
  ]);

  return {
    eliminatedAnswers,
    setEliminatedAnswers,
    handleToggleEliminate,
    eliminationTimestampsRef,
    resetElimination,
  };
}
