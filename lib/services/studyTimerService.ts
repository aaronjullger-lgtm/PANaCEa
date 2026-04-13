/**
 * Study Timer Service
 *
 * Manages Pomodoro-style study sessions with configurable work/break intervals.
 * Default: 35-min work blocks with 10-min breaks (research-optimal for medical
 * content — see Roe et al. 2022 on sustained attention in medical education).
 *
 * Tracks per-session: start/end time, questions answered, accuracy trend,
 * response times. Integrates with the existing composite fatigue detection
 * system to suggest breaks when cognitive decline is detected.
 *
 * @module lib/services/studyTimerService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimerPhase = 'work' | 'break' | 'complete';

export interface StudyTimerConfig {
  /** Work block duration in ms (default: 35 min) */
  workDurationMs: number;
  /** Break duration in ms (default: 10 min) */
  breakDurationMs: number;
}

export interface SessionDataPoint {
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Whether the answer was correct */
  wasCorrect: boolean;
  /** Timestamp of this response */
  timestamp: number;
}

export interface FatigueAlert {
  /** Whether fatigue was detected */
  detected: boolean;
  /** Human-readable fatigue message */
  message: string | null;
  /** Accuracy drop percentage from session baseline (0 if not triggered) */
  accuracyDropPct: number;
  /** Response time increase percentage from session baseline (0 if not triggered) */
  responseTimeIncreasePct: number;
}

export interface SessionSummary {
  /** Session duration in ms */
  durationMs: number;
  /** Total questions answered */
  questionsAnswered: number;
  /** Number of correct answers */
  correctAnswers: number;
  /** Overall accuracy (0-1) */
  accuracy: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
  /** Estimated retention score (0-1) based on accuracy trend and time */
  retentionEstimate: number;
  /** Number of work blocks completed */
  workBlocksCompleted: number;
  /** Whether fatigue was detected during the session */
  fatigueDetected: boolean;
  /** Timestamps of fatigue alerts */
  fatigueAlertTimestamps: number[];
}

export interface StudySession {
  /** Session ID */
  id: string;
  /** Current timer phase */
  phase: TimerPhase;
  /** Configuration for this session */
  config: StudyTimerConfig;
  /** Session start timestamp (epoch ms) */
  startedAt: number;
  /** Current phase start timestamp (epoch ms) */
  phaseStartedAt: number;
  /** Total elapsed work time in ms across all blocks */
  totalWorkMs: number;
  /** Number of completed work blocks */
  workBlocksCompleted: number;
  /** Question data points for the current session */
  dataPoints: SessionDataPoint[];
  /** Fatigue alerts during this session */
  fatigueAlerts: FatigueAlert[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default work block: 35 minutes (research-optimal for medical content) */
export const DEFAULT_WORK_MS = 35 * 60 * 1000;

/** Default break: 10 minutes */
export const DEFAULT_BREAK_MS = 10 * 60 * 1000;

/** Minimum data points before fatigue analysis is reliable */
const MIN_DATA_POINTS = 6;

/** Baseline window: first N answers establish "fresh" baseline */
const BASELINE_WINDOW = 5;

/** Accuracy drop threshold: 15% drop from baseline triggers fatigue warning */
const ACCURACY_DROP_THRESHOLD = 0.15;

/** Response time increase threshold: 30% increase from baseline triggers warning */
const RT_INCREASE_THRESHOLD = 0.30;

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a new study session with the given config.
 */
export function createSession(
  config: Partial<StudyTimerConfig> = {},
  id = crypto.randomUUID(),
): StudySession {
  const now = Date.now();
  return {
    id,
    phase: 'work',
    config: {
      workDurationMs: config.workDurationMs ?? DEFAULT_WORK_MS,
      breakDurationMs: config.breakDurationMs ?? DEFAULT_BREAK_MS,
    },
    startedAt: now,
    phaseStartedAt: now,
    totalWorkMs: 0,
    workBlocksCompleted: 0,
    dataPoints: [],
    fatigueAlerts: [],
  };
}

// ─── Phase Transitions ───────────────────────────────────────────────────────

/**
 * Transition to the next phase. Returns a new session object with updated state.
 */
export function transitionPhase(session: StudySession): StudySession {
  const now = Date.now();
  const phaseElapsed = now - session.phaseStartedAt;

  switch (session.phase) {
    case 'work': {
      const newWorkBlocks = session.workBlocksCompleted + 1;
      return {
        ...session,
        phase: 'break',
        phaseStartedAt: now,
        totalWorkMs: session.totalWorkMs + phaseElapsed,
        workBlocksCompleted: newWorkBlocks,
      };
    }
    case 'break':
      return {
        ...session,
        phase: 'work',
        phaseStartedAt: now,
      };
    case 'complete':
      return session;
  }
}

/**
 * Complete the session and generate a summary.
 */
export function completeSession(session: StudySession): { session: StudySession; summary: SessionSummary } {
  const now = Date.now();
  const phaseElapsed = now - session.phaseStartedAt;
  const finalTotalWork =
    session.phase === 'work'
      ? session.totalWorkMs + phaseElapsed
      : session.totalWorkMs;

  const completedSession: StudySession = {
    ...session,
    phase: 'complete',
    totalWorkMs: finalTotalWork,
  };

  return {
    session: completedSession,
    summary: buildSummary(completedSession),
  };
}

// ─── Data Collection ─────────────────────────────────────────────────────────

/**
 * Record a question answer in the session. Returns updated session and fatigue alert.
 */
export function recordAnswer(
  session: StudySession,
  dataPoint: SessionDataPoint,
): { session: StudySession; fatigueAlert: FatigueAlert } {
  const updatedSession: StudySession = {
    ...session,
    dataPoints: [...session.dataPoints, dataPoint],
  };

  const fatigueAlert = checkFatigue(updatedSession.dataPoints);

  if (fatigueAlert.detected) {
    updatedSession.fatigueAlerts = [
      ...updatedSession.fatigueAlerts,
      { ...fatigueAlert },
    ];
  }

  return { session: updatedSession, fatigueAlert };
}

// ─── Fatigue Detection ───────────────────────────────────────────────────────

/**
 * Check for cognitive fatigue based on accuracy drop and response time increase.
 *
 * Uses a rolling window approach: compare recent performance (last BASELINE_WINDOW
 * answers) against the session baseline (first BASELINE_WINDOW answers).
 *
 * Triggers when:
 * - Accuracy drops >15% from baseline, OR
 * - Response times increase >30% from baseline
 *
 * Only evaluates after MIN_DATA_POINTS answers to ensure reliability.
 */
export function checkFatigue(dataPoints: SessionDataPoint[]): FatigueAlert {
  const noAlert: FatigueAlert = {
    detected: false,
    message: null,
    accuracyDropPct: 0,
    responseTimeIncreasePct: 0,
  };

  if (dataPoints.length < MIN_DATA_POINTS) return noAlert;

  // Establish baseline from first BASELINE_WINDOW answers
  const baselineSlice = dataPoints.slice(0, BASELINE_WINDOW);
  const recentSlice = dataPoints.slice(-BASELINE_WINDOW);

  const baselineAccuracy =
    baselineSlice.filter((dp) => dp.wasCorrect).length / baselineSlice.length;
  const recentAccuracy =
    recentSlice.filter((dp) => dp.wasCorrect).length / recentSlice.length;

  const baselineRT = average(baselineSlice.map((dp) => dp.responseTimeMs));
  const recentRT = average(recentSlice.map((dp) => dp.responseTimeMs));

  const accuracyDrop = baselineAccuracy - recentAccuracy;
  const rtIncrease = baselineRT > 0 ? (recentRT - baselineRT) / baselineRT : 0;

  const detected =
    accuracyDrop > ACCURACY_DROP_THRESHOLD || rtIncrease > RT_INCREASE_THRESHOLD;

  if (!detected) return noAlert;

  // Build contextual message
  const messages: string[] = [];
  if (accuracyDrop > ACCURACY_DROP_THRESHOLD) {
    messages.push(
      `accuracy dropped ${Math.round(accuracyDrop * 100)}%`,
    );
  }
  if (rtIncrease > RT_INCREASE_THRESHOLD) {
    messages.push(
      `response times increased ${Math.round(rtIncrease * 100)}%`,
    );
  }

  return {
    detected: true,
    message: `Fatigue detected: ${messages.join(' and ')}. Consider taking a break.`,
    accuracyDropPct: Math.max(0, accuracyDrop),
    responseTimeIncreasePct: Math.max(0, rtIncrease),
  };
}

// ─── Time Helpers ────────────────────────────────────────────────────────────

/**
 * Get remaining time in the current phase.
 */
export function getPhaseRemainingMs(session: StudySession): number {
  const now = Date.now();
  const elapsed = now - session.phaseStartedAt;
  const duration =
    session.phase === 'work'
      ? session.config.workDurationMs
      : session.config.breakDurationMs;
  return Math.max(0, duration - elapsed);
}

/**
 * Get progress through the current phase (0-1).
 */
export function getPhaseProgress(session: StudySession): number {
  const duration =
    session.phase === 'work'
      ? session.config.workDurationMs
      : session.config.breakDurationMs;
  const remaining = getPhaseRemainingMs(session);
  return 1 - remaining / duration;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function buildSummary(session: StudySession): SessionSummary {
  const dps = session.dataPoints;
  const total = dps.length;
  const correct = dps.filter((dp) => dp.wasCorrect).length;
  const accuracy = total > 0 ? correct / total : 0;
  const avgRT = total > 0 ? average(dps.map((dp) => dp.responseTimeMs)) : 0;

  return {
    durationMs: session.totalWorkMs,
    questionsAnswered: total,
    correctAnswers: correct,
    accuracy,
    avgResponseTimeMs: avgRT,
    retentionEstimate: estimateRetention(session),
    workBlocksCompleted: session.workBlocksCompleted,
    fatigueDetected: session.fatigueAlerts.length > 0,
    fatigueAlertTimestamps: session.fatigueAlerts.map((_, i) => i),
  };
}

/**
 * Estimate retention based on session characteristics.
 *
 * Model: combines accuracy, consistency, and time factors.
 * - Accuracy weight: 0.5 (direct measure of encoding)
 * - Consistency weight: 0.3 (stable performance = deeper processing)
 * - Time factor: 0.2 (longer focused sessions = stronger traces, up to a point)
 */
function estimateRetention(session: StudySession): number {
  const dps = session.dataPoints;
  if (dps.length < 3) return 0;

  const accuracy =
    dps.filter((dp) => dp.wasCorrect).length / dps.length;

  // Consistency: inverse of accuracy variance across rolling windows
  const windowSize = Math.min(5, dps.length);
  const accuracies: number[] = [];
  for (let i = windowSize - 1; i < dps.length; i++) {
    const window = dps.slice(i - windowSize + 1, i + 1);
    accuracies.push(window.filter((dp) => dp.wasCorrect).length / window.length);
  }
  const meanAcc = average(accuracies);
  const variance =
    accuracies.length > 1
      ? average(accuracies.map((a) => (a - meanAcc) ** 2))
      : 0;
  const consistency = Math.max(0, 1 - Math.sqrt(variance) * 3);

  // Time factor: peaks around 25-30 min of focused work
  const workMinutes = session.totalWorkMs / 60000;
  const timeFactor = Math.min(1, workMinutes / 30);

  return Math.min(
    1,
    Math.max(0, 0.5 * accuracy + 0.3 * consistency + 0.2 * timeFactor),
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
