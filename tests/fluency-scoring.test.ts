import { describe, it, expect } from 'vitest';
import {
  calculateFluency,
  initFluencyTracker,
  updateFluencyTracker,
  analyzeSessionFluency,
  serializeFluency,
  type FluencyInput,
  type ResponseFluency,
} from '../lib/fluency-scoring';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A "flow" input: fast + stable + no switches + par time around 0.7x */
const FLOW_INPUT: FluencyInput = {
  latencyMs: 7000,
  parTimeMs: 10000,
  answerSwitches: 0,
  previousLatencies: [6800, 7000, 7100, 6900, 7200],
  trajectory: { efficiency: 0.95, hesitationIndex: 0.1, jitterScore: 0.1 },
};

/** A "frustrated" input: very slow with many switches */
const FRUSTRATED_INPUT: FluencyInput = {
  latencyMs: 30000,
  parTimeMs: 10000,
  answerSwitches: 5,
};

/** A "disengaged" input: way too fast */
const DISENGAGED_INPUT: FluencyInput = {
  latencyMs: 1500,
  parTimeMs: 10000,
  answerSwitches: 0,
};

// ─── calculateFluency — state classification ────────────────────────────────

describe('calculateFluency — state classification', () => {
  it('classifies as "flow" when all signals are clean and fast', () => {
    const result = calculateFluency(FLOW_INPUT);
    expect(result.state).toBe('flow');
    expect(result.score).toBeGreaterThanOrEqual(0.75);
  });

  it('classifies as "frustrated" when latency ratio exceeds 2.0', () => {
    // 30000/10000 = 3.0 → frustrated
    const result = calculateFluency(FRUSTRATED_INPUT);
    expect(result.state).toBe('frustrated');
  });

  it('classifies as "disengaged" when too-fast and low engagement score', () => {
    // 1500/10000 = 0.15 < MIN_ENGAGED_RATIO (0.3)
    const result = calculateFluency(DISENGAGED_INPUT);
    expect(result.state).toBe('disengaged');
  });

  it('classifies as "labored" when latency ratio > 1.2 but <= 2.0', () => {
    const result = calculateFluency({
      latencyMs: 15000,
      parTimeMs: 10000,
      answerSwitches: 0,
    });
    expect(result.state).toBe('labored');
  });

  it('classifies as "engaged" in the moderate zone', () => {
    const result = calculateFluency({
      latencyMs: 9000,
      parTimeMs: 10000,
      answerSwitches: 0,
    });
    // Ratio 0.9, no history, no trajectory — score in engaged range
    expect(['engaged', 'flow']).toContain(result.state);
  });
});

// ─── calculateFluency — score bounds ────────────────────────────────────────

describe('calculateFluency — score bounds', () => {
  it('produces score between 0 and 1', () => {
    const result = calculateFluency(FLOW_INPUT);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('rounds score to 2 decimal places', () => {
    const result = calculateFluency(FLOW_INPUT);
    const str = result.score.toString();
    const afterDecimal = str.includes('.') ? str.split('.')[1] : '';
    expect(afterDecimal.length).toBeLessThanOrEqual(2);
  });
});

// ─── calculateFluency — confidence scaling ──────────────────────────────────

describe('calculateFluency — confidence scaling', () => {
  it('starts at 0.7 confidence with minimal data', () => {
    const result = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 0,
    });
    expect(result.confidence).toBeCloseTo(0.7, 2);
  });

  it('increases by 0.15 when previousLatencies >= 5', () => {
    const result = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 0,
      previousLatencies: [6500, 7000, 7200, 6800, 7100],
    });
    expect(result.confidence).toBeCloseTo(0.85, 2);
  });

  it('increases by 0.15 when trajectory data is present', () => {
    const result = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 0,
      trajectory: { efficiency: 0.9, hesitationIndex: 0.1, jitterScore: 0.1 },
    });
    expect(result.confidence).toBeCloseTo(0.85, 2);
  });

  it('caps at 1.0 when all signals present', () => {
    const result = calculateFluency(FLOW_INPUT);
    expect(result.confidence).toBe(1);
  });
});

// ─── Components ─────────────────────────────────────────────────────────────

describe('calculateFluency — components', () => {
  it('penalizes answer switches in deletionScore', () => {
    const noSwitches = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 0,
    });
    const manySwitches = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 3,
    });
    expect(manySwitches.components.deletionScore).toBeLessThan(noSwitches.components.deletionScore);
  });

  it('gives high pauseScore for fast-but-engaged responses (0.3-0.7 ratio)', () => {
    const result = calculateFluency({
      latencyMs: 5000,
      parTimeMs: 10000,
      answerSwitches: 0,
    });
    expect(result.components.pauseScore).toBeCloseTo(0.9, 2);
  });

  it('gives low pauseScore for very slow responses (ratio >= 2.0)', () => {
    const result = calculateFluency({
      latencyMs: 25000,
      parTimeMs: 10000,
      answerSwitches: 0,
    });
    expect(result.components.pauseScore).toBeLessThanOrEqual(0.1);
  });

  it('uses default stability (0.5) when previousLatencies < 3', () => {
    const result = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 0,
      previousLatencies: [7000],
    });
    expect(result.components.stabilityScore).toBeCloseTo(0.5, 2);
  });

  it('rewards low-variance history with high stabilityScore', () => {
    const result = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 0,
      previousLatencies: [7000, 7000, 7000, 7000, 7000], // zero variance
    });
    expect(result.components.stabilityScore).toBe(1.0);
  });
});

// ─── Trajectory scoring ─────────────────────────────────────────────────────

describe('calculateFluency — trajectory', () => {
  it('computes trajectory score as weighted blend', () => {
    // trajectoryScore = 0.5*eff + 0.3*(1-hes) + 0.2*(1-jit)
    // = 0.5*1.0 + 0.3*1.0 + 0.2*1.0 = 1.0
    const result = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 0,
      trajectory: { efficiency: 1.0, hesitationIndex: 0, jitterScore: 0 },
    });
    expect(result.components.trajectoryScore).toBeCloseTo(1.0, 2);
  });

  it('uses default trajectory score (0.5) when trajectory data missing', () => {
    const result = calculateFluency({
      latencyMs: 7000,
      parTimeMs: 10000,
      answerSwitches: 0,
    });
    expect(result.components.trajectoryScore).toBeCloseTo(0.5, 2);
  });
});

// ─── initFluencyTracker ─────────────────────────────────────────────────────

describe('initFluencyTracker', () => {
  it('returns a tracker with empty latencies and zero state times', () => {
    const tracker = initFluencyTracker();
    expect(tracker.latencies).toHaveLength(0);
    expect(tracker.scores).toHaveLength(0);
    expect(tracker.stateTransitions).toBe(0);
    expect(tracker.currentState).toBe('engaged');
    expect(tracker.stateTime.flow).toBe(0);
    expect(tracker.stateTime.engaged).toBe(0);
  });
});

// ─── updateFluencyTracker ───────────────────────────────────────────────────

describe('updateFluencyTracker', () => {
  it('counts a state transition when state changes', () => {
    const tracker = initFluencyTracker(); // engaged
    const flowFluency = calculateFluency(FLOW_INPUT);
    const updated = updateFluencyTracker(tracker, flowFluency, Date.now() + 1000);
    expect(updated.currentState).toBe('flow');
    expect(updated.stateTransitions).toBe(1);
  });

  it('does NOT count transition when state stays the same', () => {
    const tracker = { ...initFluencyTracker(), currentState: 'flow' as const };
    const flowFluency = calculateFluency(FLOW_INPUT);
    const updated = updateFluencyTracker(tracker, flowFluency, Date.now() + 1000);
    expect(updated.stateTransitions).toBe(0);
  });

  it('keeps at most last 20 entries in latencies/scores', () => {
    let tracker = initFluencyTracker();
    const fluency = calculateFluency(FLOW_INPUT);
    for (let i = 0; i < 25; i++) {
      tracker = updateFluencyTracker(tracker, fluency, Date.now() + i);
    }
    expect(tracker.latencies.length).toBeLessThanOrEqual(20);
    expect(tracker.scores.length).toBeLessThanOrEqual(20);
  });

  it('accumulates state time for the previous state', () => {
    const tracker = initFluencyTracker();
    const fluency = calculateFluency(FLOW_INPUT);
    const startTime = tracker.lastTimestamp;
    const updated = updateFluencyTracker(tracker, fluency, startTime + 5000);
    // 5000ms was spent in "engaged" (the previous currentState)
    expect(updated.stateTime.engaged).toBe(5000);
  });
});

// ─── analyzeSessionFluency ──────────────────────────────────────────────────

describe('analyzeSessionFluency', () => {
  it('returns default avgFluency 0.5 for empty tracker', () => {
    const tracker = initFluencyTracker();
    const analysis = analyzeSessionFluency(tracker);
    expect(analysis.avgFluency).toBe(0.5);
    expect(analysis.flowPercentage).toBe(0);
  });

  it('recommends break when dominant state is frustrated', () => {
    const tracker = initFluencyTracker();
    tracker.stateTime.frustrated = 60000;
    tracker.stateTime.engaged = 10000;
    const analysis = analyzeSessionFluency(tracker);
    expect(analysis.dominantState).toBe('frustrated');
    expect(analysis.recommendation.toLowerCase()).toContain('break');
  });

  it('praises flow when flowPercentage >= 50', () => {
    const tracker = initFluencyTracker();
    tracker.stateTime.flow = 70000;
    tracker.stateTime.engaged = 30000;
    const analysis = analyzeSessionFluency(tracker);
    expect(analysis.flowPercentage).toBeGreaterThanOrEqual(50);
    expect(analysis.recommendation.toLowerCase()).toContain('flow');
  });

  it('suggests increasing difficulty when dominant state is disengaged', () => {
    const tracker = initFluencyTracker();
    tracker.stateTime.disengaged = 60000;
    tracker.stateTime.engaged = 10000;
    const analysis = analyzeSessionFluency(tracker);
    expect(analysis.dominantState).toBe('disengaged');
    expect(analysis.recommendation.toLowerCase()).toMatch(/increase|challenge/);
  });

  it('detects improving trend when second half averages > first half + 0.1', () => {
    const tracker = initFluencyTracker();
    // 10 scores: first 5 at 0.3, last 5 at 0.8
    tracker.scores = [0.3, 0.3, 0.3, 0.3, 0.3, 0.8, 0.8, 0.8, 0.8, 0.8];
    const analysis = analyzeSessionFluency(tracker);
    expect(analysis.stabilityTrend).toBe('improving');
  });

  it('detects declining trend when first half averages > second half + 0.1', () => {
    const tracker = initFluencyTracker();
    tracker.scores = [0.9, 0.9, 0.9, 0.9, 0.9, 0.4, 0.4, 0.4, 0.4, 0.4];
    const analysis = analyzeSessionFluency(tracker);
    expect(analysis.stabilityTrend).toBe('declining');
  });

  it('reports stable trend when fewer than 10 scores', () => {
    const tracker = initFluencyTracker();
    tracker.scores = [0.9, 0.2];
    const analysis = analyzeSessionFluency(tracker);
    expect(analysis.stabilityTrend).toBe('stable');
  });
});

// ─── serializeFluency ───────────────────────────────────────────────────────

describe('serializeFluency', () => {
  it('produces a flat object with expected keys', () => {
    const fluency: ResponseFluency = {
      score: 0.85,
      state: 'flow',
      components: {
        stabilityScore: 0.9,
        deletionScore: 1.0,
        pauseScore: 0.9,
        trajectoryScore: 0.8,
        engagementScore: 0.95,
      },
      confidence: 1.0,
    };
    const serialized = serializeFluency(fluency);
    expect(serialized.score).toBe(0.85);
    expect(serialized.state).toBe('flow');
    expect(serialized.stability).toBe(0.9);
    expect(serialized.engagement).toBe(0.95);
    expect(serialized.confidence).toBe(1.0);
  });
});
