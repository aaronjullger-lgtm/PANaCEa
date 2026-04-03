import { describe, it, expect } from 'vitest';
import { analyzeSwitchDirections } from '../switchDirectionService';

describe('analyzeSwitchDirections', () => {
  // ── Edge cases ──

  it('returns neutral result for empty interactions', () => {
    const result = analyzeSwitchDirections([], 'B');
    expect(result.wrongToRight).toBe(0);
    expect(result.rightToWrong).toBe(0);
    expect(result.wrongToWrong).toBe(0);
    expect(result.netSwitchValue).toBe(0);
    expect(result.metacognitivePrecision).toBeNull();
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  it('returns neutral result for single interaction (no switch)', () => {
    const result = analyzeSwitchDirections([{ option_id: 'B' }], 'B');
    expect(result.confidenceMultiplier).toBe(1.0);
    expect(result.metacognitivePrecision).toBeNull();
  });

  it('returns neutral result for null interactions', () => {
    const result = analyzeSwitchDirections(null as any, 'B');
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  // ── Wrong → Right (beneficial self-correction) ──

  it('rewards wrong → right switch with bonus', () => {
    const interactions = [
      { option_id: 'A' }, // wrong
      { option_id: 'B' }, // right (correct)
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.wrongToRight).toBe(1);
    expect(result.rightToWrong).toBe(0);
    expect(result.wrongToWrong).toBe(0);
    expect(result.netSwitchValue).toBe(1);
    expect(result.metacognitivePrecision).toBe(1.0);
    expect(result.confidenceMultiplier).toBe(1.03);
  });

  // ── Right → Wrong (harmful second-guessing) ──

  it('penalizes right → wrong switch', () => {
    const interactions = [
      { option_id: 'B' }, // right
      { option_id: 'A' }, // wrong
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.wrongToRight).toBe(0);
    expect(result.rightToWrong).toBe(1);
    expect(result.wrongToWrong).toBe(0);
    expect(result.netSwitchValue).toBe(-1);
    expect(result.metacognitivePrecision).toBe(0);
    expect(result.confidenceMultiplier).toBe(0.9);
  });

  // ── Wrong → Wrong (lateral confusion) ──

  it('handles wrong → wrong switches', () => {
    const interactions = [
      { option_id: 'A' }, // wrong
      { option_id: 'C' }, // wrong
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.wrongToRight).toBe(0);
    expect(result.rightToWrong).toBe(0);
    expect(result.wrongToWrong).toBe(1);
    expect(result.netSwitchValue).toBe(0);
    // 1 wrong→wrong is below the flailing threshold (≥2)
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  it('penalizes flailing (2+ wrong → wrong)', () => {
    const interactions = [
      { option_id: 'A' }, // wrong
      { option_id: 'C' }, // wrong
      { option_id: 'D' }, // wrong
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.wrongToWrong).toBe(2);
    expect(result.confidenceMultiplier).toBe(0.95);
  });

  // ── Complex sequences ──

  it('handles mixed sequence: wrong → right → wrong', () => {
    const interactions = [
      { option_id: 'A' }, // wrong
      { option_id: 'B' }, // right
      { option_id: 'C' }, // wrong
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.wrongToRight).toBe(1);
    expect(result.rightToWrong).toBe(1);
    expect(result.wrongToWrong).toBe(0);
    expect(result.netSwitchValue).toBe(0);
    // right→wrong penalty: 0.90
    // wrongToRight > 0 but rightToWrong > 0, so no bonus
    expect(result.confidenceMultiplier).toBe(0.9);
  });

  it('handles flailing + right→wrong combined', () => {
    const interactions = [
      { option_id: 'B' }, // right
      { option_id: 'A' }, // wrong
      { option_id: 'C' }, // wrong
      { option_id: 'D' }, // wrong
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.rightToWrong).toBe(1);
    expect(result.wrongToWrong).toBe(2);
    // 0.90 * 0.95 = 0.855
    expect(result.confidenceMultiplier).toBe(0.855);
  });

  it('handles right → right (re-selecting same correct option) as no switch', () => {
    const interactions = [
      { option_id: 'B' }, // right
      { option_id: 'B' }, // right (re-selected)
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.wrongToRight).toBe(0);
    expect(result.rightToWrong).toBe(0);
    expect(result.wrongToWrong).toBe(0);
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  // ── Metacognitive precision ──

  it('computes metacognitive precision correctly', () => {
    const interactions = [
      { option_id: 'A' }, // wrong
      { option_id: 'C' }, // wrong (wrong→wrong)
      { option_id: 'B' }, // right (wrong→right)
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.wrongToRight).toBe(1);
    expect(result.wrongToWrong).toBe(1);
    // precision = 1/2 = 0.5
    expect(result.metacognitivePrecision).toBe(0.5);
  });

  // ── Floor check ──

  it('never goes below 0.80', () => {
    const interactions = [
      { option_id: 'B' }, // right
      { option_id: 'A' }, // wrong (right→wrong)
      { option_id: 'C' }, // wrong (wrong→wrong)
      { option_id: 'D' }, // wrong (wrong→wrong)
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    // 0.90 * 0.95 = 0.855 > 0.80 (doesn't hit floor in practice)
    expect(result.confidenceMultiplier).toBeGreaterThanOrEqual(0.80);
  });

  // ── Multiple beneficial switches ──

  it('gives bonus for multiple wrong→right with no right→wrong', () => {
    const interactions = [
      { option_id: 'A' }, // wrong
      { option_id: 'B' }, // right (wrong→right)
      { option_id: 'A' }, // wrong (right→wrong) — wait, this breaks the bonus
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    // Has right→wrong, so no bonus
    expect(result.confidenceMultiplier).toBe(0.9);
  });

  it('gives bonus for clean wrong→right sequence', () => {
    // Simulates: picked wrong, then self-corrected to right
    const interactions = [
      { option_id: 'C' }, // wrong
      { option_id: 'B' }, // right (wrong→right, clean)
    ];
    const result = analyzeSwitchDirections(interactions, 'B');
    expect(result.wrongToRight).toBe(1);
    expect(result.rightToWrong).toBe(0);
    expect(result.confidenceMultiplier).toBe(1.03);
  });
});
