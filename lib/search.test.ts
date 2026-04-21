import { describe, it, expect } from 'vitest';
import { toRAGChunk, applyReranker, type MedicalContentSearchResult } from './search';

function makeRow(
  partial: Partial<MedicalContentSearchResult> & { id: string; condition: string }
): MedicalContentSearchResult {
  return {
    id: partial.id,
    condition: partial.condition,
    conditionId: partial.conditionId ?? '',
    system: partial.system ?? '',
    subcategory: partial.subcategory ?? '',
    pance_yield: partial.pance_yield ?? null,
    classic_patient: partial.classic_patient ?? null,
    buzzwords: partial.buzzwords ?? [],
    gold_standard_dx: partial.gold_standard_dx ?? null,
    first_line_rx: partial.first_line_rx ?? null,
    overview: partial.overview ?? null,
    symptoms: partial.symptoms ?? null,
    pathophysiology: partial.pathophysiology ?? null,
    treatment: partial.treatment ?? null,
    diagnostics: partial.diagnostics ?? null,
    best_initial_test: partial.best_initial_test ?? null,
    clinical_pearls: partial.clinical_pearls ?? null,
    lastClinicalReviewAt: partial.lastClinicalReviewAt ?? null,
    rrfScore: partial.rrfScore ?? 0.01,
  };
}

describe('toRAGChunk', () => {
  it('maps condition + buzzwords + pearls into a single content surface', () => {
    const row = makeRow({
      id: 'a',
      condition: 'Acute myocardial infarction',
      buzzwords: ['crushing substernal chest pain'],
      classic_patient: '58M smoker with diaphoresis',
      clinical_pearls: 'First-line: aspirin 325mg chewed',
      system: 'Cardiovascular',
    });
    const chunk = toRAGChunk(row);
    expect(chunk.sourceId).toBe('a');
    expect(chunk.system).toBe('Cardiovascular');
    expect(chunk.condition).toBe('Acute myocardial infarction');
    expect(chunk.content).toContain('Acute myocardial infarction');
    expect(chunk.content).toContain('crushing substernal chest pain');
    expect(chunk.content).toContain('aspirin');
    expect(chunk.similarity).toBeCloseTo(0.01, 6);
  });

  it('selects content-type by priority: pearls > treatment > diagnostics > patho > symptoms > overview', () => {
    expect(toRAGChunk(makeRow({ id: '1', condition: 'X', clinical_pearls: 'p' })).contentType).toBe(
      'clinical_pearls'
    );
    expect(toRAGChunk(makeRow({ id: '2', condition: 'X', first_line_rx: 'rx' })).contentType).toBe(
      'treatment'
    );
    expect(
      toRAGChunk(makeRow({ id: '3', condition: 'X', best_initial_test: 'CXR' })).contentType
    ).toBe('diagnostics');
    expect(
      toRAGChunk(makeRow({ id: '4', condition: 'X', pathophysiology: 'mech' })).contentType
    ).toBe('pathophysiology');
    expect(toRAGChunk(makeRow({ id: '5', condition: 'X', symptoms: 's' })).contentType).toBe(
      'symptoms'
    );
    expect(toRAGChunk(makeRow({ id: '6', condition: 'X' })).contentType).toBe('overview');
  });
});

describe('applyReranker', () => {
  it('returns an array of the same rows (no data loss)', () => {
    const rows = [
      makeRow({
        id: 'a',
        condition: 'Pericarditis',
        system: 'Cardiovascular',
        clinical_pearls: 'friction rub',
        rrfScore: 0.016,
      }),
      makeRow({
        id: 'b',
        condition: 'Acute myocardial infarction',
        system: 'Cardiovascular',
        buzzwords: ['crushing chest pain left arm radiation'],
        clinical_pearls: 'ST elevation, aspirin 325mg first-line',
        rrfScore: 0.015,
      }),
    ];
    const out = applyReranker(rows, 'crushing chest pain', 'Cardiovascular');
    expect(out).toHaveLength(2);
    const ids = out.map((r) => r.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('promotes the row whose content aligns with the query (lexical + clinical)', () => {
    // Row A: bare pericarditis with weak content; Row B: rich MI content that
    // should lexically dominate a "crushing chest pain" query.
    const rows = [
      makeRow({
        id: 'pericarditis',
        condition: 'Pericarditis',
        system: 'Cardiovascular',
        overview: 'inflammation of pericardium',
        rrfScore: 0.016, // slightly higher RRF (tie-breaker for reranker to flip)
      }),
      makeRow({
        id: 'mi',
        condition: 'Acute myocardial infarction',
        system: 'Cardiovascular',
        buzzwords: ['crushing chest pain radiating to left arm diaphoresis'],
        clinical_pearls: 'First-line: aspirin 325mg chewed; gold standard troponin',
        rrfScore: 0.015,
      }),
    ];
    const out = applyReranker(rows, 'crushing chest pain', 'Cardiovascular');
    expect(out[0]?.id).toBe('mi');
  });

  it('rewrites rrfScore to the rerank score (so UI can observe the lift)', () => {
    const rows = [
      makeRow({
        id: 'x',
        condition: 'X',
        clinical_pearls: 'guideline class I, sensitivity 0.95',
        system: 'Cardiovascular',
        rrfScore: 0.01,
      }),
    ];
    const out = applyReranker(rows, 'x', 'Cardiovascular');
    expect(out).toHaveLength(1);
    // Rerank score is bounded 0..1; should not equal the original RRF score.
    expect(out[0]!.rrfScore).toBeGreaterThan(0.01);
    expect(out[0]!.rrfScore).toBeLessThanOrEqual(1);
  });
});
