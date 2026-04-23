// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for pure, data-in/data-out functions in lib/services/userTimingProfileService.ts
 *
 * Functions tested (no Prisma, no DB):
 *   classifyComplexityTier — maps question text word count to tier
 *
 * Tier thresholds (word count):
 *   short:    < 60 words
 *   medium:   60–149 words
 *   long:     150–299 words
 *   vignette: >= 300 words
 *
 * NOTE: computeUserTimingProfile, getUserSpeedFactor, computeBehavioralBaseline,
 *   getUserBehavioralBaseline, getUserBehavioralContext are excluded — they
 *   require PrismaClient.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyComplexityTier,
  type ComplexityTier,
} from './userTimingProfileService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wordsOf(n: number): string {
  return Array(n).fill('word').join(' ');
}

// ─── classifyComplexityTier ───────────────────────────────────────────────────

describe('classifyComplexityTier', () => {
  // Boundary: short < 60 words
  it('1-word text → short', () => {
    expect(classifyComplexityTier('Hello')).toBe('short');
  });

  it('59-word text → short', () => {
    expect(classifyComplexityTier(wordsOf(59))).toBe('short');
  });

  // Boundary: medium [60, 150)
  it('60-word text → medium', () => {
    expect(classifyComplexityTier(wordsOf(60))).toBe('medium');
  });

  it('100-word text → medium', () => {
    expect(classifyComplexityTier(wordsOf(100))).toBe('medium');
  });

  it('149-word text → medium', () => {
    expect(classifyComplexityTier(wordsOf(149))).toBe('medium');
  });

  // Boundary: long [150, 300)
  it('150-word text → long', () => {
    expect(classifyComplexityTier(wordsOf(150))).toBe('long');
  });

  it('225-word text → long', () => {
    expect(classifyComplexityTier(wordsOf(225))).toBe('long');
  });

  it('299-word text → long', () => {
    expect(classifyComplexityTier(wordsOf(299))).toBe('long');
  });

  // Boundary: vignette >= 300
  it('300-word text → vignette', () => {
    expect(classifyComplexityTier(wordsOf(300))).toBe('vignette');
  });

  it('500-word text → vignette', () => {
    expect(classifyComplexityTier(wordsOf(500))).toBe('vignette');
  });

  it('returns one of the four valid tiers for any input', () => {
    const valid = new Set<ComplexityTier>(['short', 'medium', 'long', 'vignette']);
    for (const n of [1, 30, 59, 60, 100, 149, 150, 299, 300, 500]) {
      expect(valid.has(classifyComplexityTier(wordsOf(n)))).toBe(true);
    }
  });

  it('handles leading/trailing whitespace correctly', () => {
    const text = '  ' + wordsOf(59) + '  '; // 59 words with surrounding spaces
    expect(classifyComplexityTier(text)).toBe('short');
  });

  it('handles multi-space gaps between words', () => {
    // 10 words separated by multiple spaces — still counted as 10
    const text = 'word  word   word    word word word word word word word';
    expect(classifyComplexityTier(text)).toBe('short');
  });

  it('realistic short question → short', () => {
    const q = 'A 45-year-old male presents with chest pain radiating to the left arm. What is the most likely diagnosis?';
    expect(classifyComplexityTier(q)).toBe('short');
  });

  it('300-word clinical vignette → vignette tier', () => {
    // Exactly 300 words → vignette
    const text = wordsOf(300);
    expect(classifyComplexityTier(text)).toBe('vignette');
  });
});
