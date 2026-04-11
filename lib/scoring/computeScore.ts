/**
 * Pure scoring utilities extracted from QuizView's handleSubmitAnswer.
 *
 * These are stateless functions that compute scores, FSRS ratings, and telemetry
 * without touching React state. They're tested independently and called from
 * the submit handler in QuizView.
 */

import type { Question } from '@/types';
import { deriveFsrsRatingFromBehavior } from '@/lib/utils/fsrsImplicitRating';
import { calculateParTime } from '@/lib/utils/questionComplexity';
import { behavioralPayloadToTelemetryData, enrichTelemetryWithSessionPosition } from '@/components/quiz/Tracker';

interface MicroMetrics {
  oscillations: number;
  vignetteRegressions: number;
  selectionDriftMs: number;
  tremorScore: number;
  cursorEntropy: number;
  inputMethod: string;
}

export interface ScoreResult {
  isCorrect: boolean;
  timeToAnswer: number;
  questionId: string;
  parTime: number;
  fsrsRating: number;
  telemetryWithPosition: ReturnType<typeof enrichTelemetryWithSessionPosition>;
}

export function computeScore(params: {
  selectedAnswerIndex: number;
  questionStartTime: number;
  question: Question;
  questionNumber: number;
  behavioralPayload: any;
  microMetrics: MicroMetrics;
  eliminationTimestamps: number[];
}): ScoreResult {
  const {
    selectedAnswerIndex,
    questionStartTime,
    question,
    questionNumber,
    behavioralPayload,
    microMetrics,
    eliminationTimestamps,
  } = params;

  const isCorrect = selectedAnswerIndex === question.correctAnswerIndex;
  const timeToAnswer = Date.now() - questionStartTime;
  const questionId = question.id || `temp-${questionNumber}`;
  const parTime = calculateParTime(question);

  // Elimination velocity
  const eliminationVelocity =
    eliminationTimestamps.length >= 2
      ? eliminationTimestamps.length /
        ((eliminationTimestamps[eliminationTimestamps.length - 1]! - eliminationTimestamps[0]!) / 1000)
      : undefined;

  // Build telemetry
  const telemetryForApi = behavioralPayload
    ? behavioralPayloadToTelemetryData(
        behavioralPayload,
        behavioralPayload.answer_change_count,
        false,
        {
          oscillations: microMetrics.oscillations,
          vignetteRegressions: microMetrics.vignetteRegressions,
          selectionDriftMs: microMetrics.selectionDriftMs,
          tremorScore: microMetrics.tremorScore,
          cursorEntropy: microMetrics.cursorEntropy,
          inputMethod: microMetrics.inputMethod,
        },
        eliminationVelocity
      )
    : undefined;

  const telemetryWithPosition = telemetryForApi
    ? enrichTelemetryWithSessionPosition(telemetryForApi, questionNumber)
    : undefined;

  // FSRS rating
  const fsrsRating = behavioralPayload
    ? deriveFsrsRatingFromBehavior({
        isCorrect,
        timeToFirstClickMs: behavioralPayload.time_to_first_interaction_ms,
        totalDwellTimeMs: behavioralPayload.duration_ms,
        parTimeMs: parTime,
        answerSwitches: behavioralPayload.answer_change_count,
        cursorEntropy: microMetrics.cursorEntropy,
        hoverOscillations: microMetrics.oscillations,
        vignetteRegressions: microMetrics.vignetteRegressions,
        selectionDriftMs: microMetrics.selectionDriftMs,
        tremorScore: microMetrics.tremorScore,
      })
    : deriveFsrsRatingFromBehavior({
        isCorrect,
        timeToFirstClickMs: null,
        totalDwellTimeMs: timeToAnswer,
        parTimeMs: parTime,
        answerSwitches: 0,
      });

  return { isCorrect, timeToAnswer, questionId, parTime, fsrsRating, telemetryWithPosition };
}
