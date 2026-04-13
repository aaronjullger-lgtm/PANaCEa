/**
 * Custom Study Session Service
 *
 * Manages ephemeral Quizlet-style study sessions with:
 * - Multi-select content filtering
 * - Retry queue for missed questions
 * - No FSRS tracking (session state is local only)
 */

import type { Question } from '@/types';
import type {
  CustomSessionConfig,
  CustomSessionState,
  CustomSessionSummary,
  AnsweredQuestion,
  SystemBreakdown,
  FocusAreaBreakdown,
  AvailableContent,
  GenerateCustomSessionRequest,
  GenerateCustomSessionResponse,
  FocusArea,
} from '@/types/custom-session';
import { CUSTOM_SESSION_STORAGE_KEY, DEFAULT_CUSTOM_SESSION_CONFIG } from '@/types/custom-session';
import { ABBREVIATION_TO_TOPIC_MAP } from "@/config/topic-map";
import type { SystemCode } from '@/types';

// ============================================================================
// SESSION STATE MANAGEMENT (localStorage - ephemeral)
// ============================================================================

/**
 * Get the current session state from localStorage
 */
export function getSessionState(): CustomSessionState | null {
  try {
    const stored = localStorage.getItem(CUSTOM_SESSION_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as CustomSessionState;
  } catch (error) {
    console.error('[CustomSession] Failed to parse session state:', error);
    return null;
  }
}

/**
 * Save session state to localStorage
 */
export function saveSessionState(state: CustomSessionState): void {
  try {
    localStorage.setItem(CUSTOM_SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[CustomSession] Failed to save session state:', error);
  }
}

/**
 * Clear session state from localStorage
 */
export function clearSessionState(): void {
  localStorage.removeItem(CUSTOM_SESSION_STORAGE_KEY);
}

/**
 * Check if a session is in progress
 */
export function hasActiveSession(): boolean {
  return getSessionState() !== null;
}

// ============================================================================
// SESSION INITIALIZATION
// ============================================================================

/**
 * Initialize a new custom study session
 */
export async function startSession(config: CustomSessionConfig): Promise<CustomSessionState> {
  // Clear any existing session
  clearSessionState();

  // Fetch initial questions from API
  const questions = await fetchSessionQuestions(config, config.questionsPerIncrement);

  // Create initial state
  const state: CustomSessionState = {
    config,
    currentIncrement: 1,
    questionsAnswered: 0,
    correctCount: 0,
    retryQueue: [],
    currentQuestions: questions,
    currentQuestionIndex: 0,
    isRetryPhase: false,
    startedAt: new Date().toISOString(),
    answeredQuestions: [],
  };

  saveSessionState(state);
  return state;
}

/**
 * Fetch questions for a custom session from the API
 */
export async function fetchSessionQuestions(
  config: CustomSessionConfig,
  count: number
): Promise<Question[]> {
  const request: GenerateCustomSessionRequest = {
    config,
    count,
  };

  try {
    const response = await fetch('/api/questions/custom-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to fetch questions: ${response.status}`);
    }

    const data: GenerateCustomSessionResponse = await response.json();

    if (data.warning) {
      console.warn('[CustomSession] Warning:', data.warning);
    }

    return data.questions;
  } catch (error) {
    console.error('[CustomSession] Failed to fetch questions:', error);
    throw error;
  }
}

// ============================================================================
// ANSWER HANDLING
// ============================================================================

/**
 * Submit an answer and update session state
 * Returns the updated state
 */
export function submitAnswer(
  questionId: string,
  selectedAnswer: string,
  isCorrect: boolean,
  timeSpentMs: number
): CustomSessionState {
  const state = getSessionState();
  if (!state) {
    throw new Error('No active session');
  }

  const currentQuestion = state.currentQuestions[state.currentQuestionIndex];
  if (!currentQuestion) {
    throw new Error('No current question');
  }

  // Record the answer
  const answeredQuestion: AnsweredQuestion = {
    questionId,
    question: currentQuestion,
    isCorrect,
    selectedAnswer,
    timeSpentMs,
    isRetry: state.isRetryPhase,
  };

  state.answeredQuestions.push(answeredQuestion);
  state.questionsAnswered++;

  if (isCorrect) {
    state.correctCount++;
  } else if (state.config.retryMissedQuestions && !state.isRetryPhase) {
    // Add to retry queue if not already in retry phase
    state.retryQueue.push(currentQuestion);
  }

  // Move to next question
  state.currentQuestionIndex++;

  // Check if we've finished the current batch
  if (state.currentQuestionIndex >= state.currentQuestions.length) {
    // Check if we need to do retry phase
    if (state.retryQueue.length > 0 && !state.isRetryPhase) {
      // Start retry phase
      state.isRetryPhase = true;
      state.currentQuestions = [...state.retryQueue];
      state.retryQueue = [];
      state.currentQuestionIndex = 0;
    }
    // If we're done with retries or no retries needed, the session increment is complete
  }

  saveSessionState(state);
  return state;
}

/**
 * Get the current question
 */
export function getCurrentQuestion(): Question | null {
  const state = getSessionState();
  if (!state) return null;

  if (state.currentQuestionIndex >= state.currentQuestions.length) {
    return null; // Increment complete
  }

  return state.currentQuestions[state.currentQuestionIndex] ?? null;
}

/**
 * Check if current increment is complete (all questions answered including retries)
 */
export function isIncrementComplete(): boolean {
  const state = getSessionState();
  if (!state) return false;

  // Increment is complete when:
  // 1. All current questions have been answered
  // 2. AND (no retry queue OR we've already done retry phase)
  const allAnswered = state.currentQuestionIndex >= state.currentQuestions.length;
  const noMoreRetries = state.retryQueue.length === 0 || state.isRetryPhase;

  return allAnswered && noMoreRetries;
}

// ============================================================================
// SESSION PROGRESSION
// ============================================================================

/**
 * Start the next increment of questions
 * Returns null if session should end (no more questions available)
 */
export async function startNextIncrement(): Promise<CustomSessionState | null> {
  const state = getSessionState();
  if (!state) {
    throw new Error('No active session');
  }

  // Fetch more questions
  const questions = await fetchSessionQuestions(state.config, state.config.questionsPerIncrement);

  if (questions.length === 0) {
    // No more questions available
    return null;
  }

  // Update state for new increment
  state.currentIncrement++;
  state.currentQuestions = questions;
  state.currentQuestionIndex = 0;
  state.isRetryPhase = false;
  state.retryQueue = [];

  saveSessionState(state);
  return state;
}

/**
 * End the session and get summary
 */
export function endSession(): CustomSessionSummary {
  const state = getSessionState();
  if (!state) {
    throw new Error('No active session');
  }

  const summary = calculateSessionSummary(state);
  clearSessionState();

  return summary;
}

// ============================================================================
// SESSION SUMMARY & ANALYTICS
// ============================================================================

/**
 * Calculate session summary statistics
 */
export function calculateSessionSummary(state: CustomSessionState): CustomSessionSummary {
  const { answeredQuestions, startedAt } = state;

  // Calculate first attempt vs retry stats
  const firstAttemptQuestions = answeredQuestions.filter((q) => !q.isRetry);
  const retryQuestions = answeredQuestions.filter((q) => q.isRetry);

  const correctFirstAttempt = firstAttemptQuestions.filter((q) => q.isCorrect).length;
  const correctOnRetry = retryQuestions.filter((q) => q.isCorrect).length;

  // Calculate time
  const totalTimeMs = answeredQuestions.reduce((sum, q) => sum + q.timeSpentMs, 0);
  const avgTimePerQuestion =
    answeredQuestions.length > 0 ? totalTimeMs / answeredQuestions.length : 0;

  // Calculate accuracy
  const firstAttemptAccuracy =
    firstAttemptQuestions.length > 0
      ? (correctFirstAttempt / firstAttemptQuestions.length) * 100
      : 0;

  const totalCorrect = correctFirstAttempt + correctOnRetry;
  const overallAccuracy =
    answeredQuestions.length > 0 ? (totalCorrect / answeredQuestions.length) * 100 : 0;

  // Calculate system breakdown
  const systemBreakdown = calculateSystemBreakdown(firstAttemptQuestions);

  // Calculate focus area breakdown
  const focusAreaBreakdown = calculateFocusAreaBreakdown(firstAttemptQuestions);

  // Identify weak and strong areas
  const weakAreas: string[] = [];
  const strongAreas: string[] = [];

  systemBreakdown.forEach((s) => {
    if (s.accuracy < 70 && s.total >= 2) {
      weakAreas.push(s.systemName);
    } else if (s.accuracy >= 90 && s.total >= 2) {
      strongAreas.push(s.systemName);
    }
  });

  return {
    totalAnswered: answeredQuestions.length,
    correctFirstAttempt,
    correctOnRetry,
    totalTimeMs,
    avgTimePerQuestion,
    firstAttemptAccuracy,
    overallAccuracy,
    systemBreakdown,
    focusAreaBreakdown,
    weakAreas,
    strongAreas,
  };
}

/**
 * Calculate performance breakdown by system
 */
function calculateSystemBreakdown(questions: AnsweredQuestion[]): SystemBreakdown[] {
  const systemMap = new Map<SystemCode, { total: number; correct: number }>();

  questions.forEach((q) => {
    const system = (q.question.system || q.question.topic) as SystemCode;
    if (!system) return;

    const current = systemMap.get(system) || { total: 0, correct: 0 };
    current.total++;
    if (q.isCorrect) current.correct++;
    systemMap.set(system, current);
  });

  return Array.from(systemMap.entries()).map(([system, stats]) => ({
    system,
    systemName: ABBREVIATION_TO_TOPIC_MAP[system] || system,
    total: stats.total,
    correct: stats.correct,
    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
  }));
}

/**
 * Calculate performance breakdown by focus area
 * Note: This requires questions to have focusArea metadata
 */
function calculateFocusAreaBreakdown(questions: AnsweredQuestion[]): FocusAreaBreakdown[] {
  const focusMap = new Map<FocusArea, { total: number; correct: number }>();

  questions.forEach((q) => {
    // Try to get focus area from question metadata
    const focusArea = (q.question as any).focusArea as FocusArea | undefined;
    if (!focusArea) return;

    const current = focusMap.get(focusArea) || { total: 0, correct: 0 };
    current.total++;
    if (q.isCorrect) current.correct++;
    focusMap.set(focusArea, current);
  });

  return Array.from(focusMap.entries()).map(([focusArea, stats]) => ({
    focusArea,
    total: stats.total,
    correct: stats.correct,
    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
  }));
}

// ============================================================================
// AVAILABLE CONTENT FETCHING
// ============================================================================

/**
 * Fetch available content for the session builder UI
 */
export async function fetchAvailableContent(): Promise<AvailableContent> {
  try {
    const response = await fetch('/api/questions/custom-session/available');

    if (!response.ok) {
      throw new Error(`Failed to fetch available content: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[CustomSession] Failed to fetch available content:', error);
    throw error;
  }
}

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

/**
 * Get default configuration
 */
export function getDefaultConfig(): CustomSessionConfig {
  return { ...DEFAULT_CUSTOM_SESSION_CONFIG };
}

/**
 * Validate session configuration
 */
export function validateConfig(config: CustomSessionConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Must have at least one system selected
  if (config.systems.length === 0) {
    errors.push('Please select at least one organ system');
  }

  // Must have at least one focus area
  if (config.focusAreas.length === 0) {
    errors.push('Please select at least one focus area');
  }

  // Questions per increment must be reasonable
  if (config.questionsPerIncrement < 5 || config.questionsPerIncrement > 50) {
    errors.push('Questions per increment must be between 5 and 50');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get progress percentage within current increment
 */
export function getIncrementProgress(): number {
  const state = getSessionState();
  if (!state) return 0;

  const totalInIncrement = state.currentQuestions.length;
  if (totalInIncrement === 0) return 0;

  return (state.currentQuestionIndex / totalInIncrement) * 100;
}

/**
 * Get current session stats (for display during session)
 */
export function getCurrentStats(): {
  questionsAnswered: number;
  correctCount: number;
  accuracy: number;
  currentIncrement: number;
  isRetryPhase: boolean;
  retryQueueSize: number;
} | null {
  const state = getSessionState();
  if (!state) return null;

  return {
    questionsAnswered: state.questionsAnswered,
    correctCount: state.correctCount,
    accuracy:
      state.questionsAnswered > 0 ? (state.correctCount / state.questionsAnswered) * 100 : 0,
    currentIncrement: state.currentIncrement,
    isRetryPhase: state.isRetryPhase,
    retryQueueSize: state.retryQueue.length,
  };
}

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

export const customSessionService = {
  // State management
  getSessionState,
  saveSessionState,
  clearSessionState,
  hasActiveSession,

  // Session lifecycle
  startSession,
  startNextIncrement,
  endSession,

  // Question handling
  fetchSessionQuestions,
  submitAnswer,
  getCurrentQuestion,
  isIncrementComplete,

  // Analytics
  calculateSessionSummary,

  // Configuration
  getDefaultConfig,
  validateConfig,
  fetchAvailableContent,

  // Progress helpers
  getIncrementProgress,
  getCurrentStats,
};

export default customSessionService;
