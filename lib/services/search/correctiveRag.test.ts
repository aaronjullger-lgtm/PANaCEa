/**
 * Unit tests for lib/services/search/correctiveRag.ts
 *
 * All functions are pure (no network, no DB). Tests pin confidence math
 * against known-good inputs so regressions in the quality-gate for LLM
 * context grounding surface immediately.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  gradeDocument,
  gradeDocuments,
  buildCRAGContext,
  type RetrievedDocument,
  type CRAGConfig,
} from './correctiveRag';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDoc(partial: Partial<RetrievedDocument> & { id: string }): RetrievedDocument {
  return {
    text: partial.text ?? '',
    score: partial.score ?? 0.5,
    source: partial.source ?? 'test',
    ...partial,
  };
}

// ─── gradeDocument ───────────────────────────────────────────────────────────

describe('gradeDocument', () => {
  it('marks document relevant when keyword overlap is high and retrieval score is strong', () => {
    const doc = makeDoc({
      id: 'd1',
      text: 'hypertension treatment management blood pressure control beta blocker ACE inhibitor',
      score: 0.9,
    });
    const result = gradeDocument('hypertension treatment', doc);
    expect(result.relevant).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.document.id).toBe('d1');
  });

  it('marks document not relevant when there is no keyword overlap and low score', () => {
    const doc = makeDoc({
      id: 'd2',
      text: 'mathematics algebra trigonometry quadratic equations polynomial',
      score: 0.1,
    });
    const result = gradeDocument('pneumonia treatment antibiotics', doc);
    expect(result.relevant).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('boosts confidence for documents dense with medical terms', () => {
    const medicalDoc = makeDoc({
      id: 'd3',
      // Contains many MEDICAL_TERMS entries: troponin, ekg, myocardial, infarction, aspirin
      text: 'troponin elevated ekg changes consistent with myocardial infarction administer aspirin heparin anticoagulant',
      score: 0.6,
    });
    const plainDoc = makeDoc({
      id: 'd4',
      // Identical structure but no medical terms
      text: 'value elevated measurement changes consistent with quadrant error administer tablet supplement',
      score: 0.6,
    });
    const query = 'chest pain evaluation';
    const medConf = gradeDocument(query, medicalDoc).confidence;
    const plainConf = gradeDocument(query, plainDoc).confidence;
    // Medical density (15% weight) should push medical doc higher
    expect(medConf).toBeGreaterThan(plainConf);
  });

  it('respects a custom minRelevance threshold', () => {
    const doc = makeDoc({
      id: 'd5',
      text: 'sepsis management lactate blood cultures broad spectrum antibiotics',
      score: 0.55,
    });
    // Default threshold 0.5 — may be relevant
    const defaultResult = gradeDocument('sepsis', doc);
    // Very high threshold 0.99 — should NOT be relevant
    const strictResult = gradeDocument('sepsis', doc, 0.99);
    expect(strictResult.relevant).toBe(false);
    // Default result could go either way depending on overlap; just verify threshold respected
    if (defaultResult.confidence >= 0.99) {
      expect(defaultResult.relevant).toBe(true);
    }
  });

  it('handles empty query tokens gracefully (zero-divide guard)', () => {
    const doc = makeDoc({ id: 'd6', text: 'atrial fibrillation rate control', score: 0.7 });
    // Empty query produces zero keyword overlap — should not throw
    expect(() => gradeDocument('', doc)).not.toThrow();
    const result = gradeDocument('', doc);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('handles empty document text gracefully', () => {
    const doc = makeDoc({ id: 'd7', text: '', score: 0.8 });
    expect(() => gradeDocument('pneumonia', doc)).not.toThrow();
    const result = gradeDocument('pneumonia', doc);
    expect(result.relevant).toBe(false); // zero overlap on empty doc
  });

  it('includes a human-readable reason string', () => {
    const doc = makeDoc({
      id: 'd8',
      text: 'pulmonary embolism diagnosis CT angiography Wells score',
      score: 0.9,
    });
    const result = gradeDocument('pulmonary embolism diagnosis', doc);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('confidence is clamped to 3 decimal places', () => {
    const doc = makeDoc({
      id: 'd9',
      text: 'diabetes mellitus insulin glucose management',
      score: 0.7,
    });
    const result = gradeDocument('diabetes insulin', doc);
    const decimals = result.confidence.toString().split('.')[1];
    expect(decimals === undefined || decimals.length <= 3).toBe(true);
  });
});

// ─── gradeDocuments ──────────────────────────────────────────────────────────

describe('gradeDocuments', () => {
  it('accepts all documents when all are relevant', async () => {
    const query = 'STEMI treatment aspirin heparin PCI';
    const docs: RetrievedDocument[] = [
      makeDoc({ id: 'a', text: 'STEMI treatment aspirin heparin percutaneous coronary intervention', score: 0.9 }),
      makeDoc({ id: 'b', text: 'STEMI management PCI aspirin anticoagulant heparin troponin', score: 0.85 }),
    ];
    const result = await gradeDocuments(query, docs);
    expect(result.accepted.length).toBe(2);
    expect(result.qualityScore).toBe(1);
    expect(result.fallbackTriggered).toBe(false);
  });

  it('rejects irrelevant documents', async () => {
    const query = 'meningitis lumbar puncture CSF analysis';
    const docs: RetrievedDocument[] = [
      makeDoc({ id: 'c', text: 'meningitis encephalitis lumbar puncture CSF pleocytosis', score: 0.85 }),
      makeDoc({ id: 'd', text: 'quadratic formula polynomial mathematics algebra', score: 0.1 }),
    ];
    const result = await gradeDocuments(query, docs);
    expect(result.accepted.length).toBe(1);
    expect(result.accepted[0].id).toBe('c');
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].document.id).toBe('d');
  });

  it('returns qualityScore = 0 when all docs are irrelevant', async () => {
    const docs: RetrievedDocument[] = [
      makeDoc({ id: 'e', text: 'trigonometry algebra calculus', score: 0.05 }),
      makeDoc({ id: 'f', text: 'quantum mechanics physics wavelength', score: 0.05 }),
    ];
    const result = await gradeDocuments('septic shock vasopressors', docs);
    expect(result.qualityScore).toBe(0);
    expect(result.accepted.length).toBe(0);
  });

  it('triggers fallback when quality is below threshold and fallbackRetriever is provided', async () => {
    const fallbackDoc = makeDoc({
      id: 'fallback-1',
      text: 'anaphylaxis epinephrine treatment shock allergy',
      score: 0.9,
    });
    const fallbackRetriever = vi.fn().mockResolvedValue([fallbackDoc]);

    const docs: RetrievedDocument[] = [
      makeDoc({ id: 'irrelevant', text: 'coffee espresso barista latte', score: 0.05 }),
    ];

    const config: CRAGConfig = {
      minQualityRatio: 0.3,
      fallbackRetriever,
    };
    const result = await gradeDocuments('anaphylaxis treatment', docs, config);
    expect(fallbackRetriever).toHaveBeenCalledOnce();
    expect(result.fallbackTriggered).toBe(true);
  });

  it('does NOT trigger fallback when no fallbackRetriever provided', async () => {
    const docs: RetrievedDocument[] = [
      makeDoc({ id: 'z', text: 'philosophy metaphysics ontology', score: 0.05 }),
    ];
    const result = await gradeDocuments('COPD bronchodilator', docs, { minQualityRatio: 0.3 });
    expect(result.fallbackTriggered).toBe(false);
    // accepted may be empty but should not throw
    expect(Array.isArray(result.accepted)).toBe(true);
  });

  it('handles empty document array without throwing', async () => {
    const result = await gradeDocuments('hypertension', []);
    expect(result.qualityScore).toBe(0);
    expect(result.accepted).toEqual([]);
    expect(result.fallbackTriggered).toBe(false);
  });

  it('respects maxAccepted cap', async () => {
    const query = 'pneumonia antibiotic treatment cephalosporin';
    const docs = Array.from({ length: 15 }, (_, i) =>
      makeDoc({
        id: `p${i}`,
        text: 'pneumonia antibiotic treatment cephalosporin respiratory infection fluoroquinolone',
        score: 0.9,
      })
    );
    const result = await gradeDocuments(query, docs, { maxAccepted: 5 });
    expect(result.accepted.length).toBeLessThanOrEqual(5);
  });

  it('qualityScore is rounded to 3 decimal places', async () => {
    const docs = [makeDoc({ id: 'q1', text: 'hypertension ACE inhibitor', score: 0.9 })];
    const result = await gradeDocuments('hypertension', docs);
    const decimals = result.qualityScore.toString().split('.')[1];
    expect(decimals === undefined || decimals.length <= 3).toBe(true);
  });
});

// ─── buildCRAGContext ─────────────────────────────────────────────────────────

describe('buildCRAGContext', () => {
  it('returns empty string for empty array', () => {
    expect(buildCRAGContext([])).toBe('');
  });

  it('includes source attribution with 1-based index', () => {
    const docs: RetrievedDocument[] = [
      makeDoc({ id: 'x', text: 'First doc content.', source: 'PubMed' }),
      makeDoc({ id: 'y', text: 'Second doc content.', source: 'ClinicalTrials' }),
    ];
    const ctx = buildCRAGContext(docs);
    expect(ctx).toContain('[Source 1: PubMed]');
    expect(ctx).toContain('[Source 2: ClinicalTrials]');
    expect(ctx).toContain('First doc content.');
    expect(ctx).toContain('Second doc content.');
  });

  it('preserves document order', () => {
    const docs: RetrievedDocument[] = [
      makeDoc({ id: 'a', text: 'Alpha', source: 'S1' }),
      makeDoc({ id: 'b', text: 'Beta', source: 'S2' }),
      makeDoc({ id: 'c', text: 'Gamma', source: 'S3' }),
    ];
    const ctx = buildCRAGContext(docs);
    const pos1 = ctx.indexOf('Alpha');
    const pos2 = ctx.indexOf('Beta');
    const pos3 = ctx.indexOf('Gamma');
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
  });
});
