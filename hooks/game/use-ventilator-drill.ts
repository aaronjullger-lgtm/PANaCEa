/**
 * useVentilatorDrill - Hook for Ventilator Management drill mode
 * 
 * Fetches ventilator scenarios from the database and manages drill state.
 * Practice adjusting ventilator settings based on clinical scenarios and ABG results.
 */

import { useState, useCallback, useRef } from 'react';
import { recordDrillSession } from '@/services/drillStatsService';

export type VentMode = 'AC' | 'SIMV' | 'PRVC' | 'PS' | 'CPAP';
export type VentilatorDrillStatus = 'landing' | 'loading' | 'playing' | 'feedback' | 'error';

export interface VentSettings {
  mode: VentMode;
  tidalVolume?: number; // mL
  respiratoryRate?: number; // breaths/min
  peep: number; // cmH2O
  fio2: number; // percentage
  pressureSupport?: number; // cmH2O
  inspiratoryPressure?: number; // cmH2O
}

export interface ABGResult {
  pH: number;
  paCO2: number; // mmHg
  paO2: number; // mmHg
  hco3: number; // mEq/L
  sao2: number; // percentage
}

export interface VentCase {
  id: string;
  vignette: string;
  currentSettings: VentSettings;
  abg: ABGResult;
  prompt: string;
  options: string[];
  correctAnswer: string;
  correctAction?: string; // For displaying correct action label
  explanation: string;
  tags: string[];
  patientInfo?: string;
  indication?: string;
  physicalExam?: string;
}

export interface UseVentilatorDrillReturn {
  currentCase: VentCase | null;
  score: number;
  totalAttempts: number;
  streak: number;
  userAction: string | null;
  isCorrect: boolean | null;
  status: VentilatorDrillStatus;
  error: string | null;
  submitAction: (action: string) => void;
  nextCase: () => void;
  reset: () => void;
  startSession: () => void;
  exitToMenu: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useVentilatorDrill(): UseVentilatorDrillReturn {
  const [cases, setCases] = useState<VentCase[]>([]);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userAction, setUserAction] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<VentilatorDrillStatus>('landing');
  const [error, setError] = useState<string | null>(null);

  // Track session for statistics
  const sessionStartRef = useRef<number>(Date.now());
  const sessionDataRef = useRef({
    questionsAttempted: 0,
    correctAnswers: 0,
    bestStreak: 0,
  });

  const currentCase = cases[currentCaseIndex] || null;

  // Fetch questions from API
  const fetchQuestions = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/questions?category=ventilator&limit=20');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No ventilator questions available. Please run seed script.');
      }

      // Transform database questions into VentCase format
      const transformedCases: VentCase[] = data.questions.map((q: any) => {
        const questionData = typeof q.question === 'string' ? JSON.parse(q.question) : q.question;
        const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        const tags = typeof q.tags === 'string' ? JSON.parse(q.tags) : (q.tags || []);

        return {
          id: q.id,
          vignette: q.vignette,
          currentSettings: questionData.currentSettings,
          abg: questionData.abg,
          prompt: questionData.prompt,
          options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          tags,
        };
      });

      // Shuffle questions
      const shuffled = transformedCases.sort(() => Math.random() - 0.5);
      setCases(shuffled);
      setCurrentCaseIndex(0);
      setStatus('playing');
    } catch (err) {
      console.error('Error fetching ventilator questions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load questions');
      setStatus('error');
    }
  }, []);

  const submitAction = useCallback(
    (action: string) => {
      if (!currentCase || status !== 'playing') return;

      setUserAction(action);
      const correct = action === currentCase.correctAnswer;
      setIsCorrect(correct);

      setTotalAttempts((prev) => prev + 1);
      sessionDataRef.current.questionsAttempted += 1;

      if (correct) {
        setScore((prev) => prev + 1);
        setStreak((prev) => {
          const newStreak = prev + 1;
          sessionDataRef.current.bestStreak = Math.max(
            sessionDataRef.current.bestStreak,
            newStreak
          );
          return newStreak;
        });
        sessionDataRef.current.correctAnswers += 1;
      } else {
        setStreak(0);
      }

      setStatus('feedback');
    },
    [currentCase, status]
  );

  const nextCase = useCallback(() => {
    if (currentCaseIndex < cases.length - 1) {
      setCurrentCaseIndex((prev) => prev + 1);
      setUserAction(null);
      setIsCorrect(null);
      setStatus('playing');
    } else {
      // End of questions - fetch more or reset
      fetchQuestions();
    }
  }, [currentCaseIndex, cases.length, fetchQuestions]);

  const reset = useCallback(() => {
    // Record session before reset
    if (sessionDataRef.current.questionsAttempted > 0) {
      const endTime = Date.now();
      recordDrillSession({
        drillType: 'ventilator_hero',
        startTime: new Date(sessionStartRef.current).toISOString(),
        endTime: new Date(endTime).toISOString(),
        questionsAttempted: sessionDataRef.current.questionsAttempted,
        correctAnswers: sessionDataRef.current.correctAnswers,
        accuracy:
          (sessionDataRef.current.correctAnswers / sessionDataRef.current.questionsAttempted) *
          100,
        timeSpent: Math.round((endTime - sessionStartRef.current) / 1000),
        bestStreak: sessionDataRef.current.bestStreak,
      });
    }

    setCases([]);
    setCurrentCaseIndex(0);
    setScore(0);
    setTotalAttempts(0);
    setStreak(0);
    setUserAction(null);
    setIsCorrect(null);
    setStatus('landing');
    setError(null);

    // Reset session tracking
    sessionStartRef.current = Date.now();
    sessionDataRef.current = {
      questionsAttempted: 0,
      correctAnswers: 0,
      bestStreak: 0,
    };
  }, []);

  const startSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    sessionDataRef.current = {
      questionsAttempted: 0,
      correctAnswers: 0,
      bestStreak: 0,
    };
    fetchQuestions();
  }, [fetchQuestions]);

  const exitToMenu = useCallback(() => {
    // Record session if any questions were attempted
    if (sessionDataRef.current.questionsAttempted > 0) {
      const endTime = Date.now();
      recordDrillSession({
        drillType: 'ventilator_hero',
        startTime: new Date(sessionStartRef.current).toISOString(),
        endTime: new Date(endTime).toISOString(),
        questionsAttempted: sessionDataRef.current.questionsAttempted,
        correctAnswers: sessionDataRef.current.correctAnswers,
        accuracy:
          (sessionDataRef.current.correctAnswers / sessionDataRef.current.questionsAttempted) *
          100,
        timeSpent: Math.round((endTime - sessionStartRef.current) / 1000),
        bestStreak: sessionDataRef.current.bestStreak,
      });
    }

    setStatus('landing');
  }, []);

  return {
    currentCase,
    score,
    totalAttempts,
    streak,
    userAction,
    isCorrect,
    status,
    error,
    submitAction,
    nextCase,
    reset,
    startSession,
    exitToMenu,
  };
}
