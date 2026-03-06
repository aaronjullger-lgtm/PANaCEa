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
  useEffect,
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
  version?: number;
  settings: SessionSettings;
  questionQueue: Question[];
  currentQuestionIndex: number;
  calibration: SessionCalibration;
  startTime: number;
}

const SESSION_STORAGE_KEY = 'panacea-active-session';
const MAX_SESSION_AGE_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_STORAGE_VERSION = 1;

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
  const isRestored = useRef(false);

  const hasActiveSession = useMemo(() => {
    return !!sessionSettings && questionQueue.length > 0;
  }, [sessionSettings, questionQueue.length]);

  const shouldRestoreSavedSession = useCallback((state: SessionState): boolean => {
    const version = state.version ?? 1;
    if (version !== SESSION_STORAGE_VERSION) return false;
    const age = Date.now() - state.startTime;
    if (age > MAX_SESSION_AGE_MS) return false;
    if (!state.settings || !state.questionQueue || state.questionQueue.length === 0) return false;
    // Ensure each question has required fields (optional)
    if (!state.questionQueue.every(q => q.id && q.question)) return false;
    return true;
  }, []);

  const saveSessionState = useCallback(() => {
    if (sessionSettings && calibration) {
      const state: SessionState = {
        version: SESSION_STORAGE_VERSION,
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
    if (isRestored.current) return false;
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return false;
    try {
      const state: SessionState = JSON.parse(saved);
      // Default version to 1 if missing
      state.version = state.version ?? 1;
      if (!shouldRestoreSavedSession(state)) {
        // Clear invalid session
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return false;
      }
      setSessionSettings(state.settings);
      setQuestionQueue(state.questionQueue);
      setCurrentQuestionIndex(state.currentQuestionIndex);
      setCalibration(state.calibration);
      calibrationRef.current = state.calibration;
      isRestored.current = true;
      return true;
    } catch (error) {
      console.error('Failed to parse saved session:', error);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }
  }, [shouldRestoreSavedSession]);

  // Restore saved session on mount if valid
  useEffect(() => {
    if (!hasActiveSession) {
      resumeSession();
    }
  }, [hasActiveSession, resumeSession]);

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
    isRestored.current = false;
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
