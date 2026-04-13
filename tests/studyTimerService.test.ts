/**
 * Study Timer Service — Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSession,
  transitionPhase,
  completeSession,
  recordAnswer,
  checkFatigue,
  getPhaseRemainingMs,
  getPhaseProgress,
  DEFAULT_WORK_MS,
  DEFAULT_BREAK_MS,
  type SessionDataPoint,
  type StudySession,
} from '@/lib/services/studyTimerService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a deterministic session with a fixed start time */
function createTestSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    ...createSession({}, 'test-session-id'),
    startedAt: 1000000000000,
    phaseStartedAt: 1000000000000,
    ...overrides,
  };
}

/** Generate mock data points */
function makeDataPoints(count: number, correctPct: number, baseRT = 3000): SessionDataPoint[] {
  const points: SessionDataPoint[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      responseTimeMs: baseRT,
      wasCorrect: Math.random() < correctPct,
      timestamp: 1000000000000 + i * 60000,
    });
  }
  return points;
}

/** Generate data points with deterministic correctness */
function makeDeterministicPoints(
  count: number,
  correctPattern: boolean[],
  rtPattern: number[],
): SessionDataPoint[] {
  return correctPattern.map((wasCorrect, i) => ({
    responseTimeMs: rtPattern[i] ?? 3000,
    wasCorrect,
    timestamp: 1000000000000 + i * 60000,
  }));
}

// ─── createSession ───────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session with default config', () => {
    const session = createSession();

    expect(session.phase).toBe('work');
    expect(session.config.workDurationMs).toBe(DEFAULT_WORK_MS);
    expect(session.config.breakDurationMs).toBe(DEFAULT_BREAK_MS);
    expect(session.totalWorkMs).toBe(0);
    expect(session.workBlocksCompleted).toBe(0);
    expect(session.dataPoints).toEqual([]);
    expect(session.fatigueAlerts).toEqual([]);
  });

  it('creates a session with custom config', () => {
    const session = createSession({
      workDurationMs: 25 * 60 * 1000,
      breakDurationMs: 5 * 60 * 1000,
    }, 'custom-id');

    expect(session.id).toBe('custom-id');
    expect(session.config.workDurationMs).toBe(25 * 60 * 1000);
    expect(session.config.breakDurationMs).toBe(5 * 60 * 1000);
  });

  it('generates a UUID when no id is provided', () => {
    const session = createSession();
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ─── transitionPhase ─────────────────────────────────────────────────────────

describe('transitionPhase', () => {
  it('transitions work → break', () => {
    const session = createTestSession();
    const next = transitionPhase(session);

    expect(next.phase).toBe('break');
    expect(next.workBlocksCompleted).toBe(1);
    expect(next.totalWorkMs).toBeGreaterThan(0);
  });

  it('transitions break → work', () => {
    const session = createTestSession({ phase: 'break' });
    const next = transitionPhase(session);

    expect(next.phase).toBe('work');
    expect(next.workBlocksCompleted).toBe(0);
  });

  it('returns unchanged session when complete', () => {
    const session = createTestSession({ phase: 'complete' });
    const next = transitionPhase(session);

    expect(next).toBe(session);
  });

  it('accumulates work time across multiple blocks', () => {
    const session = createTestSession({ workBlocksCompleted: 2, totalWorkMs: 70000000 });
    const next = transitionPhase(session);

    expect(next.workBlocksCompleted).toBe(3);
    expect(next.totalWorkMs).toBeGreaterThan(70000000);
  });
});

// ─── completeSession ─────────────────────────────────────────────────────────

describe('completeSession', () => {
  it('sets phase to complete and returns summary', () => {
    const points = makeDeterministicPoints(
      10,
      [true, true, false, true, true, false, true, true, true, false],
      Array(10).fill(3000),
    );
    const session = createTestSession({
      workBlocksCompleted: 2,
      totalWorkMs: 60000000,
      dataPoints: points,
    });

    const { session: completed, summary } = completeSession(session);

    expect(completed.phase).toBe('complete');
    expect(summary.questionsAnswered).toBe(10);
    expect(summary.correctAnswers).toBe(7);
    expect(summary.accuracy).toBe(0.7);
    expect(summary.avgResponseTimeMs).toBe(3000);
    expect(summary.workBlocksCompleted).toBe(2);
    expect(summary.retentionEstimate).toBeGreaterThan(0);
    expect(summary.retentionEstimate).toBeLessThanOrEqual(1);
  });

  it('handles empty data points gracefully', () => {
    const session = createTestSession({ totalWorkMs: 1000000 });
    const { summary } = completeSession(session);

    expect(summary.questionsAnswered).toBe(0);
    expect(summary.accuracy).toBe(0);
    expect(summary.avgResponseTimeMs).toBe(0);
  });

  it('accounts for in-progress work time', () => {
    const now = Date.now();
    const session = createTestSession({
      phase: 'work',
      totalWorkMs: 30000000,
      phaseStartedAt: now - 600000, // 10 min into work
    });
    const { session: completed } = completeSession(session);

    expect(completed.totalWorkMs).toBeGreaterThan(30000000);
  });

  it('does not add break time to totalWorkMs', () => {
    const now = Date.now();
    const session = createTestSession({
      phase: 'break',
      totalWorkMs: 30000000,
      phaseStartedAt: now - 600000,
    });
    const { session: completed } = completeSession(session);

    // Should not add break elapsed to work time
    expect(completed.totalWorkMs).toBe(30000000);
  });
});

// ─── recordAnswer ────────────────────────────────────────────────────────────

describe('recordAnswer', () => {
  it('adds a data point to the session', () => {
    const session = createTestSession();
    const dp: SessionDataPoint = {
      responseTimeMs: 4500,
      wasCorrect: true,
      timestamp: Date.now(),
    };

    const { session: updated } = recordAnswer(session, dp);

    expect(updated.dataPoints).toHaveLength(1);
    expect(updated.dataPoints[0].responseTimeMs).toBe(4500);
    expect(updated.dataPoints[0].wasCorrect).toBe(true);
  });

  it('does not trigger fatigue with few data points', () => {
    const session = createTestSession();
    const dp: SessionDataPoint = {
      responseTimeMs: 3000,
      wasCorrect: true,
      timestamp: Date.now(),
    };

    const { fatigueAlert } = recordAnswer(session, dp);

    expect(fatigueAlert.detected).toBe(false);
  });
});

// ─── checkFatigue ────────────────────────────────────────────────────────────

describe('checkFatigue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000000000);
  });

  it('returns no alert when data points below minimum', () => {
    const points = makeDeterministicPoints(
      4,
      [true, true, true, false],
      Array(4).fill(3000),
    );

    const alert = checkFatigue(points);

    expect(alert.detected).toBe(false);
  });

  it('detects fatigue from accuracy drop >15%', () => {
    // Baseline: 5/5 correct (100%), Recent: 2/5 correct (40%) = 60% drop
    const pattern = [
      true, true, true, true, true,   // baseline: perfect
      false, false, false, true, false, // recent: 40% accuracy
    ];
    const points = makeDeterministicPoints(pattern.length, pattern, Array(10).fill(3000));

    const alert = checkFatigue(points);

    expect(alert.detected).toBe(true);
    expect(alert.accuracyDropPct).toBeGreaterThan(0.15);
    expect(alert.message).toContain('accuracy');
  });

  it('detects fatigue from response time increase >30%', () => {
    // Baseline: 3000ms RT, Recent: 5000ms RT = 67% increase
    const rtPattern = [
      3000, 3000, 3000, 3000, 3000,  // baseline
      5000, 5000, 5000, 5000, 5000,  // recent: 67% increase
    ];
    const pattern = Array(10).fill(true); // All correct — accuracy not the trigger
    const points = makeDeterministicPoints(pattern.length, pattern, rtPattern);

    const alert = checkFatigue(points);

    expect(alert.detected).toBe(true);
    expect(alert.responseTimeIncreasePct).toBeGreaterThan(0.30);
    expect(alert.message).toContain('response times');
  });

  it('detects both accuracy drop and RT increase', () => {
    const rtPattern = [
      3000, 3000, 3000, 3000, 3000,
      5000, 5000, 5000, 5000, 5000,
    ];
    const pattern = [
      true, true, true, true, true,
      false, false, false, true, false,
    ];
    const points = makeDeterministicPoints(pattern.length, pattern, rtPattern);

    const alert = checkFatigue(points);

    expect(alert.detected).toBe(true);
    expect(alert.message).toContain('accuracy');
    expect(alert.message).toContain('response times');
  });

  it('returns no alert when performance is stable', () => {
    // Baseline: 4/5 correct (80%), Recent: 4/5 correct (80%)
    // Same RT throughout
    const pattern = [
      true, true, true, true, false,
      true, true, true, true, false,
    ];
    const rtPattern = Array(10).fill(3000);
    const points = makeDeterministicPoints(pattern.length, pattern, rtPattern);

    const alert = checkFatigue(points);

    expect(alert.detected).toBe(false);
    expect(alert.accuracyDropPct).toBe(0);
    expect(alert.responseTimeIncreasePct).toBe(0);
  });

  it('returns no alert when accuracy improves', () => {
    // Baseline: 2/5 correct (40%), Recent: 5/5 correct (100%)
    const pattern = [
      false, false, true, false, true,
      true, true, true, true, true,
    ];
    const rtPattern = Array(10).fill(3000);
    const points = makeDeterministicPoints(pattern.length, pattern, rtPattern);

    const alert = checkFatigue(points);

    expect(alert.detected).toBe(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

// ─── getPhaseRemainingMs ─────────────────────────────────────────────────────

describe('getPhaseRemainingMs', () => {
  it('returns full duration at phase start', () => {
    const now = Date.now();
    const session = createTestSession({ phase: 'work', phaseStartedAt: now });

    expect(getPhaseRemainingMs(session)).toBeCloseTo(DEFAULT_WORK_MS, -3);
  });

  it('returns 0 after duration elapsed', () => {
    const session = createTestSession({
      phase: 'work',
      phaseStartedAt: Date.now() - DEFAULT_WORK_MS - 1000,
    });

    expect(getPhaseRemainingMs(session)).toBe(0);
  });

  it('uses break duration during break phase', () => {
    const now = Date.now();
    const session = createTestSession({ phase: 'break', phaseStartedAt: now });

    expect(getPhaseRemainingMs(session)).toBe(DEFAULT_BREAK_MS);
  });
});

// ─── getPhaseProgress ────────────────────────────────────────────────────────

describe('getPhaseProgress', () => {
  it('returns ~0 at phase start', () => {
    const now = Date.now();
    const session = createTestSession({ phase: 'work', phaseStartedAt: now });

    expect(getPhaseProgress(session)).toBeLessThan(0.01);
  });

  it('returns ~0.5 at halfway point', () => {
    const halfWork = DEFAULT_WORK_MS / 2;
    const session = createTestSession({
      phase: 'work',
      phaseStartedAt: Date.now() - halfWork,
    });

    const progress = getPhaseProgress(session);
    expect(progress).toBeGreaterThan(0.45);
    expect(progress).toBeLessThan(0.55);
  });

  it('returns 1 when phase is complete', () => {
    const session = createTestSession({
      phase: 'work',
      phaseStartedAt: Date.now() - DEFAULT_WORK_MS - 1000,
    });

    expect(getPhaseProgress(session)).toBe(1);
  });
});

// ─── Session Summary ─────────────────────────────────────────────────────────

describe('Session Summary', () => {
  it('calculates retention estimate', () => {
    const points = makeDeterministicPoints(
      10,
      [true, true, true, true, true, true, true, true, true, true],
      Array(10).fill(3000),
    );
    const session = createTestSession({
      totalWorkMs: 30 * 60 * 1000,
      dataPoints: points,
      workBlocksCompleted: 1,
    });

    const { summary } = completeSession(session);

    expect(summary.retentionEstimate).toBeGreaterThan(0.5);
    expect(summary.retentionEstimate).toBeLessThanOrEqual(1);
  });

  it('tracks fatigue alerts in summary', () => {
    const points = makeDeterministicPoints(
      10,
      [true, true, true, true, true, false, false, false, true, false],
      Array(10).fill(3000),
    );
    const session = createTestSession({
      dataPoints: points,
    });

    const { fatigueAlert } = recordAnswer(session, {
      responseTimeMs: 3000,
      wasCorrect: false,
      timestamp: Date.now(),
    });

    expect(fatigueAlert.detected).toBe(true);
  });

  it('returns low retention for short sessions with few questions', () => {
    const session = createTestSession({
      totalWorkMs: 5 * 60 * 1000,
      workBlocksCompleted: 0,
    });

    const { summary } = completeSession(session);

    expect(summary.questionsAnswered).toBe(0);
    expect(summary.retentionEstimate).toBe(0);
  });
});
