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

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
  useRef,
} from 'react';
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
} from '../services/analytics/calibrationService';
import type { Question, SessionSettings } from '../types';

/** Commuter Mode: buffer for offline/low-connectivity — prefetch 50 cards on Start Session */
const INITIAL_QUEUE_SIZE = 50;

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

interface SessionState {
  settings: SessionSettings;
  questionQueue: Question[];
  currentQuestionIndex: number;
  calibration: SessionCalibration;
  startTime: number;
}

const SESSION_STORAGE_KEY = 'panacea-active-session';

export function SessionProvider({ children }: SessionProviderProps) {
  const { getToken } = useAuth();

  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [questionQueue, setQuestionQueue] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // JOL Calibration state
  const [calibration, setCalibration] = useState<SessionCalibration | null>(null);
  const calibrationRef = useRef<SessionCalibration | null>(null);

  const hasActiveSession = useMemo(() => {
    return !!sessionSettings && questionQueue.length > 0;
  }, [sessionSettings, questionQueue.length]);

  const saveSessionState = useCallback(() => {
    if (sessionSettings && calibration) {
      const state: SessionState = {
        settings: sessionSettings,
        questionQueue,
        currentQuestionIndex,
        calibration,
        startTime: Date.now(),
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
    }
  }, [sessionSettings, questionQueue, currentQuestionIndex, calibration]);

  const resumeSession = useCallback(() => {
    const savedState = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedState) {
      const state: SessionState = JSON.parse(savedState);
      setSessionSettings(state.settings);
      setQuestionQueue(state.questionQueue);
      setCurrentQuestionIndex(state.currentQuestionIndex);
      setCalibration(state.calibration);
      calibrationRef.current = state.calibration;
      return true;
    }
    return false;
  }, []);

  const startSession = useCallback(
    async (
      settings: SessionSettings,
      missedQuestions: Question[],
      flaggedQuestions: Question[],
      growthAreas: string[]
    ) => {
      // If a session can be resumed, don't start a new one
      if (resumeSession()) {
        return;
      }
      
      setSessionSettings(settings);
      setError(null);

      // ... (rest of startSession logic)
    },
    [getToken, resumeSession]
  );

  const endSession = useCallback(() => {
    setSessionSettings(null);
    setQuestionQueue([]);
    setCurrentQuestionIndex(0);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const pauseSession = useCallback(() => {
    saveSessionState();
  }, [saveSessionState]);

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
