// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/jol-calibration.ts
 *
 * Pure functions tested:
 *   deriveImplicitConfidence(params)      — logistic latency + switch penalty + trajectory blend
 *   initCalibrationTracker()              — zeroed structure
 *   addJOLObservation(tracker, obs)       — pure tracker update (brier accumulation)
 *   analyzeCalibration(tracker)           — full analysis (requires >= 10 observations)
 *
 * Key constants:
 *   MIN_OBSERVATIONS = 10   (below → state='unknown', brierScore=0.25)
 *   ANALYSIS_WINDOW  = 50   (rolling window, older obs discarded)
 *
 * deriveImplicitConfidence formula:
 *   latencyConf = 1 / (1 + exp(2 * (latencyRatio - 0.8)))
 *   switchPenalty = max(0, 1 - answerSwitches * 0.2)
 *   without trajectory: result = latencyConf * switchPenalty
 *   with trajectory:    result = 0.4 * latencyConf * switchPenalty + 0.6 * trajectoryConfidence
 */

import { describe, it, expect } from 'vitest';
import {
  deriveImplicitConfidence,
  initCalibrationTracker,
  addJOLObservation,
  analyzeCalibration,
} from './jol-calibration';
import type { CalibrationTracker, JOLObservation } from './jol-calibration';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeObs(overrides: Partial<JOLObservation> = {}): JOLObservation {
  return {
    questionId: 'q1',
    implicitConfidence: 0.7,
    actualOutcome: 1,
    latencyMs: 2000,
    latencyRatio: 0.8,
    timestamp: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Build a tracker with N observations already added */
function buildTracker(observations: JOLObservation[]): CalibrationTracker {
  let tracker = initCalibrationTracker();
  for (const obs of observations) {
    tracker = addJOLObservation(tracker, obs);
  }
  return tracker;
}

/** Generate N identical observations */
function makeNObs(
  n: number,
  overrides: Partial<JOLObservation> = {}
): JOLObservation[] {
  return Array.from({ length: n }, (_, i) =>
    makeObs({ questionId: `q${i}`, ...overrides })
  );
}

// ─── deriveImplicitConfidence ─────────────────────────────────────────────────

describe('deriveImplicitConfidence', () => {
  it('returns a value in [0, 1]', () => {
    const cases = [
      { latencyRatio: 0, answerSwitches: 0 },
      { latencyRatio: 0.5, answerSwitches: 2 },
      { latencyRatio: 0.8, answerSwitches: 0 },
      { latencyRatio: 2.0, answerSwitches: 5 },
    ];
    for (const c of cases) {
      const result = deriveImplicitConfidence(c);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });

  it('at latencyRatio=0.8, answerSwitches=0: result = 0.5 (logistic midpoint)', () => {
    // latencyConf = 1/(1+exp(0)) = 0.5; switchPenalty = 1.0; result = 0.5
    const result = deriveImplicitConfidence({ latencyRatio: 0.8, answerSwitches: 0 });
    expect(result).toBeCloseTo(0.5, 5);
  });

  it('faster latency (< 0.8) produces higher confidence', () => {
    const fast = deriveImplicitConfidence({ latencyRatio: 0.2, answerSwitches: 0 });
    const slow = deriveImplicitConfidence({ latencyRatio: 1.4, answerSwitches: 0 });
    expect(fast).toBeGreaterThan(slow);
  });

  it('more answer switches reduce confidence (switch penalty)', () => {
    const noSwitch = deriveImplicitConfidence({ latencyRatio: 0.5, answerSwitches: 0 });
    const twoSwitch = deriveImplicitConfidence({ latencyRatio: 0.5, answerSwitches: 2 });
    expect(twoSwitch).toBeLessThan(noSwitch);
  });

  it('answerSwitches >= 5 → switchPenalty = 0 → result = 0 (without trajectory)', () => {
    const result = deriveImplicitConfidence({ latencyRatio: 0.8, answerSwitches: 5 });
    expect(result).toBe(0);
  });

  it('trajectoryConfidence blends as 40/60 with latency-based signal', () => {
    // latencyRatio=0.8, switches=0 → latencyConf=0.5, switchPenalty=1.0
    // 0.4 * 0.5 * 1.0 + 0.6 * 0.8 = 0.2 + 0.48 = 0.68
    const result = deriveImplicitConfidence({
      latencyRatio: 0.8,
      answerSwitches: 0,
      trajectoryConfidence: 0.8,
    });
    expect(result).toBeCloseTo(0.68, 5);
  });

  it('without trajectory: result = latencyConf * switchPenalty (not the blend)', () => {
    const withoutTraj = deriveImplicitConfidence({ latencyRatio: 0.5, answerSwitches: 0 });
    const withTraj    = deriveImplicitConfidence({ latencyRatio: 0.5, answerSwitches: 0, trajectoryConfidence: 0.5 });
    // Without trajectory: latencyConf * 1.0 (some value > 0.5)
    // With trajectory (0.5): 0.4*latencyConf + 0.6*0.5 — will differ
    expect(withoutTraj).not.toBeCloseTo(withTraj, 3);
  });
});

// ─── initCalibrationTracker ───────────────────────────────────────────────────

describe('initCalibrationTracker', () => {
  it('returns a tracker with zero observations', () => {
    const t = initCalibrationTracker();
    expect(t.observations).toHaveLength(0);
    expect(t.count).toBe(0);
  });

  it('initializes brierSum, confidenceSum, accuracySum to 0', () => {
    const t = initCalibrationTracker();
    expect(t.brierSum).toBe(0);
    expect(t.confidenceSum).toBe(0);
    expect(t.accuracySum).toBe(0);
  });

  it('lastAnalysis is undefined on init', () => {
    expect(initCalibrationTracker().lastAnalysis).toBeUndefined();
  });
});

// ─── addJOLObservation ────────────────────────────────────────────────────────

describe('addJOLObservation', () => {
  it('increments count by 1', () => {
    let t = initCalibrationTracker();
    t = addJOLObservation(t, makeObs());
    expect(t.count).toBe(1);
    t = addJOLObservation(t, makeObs({ questionId: 'q2' }));
    expect(t.count).toBe(2);
  });

  it('adds the observation to observations array', () => {
    let t = initCalibrationTracker();
    const obs = makeObs({ questionId: 'unique-id' });
    t = addJOLObservation(t, obs);
    expect(t.observations).toHaveLength(1);
    expect(t.observations[0]!.questionId).toBe('unique-id');
  });

  it('accumulates brierSum correctly: (confidence - outcome)^2', () => {
    let t = initCalibrationTracker();
    // implicitConfidence=0.5, actualOutcome=1 → brier contribution=(0.5-1)^2=0.25
    t = addJOLObservation(t, makeObs({ implicitConfidence: 0.5, actualOutcome: 1 }));
    expect(t.brierSum).toBeCloseTo(0.25, 5);
  });

  it('brier contribution is 0 for perfect prediction', () => {
    let t = initCalibrationTracker();
    t = addJOLObservation(t, makeObs({ implicitConfidence: 1.0, actualOutcome: 1 }));
    t = addJOLObservation(t, makeObs({ implicitConfidence: 0.0, actualOutcome: 0, questionId: 'q2' }));
    expect(t.brierSum).toBeCloseTo(0, 5);
  });

  it('keeps only last 50 observations (ANALYSIS_WINDOW)', () => {
    let t = initCalibrationTracker();
    for (let i = 0; i < 55; i++) {
      t = addJOLObservation(t, makeObs({ questionId: `q${i}` }));
    }
    expect(t.observations).toHaveLength(50);
    // count still accumulates beyond window
    expect(t.count).toBe(55);
  });

  it('is immutable — original tracker unchanged', () => {
    const original = initCalibrationTracker();
    addJOLObservation(original, makeObs());
    expect(original.count).toBe(0);
    expect(original.observations).toHaveLength(0);
  });
});

// ─── analyzeCalibration ───────────────────────────────────────────────────────

describe('analyzeCalibration', () => {
  // ── Insufficient data (<10 observations) ──

  it('returns state="unknown" for fewer than 10 observations', () => {
    const tracker = buildTracker(makeNObs(5));
    expect(analyzeCalibration(tracker).state).toBe('unknown');
  });

  it('returns brierScore=0.25 (baseline) when insufficient data', () => {
    const tracker = buildTracker(makeNObs(3));
    expect(analyzeCalibration(tracker).brierScore).toBe(0.25);
  });

  it('analysisConfidence = sampleSize / 10 when sampleSize < 10', () => {
    const tracker = buildTracker(makeNObs(5));
    expect(analyzeCalibration(tracker).analysisConfidence).toBeCloseTo(0.5, 5);
  });

  it('recommendation contains "more responses" when insufficient data', () => {
    const tracker = buildTracker(makeNObs(3));
    expect(analyzeCalibration(tracker).recommendation).toContain('more responses');
  });

  // ── With sufficient data (>= 10 observations) ──

  it('state is not "unknown" when ≥2 confidence bins each have ≥3 observations', () => {
    // determineCalibrationState requires >= 2 bins with count >= 3; spread across bins
    const lowConf  = makeNObs(5, { implicitConfidence: 0.3, actualOutcome: 0 }); // bin [0.2,0.4)
    const highConf = makeNObs(5, { implicitConfidence: 0.7, actualOutcome: 1 }); // bin [0.6,0.8)
    const tracker = buildTracker([...lowConf, ...highConf]);
    expect(analyzeCalibration(tracker).state).not.toBe('unknown');
  });

  it('overconfidenceBias > 0 when avg confidence > avg accuracy', () => {
    const obs = makeNObs(10, { implicitConfidence: 0.9, actualOutcome: 0 });
    const tracker = buildTracker(obs);
    expect(analyzeCalibration(tracker).overconfidenceBias).toBeGreaterThan(0);
  });

  it('overconfidenceBias < 0 when avg confidence < avg accuracy', () => {
    const obs = makeNObs(10, { implicitConfidence: 0.1, actualOutcome: 1 });
    const tracker = buildTracker(obs);
    expect(analyzeCalibration(tracker).overconfidenceBias).toBeLessThan(0);
  });

  it('illusionOfCompetence is false when fewer than 6 fast responses', () => {
    // Only 5 fast responses (latencyRatio < 0.6); 5 slow
    const fastObs = makeNObs(5, { implicitConfidence: 0.8, actualOutcome: 0, latencyRatio: 0.3 });
    const slowObs = makeNObs(5, { implicitConfidence: 0.5, actualOutcome: 1, latencyRatio: 1.5 });
    const tracker = buildTracker([...fastObs, ...slowObs]);
    expect(analyzeCalibration(tracker).illusionOfCompetence).toBe(false);
  });

  it('illusionOfCompetence is true when 6+ fast responses with low accuracy', () => {
    // 10 fast low-accuracy responses (latencyRatio < 0.6, actualOutcome=0)
    const obs = makeNObs(10, { implicitConfidence: 0.8, actualOutcome: 0, latencyRatio: 0.3 });
    const tracker = buildTracker(obs);
    const result = analyzeCalibration(tracker);
    expect(result.illusionOfCompetence).toBe(true);
  });

  it('sampleSize reflects the number of recent observations (capped at 50)', () => {
    const tracker = buildTracker(makeNObs(12));
    expect(analyzeCalibration(tracker).sampleSize).toBe(12);
  });

  it('calibrationCurve is a non-empty array for 10+ observations', () => {
    const tracker = buildTracker(makeNObs(10));
    const { calibrationCurve } = analyzeCalibration(tracker);
    expect(Array.isArray(calibrationCurve)).toBe(true);
    // At least some bins should appear
    expect(calibrationCurve.length).toBeGreaterThan(0);
  });

  it('brierScore is in [0, 1] for valid observations', () => {
    const tracker = buildTracker(makeNObs(10));
    const { brierScore } = analyzeCalibration(tracker);
    expect(brierScore).toBeGreaterThanOrEqual(0);
    expect(brierScore).toBeLessThanOrEqual(1);
  });

  it('returns a non-empty recommendation string', () => {
    const tracker = buildTracker(makeNObs(10));
    const { recommendation } = analyzeCalibration(tracker);
    expect(typeof recommendation).toBe('string');
    expect(recommendation.length).toBeGreaterThan(0);
  });
});
