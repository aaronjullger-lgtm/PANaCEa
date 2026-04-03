import { describe, it, expect } from 'vitest';
import { analyzeExplanationEngagement } from '../explanationEngagementService';

describe('analyzeExplanationEngagement', () => {
  // ── After incorrect answer ──

  it('gives stability bonus for deep engagement after error', () => {
    // Long dwell + high scroll + expanded sections → deep engagement
    const result = analyzeExplanationEngagement(12000, 0.9, 2, false);
    expect(result.engagementScore).toBeGreaterThan(0.6);
    expect(result.stabilityModifier).toBe(1.08);
    expect(result.confidenceModifier).toBe(1.0); // no confidence change for errors
  });

  it('gives stability penalty for shallow engagement after error', () => {
    // Short dwell with minimal scroll → didn't read the explanation
    const result = analyzeExplanationEngagement(2000, 0.1, 0, false);
    expect(result.engagementScore).toBeLessThan(0.2);
    expect(result.stabilityModifier).toBe(0.95);
    expect(result.confidenceModifier).toBe(1.0);
  });

  it('returns neutral for very brief glance after error (< 1s)', () => {
    // < 1000ms → might have been a misclick, don't penalize
    const result = analyzeExplanationEngagement(500, 0.0, 0, false);
    expect(result.stabilityModifier).toBe(1.0);
  });

  it('returns neutral for moderate engagement after error', () => {
    // Moderate engagement — neither deep nor shallow
    const result = analyzeExplanationEngagement(5000, 0.4, 0, false);
    expect(result.engagementScore).toBeGreaterThanOrEqual(0.2);
    expect(result.engagementScore).toBeLessThanOrEqual(0.6);
    expect(result.stabilityModifier).toBe(1.0);
  });

  // ── After correct answer ──

  it('returns neutral for brief review after correct', () => {
    const result = analyzeExplanationEngagement(3000, 0.3, 0, true);
    expect(result.confidenceModifier).toBe(1.0);
    expect(result.stabilityModifier).toBe(1.0);
  });

  it('penalizes confidence for long dwell + deep scroll after correct (surprise)', () => {
    // > 15000ms + scroll > 0.5 → surprise / lucky guess
    const result = analyzeExplanationEngagement(20000, 0.8, 3, true);
    expect(result.confidenceModifier).toBe(0.95);
    expect(result.stabilityModifier).toBe(1.0); // no stability change for correct
  });

  it('does not penalize if dwell is long but scroll is low after correct', () => {
    // Long dwell but didn't scroll (maybe just left the page open)
    const result = analyzeExplanationEngagement(20000, 0.3, 0, true);
    expect(result.confidenceModifier).toBe(1.0);
  });

  it('does not penalize if scroll is deep but dwell is short after correct', () => {
    // Fast scroll-through — not indicative of surprise
    const result = analyzeExplanationEngagement(5000, 0.9, 2, true);
    expect(result.confidenceModifier).toBe(1.0);
  });

  // ── Edge cases ──

  it('handles zero dwell gracefully', () => {
    const result = analyzeExplanationEngagement(0, 0, 0, true);
    expect(result.engagementScore).toBe(0);
    expect(result.confidenceModifier).toBe(1.0);
    expect(result.stabilityModifier).toBe(1.0);
  });

  it('engagement score is bounded 0–1', () => {
    // Extreme values
    const result = analyzeExplanationEngagement(100000, 1.0, 10, false);
    expect(result.engagementScore).toBeGreaterThanOrEqual(0);
    expect(result.engagementScore).toBeLessThanOrEqual(1);
  });

  it('section expansion contributes to engagement score', () => {
    const noExpand = analyzeExplanationEngagement(5000, 0.2, 0, false);
    const withExpand = analyzeExplanationEngagement(5000, 0.2, 3, false);
    expect(withExpand.engagementScore).toBeGreaterThan(noExpand.engagementScore);
  });
});
