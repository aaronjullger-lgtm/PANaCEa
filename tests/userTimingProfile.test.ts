/**
 * User Timing Profile — Unit Tests (Sprint 1)
 *
 * Tests personalized par time calibration:
 * - Complexity tier classification
 * - Speed factor computation
 * - calculateParTime with user speed factor
 */

import { describe, it, expect } from 'vitest';
import {
  classifyComplexityTier,
  type ComplexityTier,
} from '../lib/services/userTimingProfileService';
import { calculateParTime } from '../lib/utils/questionComplexity';

// ── Complexity Tier Classification ──────────────────────────────────────────

describe('classifyComplexityTier', () => {
  it('classifies short questions (< 60 words)', () => {
    const text = 'Which of the following is the most common cause of pneumonia?';
    expect(classifyComplexityTier(text)).toBe('short');
  });

  it('classifies medium questions (60-150 words)', () => {
    const words = Array(100).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('medium');
  });

  it('classifies long questions (150-300 words)', () => {
    const words = Array(200).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('long');
  });

  it('classifies vignette questions (> 300 words)', () => {
    const words = Array(350).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('vignette');
  });

  it('handles empty text', () => {
    expect(classifyComplexityTier('')).toBe('short');
  });

  it('handles exact boundary at 60 words', () => {
    const words = Array(60).fill('word').join(' ');
    expect(classifyComplexityTier(words)).toBe('medium');
  });
});

// ── Personalized Par Time ───────────────────────────────────────────────────

describe('calculateParTime with userSpeedFactor', () => {
  const baseQuestion = {
    stem: Array(90).fill('word').join(' '), // ~90 words → medium complexity
    choices: ['Option A text here', 'Option B text here', 'Option C text here', 'Option D text here'],
  };

  it('returns population baseline when speedFactor = 1.0', () => {
    const baseline = calculateParTime(baseQuestion, 1.0);
    const noFactor = calculateParTime(baseQuestion);
    expect(baseline).toBe(noFactor);
  });

  it('shortens par time for fast readers (speedFactor > 1.0)', () => {
    const baseline = calculateParTime(baseQuestion, 1.0);
    const fast = calculateParTime(baseQuestion, 1.5);
    expect(fast).toBeLessThan(baseline);
  });

  it('lengthens par time for slow readers (speedFactor < 1.0)', () => {
    const baseline = calculateParTime(baseQuestion, 1.0);
    const slow = calculateParTime(baseQuestion, 0.7);
    expect(slow).toBeGreaterThan(baseline);
  });

  it('clamps speedFactor floor at 0.5 to prevent extreme par times', () => {
    const atFloor = calculateParTime(baseQuestion, 0.5);
    const belowFloor = calculateParTime(baseQuestion, 0.1);
    // 0.1 should be treated as 0.5 due to Math.max(0.5, ...)
    expect(belowFloor).toBe(atFloor);
  });

  it('does not scale decision buffer, only reading time', () => {
    // Short question: reading time is small, decision buffer dominates
    const shortQ = { stem: 'Which drug?', choices: ['A', 'B', 'C', 'D'] };
    const baselineShort = calculateParTime(shortQ, 1.0);
    const fastShort = calculateParTime(shortQ, 2.0);

    // Long question: reading time dominates
    const longQ = { stem: Array(250).fill('word').join(' '), choices: ['A', 'B', 'C', 'D'] };
    const baselineLong = calculateParTime(longQ, 1.0);
    const fastLong = calculateParTime(longQ, 2.0);

    // Speed factor should have larger relative effect on long questions
    const shortReduction = 1 - (fastShort / baselineShort);
    const longReduction = 1 - (fastLong / baselineLong);
    expect(longReduction).toBeGreaterThan(shortReduction);
  });

  it('preserves 15-second floor', () => {
    const tinyQ = { stem: 'Test?', choices: ['A', 'B'] };
    // Even with 2x speed, should not go below 15s
    const result = calculateParTime(tinyQ, 2.0);
    expect(result).toBeGreaterThanOrEqual(15000);
  });

  it('handles image and lab buffers alongside speed factor', () => {
    const labQ = {
      stem: Array(90).fill('word').join(' '),
      choices: ['A', 'B', 'C', 'D'],
      hasLabs: true,
      imageUrl: 'https://example.com/xray.png',
    };
    const baseline = calculateParTime(labQ, 1.0);
    const fast = calculateParTime(labQ, 1.5);

    // Lab and image buffers are fixed, so fast reader still gets some reduction
    expect(fast).toBeLessThan(baseline);
    // But the reduction should be moderate since buffers don't scale
    expect(fast).toBeGreaterThan(baseline * 0.6);
  });
});
