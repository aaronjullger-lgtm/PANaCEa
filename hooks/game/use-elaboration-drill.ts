/**
 * useElaborationDrill — Elaborative Interrogation Drill hook
 *
 * Presents a clinical fact and asks the student to explain WHY it's true.
 * Free-text explanation is graded by Gemini on a 0-3 rubric.
 * Score maps to FSRS: 0-1 → Again, 2-3 → Good.
 *
 * Research: Pressley et al. (1987), Dunlosky et al. (2013)
 *
 * @see functions/api/drills/elaboration/generate.ts
 * @see functions/api/drills/elaboration/grade.ts
 */

import { useState, useCallback, useRef } from 'react';
import { useDrillFSRS } from '@/hooks/useDrillFSRS';
import { useAuth } from '@clerk/clerk-react';
import { logger } from '@/lib/logger';
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

const LOG_SCOPE = 'ElaborationDrill';

export interface ElaborationFact {
  id: string;
  fact: string;
  system: string;
  gradingRubric: string[];
  _mechanism: string;
}

export interface GradeResult {
  score: number;
  maxScore: number;
  feedback: string;
  missingConcepts: string[];
  modelExplanation: string;
}

export type ElaborationStatus = 'landing' | 'fact_presented' | 'typing' | 'grading' | 'feedback' | 'summary';

export interface UseElaborationDrillReturn {
  currentFact: ElaborationFact | null;
  status: ElaborationStatus;
  explanation: string;
  gradeResult: GradeResult | null;
  score: number;
  totalAttempts: number;
  isLoading: boolean;
  hintUsed: boolean;
  setExplanation: (text: string) => void;
  submitExplanation: () => void;
  useHint: () => void;
  nextFact: () => void;
  startSession: () => void;
  reset: () => void;
  fsrsNextReview: import('@/hooks/useDrillFSRS').FSRSNextReview | null;
}

export function useElaborationDrill(): UseElaborationDrillReturn {
  const { getToken } = useAuth();
  const [currentFact, setCurrentFact] = useState<ElaborationFact | null>(null);
  const [status, setStatus] = useState<ElaborationStatus>('landing');
  const [explanation, setExplanation] = useState('');
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  const questionStartTimeRef = useRef<number>(Date.now());

  const {
    startQuestion: startQuestionFSRS,
    submitAnswer: submitAnswerFSRS,
    fsrsNextReview,
  } = useDrillFSRS({ drillType: 'elaboration' });

  const fetchFact = useCallback(async (): Promise<ElaborationFact | null> => {
    try {
      const token = await getToken();
      const res = await fetch('/api/drills/elaboration/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) return null;
      const fact = unwrapApiEnvelope<ElaborationFact | { fact: null }>(await res.json());
      return fact && 'fact' in fact && fact.fact ? fact : null;
    } catch (err) {
      logger.error(`[${LOG_SCOPE}] Failed to fetch fact`, { error: err });
      return null;
    }
  }, [getToken]);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    const fact = await fetchFact();
    if (fact) {
      setCurrentFact(fact);
      setStatus('fact_presented');
      setExplanation('');
      setGradeResult(null);
      setHintUsed(false);
      setScore(0);
      setTotalAttempts(0);
      startQuestionFSRS(fact.id);
      questionStartTimeRef.current = Date.now();
    }
    setIsLoading(false);
  }, [fetchFact, startQuestionFSRS]);

  const submitExplanation = useCallback(async () => {
    if (!currentFact || explanation.trim().length < 10) return;

    setStatus('grading');
    setIsLoading(true);

    try {
      const token = await getToken();
      const res = await fetch('/api/drills/elaboration/grade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fact: currentFact.fact,
          studentExplanation: explanation,
          gradingRubric: currentFact.gradingRubric,
        }),
      });

      if (!res.ok) throw new Error('Grading failed');
      const result = unwrapApiEnvelope<GradeResult>(await res.json());

      setGradeResult(result);
      setTotalAttempts((prev) => prev + 1);
      if (result.score >= 2) setScore((prev) => prev + 1);
      setStatus('feedback');

      // Map score to FSRS: 0-1 → incorrect (Again), 2-3 → correct (Good)
      const isCorrect = result.score >= 2;
      submitAnswerFSRS({
        questionId: currentFact.id,
        selectedAnswer: explanation.slice(0, 200),
        correctAnswer: currentFact._mechanism?.slice(0, 200) ?? '',
        isCorrect,
        timeSpentMs: Date.now() - questionStartTimeRef.current,
        hintViewed: hintUsed,
      }).catch((err) => {
        // useDrillFSRS already surfaces a toast + offline-queues the review; this
        // .catch prevents an unhandled promise rejection bubbling up.
        if (import.meta.env.DEV) {
          console.warn('[use-elaboration-drill] submitAnswerFSRS error (already handled):', err);
        }
      });
    } catch (err) {
      logger.error(`[${LOG_SCOPE}] Grading failed`, { error: err });
      setStatus('fact_presented');
    } finally {
      setIsLoading(false);
    }
  }, [currentFact, explanation, hintUsed, getToken, submitAnswerFSRS]);

  const useHint = useCallback(() => {
    if (!currentFact) return;
    setHintUsed(true);
  }, [currentFact]);

  const nextFact = useCallback(async () => {
    setIsLoading(true);
    const fact = await fetchFact();
    if (fact) {
      setCurrentFact(fact);
      setStatus('fact_presented');
      setExplanation('');
      setGradeResult(null);
      setHintUsed(false);
      startQuestionFSRS(fact.id);
      questionStartTimeRef.current = Date.now();
    }
    setIsLoading(false);
  }, [fetchFact, startQuestionFSRS]);

  const reset = useCallback(() => {
    setCurrentFact(null);
    setStatus('landing');
    setExplanation('');
    setGradeResult(null);
    setScore(0);
    setTotalAttempts(0);
    setHintUsed(false);
  }, []);

  return {
    currentFact,
    status,
    explanation,
    gradeResult,
    score,
    totalAttempts,
    isLoading,
    hintUsed,
    setExplanation,
    submitExplanation,
    useHint,
    nextFact,
    startSession,
    reset,
    fsrsNextReview,
  };
}
