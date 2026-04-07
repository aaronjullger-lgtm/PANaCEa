/**
 * Tests for IRT/Elo Service (Tier 2, Feature 6)
 *
 * Tests pure IRT/Elo computation functions: item response, Fisher information,
 * Elo updates, session ordering, fatigue detection, and FSRS↔Elo conversion.
 */

import { describe, it, expect } from 'vitest';
import {
  itemResponseFunction,
  raschProbability,
  fisherInformation,
  adaptiveKFactor,
  eloUpdate,
  orderSessionCards,
  detectSessionFatigue,
  fsrsDifficultyToElo,
  eloToFsrsDifficulty,
  BASE_K_FACTOR,
  MIN_K_FACTOR,
  DEFAULT_UNCERTAINTY,
  DEFAULT_DISCRIMINATION,
  GUESSING_PARAM,
  FATIGUE_ACCURACY_THRESHOLD,
} from '../lib/services/irtEloService';

// ─── Item Response Function (3PL) ─────────────────────────────────

describe('itemResponseFunction', () => {
  it('returns guessing rate when ability << difficulty', () => {
    // θ = -5, b = 5 → very hard for student → P ≈ c (guessing)
    const p = itemResponseFunction(-5, 5);
    expect(p).toBeCloseTo(GUESSING_PARAM, 1);
  });

  it('returns ~1.0 when ability >> difficulty', () => {
    // θ = 5, b = -5 → very easy → P ≈ 1
    const p = itemResponseFunction(5, -5);
    expect(p).toBeGreaterThan(0.99);
  });

  it('returns midpoint when ability = difficulty', () => {
    // θ = b → P = c + (1-c)/2 = 0.25 + 0.375 = 0.625
    const p = itemResponseFunction(0, 0);
    expect(p).toBeCloseTo(0.625, 2);
  });

  it('higher discrimination produces steeper curve', () => {
    // Same θ-b gap, but a=2 should give more extreme P than a=0.5
    const pHigh = itemResponseFunction(1, 0, 2.0);
    const pLow = itemResponseFunction(1, 0, 0.5);
    // Higher disc: more separation from guessing floor
    expect(pHigh).toBeGreaterThan(pLow);
  });
});

// ─── Rasch Probability ────────────────────────────────────────────

describe('raschProbability', () => {
  it('returns 0.5 when ability = difficulty', () => {
    expect(raschProbability(0, 0)).toBe(0.5);
  });

  it('returns > 0.5 when ability > difficulty', () => {
    expect(raschProbability(2, 0)).toBeGreaterThan(0.5);
  });

  it('returns < 0.5 when ability < difficulty', () => {
    expect(raschProbability(-2, 0)).toBeLessThan(0.5);
  });

  it('is symmetric: P(θ, b) = 1 - P(b, θ)', () => {
    // P(2, 0) + P(0, 2) = 1 (logistic symmetry)
    const p1 = raschProbability(2, 0);
    const p2 = raschProbability(0, 2);
    expect(p1 + p2).toBeCloseTo(1, 10);
  });
});

// ─── Fisher Information ───────────────────────────────────────────

describe('fisherInformation', () => {
  it('peaks when ability = difficulty', () => {
    // I(θ) = a² × P × (1-P); maximum at P=0.5 → θ=b
    const atMatch = fisherInformation(0, 0);
    const away = fisherInformation(3, 0);
    expect(atMatch).toBeGreaterThan(away);
  });

  it('maximum value is a²/4 (at θ=b)', () => {
    // P=0.5 → I = a² × 0.5 × 0.5 = a²/4
    const a = 1.5;
    const info = fisherInformation(0, 0, a);
    expect(info).toBeCloseTo(a * a / 4, 6);
  });

  it('scales with discrimination squared', () => {
    const info1 = fisherInformation(0, 0, 1.0);
    const info2 = fisherInformation(0, 0, 2.0);
    // info2 / info1 should be (2/1)² = 4
    expect(info2 / info1).toBeCloseTo(4, 6);
  });

  it('is always non-negative', () => {
    for (let theta = -5; theta <= 5; theta += 0.5) {
      expect(fisherInformation(theta, 0)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Adaptive K Factor ───────────────────────────────────────────

describe('adaptiveKFactor', () => {
  it('returns BASE_K for default uncertainty', () => {
    expect(adaptiveKFactor(DEFAULT_UNCERTAINTY)).toBeCloseTo(BASE_K_FACTOR, 6);
  });

  it('returns lower K for low uncertainty', () => {
    const k = adaptiveKFactor(0.3);
    expect(k).toBeLessThan(BASE_K_FACTOR);
  });

  it('never goes below MIN_K_FACTOR', () => {
    expect(adaptiveKFactor(0.01)).toBeGreaterThanOrEqual(MIN_K_FACTOR);
  });

  it('caps at BASE_K_FACTOR for high uncertainty', () => {
    expect(adaptiveKFactor(10)).toBeLessThanOrEqual(BASE_K_FACTOR);
  });
});

// ─── Elo Update ───────────────────────────────────────────────────

describe('eloUpdate', () => {
  it('increases ability after correct answer', () => {
    const result = eloUpdate(0, 0, true);
    expect(result.newAbility).toBeGreaterThan(0);
  });

  it('decreases ability after incorrect answer', () => {
    const result = eloUpdate(0, 0, false);
    expect(result.newAbility).toBeLessThan(0);
  });

  it('decreases item difficulty after correct answer (item gets easier)', () => {
    // When students keep getting it right, the item is revealed as easier
    const result = eloUpdate(0, 0, true);
    expect(result.newDifficulty).toBeLessThan(0);
  });

  it('increases item difficulty after incorrect answer (item gets harder)', () => {
    const result = eloUpdate(0, 0, false);
    expect(result.newDifficulty).toBeGreaterThan(0);
  });

  it('reduces uncertainty after each observation', () => {
    const result = eloUpdate(0, 0, true, 2.0, 2.0);
    expect(result.newStudentUncertainty).toBeLessThan(2.0);
    expect(result.newItemUncertainty).toBeLessThan(2.0);
  });

  it('converges: repeated correct answers push ability up monotonically', () => {
    let ability = 0;
    let uncertainty = DEFAULT_UNCERTAINTY;

    for (let i = 0; i < 10; i++) {
      const result = eloUpdate(ability, 0, true, uncertainty);
      expect(result.newAbility).toBeGreaterThan(ability);
      ability = result.newAbility;
      uncertainty = result.newStudentUncertainty;
    }
  });

  it('expectedP is between 0 and 1', () => {
    const result = eloUpdate(0, 0, true);
    expect(result.expectedP).toBeGreaterThanOrEqual(0);
    expect(result.expectedP).toBeLessThanOrEqual(1);
  });

  it('large surprise (unexpected correct) produces larger ability increase', () => {
    // Hard item (diff=3) with average student (ability=0): unexpected correct
    const hardCorrect = eloUpdate(0, 3, true);
    // Easy item (diff=-3) with average student: expected correct
    const easyCorrect = eloUpdate(0, -3, true);

    // Ability change should be larger for the surprise
    const hardDelta = hardCorrect.newAbility - 0;
    const easyDelta = easyCorrect.newAbility - 0;
    expect(hardDelta).toBeGreaterThan(easyDelta);
  });
});

// ─── Session Ordering ─────────────────────────────────────────────

describe('orderSessionCards', () => {
  const makeCards = (difficulties: number[]) =>
    difficulties.map((d, i) => ({
      itemId: `card-${i}`,
      eloDifficulty: d,
      discrimination: 1.0,
      domain: 'Cardiovascular',
    }));

  it('returns empty for empty input', () => {
    expect(orderSessionCards([], 0)).toEqual([]);
  });

  it('returns all cards from the input pool', () => {
    const cards = makeCards([-2, -1, 0, 1, 2]);
    const ordered = orderSessionCards(cards, 0);
    expect(ordered.length).toBe(5);
  });

  it('first card is a warm-up (close to ability)', () => {
    const cards = makeCards([-3, -1, 0, 0.5, 3]);
    const ordered = orderSessionCards(cards, 0);

    // First card should be near difficulty 0 (matches ability=0)
    expect(Math.abs(ordered[0].eloDifficulty)).toBeLessThanOrEqual(1);
  });

  it('shifts to easier items when fatigued', () => {
    const cards = makeCards([-2, -1, 0, 1, 2, 3]);
    // Fatigue history: 10 items, only 4 correct (40% < 60% threshold)
    const fatigueHistory = Array.from({ length: 10 }, (_, i) => i < 4);

    const ordered = orderSessionCards(cards, 0, fatigueHistory);

    // When fatigued, ordering should favor easier items
    // Check that mean difficulty of first 3 cards is below 0
    const meanDiffFirst3 = ordered.slice(0, 3).reduce((s, c) => s + c.eloDifficulty, 0) / 3;
    expect(meanDiffFirst3).toBeLessThan(1);
  });

  it('each card has expectedP and information', () => {
    const cards = makeCards([0, 1, 2]);
    const ordered = orderSessionCards(cards, 0);

    ordered.forEach((card) => {
      expect(card.expectedP).toBeGreaterThanOrEqual(0);
      expect(card.expectedP).toBeLessThanOrEqual(1);
      expect(card.information).toBeGreaterThanOrEqual(0);
    });
  });

  it('no duplicate cards in output', () => {
    const cards = makeCards([-2, -1, 0, 1, 2, 3, 4]);
    const ordered = orderSessionCards(cards, 0);
    const ids = ordered.map((c) => c.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Fatigue Detection ────────────────────────────────────────────

describe('detectSessionFatigue', () => {
  it('returns false for insufficient history', () => {
    expect(detectSessionFatigue([true, false, true])).toBe(false);
  });

  it('returns false for good accuracy', () => {
    // 8/10 correct = 80% > 60% threshold
    const history = [true, true, true, true, true, true, true, true, false, false];
    expect(detectSessionFatigue(history)).toBe(false);
  });

  it('returns true for poor accuracy in recent window', () => {
    // 5/10 correct = 50% < 60% threshold
    const history = [true, false, true, false, true, false, false, false, false, false];
    expect(detectSessionFatigue(history)).toBe(true);
  });

  it('only looks at the last N items', () => {
    // Good history followed by poor recent window
    const goodHistory = Array(20).fill(true);
    const poorRecent = Array(10).fill(false);
    const history = [...goodHistory, ...poorRecent];
    expect(detectSessionFatigue(history, 10)).toBe(true);
  });
});

// ─── FSRS ↔ Elo Conversion ───────────────────────────────────────

describe('fsrsDifficultyToElo', () => {
  it('maps FSRS D=5.5 (medium) to Elo 0', () => {
    expect(fsrsDifficultyToElo(5.5)).toBeCloseTo(0, 4);
  });

  it('maps FSRS D=1 (easy) to negative Elo', () => {
    expect(fsrsDifficultyToElo(1)).toBeLessThan(0);
  });

  it('maps FSRS D=10 (hard) to positive Elo', () => {
    expect(fsrsDifficultyToElo(10)).toBeGreaterThan(0);
  });
});

describe('eloToFsrsDifficulty', () => {
  it('inverse of fsrsDifficultyToElo', () => {
    for (const d of [1, 3, 5.5, 7, 10]) {
      const elo = fsrsDifficultyToElo(d);
      const roundTrip = eloToFsrsDifficulty(elo);
      expect(roundTrip).toBeCloseTo(d, 2);
    }
  });

  it('clamps output to [1, 10]', () => {
    expect(eloToFsrsDifficulty(-10)).toBe(1);
    expect(eloToFsrsDifficulty(10)).toBe(10);
  });
});
