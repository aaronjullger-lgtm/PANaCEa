import { describe, expect, it } from 'vitest';
import {
  AI_REVIEWER_ID,
  AI_REVIEW_CONFIDENCE_THRESHOLD,
  PACKET_INSTRUCTIONS,
  ReviewerAssessmentSchema,
  VerifierAssessmentSchema,
  aggregateAssessments,
  buildReviewPacket,
  summarizeOutcomes,
  toReviewedTemplateRow,
  type AggregationContext,
  type ReviewerAssessment,
  type VerifierAssessment,
} from '../../scripts/lib/aiReviewPipeline';
import {
  buildLinkingTemplateRow,
  validateTemplate,
  type LinkingTemplateRow,
} from '../../scripts/lib/linkingTemplate';

function templateRow(overrides: Partial<LinkingTemplateRow> = {}): LinkingTemplateRow {
  return {
    ...buildLinkingTemplateRow({
      source: 'pre_generated',
      id: 'pg-1',
      stem: 'A 35-year-old woman presents with exertional syncope. Mother died suddenly at 48. Systolic murmur increases with Valsalva. Echo: LVH with outflow gradient 65 mmHg.',
      options: ['Aortic stenosis', 'Hypertrophic cardiomyopathy', 'Dilated cardiomyopathy', 'Mitral regurgitation'],
      correctAnswer: 'B',
      rationale: 'Murmur increasing with Valsalva plus family history of sudden death and LVH with outflow obstruction is classic HCM.',
      system: 'CV',
      subcategory: 'Cardiomyopathy',
      difficulty: 'medium',
      embeddedConditionName: null,
      candidates: [
        {
          conditionId: 'CV__cardiomyopathy__hypertrophic_cardiomyopathy',
          conditionName: 'Hypertrophic cardiomyopathy',
          medicalContentId: 'mc-hcm',
        },
        {
          conditionId: 'CV__cardiomyopathy__dilated_cardiomyopathy',
          conditionName: 'Dilated cardiomyopathy',
          medicalContentId: null,
        },
      ],
    }),
    ...overrides,
  };
}

const HCM = 'CV__cardiomyopathy__hypertrophic_cardiomyopathy';
const DCM = 'CV__cardiomyopathy__dilated_cardiomyopathy';

function reviewer(overrides: Partial<ReviewerAssessment> = {}): ReviewerAssessment {
  return {
    proposedDecision: 'link_condition',
    proposedTargetId: HCM,
    confidence: 0.95,
    clinicalRationale: 'Valsalva-accentuated murmur, family history of sudden death, and LVH with outflow gradient are pathognomonic for HCM.',
    safetyConcern: false,
    concernNotes: '',
    ...overrides,
  };
}

function verifier(overrides: Partial<VerifierAssessment> = {}): VerifierAssessment {
  return {
    veto: false,
    vetoReason: '',
    specificityOk: true,
    answerExplanationConsistent: true,
    confidence: 0.92,
    ...overrides,
  };
}

const dbContext: AggregationContext = {
  knownConditionIds: new Set([HCM, DCM]),
  knownMedicalContentIds: new Set(['mc-hcm']),
};

describe('buildReviewPacket', () => {
  it('includes the clinical context and standing instructions', () => {
    const packet = buildReviewPacket(templateRow());
    expect(packet.stem).toContain('exertional syncope');
    expect(packet.options).toHaveLength(4);
    expect(packet.correctAnswer).toBe('B');
    expect(packet.rationale).toContain('Valsalva');
    expect(packet.system).toBe('CV');
    expect(packet.subcategory).toBe('Cardiomyopathy');
    expect(packet.candidates.map((c) => c.conditionId)).toEqual([HCM, DCM]);
    expect(packet.instructions).toBe(PACKET_INSTRUCTIONS);
  });

  it('excludes reviewer fields and any non-clinical metadata', () => {
    const packet = buildReviewPacket(
      templateRow({ reviewedBy: 'someone', reviewNotes: 'private', reviewDecision: 'retire' })
    );
    const keys = Object.keys(packet);
    expect(keys).not.toContain('reviewedBy');
    expect(keys).not.toContain('reviewNotes');
    expect(keys).not.toContain('reviewDecision');
    expect(keys).not.toContain('reviewedConditionId');
  });

  it('handles missing explanation and empty candidates with a stable shape', () => {
    const packet = buildReviewPacket(templateRow({ rationale: null, candidates: [] }));
    expect(packet.rationale).toBeNull();
    expect(packet.candidates).toEqual([]);
    expect(Object.keys(packet).sort()).toEqual(
      [
        'candidates',
        'correctAnswer',
        'difficulty',
        'embeddedConditionName',
        'id',
        'instructions',
        'options',
        'rationale',
        'source',
        'stem',
        'subcategory',
        'system',
      ].sort()
    );
  });
});

describe('aggregateAssessments — link gates', () => {
  it('emits a link when both reviewers agree, verifier approves, and the target exists', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer(),
      reviewer(),
      verifier(),
      dbContext
    );
    // Candidate has live medical content → prefers the content link.
    expect(outcome.decision).toBe('link_medical_content');
    expect(outcome.reviewedMedicalContentId).toBe('mc-hcm');
    expect(outcome.reviewedConditionId).toBeNull();
    expect(outcome.gatesFailed).toEqual([]);
  });

  it('links the condition when the candidate has no live medical content', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ proposedTargetId: DCM }),
      reviewer({ proposedTargetId: DCM }),
      verifier(),
      dbContext
    );
    expect(outcome.decision).toBe('link_condition');
    expect(outcome.reviewedConditionId).toBe(DCM);
    expect(outcome.reviewedMedicalContentId).toBeNull();
  });

  it('quarantines when the verifier vetoes despite reviewer agreement', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer(),
      reviewer(),
      verifier({ veto: true, vetoReason: 'Aortic stenosis lookalike not excluded.' }),
      dbContext
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('no_veto');
    expect(outcome.notes).toContain('Aortic stenosis lookalike');
  });

  it('quarantines when reviewers disagree on the target', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ proposedTargetId: HCM }),
      reviewer({ proposedTargetId: DCM }),
      verifier(),
      dbContext
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('target_agreement');
  });

  it('quarantines an invented target id that is not in the candidate list', () => {
    const invented = 'CV__made_up__condition';
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ proposedTargetId: invented }),
      reviewer({ proposedTargetId: invented }),
      verifier(),
      { knownConditionIds: new Set([invented]), knownMedicalContentIds: new Set() }
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('target_in_candidates');
  });

  it('quarantines a broad-category target the verifier marks non-specific', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer(),
      reviewer(),
      verifier({ specificityOk: false }),
      dbContext
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('specificity');
  });

  it('blocks links when the question has no explanation', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow({ rationale: null })),
      reviewer(),
      reviewer(),
      verifier(),
      dbContext
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('explanation_present');
  });

  it('quarantines when any confidence is below the strict threshold', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ confidence: AI_REVIEW_CONFIDENCE_THRESHOLD - 0.05 }),
      reviewer(),
      verifier(),
      dbContext
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('confidence');
  });

  it('quarantines links when DB validation is unavailable', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer(),
      reviewer(),
      verifier(),
      { knownConditionIds: null, knownMedicalContentIds: null }
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('db_validation_available');
  });

  it('quarantines when the agreed target does not exist in the database', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer(),
      reviewer(),
      verifier(),
      { knownConditionIds: new Set([DCM]), knownMedicalContentIds: new Set() }
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('target_exists_in_db');
  });
});

describe('aggregateAssessments — safety and non-link outcomes', () => {
  it('quarantines unsafe content when reviewers do not both propose retire', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ safetyConcern: true, concernNotes: 'Outdated anticoagulation guidance.' }),
      reviewer(),
      verifier(),
      dbContext
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('safety_concern');
    expect(outcome.notes).toContain('Outdated anticoagulation guidance');
  });

  it('retires unsafe content when both reviewers propose retire and the verifier agrees', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ proposedDecision: 'retire', proposedTargetId: null, safetyConcern: true, concernNotes: 'Dangerous dosing.' }),
      reviewer({ proposedDecision: 'retire', proposedTargetId: null, safetyConcern: true, concernNotes: 'Agree: dosing unsafe.' }),
      verifier(),
      dbContext
    );
    expect(outcome.decision).toBe('retire');
    expect(outcome.notes).toContain('Dangerous dosing');
  });

  it('keeps unsafe retire proposals quarantined when the verifier vetoes', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ proposedDecision: 'retire', proposedTargetId: null, safetyConcern: true }),
      reviewer({ proposedDecision: 'retire', proposedTargetId: null, safetyConcern: true }),
      verifier({ veto: true, vetoReason: 'Content is salvageable.' }),
      dbContext
    );
    expect(outcome.decision).toBe('keep_quarantined');
  });

  it('propagates unanimous needs_more_information', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ proposedDecision: 'needs_more_information', proposedTargetId: null }),
      reviewer({ proposedDecision: 'needs_more_information', proposedTargetId: null }),
      verifier(),
      dbContext
    );
    expect(outcome.decision).toBe('needs_more_information');
  });

  it('defaults to keep_quarantined on mixed non-link proposals', () => {
    const outcome = aggregateAssessments(
      buildReviewPacket(templateRow()),
      reviewer({ proposedDecision: 'keep_quarantined', proposedTargetId: null }),
      reviewer(),
      verifier(),
      dbContext
    );
    expect(outcome.decision).toBe('keep_quarantined');
    expect(outcome.gatesFailed).toContain('link_agreement');
  });
});

describe('model output schemas', () => {
  it('rejects malformed reviewer output', () => {
    expect(ReviewerAssessmentSchema.safeParse({ proposedDecision: 'auto_link' }).success).toBe(false);
    expect(ReviewerAssessmentSchema.safeParse({ ...reviewer(), confidence: 1.7 }).success).toBe(false);
    expect(ReviewerAssessmentSchema.safeParse({ ...reviewer(), clinicalRationale: 'short' }).success).toBe(false);
    expect(VerifierAssessmentSchema.safeParse({ veto: 'nope' }).success).toBe(false);
  });

  it('accepts well-formed reviewer output', () => {
    expect(ReviewerAssessmentSchema.safeParse(reviewer()).success).toBe(true);
    expect(VerifierAssessmentSchema.safeParse(verifier()).success).toBe(true);
  });
});

describe('reviewed template integration with the apply validator', () => {
  const validationContext = {
    knownConditionIds: new Set([HCM, DCM]),
    knownMedicalContentIds: new Set(['mc-hcm']),
  };

  it('a passed link outcome produces an apply-ready row', () => {
    const row = templateRow();
    const outcome = aggregateAssessments(buildReviewPacket(row), reviewer(), reviewer(), verifier(), dbContext);
    const reviewed = toReviewedTemplateRow(row, outcome, '2026-06-10T00:00:00.000Z');

    expect(reviewed.reviewedBy).toBe(AI_REVIEWER_ID);
    expect(reviewed.reviewedAt).toBe('2026-06-10T00:00:00.000Z');

    const summary = validateTemplate([reviewed], validationContext);
    expect(summary.invalid).toEqual([]);
    expect(summary.toApply.map((r) => r.id)).toEqual([row.id]);
  });

  it('quarantined outcomes validate as report-only (no DB mutation candidates)', () => {
    const row = templateRow();
    const outcome = aggregateAssessments(
      buildReviewPacket(row),
      reviewer(),
      reviewer(),
      verifier({ veto: true, vetoReason: 'no' }),
      dbContext
    );
    const reviewed = toReviewedTemplateRow(row, outcome, '2026-06-10T00:00:00.000Z');
    expect(reviewed.reviewedConditionId).toBe('');
    expect(reviewed.reviewedMedicalContentId).toBe('');

    const summary = validateTemplate([reviewed], validationContext);
    expect(summary.invalid).toEqual([]);
    expect(summary.toApply).toEqual([]);
    expect(summary.reportOnly.map((r) => r.id)).toEqual([row.id]);
  });
});

describe('summarizeOutcomes', () => {
  it('counts decisions and malformed rows', () => {
    const row = templateRow();
    const packet = buildReviewPacket(row);
    const outcomes = [
      aggregateAssessments(packet, reviewer(), reviewer(), verifier(), dbContext),
      aggregateAssessments(packet, reviewer(), reviewer(), verifier({ veto: true }), dbContext),
    ];
    const summary = summarizeOutcomes(outcomes, 1);
    expect(summary.total).toBe(3);
    expect(summary.preparedLinks).toBe(1);
    expect(summary.byDecision.keep_quarantined).toBe(1);
    expect(summary.malformedRows).toBe(1);
  });
});
