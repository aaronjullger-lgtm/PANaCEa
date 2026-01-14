/**
 * SessionContext
 * 
 * Manages quiz session state including:
 * - Session settings (focus, difficulty)
 * - Question queue
 * - Session lifecycle (start, end, pause)
 * 
 * Extracted from App.tsx to reduce component complexity.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getQuestionBatch } from '../services/questionService';
import type { Question, SessionSettings, MissedQuestion } from '../types';

const INITIAL_QUEUE_SIZE = 3;

interface SessionContextValue {
  /** Current session settings */
  sessionSettings: SessionSettings | null;
  /** Current question queue */
  questionQueue: Question[];
  /** Whether session is loading */
  isLoading: boolean;
  /** Session error message */
  error: string | null;
  /** Whether there's an active session */
  hasActiveSession: boolean;
  /** Start a new session */
  startSession: (
    settings: SessionSettings, 
    missedQuestions: MissedQuestion[], 
    flaggedQuestions: Question[],
    growthAreas: string[]
  ) => Promise<void>;
  /** End current session */
  endSession: () => void;
  /** Set question queue directly */
  setQuestionQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  /** Clear error */
  clearError: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { getToken } = useAuth();
  
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [questionQueue, setQuestionQueue] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasActiveSession = useMemo(() => {
    return !!sessionSettings && questionQueue.length > 0;
  }, [sessionSettings, questionQueue.length]);

  const startSession = useCallback(async (
    settings: SessionSettings,
    missedQuestions: MissedQuestion[],
    flaggedQuestions: Question[],
    growthAreas: string[]
  ) => {
    setSessionSettings(settings);
    setError(null);

    try {
      setIsLoading(true);

      if (settings.focus === 'review') {
        // Due questions - filter missed questions by date
        const today = new Date().toISOString().split('T')[0];
        const due = missedQuestions.filter(
          (q) => q.nextReviewDate && q.nextReviewDate <= today
        );
        setQuestionQueue(due as Question[]);
      } else if (settings.focus === 'reviewFlagged') {
        // Flagged questions
        setQuestionQueue(flaggedQuestions);
      } else {
        // Normal session - fetch from question pool
        const initialQuestions = await getQuestionBatch(
          settings,
          growthAreas,
          INITIAL_QUEUE_SIZE,
          getToken
        );
        setQuestionQueue(initialQuestions);
      }
    } catch (err: any) {
      console.error('Error starting session:', err);
      setError(
        err?.message || 'Failed to start session. Please try again in a moment.'
      );
      // Reset session on error
      setSessionSettings(null);
      setQuestionQueue([]);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const endSession = useCallback(() => {
    setSessionSettings(null);
    setQuestionQueue([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: SessionContextValue = {
    sessionSettings,
    questionQueue,
    isLoading,
    error,
    hasActiveSession,
    startSession,
    endSession,
    setQuestionQueue,
    clearError,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}

export default SessionContext;
