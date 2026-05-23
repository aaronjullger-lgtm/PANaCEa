/**
 * Tests for renderStructuredRationale — Clinical Content Quality Agent
 *
 * Covers:
 *   - Full rendering (all 5 rationale sections)
 *   - Partial rendering (only bottomLine + whyCorrect)
 *   - Distractor-focused rendering
 *   - Fallback for empty/legacy rationale
 *   - JSON parsing of stored structured rationale
 *   - Brief rendering for summary contexts
 */

import { describe, it, expect } from 'vitest';
import {
  renderStructuredRationale,
  renderBriefRationale,
  renderDistractorRationale,
  resolveStructuredRationale,
  type StructuredRationaleInput,
} from '@/lib/study/renderStructuredRationale';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeFullRationale(overrides: Partial<StructuredRationaleInput> = {}): StructuredRationaleInput {
  return {
    bottomLine: 'The diagnosis is acute MI, and the key discriminator is ST elevation on ECG.',
    whyCorrect: 'The patient presents with crushing substernal chest pain radiating to the left arm, ST elevation in leads II/III/aVF indicating inferior wall involvement, and elevated troponin I at 12 ng/mL — all classic for STEMI.',
    whyIncorrectA: 'Incorrect because PE typically presents with pleuritic chest pain, dyspnea, and clear lung fields on CXR. This patient has ST elevation without respiratory symptoms.',
    whyIncorrectB: 'Incorrect because aortic dissection causes tearing pain radiating to the back with pulse deficits or widened mediastinum on CXR. This patient has inferior ST elevation and no blood pressure differential.',
    whyIncorrectC: 'Incorrect because GERD causes burning retrosternal pain without ECG changes. The ST elevation and troponin elevation rule out esophageal pathology.',
    whyIncorrectD: 'Incorrect because costochondritis produces reproducible chest wall tenderness without ECG abnormalities. This patient has objective ST elevation and elevated troponin.',
    clinicalPearl: 'Remember: Inferior STEMI (II/III/aVF) often presents with nausea, vomiting, and bradycardia due to vagal stimulation — easily mistaken for GI pathology.',
    highYieldImageOrTable: 'Inferior MI localization: ST elevation in leads II, III, aVF → RCA or LCx occlusion.',
    ...overrides,
  };
}

// ─── renderStructuredRationale ──────────────────────────────────────────────

describe('renderStructuredRationale', () => {
  it('includes all 5 rationale sections in output', () => {
    const result = renderStructuredRationale(makeFullRationale());
    expect(result).toContain('acute MI');
    expect(result).toContain('Why option A is incorrect');
    expect(result).toContain('Why option B is incorrect');
    expect(result).toContain('Why option C is incorrect');
    expect(result).toContain('Why option D is incorrect');
    expect(result).toContain('Clinical Pearl');
    expect(result).toContain('High-Yield');
  });

  it('returns fallback for empty rationale', () => {
    const result = renderStructuredRationale({});
    expect(result).toContain('See rationale');
    expect(result).toContain('explanation panel');
  });

  it('omits high-yield when set to N/A', () => {
    const result = renderStructuredRationale(
      makeFullRationale({ highYieldImageOrTable: 'N/A' })
    );
    expect(result).not.toContain('High-Yield');
  });

  it('includes common pitfalls when present', () => {
    const result = renderStructuredRationale(
      makeFullRationale({ commonPitfalls: ['Beware anchoring bias'] })
    );
    expect(result).toContain('PANCE Trap');
  });

  it('omits distractor sections when none present', () => {
    const { whyIncorrectA, whyIncorrectB, whyIncorrectC, whyIncorrectD, ...rest } =
      makeFullRationale();
    const result = renderStructuredRationale(rest);
    expect(result).not.toContain('Why option');
  });

  it('strips HTML tags from rationale text', () => {
    const result = renderStructuredRationale(
      makeFullRationale({
        whyCorrect:
          'The <b>patient</b> has <span>STEMI</span> with ST elevation.',
      })
    );
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<span>');
    expect(result).toContain('The patient has STEMI');
  });
});

// ─── renderBriefRationale ───────────────────────────────────────────────────

describe('renderBriefRationale', () => {
  it('includes only bottomLine and whyCorrect', () => {
    const result = renderBriefRationale(makeFullRationale());
    expect(result).toContain('acute MI');
    expect(result).not.toContain('Why option');
    expect(result).not.toContain('Clinical Pearl');
    expect(result).not.toContain('High-Yield');
  });

  it('returns fallback when both fields missing', () => {
    const result = renderBriefRationale({});
    expect(result).toContain('See explanation panel');
  });

  it('omits null sections gracefully', () => {
    const result = renderBriefRationale({
      bottomLine: 'Just the bottom line.',
    });
    expect(result).toBe('Just the bottom line.');
  });
});

// ─── renderDistractorRationale ──────────────────────────────────────────────

describe('renderDistractorRationale', () => {
  it('includes all distractor explanations', () => {
    const result = renderDistractorRationale(makeFullRationale());
    expect(result).toContain('Option A is incorrect because');
    expect(result).toContain('Option B is incorrect because');
    expect(result).toContain('Option C is incorrect because');
    expect(result).toContain('Option D is incorrect because');
    expect(result).toContain('Remember');
  });

  it('marks the user choice distinctly', () => {
    const result = renderDistractorRationale(makeFullRationale(), 2); // chose C
    expect(result).toContain('Your answer (C) was wrong because');
    expect(result).toContain('Option A is incorrect because');
    expect(result).toContain('Option B is incorrect because');
    expect(result).toContain('Option D is incorrect because');
  });

  it('returns empty string when no distractor explanations', () => {
    const result = renderDistractorRationale({});
    expect(result).toBe('');
  });

  it('includes clinical pearl as closer', () => {
    const result = renderDistractorRationale(makeFullRationale());
    expect(result).toContain('Remember:');
    expect(result).toContain('Inferior STEMI');
  });
});

// ─── resolveStructuredRationale ─────────────────────────────────────────────

describe('resolveStructuredRationale', () => {
  it('resolves object with whyCorrect', () => {
    const result = resolveStructuredRationale({ whyCorrect: 'Because X.' });
    expect(result).not.toBeNull();
    expect(result?.whyCorrect).toBe('Because X.');
  });

  it('resolves JSON string with bottomLine', () => {
    const json = JSON.stringify({
      bottomLine: 'Bottom.',
      whyCorrect: 'Correct.',
      clinicalPearl: 'Pearl.',
    });
    const result = resolveStructuredRationale(json);
    expect(result).not.toBeNull();
    expect(result?.bottomLine).toBe('Bottom.');
    expect(result?.clinicalPearl).toBe('Pearl.');
  });

  it('resolves JSON string that has no structured fields', () => {
    const json = JSON.stringify({ rationale: 'Some explanation.' });
    const result = resolveStructuredRationale(json);
    expect(result).toBeNull();
  });

  it('returns null for plain text', () => {
    const result = resolveStructuredRationale('Just a plain string explanation.');
    expect(result).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(resolveStructuredRationale(null)).toBeNull();
    expect(resolveStructuredRationale(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveStructuredRationale('')).toBeNull();
  });
});
