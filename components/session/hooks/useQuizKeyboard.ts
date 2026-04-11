import { useState, useCallback, useEffect, useRef } from 'react';
import { useShortcut } from '@/contexts/ShortcutContext';
import type { Question } from '@/types';

export interface UseQuizKeyboardParams {
  isAnswered: boolean;
  selectedAnswerIndex: number | null;
  currentQuestion: Question | null;
  eliminatedAnswers: Set<number>;
  questionNumber: number;
  queueLength: number;
  onToggleEliminate: (index: number) => void;
  onShowMenu: () => void;
  onSubmitAnswer: () => void;
  onShowRationale: (show: boolean) => void;
  onNextQuestion: () => void;
  optionButtonsRef: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  nextButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
}

/**
 * Keyboard shortcuts and answer elimination logic for the quiz session.
 */
export function useQuizKeyboard({
  isAnswered,
  selectedAnswerIndex,
  currentQuestion,
  eliminatedAnswers,
  questionNumber,
  queueLength,
  onToggleEliminate,
  onShowMenu,
  onSubmitAnswer,
  onShowRationale,
  onNextQuestion,
  optionButtonsRef,
  nextButtonRef,
}: UseQuizKeyboardParams) {
  // ---- ELIMINATION STATE ----
  const [eliminatedAnswersState, setEliminatedAnswers] = useState<Set<number>>(new Set());
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

  // Keyboard shortcuts: FLIP_CARD
  useShortcut(
    'FLIP_CARD',
    () => { if (isAnswered) onShowRationale(true); },
    { enabled: isAnswered }
  );

  // Keyboard shortcuts: NEXT_QUESTION
  useShortcut(
    'NEXT_QUESTION',
    () => { if (isAnswered) nextButtonRef.current?.click(); },
    { enabled: isAnswered }
  );

  // Quiz-specific keyboard shortcuts (A/B/C/D, Shift+A/B/C/D, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName.toLowerCase() === 'textarea') return;

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

      // Enter to submit
      if (!isAnswered && selectedAnswerIndex !== null && event.key === 'Enter') {
        event.preventDefault();
        onSubmitAnswer();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, selectedAnswerIndex, handleToggleEliminate, eliminatedAnswers, currentQuestion, onShowMenu, onSubmitAnswer]);

  return {
    eliminatedAnswers: eliminatedAnswersState,
    setEliminatedAnswers,
    handleToggleEliminate,
    eliminationTimestampsRef,
  };
}
