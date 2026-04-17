import { describe, it, expect } from 'vitest';
import {
  detectInterference,
  DEFAULT_INTERFERENCE_CONFIG,
  type InterferenceConfig,
  type SessionReviewEntry,
} from '../lib/confidence/interferenceDetector';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a session history with sequential positions starting at 0. */
function buildHistory(entries: Array<Omit<SessionReviewEntry, 'position'>>): SessionReviewEntry[] {
  return entries.map((e, i) => ({ ...e, position: i }));
}

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('detectInterference — edge cases', () => {
  it('returns no interference for empty session history', () => {
    const result = detectInterference('condA', [], []);
    expect(result.detected).toBe(false);
    expect(result.discount).toBe(1.0);
    expect(result.details.type).toBe('none');
    expect(result.details.interferingCount).toBe(0);
    expect(result.details.closestDistance).toBeNull();
  });

  it('returns no interference when currentConditionId is empty', () => {
    const history = buildHistory([{ conditionId: 'condA' }]);
    const result = detectInterference('', [], history);
    expect(result.detected).toBe(false);
    expect(result.discount).toBe(1.0);
  });

  it('returns no interference when history has unrelated conditions', () => {
    const history = buildHistory([
      { conditionId: 'condX' },
      { conditionId: 'condY' },
      { conditionId: 'condZ' },
    ]);
    const result = detectInterference('condA', ['condB', 'condC'], history);
    expect(result.detected).toBe(false);
    expect(result.discount).toBe(1.0);
  });
});

// ─── Same-condition interference ────────────────────────────────────────────

describe('detectInterference — same-condition', () => {
  it('detects same-condition interference at close distance', () => {
    // Last entry is position 4 → currentPosition = 5
    // condA at position 4 → distance = 1 → strong discount
    const history = buildHistory([
      { conditionId: 'condX' },
      { conditionId: 'condY' },
      { conditionId: 'condZ' },
      { conditionId: 'condW' },
      { conditionId: 'condA' },
    ]);
    const result = detectInterference('condA', [], history);
    expect(result.detected).toBe(true);
    expect(result.details.type).toBe('same_condition');
    expect(result.details.closestDistance).toBe(1);
    // decayFactor = 1/10 = 0.1 → discount = 0.85 + 0.15*0.1 = 0.865
    expect(result.discount).toBeCloseTo(0.865, 3);
  });

  it('applies stronger discount at closer distance (decay)', () => {
    const nearHistory = buildHistory([
      { conditionId: 'condX' },
      { conditionId: 'condA' }, // distance 1
    ]);
    const farHistory = buildHistory([
      { conditionId: 'condA' }, // distance 5
      { conditionId: 'condX' },
      { conditionId: 'condX' },
      { conditionId: 'condX' },
      { conditionId: 'condX' },
    ]);
    const near = detectInterference('condA', [], nearHistory);
    const far = detectInterference('condA', [], farHistory);
    // Closer = smaller discount (more interference)
    expect(near.discount).toBeLessThan(far.discount);
  });

  it('produces no effective discount at distance >= decayDistance (10)', () => {
    // condA at position 0, 9 fillers after → distance exactly 10 → decay to 1.0
    const history = buildHistory([
      { conditionId: 'condA' },
      ...Array.from({ length: 9 }, () => ({ conditionId: 'condX' })),
    ]);
    const result = detectInterference('condA', [], history);
    // distance = 10 → decayFactor = 1.0 → discount = 0.85 + 0.15*1.0 = 1.0
    // The code still counts the match (interferingCount > 0) but discount is a no-op
    expect(result.discount).toBe(1.0);
  });

  it('picks the closest interfering card when multiple same-condition entries exist', () => {
    const history = buildHistory([
      { conditionId: 'condA' }, // distance 5
      { conditionId: 'condX' },
      { conditionId: 'condX' },
      { conditionId: 'condX' },
      { conditionId: 'condA' }, // distance 1 (closer)
    ]);
    const result = detectInterference('condA', [], history);
    expect(result.details.closestDistance).toBe(1);
    expect(result.details.interferingCount).toBe(2);
  });
});

// ─── Confusion-pair interference ────────────────────────────────────────────

describe('detectInterference — confusion-pair', () => {
  it('detects confusion-pair interference', () => {
    const history = buildHistory([
      { conditionId: 'condX' },
      { conditionId: 'confusedSibling' }, // distance 1
    ]);
    const result = detectInterference('condA', ['confusedSibling'], history);
    expect(result.detected).toBe(true);
    expect(result.details.type).toBe('confusion_pair');
    // decayFactor = 1/10 = 0.1 → discount = 0.90 + 0.10*0.1 = 0.91
    expect(result.discount).toBeCloseTo(0.91, 3);
  });

  it('applies weaker discount than same-condition', () => {
    const sameHistory = buildHistory([{ conditionId: 'condA' }]);
    const pairHistory = buildHistory([{ conditionId: 'confusedSibling' }]);

    const sameResult = detectInterference('condA', ['confusedSibling'], sameHistory);
    const pairResult = detectInterference('condA', ['confusedSibling'], pairHistory);
    // Same condition should produce stronger (smaller) discount than confusion-pair
    expect(sameResult.discount).toBeLessThan(pairResult.discount);
  });
});

// ─── Same-condition wins over confusion-pair ────────────────────────────────

describe('detectInterference — interference type priority', () => {
  it('same_condition wins even when a confusion-pair is closer', () => {
    const history = buildHistory([
      { conditionId: 'condA' }, // distance 2
      { conditionId: 'confusedSibling' }, // distance 1
    ]);
    const result = detectInterference('condA', ['confusedSibling'], history);
    // Same-condition produces a smaller discount than confusion-pair, so it wins
    // Specifically: same @ dist 2 → 0.85 + 0.15*0.2 = 0.88
    //               confusion @ dist 1 → 0.90 + 0.10*0.1 = 0.91
    // 0.88 < 0.91 → same_condition wins
    expect(result.details.type).toBe('same_condition');
  });

  it('counts both types in interferingCount', () => {
    const history = buildHistory([
      { conditionId: 'confusedSibling' },
      { conditionId: 'condA' },
    ]);
    const result = detectInterference('condA', ['confusedSibling'], history);
    expect(result.details.interferingCount).toBe(2);
  });
});

// ─── Lookback window ────────────────────────────────────────────────────────

describe('detectInterference — lookback window', () => {
  it('only considers the most recent lookbackWindow entries', () => {
    // condA far back (position 0), then 15 fillers → should be outside window of 10
    const history = buildHistory([
      { conditionId: 'condA' },
      ...Array.from({ length: 15 }, () => ({ conditionId: 'condX' })),
    ]);
    const result = detectInterference('condA', [], history);
    expect(result.detected).toBe(false);
  });

  it('respects custom lookbackWindow', () => {
    const customConfig: InterferenceConfig = {
      ...DEFAULT_INTERFERENCE_CONFIG,
      lookbackWindow: 3,
    };
    // condA 5 entries back, outside window of 3
    const history = buildHistory([
      { conditionId: 'condA' },
      { conditionId: 'condX' },
      { conditionId: 'condX' },
      { conditionId: 'condX' },
      { conditionId: 'condX' },
    ]);
    const result = detectInterference('condA', [], history, customConfig);
    expect(result.detected).toBe(false);
  });
});

// ─── Custom config ──────────────────────────────────────────────────────────

describe('detectInterference — custom config', () => {
  it('respects custom sameConditionMinDiscount', () => {
    const strictConfig: InterferenceConfig = {
      ...DEFAULT_INTERFERENCE_CONFIG,
      sameConditionMinDiscount: 0.7,
    };
    const history = buildHistory([{ conditionId: 'condA' }]);
    const result = detectInterference('condA', [], history, strictConfig);
    // distance = 1 → decayFactor = 0.1 → discount = 0.7 + 0.3*0.1 = 0.73
    expect(result.discount).toBeCloseTo(0.73, 3);
  });

  it('respects custom decayDistance', () => {
    const longDecayConfig: InterferenceConfig = {
      ...DEFAULT_INTERFERENCE_CONFIG,
      decayDistance: 20,
    };
    // condA at distance 10 → with default decay: discount = 1.0
    //                        with decay=20: decayFactor = 10/20 = 0.5 → discount = 0.85 + 0.075 = 0.925
    const history = buildHistory([
      { conditionId: 'condA' },
      ...Array.from({ length: 9 }, () => ({ conditionId: 'condX' })),
    ]);
    const result = detectInterference('condA', [], history, longDecayConfig);
    expect(result.detected).toBe(true);
    expect(result.discount).toBeCloseTo(0.925, 3);
  });
});

// ─── Bounds ─────────────────────────────────────────────────────────────────

describe('detectInterference — discount bounds', () => {
  it('discount is always within [0.85, 1.0] under default config', () => {
    // Stack many same-condition hits at varying distances
    const history = buildHistory([
      { conditionId: 'condA' },
      { conditionId: 'condA' },
      { conditionId: 'condA' },
      { conditionId: 'condA' },
      { conditionId: 'condA' },
    ]);
    const result = detectInterference('condA', [], history);
    expect(result.discount).toBeGreaterThanOrEqual(DEFAULT_INTERFERENCE_CONFIG.sameConditionMinDiscount);
    expect(result.discount).toBeLessThanOrEqual(1.0);
  });

  it('returns rounded discount to 3 decimal places', () => {
    const history = buildHistory([{ conditionId: 'condA' }]);
    const result = detectInterference('condA', [], history);
    const str = result.discount.toString();
    const afterDecimal = str.includes('.') ? str.split('.')[1] : '';
    expect(afterDecimal.length).toBeLessThanOrEqual(3);
  });
});

// ─── DEFAULT_INTERFERENCE_CONFIG ────────────────────────────────────────────

describe('DEFAULT_INTERFERENCE_CONFIG', () => {
  it('has documented defaults', () => {
    expect(DEFAULT_INTERFERENCE_CONFIG.lookbackWindow).toBe(10);
    expect(DEFAULT_INTERFERENCE_CONFIG.sameConditionMinDiscount).toBe(0.85);
    expect(DEFAULT_INTERFERENCE_CONFIG.confusionPairMinDiscount).toBe(0.90);
    expect(DEFAULT_INTERFERENCE_CONFIG.decayDistance).toBe(10);
  });
});
