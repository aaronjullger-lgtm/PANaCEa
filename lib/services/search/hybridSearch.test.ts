/**
 * Unit tests for lib/services/search/hybridSearch.ts
 *
 * Only classifyQuery is a pure, network-free function — all other exports
 * (hybridSearchRRF, appLevelRRF, getEmbedding) require a live DB / Gemini API
 * and belong in integration tests. These tests pin the classification logic so
 * regressions in HyDE routing surface immediately.
 */

import { describe, it, expect } from 'vitest';
import { classifyQuery, type QueryComplexity } from './hybridSearch';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertComplexity(query: string, expected: QueryComplexity) {
  const result = classifyQuery(query);
  expect(result, `classifyQuery("${query}") → expected "${expected}" but got "${result}"`).toBe(
    expected
  );
}

// ─── Simple queries ───────────────────────────────────────────────────────────

describe('classifyQuery — simple', () => {
  it('classifies short single-word drug name as simple', () => {
    assertComplexity('metformin', 'simple');
  });

  it('classifies short condition lookup as simple', () => {
    assertComplexity('hypertension', 'simple');
  });

  it('classifies "what is" pattern as simple regardless of length', () => {
    // Matches /^(what is|define|half.?life|...)/ → simple even if length ≥ 40
    assertComplexity('what is the mechanism of action of metformin', 'simple');
  });

  it('classifies "define" prefix as simple', () => {
    assertComplexity('define sepsis criteria', 'simple');
  });

  it('classifies "half-life" query as simple', () => {
    assertComplexity('half-life of digoxin', 'simple');
  });

  it('classifies "half life" (no hyphen) as simple', () => {
    assertComplexity('half life of amiodarone', 'simple');
  });

  it('classifies "mechanism" prefix as simple', () => {
    assertComplexity('mechanism of beta blockers', 'simple');
  });

  it('classifies "dose" prefix as simple', () => {
    assertComplexity('dose of vancomycin for MRSA pneumonia', 'simple');
  });

  it('classifies "dosage" prefix as simple', () => {
    assertComplexity('dosage adjustment for renal impairment lisinopril', 'simple');
  });

  it('classifies "side effects" prefix as simple', () => {
    assertComplexity('side effects of amiodarone', 'simple');
  });

  it('classifies ICD code query as simple', () => {
    assertComplexity('ICD-10 code for community acquired pneumonia', 'simple');
  });

  it('classifies LOINC prefix as simple', () => {
    assertComplexity('LOINC code for hemoglobin A1c', 'simple');
  });

  it('classifies alphanumeric code-like query as simple', () => {
    // Matches /^\w+\s?\d+/ (code-like)
    assertComplexity('J18 pneumonia', 'simple');
  });

  it('classifies very short (< 40 char) query as simple even without pattern match', () => {
    // length < 40 → simple
    assertComplexity('pulmonary embolism diagnosis', 'simple');
  });

  it('returns "simple" for an empty string (length < 40)', () => {
    assertComplexity('', 'simple');
  });

  it('classifies CPT prefix as simple', () => {
    assertComplexity('CPT code for lumbar puncture', 'simple');
  });
});

// ─── Complex queries ──────────────────────────────────────────────────────────

describe('classifyQuery — complex', () => {
  it('classifies management query as complex', () => {
    // Has "management" keyword and length > 40
    assertComplexity(
      'management of acute decompensated heart failure with reduced ejection fraction',
      'complex'
    );
  });

  it('classifies treatment query with sufficient length as complex', () => {
    assertComplexity(
      'treatment of community acquired pneumonia in a patient with penicillin allergy and renal failure',
      'complex'
    );
  });

  it('classifies "contraindicated" as complex', () => {
    assertComplexity(
      'which beta blockers are contraindicated in patients with reactive airway disease and heart failure',
      'complex'
    );
  });

  it('classifies "differential" diagnosis query as complex', () => {
    assertComplexity(
      'differential diagnosis for chest pain with dyspnea and elevated troponin in elderly patient',
      'complex'
    );
  });

  it('classifies "patient with" phrasing as complex', () => {
    assertComplexity(
      'patient with type 2 diabetes and hypertension presenting with acute kidney injury and hyperkalemia',
      'complex'
    );
  });

  it('classifies "presenting with" phrasing as complex', () => {
    assertComplexity(
      'young woman presenting with pleuritic chest pain, hemoptysis, and unilateral leg swelling',
      'complex'
    );
  });

  it('classifies "history of" phrasing as complex', () => {
    assertComplexity(
      'management of atrial fibrillation in patient with history of stroke and chronic kidney disease stage 3',
      'complex'
    );
  });

  it('classifies multi-"and" query as complex', () => {
    // Matches /\band\b.*\band\b/
    assertComplexity(
      'sepsis and renal failure and coagulopathy workup and resuscitation goals in ICU setting',
      'complex'
    );
  });

  it('classifies "compare" as complex', () => {
    assertComplexity(
      'compare and contrast fibromyalgia and rheumatoid arthritis in terms of pathophysiology and treatment approach',
      'complex'
    );
  });

  it('classifies "differentiate" as complex', () => {
    assertComplexity(
      'how to differentiate Crohn disease from ulcerative colitis based on endoscopic and histologic findings',
      'complex'
    );
  });

  it('classifies "complications" as complex', () => {
    assertComplexity(
      'what are the long-term complications of poorly controlled type 1 diabetes mellitus including nephropathy and neuropathy',
      'complex'
    );
  });

  it('classifies very long query (> 80 chars) without simple patterns as complex', () => {
    // No simple prefix, no complex keyword, but length > 80
    const longQuery =
      'elevated serum creatinine albumin calcium and low bicarbonate in elderly male with back pain and anemia';
    expect(longQuery.length).toBeGreaterThan(80);
    assertComplexity(longQuery, 'complex');
  });
});

// ─── Return type ──────────────────────────────────────────────────────────────

describe('classifyQuery — return type', () => {
  it('always returns "simple" or "complex"', () => {
    const samples = [
      'aspirin',
      'what is heparin',
      'treatment of septic shock with vasopressors in icu setting alongside renal failure',
    ];
    for (const q of samples) {
      const result = classifyQuery(q);
      expect(['simple', 'complex']).toContain(result);
    }
  });
});
