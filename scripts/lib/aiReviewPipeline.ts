/**
 * Gated AI review pipeline for unlinked study questions — pure helpers.
 *
 * Replaces the manual-review bottleneck with a conservative multi-reviewer
 * workflow. Three independent passes per row (clinical-content reviewer,
 * taxonomy/linkage reviewer, skeptical verifier); a link or retirement is
 * prepared ONLY when strict gates all pass. Uncertainty defaults to
 * keep_quarantined — the serving gate already keeps quarantined rows out of
 * the live study path, so a false negative costs nothing while a false
 * positive corrupts concept tracking.
 *
 * This module is pure (no DB, no model calls) so every gate is unit-testable
 * with mocked reviewer output. Model wiring lives in
 * scripts/ai-review-unlinked-questions.ts via the existing lib/ai gateway.
 * The ONLY mutation path remains scripts/apply-unlinked-question-links.ts.
 */

import { z } from 'zod';
import type { LinkingCandidate, LinkingTemplateRow, ReviewDecision } from './linkingTemplate';

// ─── Review packets ─────────────────────────────────────────────────────────

/** Standing instructions embedded in every packet/prompt. */
export const PACKET_INSTRUCTIONS = [
  'Choose proposedTargetId ONLY from the candidate conditionIds listed in this packet. Never invent, modify, or abbreviate an ID.',
  'If no candidate matches the specific concept this question tests, propose keep_quarantined. Prefer quarantine over guessing.',
  'A broad category or grouping is NOT an acceptable link target; the target must be the specific condition the question tests.',
  'Flag any clinically unsafe, outdated, or contradictory content via safetyConcern.',
] as const;

/**
 * The clinical context sent to reviewers. Deliberately excludes reviewer
 * fields, serving stats, hashes, and anything user- or secret-adjacent.
 */
export interface ReviewPacket {
  source: LinkingTemplateRow['source'];
  id: string;
  stem: string;
  options: string[];
  correctAnswer: string | null;
  rationale: string | null;
  system: string | null;
  subcategory: string | null;
  difficulty: string | null;
  embeddedConditionName: string | null;
  candidates: LinkingCandidate[];
  instructions: readonly string[];
}

/** Build a review packet from a template row. Pure and deterministic. */
export function buildReviewPacket(row: LinkingTemplateRow): ReviewPacket {
  return {
    source: row.source,
    id: row.id,
    stem: row.stem,
    options: [...row.options],
    correctAnswer: row.correctAnswer,
    rationale: row.rationale,
    system: row.system,
    subcategory: row.subcategory,
    difficulty: row.difficulty,
    embeddedConditionName: row.embeddedConditionName,
    candidates: row.candidates.map((c) => ({ ...c })),
    instructions: PACKET_INSTRUCTIONS,
  };
}

// ─── Model output schemas (never trust raw text) ────────────────────────────

export const AI_REVIEW_DECISIONS = [
  'link_condition',
  'link_medical_content',
  'retire',
  'keep_quarantined',
  'needs_more_information',
] as const;

export const ReviewerAssessmentSchema = z.object({
  /** What this reviewer thinks should happen to the row. */
  proposedDecision: z.enum(AI_REVIEW_DECISIONS),
  /** Candidate conditionId the question tests; null for non-link proposals. */
  proposedTargetId: z.string().min(1).nullable(),
  /** 0–1 self-assessed confidence. */
  confidence: z.number().min(0).max(1),
  /** Evidence tying stem/answer/explanation to the proposal. Required. */
  clinicalRationale: z.string().min(10),
  /** True when content is unsafe, outdated, or internally contradictory. */
  safetyConcern: z.boolean(),
  concernNotes: z.string().default(''),
});

export type ReviewerAssessment = z.infer<typeof ReviewerAssessmentSchema>;

export const VerifierAssessmentSchema = z.object({
  /** True to block the proposed decision outright. */
  veto: z.boolean(),
  vetoReason: z.string().default(''),
  /** Target is a specific testable concept (not a broad category/grouping). */
  specificityOk: z.boolean(),
  /** Correct answer and explanation are consistent with the proposed target. */
  answerExplanationConsistent: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type VerifierAssessment = z.infer<typeof VerifierAssessmentSchema>;

// ─── Prompts ────────────────────────────────────────────────────────────────

function packetForPrompt(packet: ReviewPacket): string {
  return JSON.stringify(packet, null, 2);
}

export function buildClinicalReviewerPrompt(packet: ReviewPacket): string {
  return [
    'You are a physician-assistant board-prep content reviewer.',
    'Identify the single specific condition/concept this question tests, and check that the stem, correct answer, options, and explanation clinically support it.',
    'Then decide: link to a candidate condition, retire (clinically unusable), keep_quarantined (uncertain), or needs_more_information.',
    ...PACKET_INSTRUCTIONS,
    'Question packet:',
    packetForPrompt(packet),
  ].join('\n');
}

export function buildTaxonomyReviewerPrompt(packet: ReviewPacket): string {
  return [
    'You are a clinical-taxonomy reviewer mapping a board-prep question to an existing content record.',
    'From the candidate list ONLY, pick the conditionId whose concept this question tests. Cite the metadata evidence for the mapping.',
    'If no candidate is the specific tested concept, propose keep_quarantined.',
    ...PACKET_INSTRUCTIONS,
    'Question packet:',
    packetForPrompt(packet),
  ].join('\n');
}

export function buildVerifierPrompt(
  packet: ReviewPacket,
  proposal: { decision: string; targetId: string | null }
): string {
  return [
    'You are a skeptical clinical verifier. Your job is to DISPROVE the proposed decision below.',
    'Hunt for lookalike conditions, broad-category traps, insufficient stem specificity, and answer/explanation mismatch.',
    'Veto unless the link is unambiguous and specific enough for per-concept spaced-repetition tracking.',
    `Proposed decision: ${proposal.decision}; proposed target: ${proposal.targetId ?? 'none'}.`,
    'Question packet:',
    packetForPrompt(packet),
  ].join('\n');
}

// ─── Aggregation gates ──────────────────────────────────────────────────────

/** Strict floor applied to every reviewer's self-reported confidence. */
export const AI_REVIEW_CONFIDENCE_THRESHOLD = 0.85;

export const AI_REVIEWER_ID = 'ai-review-pipeline:v1 (clinical+taxonomy+verifier)';

export interface AggregationContext {
  /**
   * Live Condition / MedicalContent ids for target validation. When
   * unavailable (no DB), link decisions CANNOT pass — validation is a gate,
   * not an optimization.
   */
  knownConditionIds: ReadonlySet<string> | null;
  knownMedicalContentIds: ReadonlySet<string> | null;
}

export interface AiReviewOutcome {
  id: string;
  source: LinkingTemplateRow['source'];
  decision: ReviewDecision;
  reviewedConditionId: string | null;
  reviewedMedicalContentId: string | null;
  gatesPassed: string[];
  gatesFailed: string[];
  notes: string;
  assessments: {
    clinical: ReviewerAssessment;
    taxonomy: ReviewerAssessment;
    verifier: VerifierAssessment;
  };
}

const isLinkProposal = (d: ReviewerAssessment['proposedDecision']) =>
  d === 'link_condition' || d === 'link_medical_content';

/**
 * Combine the three independent assessments into a final gated decision.
 *
 * Pure and deterministic. Every gate failure is recorded so the report is
 * auditable. Default for any uncertainty is keep_quarantined.
 */
export function aggregateAssessments(
  packet: ReviewPacket,
  clinical: ReviewerAssessment,
  taxonomy: ReviewerAssessment,
  verifier: VerifierAssessment,
  context: AggregationContext
): AiReviewOutcome {
  const gatesPassed: string[] = [];
  const gatesFailed: string[] = [];
  const gate = (name: string, ok: boolean): boolean => {
    (ok ? gatesPassed : gatesFailed).push(name);
    return ok;
  };

  const minReviewerConfidence = Math.min(clinical.confidence, taxonomy.confidence);
  const candidateById = new Map(packet.candidates.map((c) => [c.conditionId, c]));

  const base = {
    id: packet.id,
    source: packet.source,
    assessments: { clinical, taxonomy, verifier },
  };

  const quarantine = (notes: string): AiReviewOutcome => ({
    ...base,
    decision: 'keep_quarantined',
    reviewedConditionId: null,
    reviewedMedicalContentId: null,
    gatesPassed,
    gatesFailed,
    notes,
  });

  // ── Safety first: any safety concern forbids linking. Retire is allowed
  // only when BOTH reviewers independently propose retire and the verifier
  // does not veto; otherwise the row stays quarantined for human eyes.
  const anySafetyConcern = clinical.safetyConcern || taxonomy.safetyConcern;
  if (anySafetyConcern) {
    const bothRetire =
      clinical.proposedDecision === 'retire' && taxonomy.proposedDecision === 'retire';
    if (
      bothRetire &&
      !verifier.veto &&
      minReviewerConfidence >= AI_REVIEW_CONFIDENCE_THRESHOLD &&
      verifier.confidence >= AI_REVIEW_CONFIDENCE_THRESHOLD
    ) {
      gatesPassed.push('retire_agreement', 'no_veto', 'confidence');
      return {
        ...base,
        decision: 'retire',
        reviewedConditionId: null,
        reviewedMedicalContentId: null,
        gatesPassed,
        gatesFailed,
        notes: `Safety concern; both reviewers propose retire. ${clinical.concernNotes} ${taxonomy.concernNotes}`.trim(),
      };
    }
    gatesFailed.push('safety_concern');
    return quarantine(
      `Safety concern raised (${[clinical.concernNotes, taxonomy.concernNotes].filter(Boolean).join('; ') || 'unspecified'}); quarantined for human review.`
    );
  }

  // ── Unanimous non-link proposals (no safety concern) ──
  if (
    clinical.proposedDecision === 'needs_more_information' &&
    taxonomy.proposedDecision === 'needs_more_information'
  ) {
    return {
      ...base,
      decision: 'needs_more_information',
      reviewedConditionId: null,
      reviewedMedicalContentId: null,
      gatesPassed,
      gatesFailed,
      notes: `Both reviewers need more information. Clinical: ${clinical.clinicalRationale} Taxonomy: ${taxonomy.clinicalRationale}`,
    };
  }

  if (!isLinkProposal(clinical.proposedDecision) || !isLinkProposal(taxonomy.proposedDecision)) {
    gatesFailed.push('link_agreement');
    return quarantine(
      `No link agreement (clinical: ${clinical.proposedDecision}, taxonomy: ${taxonomy.proposedDecision}); quarantined.`
    );
  }

  // ── Link gates ──
  const sameTarget =
    clinical.proposedTargetId != null && clinical.proposedTargetId === taxonomy.proposedTargetId;
  if (!gate('target_agreement', sameTarget)) {
    return quarantine(
      `Reviewers disagree on target (clinical: ${clinical.proposedTargetId ?? 'none'}, taxonomy: ${taxonomy.proposedTargetId ?? 'none'}); quarantined.`
    );
  }
  const targetId = clinical.proposedTargetId!;

  const candidate = candidateById.get(targetId);
  if (!gate('target_in_candidates', Boolean(candidate))) {
    return quarantine(
      `Proposed target "${targetId}" is not in the packet candidate list (invented or out-of-scope id); quarantined.`
    );
  }

  if (!gate('explanation_present', Boolean(packet.rationale && packet.rationale.trim().length > 0))) {
    return quarantine('Question has no explanation/rationale; cannot verify answer consistency; quarantined.');
  }

  if (!gate('no_veto', !verifier.veto)) {
    return quarantine(`Skeptical verifier veto: ${verifier.vetoReason || 'unspecified'}; quarantined.`);
  }
  if (!gate('specificity', verifier.specificityOk)) {
    return quarantine('Verifier judged the target too broad/non-specific for concept tracking; quarantined.');
  }
  if (!gate('answer_explanation_consistent', verifier.answerExplanationConsistent)) {
    return quarantine('Verifier found answer/explanation inconsistent with the target; quarantined.');
  }

  const confident =
    minReviewerConfidence >= AI_REVIEW_CONFIDENCE_THRESHOLD &&
    verifier.confidence >= AI_REVIEW_CONFIDENCE_THRESHOLD;
  if (!gate('confidence', confident)) {
    return quarantine(
      `Confidence below ${AI_REVIEW_CONFIDENCE_THRESHOLD} (clinical ${clinical.confidence}, taxonomy ${taxonomy.confidence}, verifier ${verifier.confidence}); quarantined.`
    );
  }

  // ── DB validation: the target must exist in the live database. ──
  const dbAvailable = context.knownConditionIds !== null;
  if (!gate('db_validation_available', dbAvailable)) {
    return quarantine('Database target validation unavailable in this run; link cannot be prepared; quarantined.');
  }
  if (!gate('target_exists_in_db', context.knownConditionIds!.has(targetId))) {
    return quarantine(`Target "${targetId}" not found in the Condition table; quarantined.`);
  }

  // Prefer the medical-content link when the candidate carries one AND it
  // exists in the live MedicalContent table; otherwise link the condition.
  const medicalContentId = candidate!.medicalContentId;
  const useMedicalContent = Boolean(
    medicalContentId && context.knownMedicalContentIds?.has(medicalContentId)
  );

  return {
    ...base,
    decision: useMedicalContent ? 'link_medical_content' : 'link_condition',
    reviewedConditionId: useMedicalContent ? null : targetId,
    reviewedMedicalContentId: useMedicalContent ? medicalContentId! : null,
    gatesPassed,
    gatesFailed,
    notes:
      `Independently agreed by clinical + taxonomy reviewers; verifier did not veto. ` +
      `Clinical: ${clinical.clinicalRationale} Taxonomy: ${taxonomy.clinicalRationale}`,
  };
}

// ─── Reviewed-template emission ─────────────────────────────────────────────

/**
 * Fill a template row's reviewer fields from an aggregated outcome. Link
 * targets are written ONLY for link decisions; everything else carries notes
 * and stays target-free so the apply script treats it as report-only.
 */
export function toReviewedTemplateRow(
  row: LinkingTemplateRow,
  outcome: AiReviewOutcome,
  reviewedAt: string
): LinkingTemplateRow {
  return {
    ...row,
    reviewedConditionId: outcome.reviewedConditionId ?? '',
    reviewedMedicalContentId: outcome.reviewedMedicalContentId ?? '',
    reviewDecision: outcome.decision,
    reviewNotes: outcome.notes,
    reviewedBy: AI_REVIEWER_ID,
    reviewedAt,
  };
}

export interface AiReviewSummary {
  total: number;
  byDecision: Record<ReviewDecision, number>;
  preparedLinks: number;
  malformedRows: number;
}

export function summarizeOutcomes(
  outcomes: AiReviewOutcome[],
  malformedRows: number
): AiReviewSummary {
  const byDecision: Record<ReviewDecision, number> = {
    link_condition: 0,
    link_medical_content: 0,
    retire: 0,
    keep_quarantined: 0,
    needs_more_information: 0,
  };
  for (const o of outcomes) byDecision[o.decision] += 1;
  return {
    total: outcomes.length + malformedRows,
    byDecision,
    preparedLinks: byDecision.link_condition + byDecision.link_medical_content,
    malformedRows,
  };
}
