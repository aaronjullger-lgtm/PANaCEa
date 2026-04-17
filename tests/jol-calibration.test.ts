import { describe, it, expect } from 'vitest';
import {
  deriveImplicitConfidence,
  initCalibrationTracker,
  addJOLObservation,
  analyzeCalibration,
  serializeCalibration,
  type JOLObservation,
  type CalibrationTracker,
} from '../lib/jol-calibration';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeObservation(overrides: Partial<JOLObservation> = {}): JOLObservation {
  return {
    questionId: 'q-1',
    implicitConfidence: 0.7,
    actualOutcome: 1,
    latencyMs: 5000,
    latencyRatio: 0.8,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build a tracker with N observations matching a target confidence + accuracy.
 * `confidence` and `accuracy` each in [0, 1].
 */
function buildTracker(
  count: number,
  confidence: number,
  accuracy: number,
  latencyRatio = 1.0
): CalibrationTracker {
  let tracker = initCalibrationTracker();
  const correctCount = Math.round(count * accuracy);
  for (let i = 0; i < count; i++) {
    // Interleave correct/incorrect evenly (vitest-author skill pattern)
    const isCorrect =
      Math.floor(((i + 1) * correctCount) / count) > Math.floor((i * correctCount) / count);
    tracker = addJOLObservation(
      tracker,
      makeObservation({
        questionId: `q-${i}`,
        implicitConfidence: confidence,
        actualOutcome: isCorrect ? 1 : 0,
        latencyRatio,
      })
    );
  }
  return tracker;
}

// ─── deriveImplicitConfidence ───────────────────────────────────────────────

describe('deriveImplicitConfidence', () => {
  it('returns ~0.5 when latencyRatio=0.8 and no switches', () => {
    // latencyConfidence = 1 / (1 + exp(2*(0.8-0.8))) = 1 / (1 + 1) = 0.5
    // switchPenalty = 1 → 0.5 * 1 = 0.5
    const conf = deriveImplicitConfidence({ latencyRatio: 0.8, answerSwitches: 0 });
    expect(conf).toBeCloseTo(0.5, 2);
  });

  it('returns high confidence for very fast responses', () => {
    // latencyRatio=0 → 1/(1+exp(-1.6)) ≈ 0.832
    const conf = deriveImplicitConfidence({ latencyRatio: 0, answerSwitches: 0 });
    expect(conf).toBeGreaterThan(0.8);
  });

  it('returns low confidence for very slow responses', () => {
    // latencyRatio=2 → 1/(1+exp(2.4)) ≈ 0.083
    const conf = deriveImplicitConfidence({ latencyRatio: 2, answerSwitches: 0 });
    expect(conf).toBeLessThan(0.1);
  });

  it('applies switch penalty (0.2 per switch)', () => {
    const noSwitches = deriveImplicitConfidence({ latencyRatio: 0.5, answerSwitches: 0 });
    const oneSwitch = deriveImplicitConfidence({ latencyRatio: 0.5, answerSwitches: 1 });
    const twoSwitches = deriveImplicitConfidence({ latencyRatio: 0.5, answerSwitches: 2 });
    // Each switch multiplies by 0.2 less
    expect(oneSwitch).toBeCloseTo(noSwitches * 0.8, 3);
    expect(twoSwitches).toBeCloseTo(noSwitches * 0.6, 3);
  });

  it('clamps switch penalty at 0 (5+ switches)', () => {
    const conf = deriveImplicitConfidence({ latencyRatio: 0.5, answerSwitches: 10 });
    expect(conf).toBe(0);
  });

  it('blends trajectoryConfidence when provided (40/60 weighting)', () => {
    // latencyConf at 0.8 = 0.5, switchPenalty=1, trajectoryConf=1.0
    // => 0.4*0.5*1 + 0.6*1.0 = 0.2 + 0.6 = 0.8
    const conf = deriveImplicitConfidence({
      latencyRatio: 0.8,
      answerSwitches: 0,
      trajectoryConfidence: 1.0,
    });
    expect(conf).toBeCloseTo(0.8, 3);
  });
});

// ─── initCalibrationTracker ─────────────────────────────────────────────────

describe('initCalibrationTracker', () => {
  it('returns an empty tracker with zeroed sums', () => {
    const t = initCalibrationTracker();
    expect(t.observations).toEqual([]);
    expect(t.brierSum).toBe(0);
    expect(t.confidenceSum).toBe(0);
    expect(t.accuracySum).toBe(0);
    expect(t.count).toBe(0);
  });
});

// ─── addJOLObservation ──────────────────────────────────────────────────────

describe('addJOLObservation', () => {
  it('appends an observation and updates sums', () => {
    const tracker = initCalibrationTracker();
    const obs = makeObservation({ implicitConfidence: 0.8, actualOutcome: 1 });
    const updated = addJOLObservation(tracker, obs);
    expect(updated.observations).toHaveLength(1);
    // Brier: (0.8 - 1)^2 = 0.04
    expect(updated.brierSum).toBeCloseTo(0.04, 5);
    expect(updated.confidenceSum).toBeCloseTo(0.8, 5);
    expect(updated.accuracySum).toBe(1);
    expect(updated.count).toBe(1);
  });

  it('keeps only the last 50 observations (ANALYSIS_WINDOW)', () => {
    let tracker = initCalibrationTracker();
    for (let i = 0; i < 60; i++) {
      tracker = addJOLObservation(tracker, makeObservation({ questionId: `q-${i}` }));
    }
    expect(tracker.observations).toHaveLength(50);
    expect(tracker.observations[0].questionId).toBe('q-10');
    expect(tracker.observations[49].questionId).toBe('q-59');
    expect(tracker.count).toBe(60); // count is cumulative, not windowed
  });

  it('does not mutate the input tracker', () => {
    const tracker = initCalibrationTracker();
    addJOLObservation(tracker, makeObservation());
    expect(tracker.observations).toHaveLength(0);
    expect(tracker.count).toBe(0);
  });
});

// ─── analyzeCalibration — insufficient data ─────────────────────────────────

describe('analyzeCalibration — insufficient data', () => {
  it('returns unknown state when fewer than MIN_OBSERVATIONS (10)', () => {
    const tracker = buildTracker(5, 0.7, 0.7);
    const analysis = analyzeCalibration(tracker);
    expect(analysis.state).toBe('unknown');
    expect(analysis.sampleSize).toBe(5);
    expect(analysis.analysisConfidence).toBeCloseTo(0.5, 2);
    expect(analysis.recommendation).toContain('more responses');
  });

  it('returns unknown for empty tracker', () => {
    const analysis = analyzeCalibration(initCalibrationTracker());
    expect(analysis.state).toBe('unknown');
    expect(analysis.sampleSize).toBe(0);
  });
});

/**
 * Build a tracker whose observations span 2+ confidence bins (needed for
 * determineCalibrationState to escape 'unknown' state, which requires ≥2
 * significant bins with count ≥ 3).
 */
function buildMultiBinTracker(
  entries: Array<{ confidence: number; accuracy: number; count: number }>,
  latencyRatio = 1.0
): CalibrationTracker {
  let tracker = initCalibrationTracker();
  let idx = 0;
  for (const { confidence, accuracy, count } of entries) {
    const correctCount = Math.round(count * accuracy);
    for (let i = 0; i < count; i++) {
      const isCorrect =
        Math.floor(((i + 1) * correctCount) / count) > Math.floor((i * correctCount) / count);
      tracker = addJOLObservation(
        tracker,
        makeObservation({
          questionId: `q-${idx++}`,
          implicitConfidence: confidence,
          actualOutcome: isCorrect ? 1 : 0,
          latencyRatio,
        })
      );
    }
  }
  return tracker;
}

// ─── analyzeCalibration — well-calibrated ───────────────────────────────────

describe('analyzeCalibration — well calibrated', () => {
  it('detects well-calibrated when confidence matches accuracy across bins', () => {
    // Bin 40-60%: conf=0.5, acc=0.5 (error=0); Bin 80-100%: conf=0.9, acc=0.9 (error=0)
    const tracker = buildMultiBinTracker([
      { confidence: 0.5, accuracy: 0.5, count: 10 },
      { confidence: 0.9, accuracy: 0.9, count: 10 },
    ]);
    const analysis = analyzeCalibration(tracker);
    expect(analysis.state).toBe('well_calibrated');
    expect(Math.abs(analysis.overconfidenceBias)).toBeLessThan(0.1);
  });

  it('produces low Brier score for well-calibrated predictions', () => {
    const tracker = buildMultiBinTracker([
      { confidence: 0.5, accuracy: 0.5, count: 10 },
      { confidence: 0.9, accuracy: 0.9, count: 10 },
    ]);
    const analysis = analyzeCalibration(tracker);
    expect(analysis.brierScore).toBeLessThan(0.3);
  });
});

// ─── analyzeCalibration — overconfidence ────────────────────────────────────

describe('analyzeCalibration — overconfidence', () => {
  it('detects overconfidence (high confidence, low accuracy) across bins', () => {
    // Both bins overconfident by similar amount → low variance → 'overconfident'
    // Bin 60-80%: conf=0.7, acc=0.3 (error=0.4); Bin 80-100%: conf=0.9, acc=0.5 (error=0.4)
    const tracker = buildMultiBinTracker([
      { confidence: 0.7, accuracy: 0.3, count: 10 },
      { confidence: 0.9, accuracy: 0.5, count: 10 },
    ]);
    const analysis = analyzeCalibration(tracker);
    expect(analysis.overconfidenceBias).toBeGreaterThan(0.15);
    expect(['overconfident', 'fluctuating']).toContain(analysis.state);
  });

  it('generates overconfidence recommendation when state=overconfident', () => {
    const tracker = buildMultiBinTracker([
      { confidence: 0.7, accuracy: 0.3, count: 10 },
      { confidence: 0.9, accuracy: 0.5, count: 10 },
    ]);
    const analysis = analyzeCalibration(tracker);
    if (analysis.state === 'overconfident') {
      expect(analysis.recommendation.toLowerCase()).toContain('overconfidence');
    }
  });
});

// ─── analyzeCalibration — underconfidence ───────────────────────────────────

describe('analyzeCalibration — underconfidence', () => {
  it('detects underconfidence (low confidence, high accuracy) across bins', () => {
    // Bin 0-20%: conf=0.1, acc=0.5 (error=-0.4); Bin 20-40%: conf=0.3, acc=0.7 (error=-0.4)
    const tracker = buildMultiBinTracker([
      { confidence: 0.1, accuracy: 0.5, count: 10 },
      { confidence: 0.3, accuracy: 0.7, count: 10 },
    ]);
    const analysis = analyzeCalibration(tracker);
    expect(analysis.overconfidenceBias).toBeLessThan(-0.15);
    expect(['underconfident', 'fluctuating']).toContain(analysis.state);
  });
});

// ─── analyzeCalibration — illusion of competence ────────────────────────────

describe('analyzeCalibration — illusion of competence', () => {
  it('flags illusion when fast responses (ratio < 0.6) score < 50% accuracy', () => {
    // 15 fast + wrong responses
    let tracker = initCalibrationTracker();
    for (let i = 0; i < 15; i++) {
      tracker = addJOLObservation(
        tracker,
        makeObservation({
          questionId: `q-${i}`,
          implicitConfidence: 0.8,
          actualOutcome: 0, // wrong
          latencyRatio: 0.3, // fast
        })
      );
    }
    const analysis = analyzeCalibration(tracker);
    expect(analysis.illusionOfCompetence).toBe(true);
    expect(analysis.recommendation.toLowerCase()).toContain('slow down');
  });

  it('does not flag illusion when fast responses are accurate', () => {
    let tracker = initCalibrationTracker();
    for (let i = 0; i < 15; i++) {
      tracker = addJOLObservation(
        tracker,
        makeObservation({
          questionId: `q-${i}`,
          implicitConfidence: 0.8,
          actualOutcome: 1,
          latencyRatio: 0.3,
        })
      );
    }
    const analysis = analyzeCalibration(tracker);
    expect(analysis.illusionOfCompetence).toBe(false);
  });

  it('does not flag illusion when fewer than 6 fast responses', () => {
    // 5 fast + wrong, 10 slow + wrong
    let tracker = initCalibrationTracker();
    for (let i = 0; i < 5; i++) {
      tracker = addJOLObservation(
        tracker,
        makeObservation({ questionId: `fast-${i}`, actualOutcome: 0, latencyRatio: 0.3 })
      );
    }
    for (let i = 0; i < 10; i++) {
      tracker = addJOLObservation(
        tracker,
        makeObservation({ questionId: `slow-${i}`, actualOutcome: 0, latencyRatio: 1.0 })
      );
    }
    const analysis = analyzeCalibration(tracker);
    expect(analysis.illusionOfCompetence).toBe(false);
  });
});

// ─── Calibration curve ──────────────────────────────────────────────────────

describe('analyzeCalibration — calibration curve', () => {
  it('produces 5 bins (one per confidence range)', () => {
    const tracker = buildTracker(20, 0.5, 0.5);
    const analysis = analyzeCalibration(tracker);
    expect(analysis.calibrationCurve).toHaveLength(5);
    const labels = analysis.calibrationCurve.map((b) => b.label);
    expect(labels).toEqual(['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']);
  });

  it('reports count=0 for empty bins', () => {
    // All confidence at 0.5 → only bin "40-60%" populated
    const tracker = buildTracker(20, 0.5, 0.5);
    const analysis = analyzeCalibration(tracker);
    const populatedBins = analysis.calibrationCurve.filter((b) => b.count > 0);
    expect(populatedBins).toHaveLength(1);
    expect(populatedBins[0].label).toBe('40-60%');
  });

  it('computes calibrationError as avgConfidence - actualAccuracy per bin', () => {
    const tracker = buildTracker(20, 0.5, 0.3); // conf=0.5, acc=0.3 → error=0.2
    const analysis = analyzeCalibration(tracker);
    const bin = analysis.calibrationCurve.find((b) => b.label === '40-60%')!;
    expect(bin.count).toBe(20);
    expect(bin.calibrationError).toBeCloseTo(0.2, 2);
  });
});

// ─── Rounding ───────────────────────────────────────────────────────────────

describe('analyzeCalibration — rounding', () => {
  it('rounds brierScore to 3 decimals, bias to 2 decimals', () => {
    const tracker = buildTracker(20, 0.7, 0.7);
    const analysis = analyzeCalibration(tracker);
    const brierStr = analysis.brierScore.toString();
    const brierDecimals = brierStr.includes('.') ? brierStr.split('.')[1] : '';
    expect(brierDecimals.length).toBeLessThanOrEqual(3);

    const biasStr = analysis.overconfidenceBias.toString();
    const biasDecimals = biasStr.includes('.') ? biasStr.split('.')[1] : '';
    expect(biasDecimals.length).toBeLessThanOrEqual(2);
  });
});

// ─── serializeCalibration ───────────────────────────────────────────────────

describe('serializeCalibration', () => {
  it('produces a flat storage object with expected shape', () => {
    const tracker = buildTracker(15, 0.7, 0.7);
    const analysis = analyzeCalibration(tracker);
    const serialized = serializeCalibration(analysis);
    expect(serialized).toHaveProperty('state');
    expect(serialized).toHaveProperty('brierScore');
    expect(serialized).toHaveProperty('bias');
    expect(serialized).toHaveProperty('resolution');
    expect(serialized).toHaveProperty('sampleSize');
    expect(serialized).toHaveProperty('illusion');
    expect(serialized).toHaveProperty('curve');
  });

  it('compacts calibrationCurve into {conf, acc, n} format', () => {
    const tracker = buildTracker(15, 0.5, 0.5);
    const analysis = analyzeCalibration(tracker);
    const serialized = serializeCalibration(analysis) as { curve: Array<Record<string, number>> };
    expect(Array.isArray(serialized.curve)).toBe(true);
    expect(serialized.curve[0]).toHaveProperty('conf');
    expect(serialized.curve[0]).toHaveProperty('acc');
    expect(serialized.curve[0]).toHaveProperty('n');
  });
});

// ─── analysisConfidence scaling ─────────────────────────────────────────────

describe('analyzeCalibration — analysisConfidence', () => {
  it('scales analysisConfidence up to 1.0 at 30 observations', () => {
    const tracker = buildTracker(30, 0.7, 0.7);
    const analysis = analyzeCalibration(tracker);
    expect(analysis.analysisConfidence).toBe(1.0);
  });

  it('caps analysisConfidence at 1.0 even with more observations', () => {
    const tracker = buildTracker(50, 0.7, 0.7);
    const analysis = analyzeCalibration(tracker);
    expect(analysis.analysisConfidence).toBeLessThanOrEqual(1.0);
  });
});
