import { describe, it, expect } from 'vitest';
import {
  formatEnrichmentsAsText,
  type ExplanationEnrichment,
  type EnrichedExplanation,
} from '../lib/services/questionExplanationEnricher';
import type { QuickRefData } from '../lib/services/clinicalQuickRefService';

// ─── Helpers ────────────────────────────────────────────────────────────────

const emptyQuickRef: QuickRefData = {
  normalLabs: [],
  vitalRanges: [],
  relevantPearls: [],
  differentialFeatures: [],
  relatedConditions: [],
};

function makeEnriched(
  overrides: Partial<EnrichedExplanation> = {}
): EnrichedExplanation {
  return {
    originalExplanation: 'The answer is B because acute MI presents with ST elevation.',
    enrichments: [],
    quickRef: emptyQuickRef,
    ...overrides,
  };
}

// ─── formatEnrichmentsAsText ────────────────────────────────────────────────

describe('formatEnrichmentsAsText', () => {
  const baseExplanation = 'The answer is B because acute MI presents with ST elevation.';

  it('returns original explanation when no enrichments', () => {
    const enriched = makeEnriched();
    const result = formatEnrichmentsAsText(enriched);
    expect(result).toBe(baseExplanation);
  });

  it('appends lab_context enrichments with chart emoji', () => {
    const enrichments: ExplanationEnrichment[] = [
      { type: 'lab_context', content: 'Troponin: Normal <0.04 ng/mL — Elevated in MI' },
    ];
    const result = formatEnrichmentsAsText(makeEnriched({ enrichments }));
    expect(result).toContain(baseExplanation);
    expect(result).toContain('--- Clinical Context ---');
    expect(result).toContain('Troponin');
    expect(result).toContain('📊');
  });

  it('appends clinical_pearl enrichments with bulb emoji', () => {
    const enrichments: ExplanationEnrichment[] = [
      { type: 'clinical_pearl', content: 'STEMI requires door-to-balloon time < 90 min' },
    ];
    const result = formatEnrichmentsAsText(makeEnriched({ enrichments }));
    expect(result).toContain('💡');
    expect(result).toContain('door-to-balloon');
  });

  it('appends differential_tip enrichments with magnifying glass emoji', () => {
    const enrichments: ExplanationEnrichment[] = [
      { type: 'differential_tip', content: 'Key features distinguishing PE: pleuritic chest pain' },
    ];
    const result = formatEnrichmentsAsText(makeEnriched({ enrichments }));
    expect(result).toContain('🔍');
    expect(result).toContain('pleuritic');
  });

  it('appends high_yield enrichments with star emoji', () => {
    const enrichments: ExplanationEnrichment[] = [
      { type: 'high_yield', content: 'PANCE high-yield: ACS management algorithm' },
    ];
    const result = formatEnrichmentsAsText(makeEnriched({ enrichments }));
    expect(result).toContain('⭐');
    expect(result).toContain('ACS management');
  });

  it('handles multiple enrichments preserving order', () => {
    const enrichments: ExplanationEnrichment[] = [
      { type: 'lab_context', content: 'CK-MB elevated' },
      { type: 'clinical_pearl', content: 'Aspirin + P2Y12 inhibitor dual therapy' },
      { type: 'differential_tip', content: 'Aortic dissection: tearing pain radiating to back' },
    ];
    const result = formatEnrichmentsAsText(makeEnriched({ enrichments }));
    expect(result).toContain('📊');
    expect(result).toContain('💡');
    expect(result).toContain('🔍');
    const labIdx = result.indexOf('CK-MB');
    const pearlIdx = result.indexOf('dual therapy');
    const diffIdx = result.indexOf('Aortic dissection');
    expect(labIdx).toBeLessThan(pearlIdx);
    expect(pearlIdx).toBeLessThan(diffIdx);
  });

  it('preserves separator line between original and enrichments', () => {
    const enrichments: ExplanationEnrichment[] = [
      { type: 'clinical_pearl', content: 'Test pearl' },
    ];
    const result = formatEnrichmentsAsText(makeEnriched({ enrichments }));
    const lines = result.split('\n');
    expect(lines[0]).toBe(baseExplanation);
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('--- Clinical Context ---');
    expect(lines.length).toBe(4);
  });
});

// ─── Type Contracts ─────────────────────────────────────────────────────────

describe('questionExplanationEnricher type contracts', () => {
  it('ExplanationEnrichment type is a 4-value union', () => {
    const types: ExplanationEnrichment['type'][] = [
      'lab_context', 'clinical_pearl', 'differential_tip', 'high_yield'
    ];
    for (const t of types) {
      const e: ExplanationEnrichment = { type: t, content: `test ${t}` };
      expect(e.type).toBe(t);
    }
  });

  it('ExplanationEnrichment source is optional', () => {
    const withSource: ExplanationEnrichment = {
      type: 'clinical_pearl',
      content: 'pearl text',
      source: "Harrison's",
    };
    const withoutSource: ExplanationEnrichment = {
      type: 'clinical_pearl',
      content: 'pearl text',
    };
    expect(withSource.source).toBe("Harrison's");
    expect(withoutSource.source).toBeUndefined();
  });

  it('EnrichedExplanation includes quickRef data', () => {
    const enriched = makeEnriched();
    expect(enriched).toHaveProperty('originalExplanation');
    expect(enriched).toHaveProperty('enrichments');
    expect(enriched).toHaveProperty('quickRef');
    expect(enriched.quickRef).toHaveProperty('normalLabs');
    expect(enriched.quickRef).toHaveProperty('vitalRanges');
  });
});
