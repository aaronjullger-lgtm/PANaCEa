// SAFE-OVERRIDE: no shell commands; safety guard false-positive on function names
/**
 * Unit tests for lib/services/irtEloService.ts
 *
 * Covers pure functions:
 *   - raschProbability        1PL IRT (Elo expected score)
 *   - itemResponseFunction    3PL IRT with guessing parameter
 *   - fisherInformation       I(θ) = a² × P_rasch × (1 - P_rasch)
 *   - adaptiveKFactor         Glicko-style K ∈ [MIN_K, BASE_K]
 *   - eloUpdate               Elo update for ability/difficulty
 *   - detectSessionFatigue    Rolling window accuracy threshold
 *   - fsrsDifficultyToElo     FSRS D (1-10) → logit scale
 *   - eloToFsrsDifficulty     Logit scale → FSRS D (1-10), clamped
 */

import { describe, it, expect } from 'vitest';
import {
  raschProbability,
  itemResponseFunction,
  fisherInformation,
  adaptiveKFactor,
  eloUpdate,
  detectSessionFatigue,
  fsrsDifficultyToElo,
  eloToFsrsDifficulty,
  BASE_K_FACTOR,
  MIN_K_FACTOR,
  DEFAULT_UNCERTAINTY,
  GUESSING_PARAM,
  FATIGUE_ACCURACY_THRESHOLD,
  FATIGUE_WINDOW,
} from './irtEloService';

// ─── raschProbability ─────────────────────────────────────────────────────────

describe('raschProbability', () => {
  it('returns 0.5 when ability equals difficulty (symmetric point)', () => {
    expect(raschProbability(0, 0)).toBeCloseTo(0.5, 9);
    expect(raschProbability(2, 2)).toBeCloseTo(0.5, 9);
  });

  it('is monotonically increasing in ability', () => {
    expect(raschProbability(1, 0)).toBeGreaterThan(raschProbability(0, 0));
    expect(raschProbability(2, 0)).toBeGreaterThan(raschProbability(1, 0));
  });

  it('ability >> difficulty → approaches 1.0', () => {
    expect(raschProbability(10, 0)).toBeGreaterThan(0.9999);
  });

  it('ability << difficulty → approaches 0.0', () => {
    expect(raschProbability(-10, 0)).toBeLessThan(0.0001);
  });

  it('raschProbability(θ, b) + raschProbability(-θ, -b) = 1 (symmetry)', () => {
    const p = raschProbability(1, 0);
    const q = raschProbability(-1, 0);
    expect(p + q).toBeCloseTo(1.0, 9);
  });

  it('matches logistic formula: 1/(1+exp(-(θ-b)))', () => {
    const ability = 1.5;
    const difficulty = 0.8;
    const expected = 1 / (1 + Math.exp(-(ability - difficulty)));
    expect(raschProbability(ability, difficulty)).toBeCloseTo(expected, 9);
  });
});

// ─── itemResponseFunction (3PL) ───────────────────────────────────────────────

describe('itemResponseFunction (3PL)', () => {
  it('at θ=b with default params, P = 0.25 + 0.75/2 = 0.625 (never below guessing)', () => {
    expect(itemResponseFunction(0, 0)).toBeCloseTo(0.625, 9);
  });

  it('minimum is the guessing parameter (approaches GUESSING_PARAM for very hard items)', () => {
    // θ very low vs b very high → P approaches c=0.25
    expect(itemResponseFunction(-20, 0)).toBeCloseTo(GUESSING_PARAM, 3);
  });

  it('maximum approaches 1.0 for very easy items', () => {
    expect(itemResponseFunction(20, 0)).toBeCloseTo(1.0, 3);
  });

  it('with c=0 and a=1, reduces to raschProbability', () => {
    const ability = 1.5;
    const difficulty = 0.5;
    expect(itemResponseFunction(ability, difficulty, 1.0, 0)).toBeCloseTo(
      raschProbability(ability, difficulty),
      9
    );
  });

  it('higher discrimination → steeper function (more probability mass near b)', () => {
    // Far above difficulty: higher discrimination should push P closer to 1 faster
    const p_low_disc = itemResponseFunction(2, 0, 0.5, 0);
    const p_high_disc = itemResponseFunction(2, 0, 2.0, 0);
    expect(p_high_disc).toBeGreaterThan(p_low_disc);
  });
});

// ─── fisherInformation ────────────────────────────────────────────────────────

describe('fisherInformation', () => {
  it('peaks at θ = b (ability matches difficulty)', () => {
    // I(θ=b) = a² × 0.5 × 0.5 = 0.25 × a²
    // With a=1: I = 0.25
    expect(fisherInformation(0, 0, 1)).toBeCloseTo(0.25, 9);
  });

  it('is symmetric around b (I(θ=b+x) = I(θ=b-x))', () => {
    expect(fisherInformation(1, 0, 1)).toBeCloseTo(fisherInformation(-1, 0, 1), 9);
  });

  it('decreases as ability moves away from difficulty', () => {
    const atPeak = fisherInformation(0, 0, 1);
    const farAway = fisherInformation(3, 0, 1);
    expect(farAway).toBeLessThan(atPeak);
  });

  it('scales with discrimination² (higher a → more information)', () => {
    const I1 = fisherInformation(0, 0, 1);
    const I2 = fisherInformation(0, 0, 2);
    expect(I2).toBeCloseTo(I1 * 4, 6); // (2)² / (1)² = 4
  });
});

// ─── adaptiveKFactor ──────────────────────────────────────────────────────────

describe('adaptiveKFactor', () => {
  it('returns BASE_K_FACTOR at DEFAULT_UNCERTAINTY', () => {
    expect(adaptiveKFactor(DEFAULT_UNCERTAINTY)).toBeCloseTo(BASE_K_FACTOR, 9);
  });

  it('returns MIN_K_FACTOR at uncertainty = 0 (floor enforced)', () => {
    expect(adaptiveKFactor(0)).toBe(MIN_K_FACTOR);
  });

  it('is clamped to BASE_K_FACTOR at very high uncertainty', () => {
    expect(adaptiveKFactor(100)).toBe(BASE_K_FACTOR);
  });

  it('is proportional to uncertainty within the unclamped range', () => {
    const halfUncertainty = DEFAULT_UNCERTAINTY / 2;
    const expected = BASE_K_FACTOR * 0.5;
    // Only valid if expected >= MIN_K_FACTOR
    if (expected >= MIN_K_FACTOR) {
      expect(adaptiveKFactor(halfUncertainty)).toBeCloseTo(expected, 9);
    }
  });
});

// ─── eloUpdate ────────────────────────────────────────────────────────────────

describe('eloUpdate', () => {
  it('ability increases after correct answer when ability = difficulty', () => {
    const r = eloUpdate(0, 0, true);
    expect(r.newAbility).toBeGreaterThan(0);
    // expectedP = 0.5, K = 0.4, surprise = 0.5 → newAbility = 0.2
    expect(r.newAbility).toBeCloseTo(0.2, 9);
  });

  it('ability decreases after incorrect answer when ability = difficulty', () => {
    const r = eloUpdate(0, 0, false);
    expect(r.newAbility).toBeLessThan(0);
    expect(r.newAbility).toBeCloseTo(-0.2, 9);
  });

  it('difficulty decreases when student gets it right (item gets "easier")', () => {
    const r = eloUpdate(0, 0, true);
    expect(r.newDifficulty).toBeLessThan(0);
    expect(r.newDifficulty).toBeCloseTo(-0.2, 9);
  });

  it('difficulty increases when student gets it wrong (item gets "harder")', () => {
    const r = eloUpdate(0, 0, false);
    expect(r.newDifficulty).toBeGreaterThan(0);
    expect(r.newDifficulty).toBeCloseTo(0.2, 9);
  });

  it('expectedP is returned in result', () => {
    const r = eloUpdate(1, 0, true);
    expect(r.expectedP).toBeCloseTo(raschProbability(1, 0), 9);
  });

  it('uncertainty decays toward MIN_UNCERTAINTY (multiply by 0.98 each time)', () => {
    const r = eloUpdate(0, 0, true, DEFAULT_UNCERTAINTY, DEFAULT_UNCERTAINTY);
    expect(r.newStudentUncertainty).toBeCloseTo(DEFAULT_UNCERTAINTY * 0.98, 9);
    expect(r.newItemUncertainty).toBeCloseTo(DEFAULT_UNCERTAINTY * 0.98, 9);
  });

  it('uncertainty is clamped to MIN_UNCERTAINTY', () => {
    // Pass very low uncertainty — should clamp to MIN
    const r = eloUpdate(0, 0, true, 0.1, 0.1);
    expect(r.newStudentUncertainty).toBeGreaterThanOrEqual(0.3);
    expect(r.newItemUncertainty).toBeGreaterThanOrEqual(0.3);
  });

  it('correct answer on hard item (low expectedP) produces larger ability gain', () => {
    // Easy item (high expectedP): small surprise
    const easy = eloUpdate(0, -3, true); // ability >> difficulty
    // Hard item (low expectedP): large surprise
    const hard = eloUpdate(0, 3, true);  // ability << difficulty
    expect(hard.newAbility).toBeGreaterThan(easy.newAbility);
  });

  it('information is computed from fisher information', () => {
    const r = eloUpdate(0, 0, true);
    expect(r.information).toBeCloseTo(fisherInformation(0, 0), 9);
  });
});

// ─── detectSessionFatigue ─────────────────────────────────────────────────────

describe('detectSessionFatigue', () => {
  it('returns false when history is shorter than window', () => {
    const history = Array.from({ length: FATIGUE_WINDOW - 1 }, () => false);
    expect(detectSessionFatigue(history)).toBe(false);
  });

  it('returns false for all-correct recent history', () => {
    const history = Array.from({ length: FATIGUE_WINDOW }, () => true);
    expect(detectSessionFatigue(history)).toBe(false);
  });

  it('returns true when accuracy drops below FATIGUE_ACCURACY_THRESHOLD', () => {
    // FATIGUE_ACCURACY_THRESHOLD = 0.60; 5/10 = 0.50 < 0.60 → fatigued
    const history = [
      ...Array.from({ length: 5 }, () => true),
      ...Array.from({ length: 5 }, () => false),
    ];
    expect(detectSessionFatigue(history)).toBe(true);
  });

  it('uses only the last window items from a longer history', () => {
    // 20 items: first 10 all incorrect (old), last 10 all correct (recent)
    const history = [
      ...Array.from({ length: 10 }, () => false),
      ...Array.from({ length: 10 }, () => true),
    ];
    // Recent window (last 10) = all correct → not fatigued
    expect(detectSessionFatigue(history)).toBe(false);
  });

  it('accepts custom window and threshold', () => {
    const history = [true, false, false]; // 1/3 ≈ 0.33 < 0.50
    expect(detectSessionFatigue(history, 3, 0.50)).toBe(true);
    expect(detectSessionFatigue(history, 3, 0.30)).toBe(false);
  });
});

// ─── fsrsDifficultyToElo ──────────────────────────────────────────────────────

describe('fsrsDifficultyToElo', () => {
  it('maps mid-point (5.5) to 0 logit (neutral)', () => {
    expect(fsrsDifficultyToElo(5.5)).toBeCloseTo(0, 9);
  });

  it('easy items (D=1) map to negative logit (≈ -3)', () => {
    expect(fsrsDifficultyToElo(1)).toBeCloseTo(-3, 0);
  });

  it('hard items (D=10) map to positive logit (≈ +3)', () => {
    expect(fsrsDifficultyToElo(10)).toBeCloseTo(3, 0);
  });

  it('is monotonically increasing', () => {
    expect(fsrsDifficultyToElo(7)).toBeGreaterThan(fsrsDifficultyToElo(5));
  });
});

// ─── eloToFsrsDifficulty ─────────────────────────────────────────────────────

describe('eloToFsrsDifficulty', () => {
  it('maps 0 logit back to ≈ 5.5 (mid-point)', () => {
    expect(eloToFsrsDifficulty(0)).toBeCloseTo(5.5, 3);
  });

  it('is clamped to [1, 10]', () => {
    expect(eloToFsrsDifficulty(-100)).toBe(1);
    expect(eloToFsrsDifficulty(100)).toBe(10);
  });

  it('roundtrip fsrsDifficultyToElo → eloToFsrsDifficulty approximately recovers D', () => {
    for (const d of [1, 3, 5.5, 7, 10]) {
      const elo = fsrsDifficultyToElo(d);
      const recovered = eloToFsrsDifficulty(elo);
      expect(recovered).toBeCloseTo(d, 1);
    }
  });
});
