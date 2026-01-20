/**
 * SessionContext
 *
 * Manages quiz session state including:
 * - Session settings (focus, difficulty)
 * - Question queue
 * - Session lifecycle (start, end, pause)
 * - JOL calibration tracking for metacognitive insights
 *
 * Extracted from App.tsx to reduce component complexity.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getQuestionBatch } from '../services/questionService';
import {
  initSessionCalibration,
  createJOLObservation,
  recordObservation,
  getCalibrationSummary,
  hasReliableCalibration,
  getCalibrationProgress,
  type SessionCalibration,
  type CalibrationSummary,
  type SubmitReviewResponse,
} from '../services/calibrationService';
import type { Question, SessionSettings } from '../types';

const INITIAL_QUEUE_SIZE = 3;

interface CalibrationProgress {
  current: number;
  required: number;
  percentage: number;
}

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
    missedQuestions: Question[],
    flaggedQuestions: Question[],
    growthAreas: string[]
  ) => Promise<void>;
  /** End current session */
  endSession: () => void;
  /** Set question queue directly */
  setQuestionQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  /** Clear error */
  clearError: () => void;
  
  // ===== JOL Calibration Tracking =====
  /** Current calibration tracker (null if no active session) */
  calibration: SessionCalibration | null;
  /** Record a calibration observation after answering a question */
  recordCalibrationObservation: (
    questionId: string,
    response: SubmitReviewResponse,
    organSystem?: string
  ) => void;
  /** Get calibration summary at session end */
  getSessionCalibrationSummary: () => CalibrationSummary | null;
  /** Check if calibration has enough data for reliable analysis */
  hasReliableCalibrationData: () => boolean;
  /** Get calibration progress towards reliable analysis */
  calibrationProgress: CalibrationProgress;
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
  
  // JOL Calibration state
  const [calibration, setCalibration] = useState<SessionCalibration | null>(null);
  
  // Use ref to track if calibration was reset to avoid stale closure issues
  const calibrationRef = useRef<SessionCalibration | null>(null);

  const hasActiveSession = useMemo(() => {
    return !!sessionSettings && questionQueue.length > 0;
  }, [sessionSettings, questionQueue.length]);

  const startSession = useCallback(
    async (
      settings: SessionSettings,
      missedQuestions: Question[],
      flaggedQuestions: Question[],
      growthAreas: string[]
    ) => {
      setSessionSettings(settings);
      setError(null);
      
      // Initialize fresh calibration tracker for new session
      const newCalibration = initSessionCalibration();
      setCalibration(newCalibration);
      calibrationRef.current = newCalibration;

      try {
        setIsLoading(true);

        if (settings.focus === 'review') {
          // Due questions - filter missed questions by date
          const today = new Date().toISOString().split('T')[0];
          const due = missedQuestions.filter((q) => q.nextReviewDate && q.nextReviewDate <= today);
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
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start session. Please try again in a moment.';
        console.error('Error starting session:', err);
        setError(errorMessage);
        // Reset session on error
        setSessionSettings(null);
        setQuestionQueue([]);
        setCalibration(null);
        calibrationRef.current = null;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  const endSession = useCallback(() => {
    // Note: Calibration data is preserved until getSessionCalibrationSummary is called
    // This allows displaying the summary after the session ends
    setSessionSettings(null);
    setQuestionQueue([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Record a calibration observation after answering a question
   * 
   * Called from question submission flow with the submit-review API response.
   * Creates a JOL observation from behavioral metrics and updates the tracker.
   */
  const recordCalibrationObservation = useCallback(
    (questionId: string, response: SubmitReviewResponse, organSystem?: string) => {
      setCalibration((prevCalibration) => {
        if (!prevCalibration) {
          console.warn('recordCalibrationObservation called without active calibration tracker');
          return prevCalibration;
        }

        // Create JOL observation from API response
        const observation = createJOLObservation(questionId, response, organSystem);
        
        // Record observation and get updated tracker
        const updated = recordObservation(prevCalibration, observation);
        calibrationRef.current = updated;
        
        return updated;
      });
    },
    []
  );

  /**
   * Get calibration summary for session end display
   * 
   * Returns analysis of metacognitive calibration including:
   * - Calibration state (well_calibrated, overconfident, underconfident, etc.)
   * - Brier score (prediction accuracy)
   * - Overconfidence bias
   * - Actionable recommendations
   */
  const getSessionCalibrationSummary = useCallback((): CalibrationSummary | null => {
    const currentCalibration = calibrationRef.current || calibration;
    if (!currentCalibration) {
      return null;
    }
    return getCalibrationSummary(currentCalibration);
  }, [calibration]);

  /**
   * Check if calibration has enough data for reliable analysis
   * 
   * Requires minimum 10 observations for statistically meaningful insights.
   */
  const hasReliableCalibrationData = useCallback((): boolean => {
    const currentCalibration = calibrationRef.current || calibration;
    if (!currentCalibration) {
      return false;
    }
    return hasReliableCalibration(currentCalibration);
  }, [calibration]);

  /**
   * Get progress towards reliable calibration analysis
   * 
   * Shows how many more questions needed for reliable insights.
   */
  const calibrationProgress = useMemo((): CalibrationProgress => {
    const currentCalibration = calibrationRef.current || calibration;
    if (!currentCalibration) {
      return { current: 0, required: 10, percentage: 0 };
    }
    return getCalibrationProgress(currentCalibration);
  }, [calibration]);

  /**
   * Reset calibration tracker (called when starting a new session or clearing data)
   */
  const resetCalibration = useCallback(() => {
    setCalibration(null);
    calibrationRef.current = null;
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
    // Calibration
    calibration,
    recordCalibrationObservation,
    getSessionCalibrationSummary,
    hasReliableCalibrationData,
    calibrationProgress,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}

export default SessionContext;