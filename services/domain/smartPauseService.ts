/**
 * Smart Pause Detection Service
 *
 * Monitors session performance patterns and suggests breaks
 * when the user appears to be struggling or fatigued.
 * All inference is automatic - no user input required.
 */

const STORAGE_KEY = 'panceai_smart_pause';

export type PauseRecommendation = 'none' | 'soft' | 'suggested' | 'recommended';

interface PauseState {
  recentResults: Array<{
    correct: boolean;
    timeSpentMs: number;
    parTimeMs: number;
    timestamp: number;
  }>;
  lastPauseSuggestion: number | null;
  pausesTaken: number;
  sessionStart: number;
}

interface PauseSignals {
  consecutiveIncorrect: number;
  recentAccuracy: number; // Last 10 questions
  avgTimeVsPar: number; // >1 = slower than par
  sessionDuration: number; // minutes
  errorStreak: boolean;
  rushingPattern: boolean;
  fatigueTrend: boolean;
}

interface PauseAnalysis {
  recommendation: PauseRecommendation;
  signals: PauseSignals;
  message: string;
  encouragement: string;
}

function getState(): PauseState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[SmartPause] Failed to retrieve pause state:', error);
  }
  return {
    recentResults: [],
    lastPauseSuggestion: null,
    pausesTaken: 0,
    sessionStart: Date.now(),
  };
}

function saveState(state: PauseState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[SmartPause] Failed to save pause state:', error);
  }
}

/**
 * Record a question result for pause detection
 */
export function recordPauseResult(result: {
  correct: boolean;
  timeSpentMs: number;
  parTimeMs: number;
}): void {
  const state = getState();

  state.recentResults.push({
    ...result,
    timestamp: Date.now(),
  });

  // Keep last 20 results for analysis
  if (state.recentResults.length > 20) {
    state.recentResults = state.recentResults.slice(-20);
  }

  saveState(state);
}

/**
 * Analyze current session for pause recommendation
 */
export function analyzePauseNeed(): PauseAnalysis {
  const state = getState();
  const results = state.recentResults;

  if (results.length < 5) {
    return {
      recommendation: 'none',
      signals: {
        consecutiveIncorrect: 0,
        recentAccuracy: 100,
        avgTimeVsPar: 1,
        sessionDuration: 0,
        errorStreak: false,
        rushingPattern: false,
        fatigueTrend: false,
      },
      message: '',
      encouragement: '',
    };
  }

  // Calculate signals
  const last10 = results.slice(-10);
  const last5 = results.slice(-5);

  // Consecutive incorrect count
  let consecutiveIncorrect = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (!results[i].correct) {
      consecutiveIncorrect++;
    } else {
      break;
    }
  }

  // Recent accuracy
  const recentCorrect = last10.filter((r) => r.correct).length;
  const recentAccuracy = (recentCorrect / last10.length) * 100;

  // Average time vs par
  const avgTimeVsPar =
    last10.reduce((sum, r) => sum + r.timeSpentMs / r.parTimeMs, 0) / last10.length;

  // Session duration
  const sessionDuration = (Date.now() - state.sessionStart) / 60000; // minutes

  // Error streak detection
  const errorStreak = consecutiveIncorrect >= 3;

  // Rushing pattern: consistently under par but low accuracy
  const rushingTimes = last5.filter((r) => r.timeSpentMs < r.parTimeMs * 0.6).length;
  const last5Accuracy = last5.filter((r) => r.correct).length / last5.length;
  const rushingPattern = rushingTimes >= 3 && last5Accuracy < 0.5;

  // Fatigue trend: accuracy declining over session
  let fatigueTrend = false;
  if (results.length >= 15) {
    const first10 = results.slice(0, 10);
    const earlyAccuracy = first10.filter((r) => r.correct).length / 10;
    const lateAccuracy = recentAccuracy / 100;
    fatigueTrend = earlyAccuracy - lateAccuracy > 0.2; // 20%+ drop
  }

  const signals: PauseSignals = {
    consecutiveIncorrect,
    recentAccuracy,
    avgTimeVsPar,
    sessionDuration,
    errorStreak,
    rushingPattern,
    fatigueTrend,
  };

  // Don't suggest pauses too frequently (at least 10 min between)
  const timeSinceLastSuggestion = state.lastPauseSuggestion
    ? (Date.now() - state.lastPauseSuggestion) / 60000
    : sessionDuration;

  if (timeSinceLastSuggestion < 10) {
    return {
      recommendation: 'none',
      signals,
      message: '',
      encouragement: '',
    };
  }

  // Determine recommendation level
  let recommendation: PauseRecommendation = 'none';
  let message = '';
  let encouragement = '';

  // Critical: Error streak + fatigue
  if (errorStreak && fatigueTrend) {
    recommendation = 'recommended';
    message = 'Taking a 5-10 minute break could help reset your focus.';
    encouragement =
      "You've been working hard. A brief mental reset often leads to better performance.";
  }
  // Strong: Long session + declining performance
  else if (sessionDuration >= 45 && (recentAccuracy < 60 || fatigueTrend)) {
    recommendation = 'suggested';
    message = "You've been studying for a while. A short break might help.";
    encouragement = 'Research shows short breaks improve retention and focus.';
  }
  // Moderate: Rushing pattern detected
  else if (rushingPattern) {
    recommendation = 'suggested';
    message = 'You might be rushing through questions.';
    encouragement = 'Slowing down often leads to better accuracy. Take a breath.';
  }
  // Soft: Minor error streak
  else if (consecutiveIncorrect >= 4) {
    recommendation = 'soft';
    message = "A few tough questions in a row. That's normal!";
    encouragement = 'Stick with it - your next streak of correct answers is coming.';
  }
  // Soft: Long session
  else if (sessionDuration >= 60 && state.pausesTaken === 0) {
    recommendation = 'soft';
    message = "You've been at it for an hour.";
    encouragement = 'Consider a quick stretch or water break when convenient.';
  }

  // Update state if we're making a suggestion
  if (recommendation !== 'none') {
    state.lastPauseSuggestion = Date.now();
    saveState(state);
  }

  return {
    recommendation,
    signals,
    message,
    encouragement,
  };
}

/**
 * Record that user acknowledged/took a pause
 */
export function recordPauseTaken(): void {
  const state = getState();
  state.pausesTaken++;
  state.lastPauseSuggestion = Date.now();
  saveState(state);
}

/**
 * Get quick encouragement message based on current state
 */
export function getQuickEncouragement(): string | null {
  const state = getState();
  const results = state.recentResults;

  if (results.length < 3) return null;

  const last3 = results.slice(-3);
  const last3Correct = last3.filter((r) => r.correct).length;

  // 3 in a row correct
  if (last3Correct === 3) {
    const messages = ['On a roll!', 'Great focus!', 'Keep it up!', 'Locked in!'];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // After recovering from a miss
  if (!results[results.length - 2]?.correct && results[results.length - 1]?.correct) {
    const messages = ['Back on track!', 'Nice recovery!', 'Learning in action!'];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  return null;
}

/**
 * Reset pause tracking for new session
 */
export function resetPauseTracking(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[SmartPause] Failed to reset pause tracking:', error);
  }
}
