// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/fluency-scoring.ts — deterministic paths only
 *
 * Functions tested:
 *   calculateFluency(input)            — score, state, components, confidence
 *   initFluencyTracker()               — structure only (lastTimestamp uses Date.now — untested)
 *   updateFluencyTracker(t, f, ts)     — explicit timestamp → deterministic
 *   analyzeSessionFluency(tracker)     — avgFluency, dominantState, flowPercentage, trend
 *
 * Key thresholds:
 *   MIN_ENGAGED_RATIO = 0.3   (below → disengaged, pauseScore=0.3)
 *   MAX_FLUENT_RATIO  = 1.2   (above → labored)
 *   FRUSTRATED_RATIO  = 2.0   (above → frustrated)
 *   MAX_SWITCHES_FLUENT = 1   (answerSwitches > 1 combined with slow → labored)
 *   flow requires score >= 0.75 AND stabilityScore >= 0.6
 *
 * Weights: stability=0.2, deletion=0.15, pause=0.25, trajectory=0.2, engagement=0.2
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFluency,
  initFluencyTracker,
  updateFluencyTracker,
  analyzeSessionFluency,
} from './fluency-scoring';
import type { SessionFluencyTracker } from './fluency-scoring';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base(overrides: Partial<Parameters<typeof calculateFluency>[0]> = {}) {
  return {
    latencyMs: 800,    // latencyRatio = 0.8 (moderate)
    parTimeMs: 1000,
    answerSwitches: 0,
    ...overrides,
  };
}

// A perfectly stable previous-latency array (all same value → CV=0 → stability=1.0)
const STABLE_LATENCIES = Array(5).fill(1000);

// ─── calculateFluency — state classification ──────────────────────────────────

describe('calculateFluency — state', () => {
  it('returns "disengaged" for very fast response (latencyRatio < 0.3)', () => {
    const result = calculateFluency(base({ latencyMs: 200 })); // ratio=0.2
    expect(result.state).toBe('disengaged');
  });

  it('returns "frustrated" for very slow response (latencyRatio > 2.0)', () => {
    const result = calculateFluency(base({ latencyMs: 2100 })); // ratio=2.1
    expect(result.state).toBe('frustrated');
  });

  it('returns "labored" for slow response (1.2 < ratio ≤ 2.0)', () => {
    const result = calculateFluency(base({ latencyMs: 1500 })); // ratio=1.5
    expect(result.state).toBe('labored');
  });

  it('returns "flow" for fast stable response (score ≥ 0.75 AND stabilityScore ≥ 0.6)', () => {
    const result = calculateFluency(base({
      latencyMs: 500,            // ratio=0.5 → pauseScore=0.9
      previousLatencies: STABLE_LATENCIES,  // CV=0 → stabilityScore=1.0
    }));
    expect(result.state).toBe('flow');
  });

  it('returns "engaged" for moderate latency without enough stability for flow', () => {
    // latencyRatio=0.8, no history → stabilityScore=0.5 → doesn't meet flow threshold
    const result = calculateFluency(base());
    expect(result.state).toBe('engaged');
  });
});

// ─── calculateFluency — score and components ─────────────────────────────────

describe('calculateFluency — score and components', () => {
  it('score is in [0, 1]', () => {
    const cases = [
      base({ latencyMs: 100 }),
      base({ latencyMs: 800 }),
      base({ latencyMs: 3000 }),
      base({ latencyMs: 500, answerSwitches: 5 }),
    ];
    for (const c of cases) {
      const { score } = calculateFluency(c);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('deletionScore = 1.0 for answerSwitches=0', () => {
    const { components } = calculateFluency(base({ answerSwitches: 0 }));
    expect(components.deletionScore).toBe(1.0);
  });

  it('deletionScore = 0.75 for answerSwitches=1', () => {
    const { components } = calculateFluency(base({ answerSwitches: 1 }));
    expect(components.deletionScore).toBeCloseTo(0.75, 2);
  });

  it('deletionScore = 0 for answerSwitches >= 4', () => {
    const { components } = calculateFluency(base({ answerSwitches: 4 }));
    expect(components.deletionScore).toBe(0);
  });

  it('pauseScore = 0.9 for latencyRatio in (0.3, 0.7)', () => {
    const { components } = calculateFluency(base({ latencyMs: 500 })); // ratio=0.5
    expect(components.pauseScore).toBe(0.9);
  });

  it('pauseScore = 0.8 for latencyRatio in [0.7, 1.0)', () => {
    const { components } = calculateFluency(base({ latencyMs: 800 })); // ratio=0.8
    expect(components.pauseScore).toBe(0.8);
  });

  it('pauseScore = 0.3 for latencyRatio < 0.3 (too fast)', () => {
    const { components } = calculateFluency(base({ latencyMs: 200 })); // ratio=0.2
    expect(components.pauseScore).toBe(0.3);
  });

  it('pauseScore = 0.1 for latencyRatio >= 2.0 (very slow)', () => {
    const { components } = calculateFluency(base({ latencyMs: 2500 })); // ratio=2.5
    expect(components.pauseScore).toBe(0.1);
  });

  it('stabilityScore = 0.5 when no previousLatencies provided', () => {
    const { components } = calculateFluency(base());
    expect(components.stabilityScore).toBe(0.5);
  });

  it('stabilityScore = 1.0 for perfectly uniform previousLatencies (CV=0)', () => {
    const { components } = calculateFluency(base({ previousLatencies: STABLE_LATENCIES }));
    expect(components.stabilityScore).toBe(1.0);
  });

  it('trajectoryScore = 0.5 when trajectory not provided', () => {
    const { components } = calculateFluency(base());
    expect(components.trajectoryScore).toBe(0.5);
  });

  it('trajectoryScore computed from trajectory input: efficiency=1, hesitation=0, jitter=0', () => {
    const { components } = calculateFluency(base({
      trajectory: { efficiency: 1.0, hesitationIndex: 0.0, jitterScore: 0.0 },
    }));
    // 0.5*1.0 + 0.3*(1-0) + 0.2*(1-0) = 0.5+0.3+0.2 = 1.0
    expect(components.trajectoryScore).toBeCloseTo(1.0, 5);
  });
});

// ─── calculateFluency — confidence ───────────────────────────────────────────

describe('calculateFluency — confidence', () => {
  it('base confidence is 0.7 with no history and no trajectory', () => {
    expect(calculateFluency(base()).confidence).toBe(0.7);
  });

  it('confidence += 0.15 when previousLatencies.length >= 5', () => {
    const result = calculateFluency(base({ previousLatencies: STABLE_LATENCIES }));
    expect(result.confidence).toBeCloseTo(0.85, 5);
  });

  it('confidence += 0.15 when trajectory provided', () => {
    const result = calculateFluency(base({
      trajectory: { efficiency: 0.8, hesitationIndex: 0.1, jitterScore: 0.1 },
    }));
    expect(result.confidence).toBeCloseTo(0.85, 5);
  });

  it('confidence capped at 1.0 with both history and trajectory', () => {
    const result = calculateFluency(base({
      previousLatencies: STABLE_LATENCIES,
      trajectory: { efficiency: 0.8, hesitationIndex: 0.1, jitterScore: 0.1 },
    }));
    expect(result.confidence).toBe(1.0);
  });
});

// ─── initFluencyTracker ───────────────────────────────────────────────────────

describe('initFluencyTracker', () => {
  it('initializes with empty latencies and scores arrays', () => {
    const tracker = initFluencyTracker();
    expect(tracker.latencies).toHaveLength(0);
    expect(tracker.scores).toHaveLength(0);
  });

  it('initializes stateTransitions to 0 and currentState to "engaged"', () => {
    const tracker = initFluencyTracker();
    expect(tracker.stateTransitions).toBe(0);
    expect(tracker.currentState).toBe('engaged');
  });

  it('initializes all stateTime values to 0', () => {
    const tracker = initFluencyTracker();
    for (const v of Object.values(tracker.stateTime)) {
      expect(v).toBe(0);
    }
  });

  it('has all required state keys in stateTime', () => {
    const tracker = initFluencyTracker();
    expect('flow' in tracker.stateTime).toBe(true);
    expect('engaged' in tracker.stateTime).toBe(true);
    expect('labored' in tracker.stateTime).toBe(true);
    expect('frustrated' in tracker.stateTime).toBe(true);
    expect('disengaged' in tracker.stateTime).toBe(true);
  });
});

// ─── updateFluencyTracker ─────────────────────────────────────────────────────

describe('updateFluencyTracker', () => {
  function makeTracker(overrides: Partial<SessionFluencyTracker> = {}): SessionFluencyTracker {
    return {
      latencies: [],
      scores: [],
      stateTransitions: 0,
      currentState: 'engaged',
      stateTime: { flow: 0, engaged: 0, labored: 0, frustrated: 0, disengaged: 0 },
      lastTimestamp: 1000,
      ...overrides,
    };
  }

  it('increments stateTransitions when state changes', () => {
    const tracker = makeTracker({ currentState: 'engaged' });
    const fluency = calculateFluency(base({ latencyMs: 200 })); // state='disengaged'
    const updated = updateFluencyTracker(tracker, fluency, 2000);
    expect(updated.stateTransitions).toBe(1);
  });

  it('does not increment stateTransitions when state stays the same', () => {
    const tracker = makeTracker({ currentState: 'engaged' });
    const fluency = calculateFluency(base()); // state='engaged'
    const updated = updateFluencyTracker(tracker, fluency, 2000);
    expect(updated.stateTransitions).toBe(0);
  });

  it('accumulates state time based on elapsed duration', () => {
    const tracker = makeTracker({ currentState: 'engaged', lastTimestamp: 0 });
    const fluency = calculateFluency(base({ latencyMs: 200 })); // transitions away from engaged
    const updated = updateFluencyTracker(tracker, fluency, 5000); // 5000ms elapsed
    // Previous state ('engaged') gets the elapsed time
    expect(updated.stateTime.engaged).toBe(5000);
  });

  it('updates currentState to the new fluency state', () => {
    const tracker = makeTracker({ currentState: 'engaged', lastTimestamp: 0 });
    const fluency = calculateFluency(base({ latencyMs: 2100 })); // 'frustrated'
    const updated = updateFluencyTracker(tracker, fluency, 1000);
    expect(updated.currentState).toBe('frustrated');
  });

  it('appends the new score', () => {
    const tracker = makeTracker();
    const fluency = calculateFluency(base());
    const updated = updateFluencyTracker(tracker, fluency, 2000);
    expect(updated.scores).toHaveLength(1);
    expect(updated.scores[0]).toBe(fluency.score);
  });

  it('keeps only last 20 scores', () => {
    const tracker = makeTracker({ scores: Array(20).fill(0.5), lastTimestamp: 0 });
    const fluency = calculateFluency(base());
    const updated = updateFluencyTracker(tracker, fluency, 1000);
    expect(updated.scores).toHaveLength(20);
  });

  it('sets lastTimestamp to the provided timestamp', () => {
    const tracker = makeTracker({ lastTimestamp: 0 });
    const fluency = calculateFluency(base());
    const updated = updateFluencyTracker(tracker, fluency, 99999);
    expect(updated.lastTimestamp).toBe(99999);
  });
});

// ─── analyzeSessionFluency ────────────────────────────────────────────────────

describe('analyzeSessionFluency', () => {
  function makeTracker(overrides: Partial<SessionFluencyTracker> = {}): SessionFluencyTracker {
    return {
      latencies: [],
      scores: [],
      stateTransitions: 0,
      currentState: 'engaged',
      stateTime: { flow: 0, engaged: 0, labored: 0, frustrated: 0, disengaged: 0 },
      lastTimestamp: 0,
      ...overrides,
    };
  }

  it('returns avgFluency=0.5 for empty scores', () => {
    const result = analyzeSessionFluency(makeTracker());
    expect(result.avgFluency).toBe(0.5);
  });

  it('avgFluency is the mean of scores array', () => {
    const result = analyzeSessionFluency(makeTracker({ scores: [0.4, 0.6, 0.8] }));
    expect(result.avgFluency).toBeCloseTo(0.6, 5);
  });

  it('dominantState is the state with most time', () => {
    const result = analyzeSessionFluency(makeTracker({
      stateTime: { flow: 200, engaged: 50, labored: 0, frustrated: 0, disengaged: 0 },
    }));
    expect(result.dominantState).toBe('flow');
  });

  it('flowPercentage = 0 when no time spent in flow', () => {
    const result = analyzeSessionFluency(makeTracker({
      stateTime: { flow: 0, engaged: 100, labored: 0, frustrated: 0, disengaged: 0 },
    }));
    expect(result.flowPercentage).toBe(0);
  });

  it('flowPercentage = 50 when half the time is in flow', () => {
    const result = analyzeSessionFluency(makeTracker({
      stateTime: { flow: 100, engaged: 100, labored: 0, frustrated: 0, disengaged: 0 },
    }));
    expect(result.flowPercentage).toBe(50);
  });

  it('stabilityTrend = "stable" when fewer than 10 scores', () => {
    const result = analyzeSessionFluency(makeTracker({ scores: [0.5, 0.6, 0.7] }));
    expect(result.stabilityTrend).toBe('stable');
  });

  it('stabilityTrend = "improving" when second half scores > first half by > 0.1', () => {
    const firstHalf = Array(5).fill(0.4);
    const secondHalf = Array(5).fill(0.6); // delta = 0.2 > 0.1
    const result = analyzeSessionFluency(makeTracker({ scores: [...firstHalf, ...secondHalf] }));
    expect(result.stabilityTrend).toBe('improving');
  });

  it('stabilityTrend = "declining" when first half scores > second half by > 0.1', () => {
    const firstHalf = Array(5).fill(0.7);
    const secondHalf = Array(5).fill(0.5); // delta = 0.2 > 0.1
    const result = analyzeSessionFluency(makeTracker({ scores: [...firstHalf, ...secondHalf] }));
    expect(result.stabilityTrend).toBe('declining');
  });

  it('recommendation mentions flow when flowPercentage >= 50', () => {
    const result = analyzeSessionFluency(makeTracker({
      stateTime: { flow: 100, engaged: 50, labored: 0, frustrated: 0, disengaged: 0 },
    }));
    expect(result.recommendation).toContain('flow');
  });

  it('recommendation mentions disengaged when dominant state is disengaged', () => {
    const result = analyzeSessionFluency(makeTracker({
      stateTime: { flow: 0, engaged: 0, labored: 0, frustrated: 0, disengaged: 100 },
    }));
    expect(result.recommendation.toLowerCase()).toContain('challeng');
  });

  it('returns recommendation as a non-empty string', () => {
    const result = analyzeSessionFluency(makeTracker());
    expect(typeof result.recommendation).toBe('string');
    expect(result.recommendation.length).toBeGreaterThan(0);
  });
});
