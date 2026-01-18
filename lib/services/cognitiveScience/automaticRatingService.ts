/**
 * Automatic Rating Service
 *
 * Integrates behavioral signal collection with FSRS rating inference.
 * This service acts as the bridge between user interactions and the
 * spaced repetition algorithm - NO user input required for ratings.
 *
 * ## Key Features
 * - Real-time behavioral signal collection during quiz sessions
 * - Automatic FSRS rating inference based on collected signals
 * - Profile-based personalization using historical data
 * - Analytics export for debugging and optimization
 *
 * @module lib/services/cognitiveScience/automaticRatingService
 */

import {
  inferRating,
  buildPerformanceProfile,
  type BehavioralSignals,
  type InferredRating,
  type PerformanceProfile,
} from './implicitConfidenceInference';
import { Rating, FSRSState, FSRS, FSRSCard, FSRSReviewLog } from '../../fsrs';

// Types for interaction tracking
export interface InteractionEvent {
  type: 'click' | 'hover' | 'focus' | 'keypress' | 'scroll';
  timestamp: number;
  target?: string;
  data?: Record<string, unknown>;
}

export interface QuestionSession {
  questionId: string;
  conditionId?: string;
  startTime: number;
  endTime?: number;
  interactions: InteractionEvent[];
  selectedAnswers: { answer: string; timestamp: number }[];
  finalAnswer?: string;
  isCorrect?: boolean;
  questionNumber: number;
}

export interface SessionState {
  sessionId: string;
  userId: string;
  startTime: number;
  questions: QuestionSession[];
  profile?: PerformanceProfile;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  totalCorrect: number;
  totalAnswered: number;
}

// Store for active sessions
const activeSessions = new Map<string, SessionState>();

/**
 * Initialize a new study session
 */
export function initializeSession(
  sessionId: string,
  userId: string,
  historicalData?: {
    responseTimeMs: number;
    isCorrect: boolean;
    timestamp: Date;
    questionNumber: number;
  }[]
): SessionState {
  const profile = historicalData ? buildPerformanceProfile(historicalData) : undefined;

  const state: SessionState = {
    sessionId,
    userId,
    startTime: Date.now(),
    questions: [],
    profile,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    totalCorrect: 0,
    totalAnswered: 0,
  };

  activeSessions.set(sessionId, state);
  return state;
}

/**
 * Start tracking a new question in the session
 */
export function startQuestion(
  sessionId: string,
  questionId: string,
  conditionId?: string
): QuestionSession {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const questionSession: QuestionSession = {
    questionId,
    conditionId,
    startTime: Date.now(),
    interactions: [],
    selectedAnswers: [],
    questionNumber: session.questions.length + 1,
  };

  session.questions.push(questionSession);
  return questionSession;
}

/**
 * Record an interaction event
 */
export function recordInteraction(
  sessionId: string,
  event: Omit<InteractionEvent, 'timestamp'>
): void {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const currentQuestion = session.questions[session.questions.length - 1];
  if (!currentQuestion) return;

  currentQuestion.interactions.push({
    ...event,
    timestamp: Date.now(),
  });
}

/**
 * Record an answer selection (may be changed later)
 */
export function recordAnswerSelection(sessionId: string, answer: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const currentQuestion = session.questions[session.questions.length - 1];
  if (!currentQuestion) return;

  currentQuestion.selectedAnswers.push({
    answer,
    timestamp: Date.now(),
  });
}

/**
 * Complete a question and get automatic FSRS rating
 */
export function completeQuestion(
  sessionId: string,
  finalAnswer: string,
  isCorrect: boolean,
  historicalContext?: {
    previousAttempts: number;
    previousCorrectRate: number;
    averageResponseTimeForItem: number;
    daysSinceLastReview: number;
    currentStability: number;
    currentDifficulty: number;
  }
): {
  rating: InferredRating;
  signals: BehavioralSignals;
  sessionStats: {
    accuracy: number;
    streak: number;
    questionNumber: number;
  };
} {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const currentQuestion = session.questions[session.questions.length - 1];
  if (!currentQuestion) {
    throw new Error('No active question in session');
  }

  currentQuestion.endTime = Date.now();
  currentQuestion.finalAnswer = finalAnswer;
  currentQuestion.isCorrect = isCorrect;

  // Update session stats
  session.totalAnswered++;
  if (isCorrect) {
    session.totalCorrect++;
    session.consecutiveCorrect++;
    session.consecutiveIncorrect = 0;
  } else {
    session.consecutiveIncorrect++;
    session.consecutiveCorrect = 0;
  }

  // Extract behavioral signals from the question session
  const signals = extractBehavioralSignals(currentQuestion, session, historicalContext);

  // Infer rating automatically
  const rating = inferRating(signals, session.profile);

  return {
    rating,
    signals,
    sessionStats: {
      accuracy: session.totalCorrect / session.totalAnswered,
      streak: isCorrect ? session.consecutiveCorrect : -session.consecutiveIncorrect,
      questionNumber: currentQuestion.questionNumber,
    },
  };
}

/**
 * Extract behavioral signals from question interactions
 */
function extractBehavioralSignals(
  question: QuestionSession,
  session: SessionState,
  historicalContext?: {
    previousAttempts: number;
    previousCorrectRate: number;
    averageResponseTimeForItem: number;
    daysSinceLastReview: number;
    currentStability: number;
    currentDifficulty: number;
  }
): BehavioralSignals {
  const endTime = question.endTime || Date.now();
  const responseTimeMs = endTime - question.startTime;

  // Calculate time to first interaction
  const firstInteraction = question.interactions[0];
  const timeToFirstInteraction = firstInteraction
    ? firstInteraction.timestamp - question.startTime
    : responseTimeMs * 0.3; // Estimate if no interactions recorded

  // Calculate time between clicks
  const clickEvents = question.interactions.filter((e) => e.type === 'click');
  const timeBetweenClicks: number[] = [];
  for (let i = 1; i < clickEvents.length; i++) {
    timeBetweenClicks.push(clickEvents[i].timestamp - clickEvents[i - 1].timestamp);
  }

  // Analyze answer changes
  const answerCount = question.selectedAnswers.length;
  const answerChanged = answerCount > 1;
  const numberOfAnswerChanges = Math.max(0, answerCount - 1);

  // Check if final answer was first choice
  const firstAnswer = question.selectedAnswers[0]?.answer;
  const finalAnswerWasFirstChoice = firstAnswer === question.finalAnswer;

  return {
    responseTimeMs,
    timeToFirstInteraction,
    timeBetweenClicks,
    totalSessionTimeMs: endTime - session.startTime,
    isCorrect: question.isCorrect ?? false,
    answerChanged,
    numberOfAnswerChanges,
    finalAnswerWasFirstChoice,
    questionNumber: question.questionNumber,
    consecutiveCorrect: session.consecutiveCorrect,
    consecutiveIncorrect: session.consecutiveIncorrect,
    sessionAccuracySoFar:
      session.totalAnswered > 0 ? session.totalCorrect / session.totalAnswered : 0,
    previousAttempts: historicalContext?.previousAttempts ?? 0,
    previousCorrectRate: historicalContext?.previousCorrectRate ?? 0,
    averageResponseTimeForItem: historicalContext?.averageResponseTimeForItem ?? 30000,
    daysSinceLastReview: historicalContext?.daysSinceLastReview ?? 0,
    currentStability: historicalContext?.currentStability ?? 1,
    currentDifficulty: historicalContext?.currentDifficulty ?? 5,
  };
}

/**
 * Apply FSRS update with automatically inferred rating
 */
export function applyAutoFSRS(
  card: FSRSCard,
  inferredRating: InferredRating
): {
  updatedCard: FSRSCard;
  dueDate: Date;
  adjustedParameters: {
    stabilityMultiplier: number;
    difficultyAdjustment: number;
  };
} {
  const fsrs = new FSRS();

  // Apply the inferred rating
  const result = fsrs.next(card, new Date(), inferredRating.rating);

  // Apply additional adjustments based on behavioral analysis
  const updatedCard = { ...result.card };

  // Adjust stability based on confidence signals
  updatedCard.stability *= inferredRating.recommendedStabilityMultiplier;

  // Adjust difficulty based on performance patterns
  updatedCard.difficulty = Math.max(
    1,
    Math.min(10, updatedCard.difficulty + inferredRating.recommendedDifficultyAdjustment)
  );

  return {
    updatedCard,
    dueDate: result.due,
    adjustedParameters: {
      stabilityMultiplier: inferredRating.recommendedStabilityMultiplier,
      difficultyAdjustment: inferredRating.recommendedDifficultyAdjustment,
    },
  };
}

/**
 * End a session and get analytics
 */
export function endSession(sessionId: string): {
  summary: {
    totalQuestions: number;
    correctCount: number;
    accuracy: number;
    averageResponseTime: number;
    ratingDistribution: Record<Rating, number>;
    longestStreak: number;
  };
  detailedResults: {
    questionId: string;
    isCorrect: boolean;
    rating: Rating;
    responseTimeMs: number;
    signalConfidence: number;
  }[];
} | null {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  // Calculate summary stats
  const responseTimes = session.questions
    .filter((q) => q.endTime)
    .map((q) => q.endTime! - q.startTime);
  const averageResponseTime =
    responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

  // Calculate longest streak
  let longestStreak = 0;
  let currentStreak = 0;
  for (const q of session.questions) {
    if (q.isCorrect) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Get rating distribution (would need to re-infer or store)
  const ratingDistribution: Record<Rating, number> = {
    [Rating.Again]: 0,
    [Rating.Hard]: 0,
    [Rating.Good]: 0,
    [Rating.Easy]: 0,
  };

  // Clean up
  activeSessions.delete(sessionId);

  return {
    summary: {
      totalQuestions: session.questions.length,
      correctCount: session.totalCorrect,
      accuracy: session.totalAnswered > 0 ? session.totalCorrect / session.totalAnswered : 0,
      averageResponseTime,
      ratingDistribution,
      longestStreak,
    },
    detailedResults: session.questions.map((q) => ({
      questionId: q.questionId,
      isCorrect: q.isCorrect ?? false,
      rating: Rating.Good, // Would need to store inferred ratings
      responseTimeMs: q.endTime ? q.endTime - q.startTime : 0,
      signalConfidence: 0.8, // Would need to store confidence
    })),
  };
}

/**
 * Get current session state
 */
export function getSessionState(sessionId: string): SessionState | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Utility: Create a React hook compatible event handler
 */
export function createInteractionTracker(sessionId: string) {
  return {
    onClick: (target: string) => recordInteraction(sessionId, { type: 'click', target }),
    onHover: (target: string) => recordInteraction(sessionId, { type: 'hover', target }),
    onFocus: (target: string) => recordInteraction(sessionId, { type: 'focus', target }),
    onKeyPress: (key: string) => recordInteraction(sessionId, { type: 'keypress', data: { key } }),
    onAnswerSelect: (answer: string) => recordAnswerSelection(sessionId, answer),
  };
}

export default {
  initializeSession,
  startQuestion,
  recordInteraction,
  recordAnswerSelection,
  completeQuestion,
  applyAutoFSRS,
  endSession,
  getSessionState,
  createInteractionTracker,
};
