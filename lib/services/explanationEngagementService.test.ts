// SAFE-OVERRIDE: no shell commands; 'sh' false-positive from 'engagementScore'/'stabilityModifier' strings
/**
 * Unit tests for lib/services/explanationEngagementService.ts
 *
 * engagementScore = dwellSignal * min(1, depthSignal)
 *   dwellSignal  = min(1, ln(1 + viewedMs / 5000))
 *   depthSignal  = max(scrollDepth, 0.3 + expandedSections * 0.15)
 *
 * Incorrect answer modifiers:
 *   engagementScore > 0.60                                   → stabilityModifier = 1.08
 *   engagementScore < 0.20 AND viewedMs > 1000 (strict >)   → stabilityModifier = 0.95
 *   otherwise                                                → stabilityModifier = 1.0
 *
 * Correct answer modifiers:
 *   viewedMs > 15000 AND scrollDepth > 0.5                  → confidenceModifier = 0.95
 *   otherwise                                                → confidenceModifier = 1.0
 */

import { describe, it, expect } from 'vitest';
import { analyzeExplanationEngagement } from './explanationEngagementService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Expected engagement score for given inputs (not rounded).
 * dwell = min(1, ln(1 + ms/5000)); depth = max(scroll, 0.3 + sections*0.15)
 */
function expectedEngagement(viewedMs: number, scrollDepth: number, expandedSections: number): number {
  const dwell = Math.min(1, Math.log(1 + viewedMs / 5000));
  const depth = Math.max(scrollDepth, 0.3 + expandedSections * 0.15);
  return dwell * Math.min(1, depth);
}

// ─── engagementScore computation ─────────────────────────────────────────────

describe('analyzeExplanationEngagement — engagementScore', () => {
  it('returns engagementScore = 0 when viewedMs = 0, no scroll, no sections', () => {
    const r = analyzeExplanationEngagement(0, 0, 0, true);
    expect(r.engagementScore).toBe(0);
  });

  it('engagementScore is rounded to 3 decimal places', () => {
    const r = analyzeExplanationEngagement(3000, 0.5, 0, true);
    const raw = expectedEngagement(3000, 0.5, 0);
    expect(r.engagementScore).toBe(Math.round(raw * 1000) / 1000);
  });

  it('dwell signal saturates at 1.0 for very long dwell times', () => {
    // viewedMs = 200000 → ln(1 + 40) = 3.71 → capped at 1.0
    const r = analyzeExplanationEngagement(200000, 1.0, 0, true);
    // dwellSignal = 1.0, depthSignal = max(1.0, 0.3) = 1.0
    expect(r.engagementScore).toBeCloseTo(1.0, 3);
  });

  it('section expansions boost depthSignal above scrollDepth', () => {
    // scrollDepth=0.10, expandedSections=3 → depth = max(0.10, 0.3+0.45) = 0.75
    const r1 = analyzeExplanationEngagement(10000, 0.10, 0, true); // depth = max(0.10, 0.3) = 0.3
    const r2 = analyzeExplanationEngagement(10000, 0.10, 3, true); // depth = max(0.10, 0.75) = 0.75
    expect(r2.engagementScore).toBeGreaterThan(r1.engagementScore);
  });

  it('depthSignal is clamped to 1.0 maximum', () => {
    // scrollDepth=1.0, 5 sections → depthSignal = max(1.0, 1.05) → min(1, 1.05) = 1.0
    const r = analyzeExplanationEngagement(200000, 1.0, 5, true);
    expect(r.engagementScore).toBeCloseTo(1.0, 3);
  });

  it('base scroll depth of 0.3 applies even with scrollDepth=0', () => {
    // depthSignal = max(0, 0.3) = 0.3 (minimum guaranteed)
    const r = analyzeExplanationEngagement(5000, 0, 0, false);
    const expected = Math.log(2) * 0.3; // dwell = ln(2) ≈ 0.693, depth = 0.3
    expect(r.engagementScore).toBeCloseTo(expected, 3);
  });
});

// ─── Post-error: stability modifiers ─────────────────────────────────────────

describe('analyzeExplanationEngagement — post-error stability modifiers', () => {
  it('deep engagement (score > 0.60) after error → stabilityModifier = 1.08', () => {
    // viewedMs=20000 → dwellSignal=1.0; scrollDepth=0.9 → depthSignal=0.9
    // engagementScore = 0.9 > 0.6
    const r = analyzeExplanationEngagement(20000, 0.9, 0, false);
    expect(r.engagementScore).toBeGreaterThan(0.6);
    expect(r.stabilityModifier).toBeCloseTo(1.08, 3);
    expect(r.confidenceModifier).toBeCloseTo(1.0, 3);
  });

  it('shallow engagement (score < 0.20) with meaningful dwell → stabilityModifier = 0.95', () => {
    // viewedMs=2000 → dwellSignal=ln(1.4)≈0.337; scrollDepth=0 → depthSignal=0.3
    // engagementScore ≈ 0.337*0.3 = 0.101 < 0.20; viewedMs=2000 > 1000
    const r = analyzeExplanationEngagement(2000, 0, 0, false);
    expect(r.engagementScore).toBeLessThan(0.2);
    expect(r.stabilityModifier).toBeCloseTo(0.95, 3);
  });

  it('shallow engagement but viewedMs exactly 1000 (not > 1000) → no penalty', () => {
    // Condition is viewedMs > 1000 (strict >); 1000 is NOT > 1000
    const r = analyzeExplanationEngagement(1000, 0, 0, false);
    expect(r.stabilityModifier).toBeCloseTo(1.0, 3);
  });

  it('shallow engagement but viewedMs = 0 → no penalty (not meaningful dwell)', () => {
    const r = analyzeExplanationEngagement(0, 0, 0, false);
    expect(r.stabilityModifier).toBeCloseTo(1.0, 3);
  });

  it('mid-range engagement (0.20–0.60) after error → stabilityModifier = 1.0 (neutral)', () => {
    // viewedMs=5000, scrollDepth=0.4 → dwell=ln(2)≈0.693; depth=max(0.4,0.3)=0.4
    // engagementScore ≈ 0.693*0.4 = 0.277 — between 0.20 and 0.60
    const r = analyzeExplanationEngagement(5000, 0.4, 0, false);
    expect(r.engagementScore).toBeGreaterThan(0.2);
    expect(r.engagementScore).toBeLessThan(0.6);
    expect(r.stabilityModifier).toBeCloseTo(1.0, 3);
  });

  it('section expansions can elevate engagement above deep threshold after error', () => {
    // viewedMs=10000, scrollDepth=0.1, expandedSections=3
    // dwell=min(1,ln(3))=1.0; depth=max(0.1, 0.75)=0.75 → score=0.75 > 0.60
    const r = analyzeExplanationEngagement(10000, 0.1, 3, false);
    expect(r.engagementScore).toBeGreaterThan(0.6);
    expect(r.stabilityModifier).toBeCloseTo(1.08, 3);
  });
});

// ─── Post-correct: surprise / confidence modifiers ───────────────────────────

describe('analyzeExplanationEngagement — post-correct confidence modifiers', () => {
  it('long dwell (>15s) + deep scroll (>0.5) after correct → confidenceModifier = 0.95', () => {
    const r = analyzeExplanationEngagement(20000, 0.8, 0, true);
    expect(r.confidenceModifier).toBeCloseTo(0.95, 3);
    expect(r.stabilityModifier).toBeCloseTo(1.0, 3);
  });

  it('long dwell (>15s) but shallow scroll (≤0.5) after correct → no penalty', () => {
    const r = analyzeExplanationEngagement(20000, 0.4, 0, true);
    expect(r.confidenceModifier).toBeCloseTo(1.0, 3);
  });

  it('deep scroll (>0.5) but short dwell (≤15s) after correct → no penalty', () => {
    const r = analyzeExplanationEngagement(5000, 0.8, 0, true);
    expect(r.confidenceModifier).toBeCloseTo(1.0, 3);
  });

  it('viewedMs exactly 15000 (not > 15000) after correct → no penalty (strict >)', () => {
    const r = analyzeExplanationEngagement(15000, 0.9, 0, true);
    expect(r.confidenceModifier).toBeCloseTo(1.0, 3);
  });

  it('scrollDepth exactly 0.5 (not > 0.5) after correct → no penalty (strict >)', () => {
    const r = analyzeExplanationEngagement(20000, 0.5, 0, true);
    expect(r.confidenceModifier).toBeCloseTo(1.0, 3);
  });

  it('deep engagement after correct answer does not affect stabilityModifier', () => {
    // Stability modifier only applies post-error
    const r = analyzeExplanationEngagement(20000, 0.9, 3, true);
    expect(r.stabilityModifier).toBeCloseTo(1.0, 3);
  });
});

// ─── Neutrals / defaults ─────────────────────────────────────────────────────

describe('analyzeExplanationEngagement — neutral defaults', () => {
  it('returns both modifiers = 1.0 for typical correct answer with brief review', () => {
    const r = analyzeExplanationEngagement(3000, 0.3, 0, true);
    expect(r.confidenceModifier).toBeCloseTo(1.0, 3);
    expect(r.stabilityModifier).toBeCloseTo(1.0, 3);
  });

  it('returns both modifiers = 1.0 when no engagement at all', () => {
    const r = analyzeExplanationEngagement(0, 0, 0, false);
    expect(r.confidenceModifier).toBeCloseTo(1.0, 3);
    expect(r.stabilityModifier).toBeCloseTo(1.0, 3);
  });

  it('all returned values are rounded to 3 decimal places', () => {
    const r = analyzeExplanationEngagement(7777, 0.6, 1, false);
    const roundTo3 = (v: number) => Math.round(v * 1000) / 1000;
    expect(r.engagementScore).toBe(roundTo3(r.engagementScore));
    expect(r.confidenceModifier).toBe(roundTo3(r.confidenceModifier));
    expect(r.stabilityModifier).toBe(roundTo3(r.stabilityModifier));
  });
});
