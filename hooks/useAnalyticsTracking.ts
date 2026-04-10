import { useCallback } from 'react';
import { logger } from '@/lib/logger';
import {
  recordBehavioralConfidence,
  recordMomentumResult,
  recordAnswerPattern,
  updatePerformancePrediction,
  recordPauseResult,
  recordCircadianPerformance,
} from '@/services/analytics';
import { recordQuestion } from '@/services/domain';
import type { BehaviorSignals } from '@/services/analytics';

const LOG_SCOPE = 'useAnalyticsTracking';

interface QuestionMeta {
  id?: string;
  system?: string | null;
  subcategory?: string | null;
  conditionId?: string;
  condition?: string;
  topic?: string;
  difficulty?: string;
  correctAnswerIndex: number;
  options?: string[];
  question?: string;
}

interface AnalyticsPayload {
  isCorrect: boolean;
  timeToAnswer: number;
  parTime: number;
  behaviorSignals: BehaviorSignals;
  questionNumber: number;
  questionId: string;
  selectedAnswerIndex: number;
  eliminatedCount: number;
  answerChangeCount: number;
  firstAnswer: number | null;
  question: QuestionMeta;
}

export function useAnalyticsTracking() {
  const trackAnswer = useCallback((payload: AnalyticsPayload) => {
    const {
      isCorrect,
      timeToAnswer,
      parTime,
      behaviorSignals,
      questionNumber,
      questionId,
      selectedAnswerIndex,
      eliminatedCount,
      answerChangeCount,
      firstAnswer,
      question,
    } = payload;

    // Record behavioral confidence
    try {
      if (typeof recordBehavioralConfidence === 'function') {
        recordBehavioralConfidence(behaviorSignals, isCorrect);
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'recordBehavioralConfidence failed', e);
    }

    // Record momentum data
    try {
      if (typeof recordMomentumResult === 'function') {
        recordMomentumResult(isCorrect, timeToAnswer, parTime);
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'recordMomentumResult failed', e);
    }

    // Record answer pattern for post-session analysis
    try {
      if (typeof recordAnswerPattern === 'function') {
        recordAnswerPattern({
          questionId,
          firstAnswer: firstAnswer ?? selectedAnswerIndex,
          finalAnswer: selectedAnswerIndex,
          correctAnswer: question.correctAnswerIndex,
          timeSpentMs: timeToAnswer,
          parTimeMs: parTime,
          eliminatedCount,
          answerChangeCount,
          wasCorrect: isCorrect,
        });
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'recordAnswerPattern failed', e);
    }

    // Update performance prediction
    try {
      if (typeof updatePerformancePrediction === 'function') {
        updatePerformancePrediction({
          correct: isCorrect,
          timeSpentMs: timeToAnswer,
          parTimeMs: parTime,
          system: question.system,
          questionNumber,
          inferredConfidence: 0.5, // Will be overridden by caller with actual inference
        });
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'updatePerformancePrediction failed', e);
    }

    // Record for smart pause detection
    try {
      if (typeof recordPauseResult === 'function') {
        recordPauseResult({
          correct: isCorrect,
          timeSpentMs: timeToAnswer,
          parTimeMs: parTime,
        });
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'recordPauseResult failed', e);
    }

    // Record comprehensive question result
    try {
      if (typeof (globalThis as any).recordQuestionResult === 'function') {
        (globalThis as any).recordQuestionResult({
          questionId,
          responseTimeMs: timeToAnswer,
          wasCorrect: isCorrect,
          difficulty: (question.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
          answerChanges: answerChangeCount,
          eliminationsUsed: eliminatedCount,
          system: question.system || 'Unknown',
        });
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'recordQuestionResult failed', e);
    }

    // Record question for PANCE distribution tracking
    if (question.system) {
      recordQuestion(question.system, undefined);
    }

    // Record circadian performance
    recordCircadianPerformance({
      timestamp: Date.now(),
      isCorrect,
      topic: question.topic,
    });
  }, []);

  return { trackAnswer };
}
