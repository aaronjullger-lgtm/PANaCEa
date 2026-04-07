import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { Question, SessionSettings } from '@/types';

interface QuizSessionState {
  version: 1;
  timestamp: number;
  sessionSettings: SessionSettings;
  queue: Question[];
  currentQuestionIndex: number; // index in queue, -1 if none
  selectedAnswerIndex: number | null;
  isAnswered: boolean;
  questionNumber: number; // overall question number in session
  eliminatedAnswers: number[];
  localNote: string;
  answerChangeCount: number;
  firstSelectedAnswer: number | null;
  /** Running session score for restoring score display after tab crash (Finding 4 fix) */
  sessionScore: { correct: number; total: number };
  // performance data is managed by parent, not stored here
}

interface UseQuizSessionRecoveryOptions {
  userId?: string;
  sessionSettings: SessionSettings;
  initialQueue: Question[];
  onRestore?: (state: Partial<QuizSessionState>) => void;
}

/**
 * Hook that manages session recovery for QuizView.
 * Saves essential state to localStorage and restores on mount if settings match.
 * Provides a function to clear saved state (e.g., when session ends).
 */
export function useQuizSessionRecovery({
  userId,
  sessionSettings,
  initialQueue,
  onRestore,
}: UseQuizSessionRecoveryOptions) {
  const storageKey = `panacea_quiz_session_${userId || 'anonymous'}`;
  const [savedState, setSavedState] = useLocalStorage<QuizSessionState | null>(storageKey, null);
  const isRestored = useRef(false);

  // Determine if saved state matches current session settings and is recent (within 30 minutes)
  const shouldRestore = useCallback((): boolean => {
    if (!savedState) return false;
    // Version check
    if (savedState.version !== 1) return false;
    // Compare session settings (simple JSON equality)
    if (JSON.stringify(savedState.sessionSettings) !== JSON.stringify(sessionSettings)) {
      return false;
    }
    // Check timestamp (30 minutes)
    const age = Date.now() - savedState.timestamp;
    if (age > 30 * 60 * 1000) {
      return false;
    }
    // Ensure queue is not empty
    if (!savedState.queue || savedState.queue.length === 0) return false;
    // Validate each question has required fields
    if (!savedState.queue.every(q => q.id && q.question)) {
      return false;
    }
    return true;
  }, [savedState, sessionSettings]);

  // Restore state on mount if applicable
  useEffect(() => {
    if (isRestored.current) return;
    if (!shouldRestore()) return;
    if (!savedState) return;

    // Notify parent/consumer that state can be restored
    if (onRestore) {
      onRestore(savedState);
    }
    // Clear saved state after restoration to prevent double restore
    setSavedState(null);
    isRestored.current = true;
  }, [shouldRestore, savedState, onRestore, setSavedState]);

  // Save state whenever relevant pieces change (to be called by consumer)
  const saveState = useCallback((state: Omit<QuizSessionState, 'version' | 'timestamp' | 'sessionSettings'>) => {
    const fullState: QuizSessionState = {
      version: 1,
      timestamp: Date.now(),
      sessionSettings,
      ...state,
    };
    setSavedState(fullState);
  }, [sessionSettings, setSavedState]);

  const clearSavedState = useCallback(() => {
    setSavedState(null);
  }, [setSavedState]);

  return {
    saveState,
    clearSavedState,
    shouldRestore: shouldRestore(),
    savedState,
  };
}