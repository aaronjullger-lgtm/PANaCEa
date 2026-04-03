import { describe, it, expect } from 'vitest';
import { analyzeDistractorChronometry, type OptionInteractionRecord } from '../distractorChronometryService';

describe('analyzeDistractorChronometry', () => {
  // ── Edge cases ──

  it('returns neutral result for empty interactions', () => {
    const result = analyzeDistractorChronometry([], 'B', 'B');
    // With finalSelectedId but no tracked interactions, uniqueOptionsConsidered = 1
    expect(result.uniqueOptionsConsidered).toBe(1);
    expect(result.correctOptionAbandoned).toBe(false);
    expect(result.longestDistractorDwellMs).toBe(0);
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  it('returns neutral result for null/undefined interactions', () => {
    const result = analyzeDistractorChronometry(null as any, 'B', 'B');
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  // ── Decisive single selection ──

  it('returns multiplier 1.0 for decisive correct answer', () => {
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'B', selected_at_ms: 500, deselected_at_ms: 3000, dwell_ms: 2500 },
    ];
    const result = analyzeDistractorChronometry(interactions, 'B', 'B');
    expect(result.uniqueOptionsConsidered).toBe(1);
    expect(result.correctOptionAbandoned).toBe(false);
    expect(result.longestDistractorDwellMs).toBe(0);
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  it('returns multiplier 1.0 for decisive wrong answer (no switching)', () => {
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'A', selected_at_ms: 500, deselected_at_ms: 3000, dwell_ms: 2500 },
    ];
    const result = analyzeDistractorChronometry(interactions, 'B', 'A');
    expect(result.uniqueOptionsConsidered).toBe(1);
    expect(result.correctOptionAbandoned).toBe(false);
    expect(result.longestDistractorDwellMs).toBe(2500);
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  // ── Correct option abandoned (fragile knowledge) ──

  it('penalizes when correct option was selected then abandoned', () => {
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'B', selected_at_ms: 500, deselected_at_ms: 2000, dwell_ms: 1500 },
      { option_id: 'C', selected_at_ms: 2000, deselected_at_ms: 4000, dwell_ms: 2000 },
    ];
    const result = analyzeDistractorChronometry(interactions, 'B', 'C');
    expect(result.correctOptionAbandoned).toBe(true);
    expect(result.uniqueOptionsConsidered).toBe(2);
    expect(result.confidenceMultiplier).toBe(0.85);
  });

  // ── High uncertainty (3+ options) ──

  it('penalizes when 3 or more options were tried', () => {
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'A', selected_at_ms: 500, deselected_at_ms: 1000, dwell_ms: 500 },
      { option_id: 'C', selected_at_ms: 1000, deselected_at_ms: 2000, dwell_ms: 1000 },
      { option_id: 'B', selected_at_ms: 2000, deselected_at_ms: 3500, dwell_ms: 1500 },
    ];
    const result = analyzeDistractorChronometry(interactions, 'B', 'B');
    expect(result.uniqueOptionsConsidered).toBe(3);
    expect(result.correctOptionAbandoned).toBe(false);
    expect(result.confidenceMultiplier).toBe(0.95);
  });

  // ── Combined penalties ──

  it('stacks correct-abandoned and high-uncertainty penalties', () => {
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'B', selected_at_ms: 500, deselected_at_ms: 1000, dwell_ms: 500 },
      { option_id: 'A', selected_at_ms: 1000, deselected_at_ms: 2000, dwell_ms: 1000 },
      { option_id: 'D', selected_at_ms: 2000, deselected_at_ms: 3000, dwell_ms: 1000 },
    ];
    // Correct=B, final=D → abandoned + 3 options
    const result = analyzeDistractorChronometry(interactions, 'B', 'D');
    expect(result.correctOptionAbandoned).toBe(true);
    expect(result.uniqueOptionsConsidered).toBe(3);
    // 0.85 * 0.95 = 0.8075 → rounds to 0.808
    expect(result.confidenceMultiplier).toBe(0.808);
  });

  // ── Floor check ──

  it('never goes below 0.75', () => {
    // Even with maximum penalties, multiplier is 0.85 * 0.95 = 0.8075
    // which is above 0.75, but let's verify the floor works
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'B', selected_at_ms: 100, deselected_at_ms: 200, dwell_ms: 100 },
      { option_id: 'A', selected_at_ms: 200, deselected_at_ms: 300, dwell_ms: 100 },
      { option_id: 'C', selected_at_ms: 300, deselected_at_ms: 400, dwell_ms: 100 },
      { option_id: 'D', selected_at_ms: 400, deselected_at_ms: 500, dwell_ms: 100 },
    ];
    const result = analyzeDistractorChronometry(interactions, 'B', 'D');
    expect(result.confidenceMultiplier).toBeGreaterThanOrEqual(0.75);
  });

  // ── Longest distractor dwell ──

  it('tracks longest distractor dwell correctly', () => {
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'A', selected_at_ms: 500, deselected_at_ms: 800, dwell_ms: 300 },
      { option_id: 'C', selected_at_ms: 800, deselected_at_ms: 3000, dwell_ms: 2200 },
      { option_id: 'B', selected_at_ms: 3000, deselected_at_ms: 5000, dwell_ms: 2000 },
    ];
    const result = analyzeDistractorChronometry(interactions, 'B', 'B');
    // Distractors are A (300ms) and C (2200ms). Correct is B (2000ms, not counted as distractor).
    expect(result.longestDistractorDwellMs).toBe(2200);
  });

  it('handles null dwell_ms gracefully', () => {
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'A', selected_at_ms: 500, deselected_at_ms: null, dwell_ms: null },
      { option_id: 'B', selected_at_ms: 1000, deselected_at_ms: null, dwell_ms: null },
    ];
    const result = analyzeDistractorChronometry(interactions, 'B', 'B');
    expect(result.longestDistractorDwellMs).toBe(0);
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  // ── Two options (no high-uncertainty penalty) ──

  it('does not penalize for 2 options tried', () => {
    const interactions: OptionInteractionRecord[] = [
      { option_id: 'A', selected_at_ms: 500, deselected_at_ms: 1500, dwell_ms: 1000 },
      { option_id: 'B', selected_at_ms: 1500, deselected_at_ms: 3000, dwell_ms: 1500 },
    ];
    const result = analyzeDistractorChronometry(interactions, 'B', 'B');
    expect(result.uniqueOptionsConsidered).toBe(2);
    expect(result.correctOptionAbandoned).toBe(false);
    expect(result.confidenceMultiplier).toBe(1.0);
  });
});
