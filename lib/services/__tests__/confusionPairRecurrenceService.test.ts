import { describe, it, expect } from 'vitest';
import { analyzeConfusionRecurrence } from '../confusionPairRecurrenceService';

describe('analyzeConfusionRecurrence', () => {
  // ── No escalation ──

  it('returns no escalation for count 0', () => {
    const result = analyzeConfusionRecurrence(0);
    expect(result.escalate).toBe(false);
    expect(result.difficultyBoost).toBe(0);
    expect(result.queueContrastiveDrill).toBe(false);
    expect(result.generateDifferentiation).toBe(false);
  });

  it('returns no escalation for count 1', () => {
    const result = analyzeConfusionRecurrence(1);
    expect(result.pairCount).toBe(1);
    expect(result.escalate).toBe(false);
    expect(result.difficultyBoost).toBe(0);
  });

  it('returns no escalation for count 2', () => {
    const result = analyzeConfusionRecurrence(2);
    expect(result.escalate).toBe(false);
    expect(result.difficultyBoost).toBe(0);
  });

  // ── Mild escalation (≥3) ──

  it('triggers mild escalation at count 3', () => {
    const result = analyzeConfusionRecurrence(3);
    expect(result.pairCount).toBe(3);
    expect(result.escalate).toBe(true);
    expect(result.difficultyBoost).toBe(0.5);
    expect(result.queueContrastiveDrill).toBe(true);
    expect(result.generateDifferentiation).toBe(false);
  });

  it('keeps mild escalation at count 4', () => {
    const result = analyzeConfusionRecurrence(4);
    expect(result.escalate).toBe(true);
    expect(result.difficultyBoost).toBe(0.5);
    expect(result.generateDifferentiation).toBe(false);
  });

  // ── Severe escalation (≥5) ──

  it('triggers severe escalation at count 5', () => {
    const result = analyzeConfusionRecurrence(5);
    expect(result.pairCount).toBe(5);
    expect(result.escalate).toBe(true);
    expect(result.difficultyBoost).toBe(1.0);
    expect(result.queueContrastiveDrill).toBe(true);
    expect(result.generateDifferentiation).toBe(true);
  });

  it('maintains severe escalation for high counts', () => {
    const result = analyzeConfusionRecurrence(10);
    expect(result.escalate).toBe(true);
    expect(result.difficultyBoost).toBe(1.0);
    expect(result.generateDifferentiation).toBe(true);
  });

  // ── Edge cases ──

  it('handles negative count gracefully', () => {
    const result = analyzeConfusionRecurrence(-1);
    expect(result.pairCount).toBe(0);
    expect(result.escalate).toBe(false);
    expect(result.difficultyBoost).toBe(0);
  });
});
