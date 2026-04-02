/**
 * Adaptive Session Difficulty Service
 *
 * Adjusts question difficulty mid-session based on real-time performance.
 * Unlike difficultyCalibrator (which sets the mix pre-session), this service
 * recalculates after every N answers within an active session.
 *
 * Mechanisms:
 *   - Tracks a rolling window of the last 5 answers within the session
 *   - If accuracy > 80%: nudge next question harder
 *   - If accuracy < 60%: nudge next question easier
 *   - Detects fatigue via response time degradation (> 2x median)
 *   - All functions are pure (no DB) — operate on in-session state
 *
 * Research:
 *   - Wilson et al. (2019): 85% accuracy = optimal learning rate
 *   - Bjork & Bjork (2011): "desirable difficulties" — too easy = no learning
 *
 * Sprint 2C — April 2026
 * @module lib/services/adaptiveSessionDifficultyService
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Rolling window size for mid-session accuracy tracking */
export const SESSION_WINDOW_SIZE = 5;

/** Accuracy thresholds for difficulty adjustment */
export const ACCURACY_HIGH = 0.80;
export const ACCURACY_LOW = 0.60;

/** Response time multiplier that indicates fatigue */
export const FATIGUE_TIME_MULTIPLIER = 2.0;
/** Minimum questions answered before adaptation kicks in */
export const MIN_ANSWERS_FOR_ADAPTATION = 3;

/** Difficulty levels ordered from easiest to hardest */
export const DIFFICULTY_LADDER = ['easy', 'medium', 'hard'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LADDER)[number];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionAnswer {
  wasCorrect: boolean;
  responseTimeMs: number;
  difficulty: DifficultyLevel;
  questionIndex: number;
}

export interface AdaptiveState {
  answers: SessionAnswer[];
  currentDifficultyBias: DifficultyLevel;
  fatigueDetected: boolean;
  adjustmentHistory: DifficultyAdjustment[];
}

export interface DifficultyAdjustment {
  fromDifficulty: DifficultyLevel;
  toDifficulty: DifficultyLevel;
  reason: 'high_accuracy' | 'low_accuracy' | 'fatigue' | 'recovery';
  afterQuestionIndex: number;
  windowAccuracy: number;
}
export interface SessionFatigueSignal {
  isFatigued: boolean;
  medianTimeMs: number;
  recentTimeMs: number;
  ratio: number;
}

// ─── State Management ────────────────────────────────────────────────────────

/**
 * Create a fresh adaptive state for a new session.
 */
export function createAdaptiveState(
  initialDifficulty: DifficultyLevel = 'medium'
): AdaptiveState {
  return {
    answers: [],
    currentDifficultyBias: initialDifficulty,
    fatigueDetected: false,
    adjustmentHistory: [],
  };
}

// ─── Core Adaptation ─────────────────────────────────────────────────────────

/**
 * Record an answer and compute the next difficulty recommendation.
 * Pure function — mutates nothing, returns a new state.
 */
export function recordAnswerAndAdapt(
  state: AdaptiveState,
  answer: SessionAnswer
): AdaptiveState {
  const newAnswers = [...state.answers, answer];
  const newState: AdaptiveState = {
    ...state,
    answers: newAnswers,
    adjustmentHistory: [...state.adjustmentHistory],
  };
  // Not enough answers yet — no adaptation
  if (newAnswers.length < MIN_ANSWERS_FOR_ADAPTATION) {
    return newState;
  }

  // Check for fatigue first
  const fatigueSignal = detectFatigue(newAnswers);
  newState.fatigueDetected = fatigueSignal.isFatigued;

  if (fatigueSignal.isFatigued && state.currentDifficultyBias !== 'easy') {
    newState.currentDifficultyBias = 'easy';
    newState.adjustmentHistory.push({
      fromDifficulty: state.currentDifficultyBias,
      toDifficulty: 'easy',
      reason: 'fatigue',
      afterQuestionIndex: answer.questionIndex,
      windowAccuracy: computeWindowAccuracy(newAnswers),
    });
    return newState;
  }

  // Compute rolling window accuracy
  const windowAccuracy = computeWindowAccuracy(newAnswers);

  // Determine adjustment
  const currentIdx = DIFFICULTY_LADDER.indexOf(state.currentDifficultyBias);

  if (windowAccuracy > ACCURACY_HIGH && currentIdx < DIFFICULTY_LADDER.length - 1) {
    // Doing great → nudge harder
    const next = DIFFICULTY_LADDER[currentIdx + 1]!;
    newState.currentDifficultyBias = next;
    newState.adjustmentHistory.push({
      fromDifficulty: state.currentDifficultyBias,
      toDifficulty: next,
      reason: 'high_accuracy',
      afterQuestionIndex: answer.questionIndex,
      windowAccuracy,
    });
  } else if (windowAccuracy < ACCURACY_LOW && currentIdx > 0) {
    // Struggling → nudge easier
    const next = DIFFICULTY_LADDER[currentIdx - 1]!;
    newState.currentDifficultyBias = next;
    newState.adjustmentHistory.push({
      fromDifficulty: state.currentDifficultyBias,
      toDifficulty: next,
      reason: 'low_accuracy',
      afterQuestionIndex: answer.questionIndex,
      windowAccuracy,
    });
  }

  return newState;
}
// ─── Fatigue Detection ───────────────────────────────────────────────────────

/**
 * Detect fatigue by comparing recent response time to session median.
 * If the last answer took > 2x the median, the student is likely fatigued.
 */
export function detectFatigue(answers: SessionAnswer[]): SessionFatigueSignal {
  if (answers.length < MIN_ANSWERS_FOR_ADAPTATION) {
    return { isFatigued: false, medianTimeMs: 0, recentTimeMs: 0, ratio: 0 };
  }

  const times = answers.map(a => a.responseTimeMs).sort((a, b) => a - b);
  const medianTimeMs = times[Math.floor(times.length / 2)]!;
  const recentTimeMs = answers[answers.length - 1]!.responseTimeMs;

  // Avoid division by zero
  if (medianTimeMs <= 0) {
    return { isFatigued: false, medianTimeMs, recentTimeMs, ratio: 0 };
  }

  const ratio = recentTimeMs / medianTimeMs;

  return {
    isFatigued: ratio > FATIGUE_TIME_MULTIPLIER,
    medianTimeMs,
    recentTimeMs,
    ratio,
  };
}
// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute accuracy over the rolling window (last SESSION_WINDOW_SIZE answers).
 */
export function computeWindowAccuracy(answers: SessionAnswer[]): number {
  const window = answers.slice(-SESSION_WINDOW_SIZE);
  if (window.length === 0) return 0;
  const correct = window.filter(a => a.wasCorrect).length;
  return correct / window.length;
}

/**
 * Get the recommended difficulty for the next question.
 * Returns the current bias from the adaptive state.
 */
export function getNextDifficulty(state: AdaptiveState): DifficultyLevel {
  return state.currentDifficultyBias;
}

/**
 * Get a summary of the session's adaptive behavior for analytics.
 */
export function getAdaptiveSummary(state: AdaptiveState): {
  totalAnswers: number;
  overallAccuracy: number;
  adjustmentCount: number;
  fatigueDetected: boolean;
  finalDifficulty: DifficultyLevel;
  difficultyPath: DifficultyLevel[];
} {
  const correct = state.answers.filter(a => a.wasCorrect).length;
  return {
    totalAnswers: state.answers.length,
    overallAccuracy: state.answers.length > 0 ? correct / state.answers.length : 0,
    adjustmentCount: state.adjustmentHistory.length,
    fatigueDetected: state.fatigueDetected,
    finalDifficulty: state.currentDifficultyBias,
    difficultyPath: [
      'medium' as DifficultyLevel, // starting point
      ...state.adjustmentHistory.map(a => a.toDifficulty),
    ],
  };
}
