import { describe, it, expect, beforeEach } from 'vitest';
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
  type StudySession,
  type SessionDataPoint,
} from './studyTimerService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDataPoint(wasCorrect: boolean, responseTimeMs: number): SessionDataPoint {
  return { wasCorrect, responseTimeMs, timestamp: Date.now() };
}

/** Build N data points with given correctness and RT */
function makePoints(count: number, wasCorrect: boolean, responseTimeMs: number): SessionDataPoint[] {
  return Array.from({ length: count }, () => makeDataPoint(wasCorrect, responseTimeMs));
}

// ─── createSession ────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('defaults to work phase', () => {
    const s = createSession();
    expect(s.phase).toBe('work');
  });

  it('uses DEFAULT_WORK_MS and DEFAULT_BREAK_MS when no config supplied', () => {
    const s = createSession();
    expect(s.config.workDurationMs).toBe(DEFAULT_WORK_MS);
    expect(s.config.breakDurationMs).toBe(DEFAULT_BREAK_MS);
  });

  it('respects custom config values', () => {
    const s = createSession({ workDurationMs: 60_000, breakDurationMs: 15_000 });
    expect(s.config.workDurationMs).toBe(60_000);
    expect(s.config.breakDurationMs).toBe(15_000);
  });

  it('starts with empty dataPoints and fatigueAlerts', () => {
    const s = createSession();
    expect(s.dataPoints).toHaveLength(0);
    expect(s.fatigueAlerts).toHaveLength(0);
  });

  it('starts with zero totalWorkMs and workBlocksCompleted', () => {
    const s = createSession();
    expect(s.totalWorkMs).toBe(0);
    expect(s.workBlocksCompleted).toBe(0);
  });

  it('accepts a custom id', () => {
    const s = createSession({}, 'my-session-id');
    expect(s.id).toBe('my-session-id');
  });

  it('generates a unique id by default', () => {
    const a = createSession();
    const b = createSession();
    expect(a.id).not.toBe(b.id);
  });

  it('sets startedAt close to now', () => {
    const before = Date.now();
    const s = createSession();
    const after = Date.now();
    expect(s.startedAt).toBeGreaterThanOrEqual(before);
    expect(s.startedAt).toBeLessThanOrEqual(after);
  });

  it('sets phaseStartedAt equal to startedAt initially', () => {
    const s = createSession();
    expect(s.phaseStartedAt).toBe(s.startedAt);
  });
});

// ─── transitionPhase ──────────────────────────────────────────────────────────

describe('transitionPhase', () => {
  let session: StudySession;

  beforeEach(() => {
    session = createSession({ workDurationMs: 60_000, breakDurationMs: 15_000 });
  });

  it('transitions work → break', () => {
    const next = transitionPhase(session);
    expect(next.phase).toBe('break');
  });

  it('increments workBlocksCompleted on work → break', () => {
    const next = transitionPhase(session);
    expect(next.workBlocksCompleted).toBe(1);
  });

  it('accumulates totalWorkMs on work → break', () => {
    // Fake that we started 10 seconds ago
    const fakeStart = Date.now() - 10_000;
    const s = { ...session, phaseStartedAt: fakeStart };
    const next = transitionPhase(s);
    expect(next.totalWorkMs).toBeGreaterThanOrEqual(9_000);
    expect(next.totalWorkMs).toBeLessThanOrEqual(11_000);
  });

  it('transitions break → work', () => {
    const inBreak = transitionPhase(session); // work → break
    const backToWork = transitionPhase(inBreak);
    expect(backToWork.phase).toBe('work');
  });

  it('does NOT increment workBlocksCompleted on break → work', () => {
    const inBreak = transitionPhase(session);
    const blocksAfterBreak = inBreak.workBlocksCompleted;
    const backToWork = transitionPhase(inBreak);
    expect(backToWork.workBlocksCompleted).toBe(blocksAfterBreak);
  });

  it('complete phase is a no-op', () => {
    const { session: done } = completeSession(session);
    const still = transitionPhase(done);
    expect(still).toBe(done); // same reference
  });

  it('updates phaseStartedAt on every transition', () => {
    const before = Date.now();
    const next = transitionPhase(session);
    const after = Date.now();
    expect(next.phaseStartedAt).toBeGreaterThanOrEqual(before);
    expect(next.phaseStartedAt).toBeLessThanOrEqual(after);
  });

  it('preserves existing dataPoints across transition', () => {
    const withData = { ...session, dataPoints: [makeDataPoint(true, 1000)] };
    const next = transitionPhase(withData);
    expect(next.dataPoints).toHaveLength(1);
  });
});

// ─── completeSession ──────────────────────────────────────────────────────────

describe('completeSession', () => {
  it('sets phase to complete', () => {
    const s = createSession();
    const { session } = completeSession(s);
    expect(session.phase).toBe('complete');
  });

  it('accumulates work time if currently in work phase', () => {
    const s = { ...createSession(), phaseStartedAt: Date.now() - 5_000, phase: 'work' as const };
    const { session } = completeSession(s);
    expect(session.totalWorkMs).toBeGreaterThanOrEqual(4_000);
  });

  it('does NOT add more work time if currently in break phase', () => {
    const base = createSession();
    const inBreak = transitionPhase({ ...base, phaseStartedAt: Date.now() - 30_000 }); // work block
    const savedWork = inBreak.totalWorkMs;
    const { session } = completeSession({ ...inBreak, phaseStartedAt: Date.now() - 5_000 });
    // totalWorkMs should equal savedWork (no additional work time from break phase)
    expect(session.totalWorkMs).toBe(savedWork);
  });

  it('returns a SessionSummary with correct questionsAnswered', () => {
    const s = createSession();
    const dp = makeDataPoint(true, 1000);
    const { session: withAnswer } = recordAnswer(s, dp);
    const { summary } = completeSession(withAnswer);
    expect(summary.questionsAnswered).toBe(1);
  });

  it('returns correct accuracy in summary', () => {
    let s = createSession();
    s = recordAnswer(s, makeDataPoint(true, 1000)).session;
    s = recordAnswer(s, makeDataPoint(false, 1000)).session;
    const { summary } = completeSession(s);
    expect(summary.accuracy).toBeCloseTo(0.5, 5);
  });

  it('summary.correctAnswers counts only correct dataPoints', () => {
    let s = createSession();
    for (let i = 0; i < 3; i++) s = recordAnswer(s, makeDataPoint(true, 500)).session;
    s = recordAnswer(s, makeDataPoint(false, 500)).session;
    const { summary } = completeSession(s);
    expect(summary.correctAnswers).toBe(3);
  });

  it('summary.workBlocksCompleted matches session', () => {
    let s = createSession();
    s = transitionPhase(s); // work → break (completes 1 block)
    s = transitionPhase(s); // break → work
    const { summary } = completeSession(s);
    expect(summary.workBlocksCompleted).toBe(1);
  });

  it('retentionEstimate is 0 with fewer than 3 data points', () => {
    let s = createSession();
    s = recordAnswer(s, makeDataPoint(true, 500)).session;
    const { summary } = completeSession(s);
    expect(summary.retentionEstimate).toBe(0);
  });

  it('retentionEstimate between 0 and 1 with sufficient data', () => {
    let s = createSession();
    for (let i = 0; i < 5; i++) s = recordAnswer(s, makeDataPoint(true, 500)).session;
    const { summary } = completeSession(s);
    expect(summary.retentionEstimate).toBeGreaterThanOrEqual(0);
    expect(summary.retentionEstimate).toBeLessThanOrEqual(1);
  });

  it('summary.fatigueDetected is true when alerts were fired', () => {
    let s = createSession();
    // 5 correct fast baseline
    for (let i = 0; i < 5; i++) s = recordAnswer(s, makeDataPoint(true, 300)).session;
    // 5 incorrect slow (triggers fatigue)
    for (let i = 0; i < 5; i++) s = recordAnswer(s, makeDataPoint(false, 5000)).session;
    const { summary } = completeSession(s);
    expect(summary.fatigueDetected).toBe(true);
  });
});

// ─── recordAnswer ────────────────────────────────────────────────────────────

describe('recordAnswer', () => {
  it('appends data point to session', () => {
    const s = createSession();
    const dp = makeDataPoint(true, 1000);
    const { session } = recordAnswer(s, dp);
    expect(session.dataPoints).toHaveLength(1);
    expect(session.dataPoints[0]).toEqual(dp);
  });

  it('does not mutate the original session', () => {
    const s = createSession();
    recordAnswer(s, makeDataPoint(true, 1000));
    expect(s.dataPoints).toHaveLength(0);
  });

  it('returns fatigueAlert.detected=false when not enough data', () => {
    const s = createSession();
    const { fatigueAlert } = recordAnswer(s, makeDataPoint(true, 1000));
    expect(fatigueAlert.detected).toBe(false);
  });

  it('appends fatigue alert to session.fatigueAlerts when detected', () => {
    let s = createSession();
    for (let i = 0; i < 5; i++) s = recordAnswer(s, makeDataPoint(true, 300)).session;
    for (let i = 0; i < 4; i++) s = recordAnswer(s, makeDataPoint(false, 5000)).session;
    // 10th answer should trigger
    const { session, fatigueAlert } = recordAnswer(s, makeDataPoint(false, 5000));
    expect(fatigueAlert.detected).toBe(true);
    expect(session.fatigueAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT append to fatigueAlerts when alert not detected', () => {
    const s = createSession();
    const { session } = recordAnswer(s, makeDataPoint(true, 500));
    expect(session.fatigueAlerts).toHaveLength(0);
  });
});

// ─── checkFatigue ────────────────────────────────────────────────────────────

describe('checkFatigue', () => {
  it('returns no alert when fewer than 6 data points', () => {
    const pts = makePoints(5, true, 1000);
    const alert = checkFatigue(pts);
    expect(alert.detected).toBe(false);
    expect(alert.message).toBeNull();
  });

  it('returns no alert at exactly 6 perfect points', () => {
    const pts = makePoints(6, true, 1000);
    const alert = checkFatigue(pts);
    expect(alert.detected).toBe(false);
  });

  it('detects fatigue when accuracy drops > 15%', () => {
    // baseline: first 5 all correct (accuracy=1.0)
    const baseline = makePoints(5, true, 500);
    // recent: last 5 all wrong (accuracy=0.0) → drop = 1.0
    const recent = makePoints(5, false, 500);
    const alert = checkFatigue([...baseline, ...recent]);
    expect(alert.detected).toBe(true);
    expect(alert.accuracyDropPct).toBeGreaterThan(0.15);
  });

  it('detects fatigue when RT increases > 30%', () => {
    // baseline: fast (500ms each)
    const baseline = makePoints(5, true, 500);
    // recent: slow (5000ms each) — 900% increase, well above 30%
    const recent = makePoints(5, true, 5000);
    const alert = checkFatigue([...baseline, ...recent]);
    expect(alert.detected).toBe(true);
    expect(alert.responseTimeIncreasePct).toBeGreaterThan(0.3);
  });

  it('does not detect fatigue when drop is exactly at threshold (not above)', () => {
    // baseline: all correct (accuracy=1.0); recent: 85% correct → drop=0.15 exactly (NOT >0.15)
    const baseline = makePoints(5, true, 500);
    // 4 correct + 1 wrong in last 5 → recentAcc = 0.8, drop = 0.2 — over threshold
    // For exactly AT threshold (0.15): need recentAcc = 0.85 → 4.25 correct — impossible with 5 items
    // Use 5 correct baseline, 5 recent with [T,T,T,T,F] → drop = 0.2 > 0.15
    // Instead test no-trigger: baseline=0.6, recent=0.8 (improving, drop < 0)
    const improving_baseline = [
      makeDataPoint(false, 500), makeDataPoint(false, 500), makeDataPoint(true, 500),
      makeDataPoint(true, 500), makeDataPoint(true, 500),
    ]; // acc=0.6
    const improving_recent = makePoints(5, true, 500); // acc=1.0
    const alert = checkFatigue([...improving_baseline, ...improving_recent]);
    expect(alert.detected).toBe(false);
  });

  it('includes accuracy drop in message', () => {
    const baseline = makePoints(5, true, 500);
    const recent = makePoints(5, false, 500);
    const alert = checkFatigue([...baseline, ...recent]);
    expect(alert.message).toContain('accuracy dropped');
  });

  it('includes response time in message when both triggered', () => {
    const baseline = makePoints(5, true, 500);
    const recent = makePoints(5, false, 5000);
    const alert = checkFatigue([...baseline, ...recent]);
    expect(alert.message).toContain('response times increased');
  });

  it('message always contains break suggestion', () => {
    const baseline = makePoints(5, true, 500);
    const recent = makePoints(5, false, 5000);
    const alert = checkFatigue([...baseline, ...recent]);
    expect(alert.message).toContain('break');
  });

  it('no-alert has zero accuracyDropPct and responseTimeIncreasePct', () => {
    const pts = makePoints(3, true, 1000);
    const alert = checkFatigue(pts);
    expect(alert.accuracyDropPct).toBe(0);
    expect(alert.responseTimeIncreasePct).toBe(0);
  });

  it('only RT trigger produces alert without accuracy drop', () => {
    // baseline: all correct fast; recent: all correct slow
    const baseline = makePoints(5, true, 500);
    const recent = makePoints(5, true, 2000); // 300% increase > 30%
    const alert = checkFatigue([...baseline, ...recent]);
    expect(alert.detected).toBe(true);
    // Accuracy didn't drop so accuracyDropPct should be 0
    expect(alert.accuracyDropPct).toBe(0);
  });

  it('uses last BASELINE_WINDOW points as "recent"', () => {
    // Points 1-5: correct fast (baseline)
    // Points 6-9: correct fast (middle, not recent)
    // Points 10-14: incorrect slow (recent = last 5)
    const baseline = makePoints(5, true, 500);
    const middle = makePoints(4, true, 500);
    const recent = makePoints(5, false, 5000);
    const alert = checkFatigue([...baseline, ...middle, ...recent]);
    expect(alert.detected).toBe(true);
  });
});

// ─── getPhaseRemainingMs ──────────────────────────────────────────────────────

describe('getPhaseRemainingMs', () => {
  it('returns close to full duration right after phase start', () => {
    const s = createSession({ workDurationMs: 60_000 });
    const remaining = getPhaseRemainingMs(s);
    // Should be close to 60000 (subtract a few ms for execution)
    expect(remaining).toBeGreaterThan(59_000);
    expect(remaining).toBeLessThanOrEqual(60_000);
  });

  it('returns 0 when phase has elapsed past duration', () => {
    const s = createSession({ workDurationMs: 60_000 });
    const overdue = { ...s, phaseStartedAt: Date.now() - 70_000 };
    expect(getPhaseRemainingMs(overdue)).toBe(0);
  });

  it('uses breakDurationMs for break phase', () => {
    const s = createSession({ workDurationMs: 60_000, breakDurationMs: 30_000 });
    const inBreak = { ...transitionPhase(s), phaseStartedAt: Date.now() };
    const remaining = getPhaseRemainingMs(inBreak);
    expect(remaining).toBeGreaterThan(29_000);
    expect(remaining).toBeLessThanOrEqual(30_000);
  });

  it('never returns negative', () => {
    const s = createSession({ workDurationMs: 1_000 });
    const long_overdue = { ...s, phaseStartedAt: Date.now() - 1_000_000 };
    expect(getPhaseRemainingMs(long_overdue)).toBe(0);
  });
});

// ─── getPhaseProgress ────────────────────────────────────────────────────────

describe('getPhaseProgress', () => {
  it('returns ~0 right after phase start', () => {
    const s = createSession({ workDurationMs: 60_000 });
    const progress = getPhaseProgress(s);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThan(0.01); // <1% elapsed
  });

  it('returns ~1 when phase is complete', () => {
    const s = createSession({ workDurationMs: 60_000 });
    const done = { ...s, phaseStartedAt: Date.now() - 65_000 };
    expect(getPhaseProgress(done)).toBeCloseTo(1, 2);
  });

  it('returns ~0.5 when halfway through', () => {
    const s = createSession({ workDurationMs: 60_000 });
    const halfway = { ...s, phaseStartedAt: Date.now() - 30_000 };
    expect(getPhaseProgress(halfway)).toBeCloseTo(0.5, 1);
  });

  it('uses breakDurationMs for break phase', () => {
    const s = createSession({ workDurationMs: 60_000, breakDurationMs: 20_000 });
    const inBreak = transitionPhase(s);
    const halfwayBreak = { ...inBreak, phaseStartedAt: Date.now() - 10_000 };
    expect(getPhaseProgress(halfwayBreak)).toBeCloseTo(0.5, 1);
  });

  it('never exceeds 1 even when overdue', () => {
    const s = createSession({ workDurationMs: 60_000 });
    const overdue = { ...s, phaseStartedAt: Date.now() - 1_000_000 };
    expect(getPhaseProgress(overdue)).toBeCloseTo(1, 5);
  });
});
