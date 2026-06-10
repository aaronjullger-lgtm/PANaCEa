import { describe, expect, it } from 'vitest';
import {
  classifyUnlinkedQuestion,
  isDegenerate,
  summarizeClassifications,
  type UnlinkedCandidateContext,
  type UnlinkedQuestionRecord,
} from '../../scripts/lib/unlinkedQuestionClassifier';

function record(overrides: Partial<UnlinkedQuestionRecord> = {}): UnlinkedQuestionRecord {
  return {
    id: 'r1',
    source: 'pre_generated',
    system: 'CV',
    subcategory: 'Heart Failure',
    embeddedConditionName: null,
    stem: 'A 70-year-old with dyspnea and EF 25%...',
    options: ['Furosemide', 'Metoprolol', 'Digoxin', 'Spironolactone'],
    correctAnswer: 'Furosemide',
    hasRationale: true,
    timesServed: 0,
    semanticHash: null,
    ...overrides,
  };
}

function context(overrides: Partial<UnlinkedCandidateContext> = {}): UnlinkedCandidateContext {
  return {
    conditionIdsByName: [],
    conditionIdsBySubcategory: [],
    medicalContentIdByCondition: null,
    semanticHashIsDuplicated: false,
    ...overrides,
  };
}

describe('isDegenerate', () => {
  it('flags rows with no stem', () => {
    expect(isDegenerate(record({ stem: '   ' }))).toBe(true);
  });
  it('flags rows with fewer than two options', () => {
    expect(isDegenerate(record({ options: ['Only one'] }))).toBe(true);
  });
  it('flags rows with no resolvable correct answer', () => {
    expect(isDegenerate(record({ correctAnswer: null }))).toBe(true);
  });
  it('accepts complete rows', () => {
    expect(isDegenerate(record())).toBe(false);
  });
});

describe('classifyUnlinkedQuestion', () => {
  it('flags duplicates by semantic hash first', () => {
    const result = classifyUnlinkedQuestion(
      record({ semanticHash: 'h1' }),
      context({ semanticHashIsDuplicated: true })
    );
    expect(result.classification).toBe('duplicate_candidate');
    expect(result.autoActionable).toBe(false);
  });

  it('retires degenerate, never-served rows', () => {
    const result = classifyUnlinkedQuestion(
      record({ correctAnswer: null, timesServed: 0 }),
      context()
    );
    expect(result.classification).toBe('retire_candidate');
  });

  it('escalates degenerate-but-served rows to manual review', () => {
    const result = classifyUnlinkedQuestion(
      record({ correctAnswer: null, timesServed: 4 }),
      context()
    );
    expect(result.classification).toBe('manual_review_required');
  });

  it('proposes a medical-content link when exactly one named condition has content', () => {
    const result = classifyUnlinkedQuestion(
      record({ embeddedConditionName: 'Acute Pericarditis' }),
      context({ conditionIdsByName: ['cond-peri'], medicalContentIdByCondition: 'cond-peri' })
    );
    expect(result.classification).toBe('link_medical_content_candidate');
    expect(result.suggestedConditionId).toBe('cond-peri');
    expect(result.suggestedMedicalContentId).toBe('cond-peri');
  });

  it('proposes a condition link (no content) for a single unambiguous name match', () => {
    const result = classifyUnlinkedQuestion(
      record({ embeddedConditionName: 'Aortic Dissection' }),
      context({ conditionIdsByName: ['cond-aod'], medicalContentIdByCondition: null })
    );
    expect(result.classification).toBe('link_condition_candidate');
    expect(result.suggestedConditionId).toBe('cond-aod');
    expect(result.suggestedMedicalContentId).toBeNull();
  });

  it('requires manual review when a subcategory maps to multiple conditions', () => {
    const result = classifyUnlinkedQuestion(
      record(),
      context({ conditionIdsBySubcategory: ['c1', 'c2', 'c3'] })
    );
    expect(result.classification).toBe('manual_review_required');
    expect(result.candidateConditionIds).toEqual(['c1', 'c2', 'c3']);
    expect(result.suggestedConditionId).toBeNull();
  });

  it('requires manual review when a name matches multiple conditions (no auto-pick)', () => {
    const result = classifyUnlinkedQuestion(
      record({ embeddedConditionName: 'Shock' }),
      context({ conditionIdsByName: ['c1', 'c2'] })
    );
    expect(result.classification).toBe('manual_review_required');
    expect(result.candidateConditionIds).toEqual(['c1', 'c2']);
  });

  it('requires manual review for a salvageable vignette with no candidates', () => {
    const result = classifyUnlinkedQuestion(record({ subcategory: 'Tuberculosis' }), context());
    expect(result.classification).toBe('manual_review_required');
    expect(result.candidateConditionIds).toEqual([]);
  });

  it('marks rows with no inferable metadata as unsafe_to_infer', () => {
    const result = classifyUnlinkedQuestion(
      record({ system: null, subcategory: null, embeddedConditionName: null }),
      context()
    );
    expect(result.classification).toBe('unsafe_to_infer');
  });

  it('never marks any row auto-actionable (no fabricated links)', () => {
    const results = [
      classifyUnlinkedQuestion(record({ embeddedConditionName: 'Aortic Dissection' }), context({ conditionIdsByName: ['c1'] })),
      classifyUnlinkedQuestion(record(), context({ conditionIdsBySubcategory: ['c1', 'c2'] })),
      classifyUnlinkedQuestion(record({ correctAnswer: null }), context()),
    ];
    expect(results.every((r) => r.autoActionable === false)).toBe(true);
  });
});

describe('summarizeClassifications', () => {
  it('aggregates counts by classification and source', () => {
    const results = [
      classifyUnlinkedQuestion(record({ id: 'a' }), context({ conditionIdsBySubcategory: ['c1', 'c2'] })),
      classifyUnlinkedQuestion(record({ id: 'b', source: 'question', correctAnswer: null }), context()),
      classifyUnlinkedQuestion(record({ id: 'c', semanticHash: 'h' }), context({ semanticHashIsDuplicated: true })),
    ];
    const summary = summarizeClassifications(results);
    expect(summary.total).toBe(3);
    expect(summary.bySource.pre_generated).toBe(2);
    expect(summary.bySource.question).toBe(1);
    expect(summary.byClassification.manual_review_required).toBe(1);
    expect(summary.byClassification.retire_candidate).toBe(1);
    expect(summary.byClassification.duplicate_candidate).toBe(1);
    expect(summary.autoActionable).toBe(0);
  });
});
