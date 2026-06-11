import { describe, expect, it } from 'vitest';
import {
  REVIEW_DECISIONS,
  buildLinkingTemplate,
  buildLinkingTemplateRow,
  buildPreGeneratedFingerprintSource,
  buildQuestionFingerprintSource,
  computeSourceFingerprint,
  evaluateApplyEligibility,
  validateReviewedRow,
  validateTemplate,
  type LinkingTemplateRow,
  type LinkingTemplateSourceRow,
} from '../../scripts/lib/linkingTemplate';

function sourceRow(overrides: Partial<LinkingTemplateSourceRow> = {}): LinkingTemplateSourceRow {
  return {
    source: 'pre_generated',
    id: 'pg-1',
    stem: 'A 70-year-old with dyspnea...',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    rationale: 'Because A.',
    system: 'CV',
    subcategory: 'Heart Failure',
    difficulty: 'medium',
    embeddedConditionName: null,
    candidates: [
      { conditionId: 'cond-hf', conditionName: 'Left-sided heart failure', medicalContentId: 'mc-hf' },
    ],
    ...overrides,
  };
}

function reviewedRow(overrides: Partial<LinkingTemplateRow> = {}): LinkingTemplateRow {
  return {
    ...buildLinkingTemplateRow(sourceRow()),
    ...overrides,
  };
}

const context = {
  knownConditionIds: new Set(['cond-hf', 'cond-copd']),
  knownMedicalContentIds: new Set(['mc-hf']),
};

describe('buildLinkingTemplate', () => {
  it('produces blank review fields and preserves source context', () => {
    const row = buildLinkingTemplateRow(sourceRow());
    expect(row.reviewDecision).toBe('');
    expect(row.reviewedConditionId).toBe('');
    expect(row.reviewedMedicalContentId).toBe('');
    expect(row.reviewNotes).toBe('');
    expect(row.reviewedBy).toBe('');
    expect(row.reviewedAt).toBe('');
    expect(row.candidates).toHaveLength(1);
    expect(row.stem).toContain('dyspnea');
  });

  it('orders rows deterministically by source then id', () => {
    const rows = buildLinkingTemplate([
      sourceRow({ source: 'question', id: 'q-b' }),
      sourceRow({ id: 'pg-2' }),
      sourceRow({ source: 'question', id: 'q-a' }),
      sourceRow({ id: 'pg-1' }),
    ]);
    expect(rows.map((r) => `${r.source}::${r.id}`)).toEqual([
      'pre_generated::pg-1',
      'pre_generated::pg-2',
      'question::q-a',
      'question::q-b',
    ]);
  });

  it('preserves reviewer-filled fields across regeneration', () => {
    const previous = [
      reviewedRow({
        id: 'pg-1',
        reviewDecision: 'link_condition',
        reviewedConditionId: 'cond-hf',
        reviewedBy: 'aaron',
        reviewedAt: '2026-06-10',
      }),
    ];
    const rows = buildLinkingTemplate([sourceRow({ id: 'pg-1' }), sourceRow({ id: 'pg-2' })], previous);
    const merged = rows.find((r) => r.id === 'pg-1')!;
    expect(merged.reviewDecision).toBe('link_condition');
    expect(merged.reviewedConditionId).toBe('cond-hf');
    expect(merged.reviewedBy).toBe('aaron');
    const fresh = rows.find((r) => r.id === 'pg-2')!;
    expect(fresh.reviewDecision).toBe('');
  });
});

describe('validateReviewedRow', () => {
  it('skips unreviewed rows', () => {
    expect(validateReviewedRow(reviewedRow(), context).status).toBe('skip');
  });

  it('refuses a reviewed target without a decision', () => {
    const result = validateReviewedRow(reviewedRow({ reviewedConditionId: 'cond-hf' }), context);
    expect(result.status).toBe('invalid');
  });

  it('refuses unknown decisions', () => {
    const result = validateReviewedRow(
      reviewedRow({ reviewDecision: 'auto_link' as any, reviewedBy: 'aaron' }),
      context
    );
    expect(result.status).toBe('invalid');
  });

  it('accepts a valid condition link', () => {
    const result = validateReviewedRow(
      reviewedRow({ reviewDecision: 'link_condition', reviewedConditionId: 'cond-hf', reviewedBy: 'aaron' }),
      context
    );
    expect(result.status).toBe('apply');
  });

  it('accepts a valid medical-content link', () => {
    const result = validateReviewedRow(
      reviewedRow({
        reviewDecision: 'link_medical_content',
        reviewedMedicalContentId: 'mc-hf',
        reviewedBy: 'aaron',
      }),
      context
    );
    expect(result.status).toBe('apply');
  });

  it('rejects unknown target ids', () => {
    const result = validateReviewedRow(
      reviewedRow({ reviewDecision: 'link_condition', reviewedConditionId: 'cond-nope', reviewedBy: 'aaron' }),
      context
    );
    expect(result.status).toBe('invalid');
    expect(result.errors[0]).toMatch(/does not exist/);
  });

  it('rejects dual condition + medical-content links', () => {
    const result = validateReviewedRow(
      reviewedRow({
        reviewDecision: 'link_condition',
        reviewedConditionId: 'cond-hf',
        reviewedMedicalContentId: 'mc-hf',
        reviewedBy: 'aaron',
      }),
      context
    );
    expect(result.status).toBe('invalid');
    expect(result.errors.join(' ')).toMatch(/not both/);
  });

  it('rejects link decisions without a reviewed target', () => {
    const result = validateReviewedRow(
      reviewedRow({ reviewDecision: 'link_condition', reviewedBy: 'aaron' }),
      context
    );
    expect(result.status).toBe('invalid');
  });

  it.each(['retire', 'keep_quarantined', 'needs_more_information'] as const)(
    'requires notes for %s',
    (decision) => {
      const missing = validateReviewedRow(reviewedRow({ reviewDecision: decision, reviewedBy: 'aaron' }), context);
      expect(missing.status).toBe('invalid');

      const withNotes = validateReviewedRow(
        reviewedRow({ reviewDecision: decision, reviewNotes: 'duplicate of pg-9', reviewedBy: 'aaron' }),
        context
      );
      expect(withNotes.status).toBe(decision === 'retire' ? 'apply' : 'report_only');
    }
  );

  it('requires reviewedBy for any decision', () => {
    const result = validateReviewedRow(
      reviewedRow({ reviewDecision: 'link_condition', reviewedConditionId: 'cond-hf' }),
      context
    );
    expect(result.status).toBe('invalid');
    expect(result.errors.join(' ')).toMatch(/reviewedBy/);
  });

  it('rejects non-link decisions that carry link targets', () => {
    const result = validateReviewedRow(
      reviewedRow({
        reviewDecision: 'retire',
        reviewNotes: 'bad content',
        reviewedBy: 'aaron',
        reviewedConditionId: 'cond-hf',
      }),
      context
    );
    expect(result.status).toBe('invalid');
  });
});

describe('validateTemplate', () => {
  it('partitions rows into apply / report-only / skipped / invalid', () => {
    const rows = [
      reviewedRow({ id: 'a' }), // unreviewed
      reviewedRow({ id: 'b', reviewDecision: 'link_condition', reviewedConditionId: 'cond-hf', reviewedBy: 'aaron' }),
      reviewedRow({ id: 'c', reviewDecision: 'keep_quarantined', reviewNotes: 'wait for content', reviewedBy: 'aaron' }),
      reviewedRow({ id: 'd', reviewDecision: 'link_condition', reviewedBy: 'aaron' }), // missing target
    ];
    const summary = validateTemplate(rows, context);
    expect(summary.total).toBe(4);
    expect(summary.skipped).toBe(1);
    expect(summary.toApply.map((r) => r.id)).toEqual(['b']);
    expect(summary.reportOnly.map((r) => r.id)).toEqual(['c']);
    expect(summary.invalid.map((i) => i.row.id)).toEqual(['d']);
  });
});

describe('REVIEW_DECISIONS', () => {
  it('exposes exactly the five allowed decisions', () => {
    expect(REVIEW_DECISIONS).toEqual([
      'link_condition',
      'link_medical_content',
      'retire',
      'keep_quarantined',
      'needs_more_information',
    ]);
  });
});

describe('computeSourceFingerprint + builders', () => {
  const pregenRow = {
    questionData: {
      question: 'Stem?',
      options: ['A. one', 'B. two'],
      correctAnswer: 'A',
      rationale: 'Because one.',
    },
    validationStatus: 'approved',
    conditionId: null,
    medicalContentId: null,
  };

  it('is stable for identical input', () => {
    const a = computeSourceFingerprint(buildPreGeneratedFingerprintSource(pregenRow));
    const b = computeSourceFingerprint(buildPreGeneratedFingerprintSource({ ...pregenRow }));
    expect(a).toBe(b);
    expect(a).toMatch(/^fnv1a:[0-9a-f]{8}:\d+$/);
  });

  it.each([
    ['stem', { questionData: { ...pregenRow.questionData, question: 'Changed?' } }],
    ['correct answer', { questionData: { ...pregenRow.questionData, correctAnswer: 'B' } }],
    ['explanation', { questionData: { ...pregenRow.questionData, rationale: 'Different.' } }],
    ['status', { validationStatus: 'rejected' }],
    ['linkage', { conditionId: 'cond-x' }],
  ] as const)('changes when %s changes', (_label, override) => {
    const before = computeSourceFingerprint(buildPreGeneratedFingerprintSource(pregenRow));
    const after = computeSourceFingerprint(
      buildPreGeneratedFingerprintSource({ ...pregenRow, ...override } as typeof pregenRow)
    );
    expect(after).not.toBe(before);
  });

  it('normalizes object-form options deterministically for Question rows', () => {
    const fp1 = computeSourceFingerprint(
      buildQuestionFingerprintSource({
        question: 'Q?',
        vignette: null,
        options: { B: 'two', A: 'one' },
        correctAnswer: 'A',
        explanation: 'exp',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        conditionId: null,
        medicalContentId: null,
      })
    );
    const fp2 = computeSourceFingerprint(
      buildQuestionFingerprintSource({
        question: 'Q?',
        vignette: null,
        options: { A: 'one', B: 'two' },
        correctAnswer: 'A',
        explanation: 'exp',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        conditionId: null,
        medicalContentId: null,
      })
    );
    expect(fp1).toBe(fp2);
  });
});

describe('evaluateApplyEligibility', () => {
  const fp = 'fnv1a:00000001:10';
  const linkRow = (overrides: Partial<LinkingTemplateRow> = {}): LinkingTemplateRow =>
    reviewedRow({
      reviewDecision: 'link_condition',
      reviewedConditionId: 'cond-hf',
      reviewedBy: 'ai',
      sourceFingerprint: fp,
      ...overrides,
    });
  const liveUnlinked = { exists: true, fingerprint: fp, conditionId: null, medicalContentId: null };

  it('applies when the live fingerprint matches and the row is still unlinked', () => {
    expect(evaluateApplyEligibility(linkRow(), liveUnlinked)).toBe('apply');
  });

  it('skips when the source row is missing', () => {
    expect(evaluateApplyEligibility(linkRow(), { ...liveUnlinked, exists: false })).toBe('skip_source_missing');
  });

  it('skips link rows without a fingerprint (legacy template)', () => {
    expect(evaluateApplyEligibility(linkRow({ sourceFingerprint: undefined }), liveUnlinked)).toBe(
      'skip_no_fingerprint'
    );
  });

  it('skips when the source changed since review', () => {
    expect(
      evaluateApplyEligibility(linkRow(), { ...liveUnlinked, fingerprint: 'fnv1a:deadbeef:11' })
    ).toBe('skip_stale_source');
  });

  it('treats an already-applied identical link as an idempotent no-op', () => {
    expect(
      evaluateApplyEligibility(linkRow(), { ...liveUnlinked, conditionId: 'cond-hf' })
    ).toBe('apply_idempotent_noop');
  });

  it('skips when the row got linked to something else after review', () => {
    expect(
      evaluateApplyEligibility(linkRow(), { ...liveUnlinked, conditionId: 'cond-other' })
    ).toBe('skip_already_linked');
  });

  it('applies retire when the fingerprint still matches', () => {
    expect(
      evaluateApplyEligibility(
        reviewedRow({ reviewDecision: 'retire', reviewNotes: 'bad', reviewedBy: 'ai', sourceFingerprint: fp }),
        liveUnlinked
      )
    ).toBe('apply');
  });
});
