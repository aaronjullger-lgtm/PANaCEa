/**
 * useTeachBackDrill — Teach-Back Mode drill hook
 *
 * Presents a well-learned topic and asks the student to explain it as if
 * teaching a classmate. Free-text explanation is graded by Gemini on a
 * 4-category rubric (Definition, Presentation, Diagnosis, Treatment).
 *
 * This leverages the generation effect: producing explanations strengthens
 * retention far more than passive review. Targeted at mastered topics
 * (stability > 30 days) to consolidate and deepen understanding.
 *
 * Research:
 * - Fiorella & Mayer (2016): Learning by explaining
 * - Chi et al. (1994): Self-explanation effect
 * - Roscoe & Chi (2007): Tutor learning
 *
 * @see functions/api/drills/teachback/generate.ts
 * @see functions/api/drills/teachback/grade.ts
 */

import { useState, useCallback, useRef } from 'react';
import { useDrillFSRS, type FSRSNextReview } from '@/hooks/useDrillFSRS';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { logger } from '@/lib/logger';

const LOG_SCOPE = 'TeachBackDrill';

export interface TeachBackTopic {
  id: string;
  topic: string;
  system: string;
  prompt: string;
  expectedConcepts: string[];
  difficulty: 'foundational' | 'intermediate' | 'advanced';
}

export interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface TeachBackGradeResult {
  categories: CategoryScore[];
  totalScore: number;
  maxScore: number;
  overallFeedback: string;
  missingConcepts: string[];
  strengths: string[];
  modelExplanation: string;
  fsrsRating: number;
  passed: boolean;
}

export type TeachBackStatus =
  | 'landing'
  | 'topic_presented'
  | 'typing'
  | 'grading'
  | 'feedback'
  | 'summary';

export interface TeachBackSessionStats {
  topicsAttempted: number;
  topicsPassed: number;
  totalScore: number;
  maxPossibleScore: number;
  averageCategoryScores: Record<string, number>;
}

export interface UseTeachBackDrillReturn {
  currentTopic: TeachBackTopic | null;
  status: TeachBackStatus;
  explanation: string;
  gradeResult: TeachBackGradeResult | null;
  sessionStats: TeachBackSessionStats;
  isLoading: boolean;
  error: string | null;
  hintUsed: boolean;
  setExplanation: (text: string) => void;
  submitExplanation: () => Promise<void>;
  useHint: () => void;
  nextTopic: () => Promise<void>;
  startSession: () => Promise<void>;
  reset: () => void;
  fsrsNextReview: FSRSNextReview | null;
}

export function useTeachBackDrill(): UseTeachBackDrillReturn {
  const { getToken } = useAuth();
  const drillFSRS = useDrillFSRS({ drillType: 'teachback' });

  const [currentTopic, setCurrentTopic] = useState<TeachBackTopic | null>(null);
  const [status, setStatus] = useState<TeachBackStatus>('landing');
  const [explanation, setExplanation] = useState('');
  const [gradeResult, setGradeResult] = useState<TeachBackGradeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(false);

  const questionStartRef = useRef<number>(Date.now());
  const categoryAccumulator = useRef<Record<string, number[]>>({});

  const [sessionStats, setSessionStats] = useState<TeachBackSessionStats>({
    topicsAttempted: 0,
    topicsPassed: 0,
    totalScore: 0,
    maxPossibleScore: 0,
    averageCategoryScores: {},
  });

  const fetchTopic = useCallback(async (): Promise<TeachBackTopic | null> => {
    const token = await getToken();
    const endpoint = getApiEndpoint('/api/drills/teachback/generate');
    const res = await fetch(endpoint, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch topic: ${res.status}`);
    const json = await res.json() as { data: { topic: TeachBackTopic } };
    return json.data.topic;
  }, [getToken]);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const topic = await fetchTopic();
      if (topic) {
        setCurrentTopic(topic);
        setStatus('topic_presented');
        setExplanation('');
        setGradeResult(null);
        setHintUsed(false);
        questionStartRef.current = Date.now();
        drillFSRS.startQuestion();
      }
    } catch (err) {
      logger.error(LOG_SCOPE, 'Failed to start session', err);
      setError(err instanceof Error ? err.message : 'Failed to load topic');
    } finally {
      setIsLoading(false);
    }
  }, [fetchTopic, drillFSRS]);

  const submitExplanation = useCallback(async () => {
    if (!currentTopic || explanation.trim().length < 20) return;

    setStatus('grading');
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const endpoint = getApiEndpoint('/api/drills/teachback/grade');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topicId: currentTopic.id,
          topic: currentTopic.topic,
          system: currentTopic.system,
          explanation: explanation.trim(),
          expectedConcepts: currentTopic.expectedConcepts,
          prompt: currentTopic.prompt,
        }),
      });

      if (!res.ok) throw new Error(`Grading failed: ${res.status}`);
      const json = await res.json() as { data: TeachBackGradeResult };
      const result = json.data;
      setGradeResult(result);

      // Submit to FSRS pipeline
      const timeSpentMs = Date.now() - questionStartRef.current;
      await drillFSRS.submitAnswer({
        questionId: currentTopic.id,
        selectedAnswer: result.passed ? 'pass' : 'fail',
        timeSpentMs,
      });

      // Update session stats
      setSessionStats((prev) => {
        const newStats = {
          topicsAttempted: prev.topicsAttempted + 1,
          topicsPassed: prev.topicsPassed + (result.passed ? 1 : 0),
          totalScore: prev.totalScore + result.totalScore,
          maxPossibleScore: prev.maxPossibleScore + result.maxScore,
          averageCategoryScores: { ...prev.averageCategoryScores },
        };

        // Accumulate category scores for averaging
        for (const cat of result.categories) {
          if (!categoryAccumulator.current[cat.category]) {
            categoryAccumulator.current[cat.category] = [];
          }
          categoryAccumulator.current[cat.category].push(cat.score);
          const scores = categoryAccumulator.current[cat.category];
          newStats.averageCategoryScores[cat.category] =
            scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        return newStats;
      });

      setStatus('feedback');
    } catch (err) {
      logger.error(LOG_SCOPE, 'Failed to grade explanation', err);
      setError(err instanceof Error ? err.message : 'Grading failed');
      setStatus('topic_presented');
    } finally {
      setIsLoading(false);
    }
  }, [currentTopic, explanation, getToken, drillFSRS]);

  const useHint = useCallback(() => {
    if (!currentTopic || hintUsed) return;
    setHintUsed(true);
    // Hint: reveal first 2 expected concepts
  }, [currentTopic, hintUsed]);

  const nextTopic = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const topic = await fetchTopic();
      if (topic) {
        setCurrentTopic(topic);
        setStatus('topic_presented');
        setExplanation('');
        setGradeResult(null);
        setHintUsed(false);
        questionStartRef.current = Date.now();
        drillFSRS.reset();
        drillFSRS.startQuestion();
      }
    } catch (err) {
      logger.error(LOG_SCOPE, 'Failed to fetch next topic', err);
      setError(err instanceof Error ? err.message : 'Failed to load topic');
    } finally {
      setIsLoading(false);
    }
  }, [fetchTopic, drillFSRS]);

  const reset = useCallback(() => {
    setCurrentTopic(null);
    setStatus('landing');
    setExplanation('');
    setGradeResult(null);
    setIsLoading(false);
    setError(null);
    setHintUsed(false);
    setSessionStats({
      topicsAttempted: 0,
      topicsPassed: 0,
      totalScore: 0,
      maxPossibleScore: 0,
      averageCategoryScores: {},
    });
    categoryAccumulator.current = {};
    drillFSRS.reset();
  }, [drillFSRS]);

  return {
    currentTopic,
    status,
    explanation,
    gradeResult,
    sessionStats,
    isLoading,
    error,
    hintUsed,
    setExplanation,
    submitExplanation,
    useHint,
    nextTopic,
    startSession,
    reset,
    fsrsNextReview: drillFSRS.fsrsNextReview,
  };
}
