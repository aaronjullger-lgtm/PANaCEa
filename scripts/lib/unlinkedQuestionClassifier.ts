/**
 * Pure classification logic for unlinked study questions.
 *
 * "Unlinked" = an approved/servable question with neither conditionId nor
 * medicalContentId. Such a question can be served and answered but the
 * ReviewLog/UserProgress/FSRS branch in drillReviewService silently skips it
 * (now observable via fsrsSkippedReason='missing_condition_linkage'), so every
 * answer is a scheduling no-op. The serving-safety gate (withProgressLinkage)
 * already prevents these from entering the main study path; this classifier
 * decides what durable remediation each row needs.
 *
 * This module is intentionally DB-free and deterministic so it can be unit
 * tested without a database. The audit script supplies pre-computed candidate
 * matches (looked up against Condition/MedicalContent) and this module decides
 * the action. It NEVER mutates data and NEVER fabricates a link: a condition
 * link is only proposed when exactly one unambiguous candidate exists.
 */

export type UnlinkedSource = 'pre_generated' | 'question';

export type UnlinkedClassification =
  | 'link_condition_candidate'
  | 'link_medical_content_candidate'
  | 'retire_candidate'
  | 'manual_review_required'
  | 'duplicate_candidate'
  | 'unsafe_to_infer';

/** Normalized, source-agnostic view of an unlinked row. */
export interface UnlinkedQuestionRecord {
  id: string;
  source: UnlinkedSource;
  system: string | null;
  /** Clinical grouping (PreGen questionData.subcategory or Question.category/topic). */
  subcategory: string | null;
  /** Diagnosis name embedded in the question payload, if any (often absent by design). */
  embeddedConditionName: string | null;
  /** Stem/question prompt text. */
  stem: string;
  /** Answer choices. */
  options: string[];
  /** Resolvable correct answer (text, letter, or index as string). */
  correctAnswer: string | null;
  /** Whether an explanation/rationale is present. */
  hasRationale: boolean;
  timesServed: number;
  /** semanticHash (PreGen) or null. Used only for duplicate detection. */
  semanticHash: string | null;
}

/**
 * Candidate links resolved by the caller against the live content tables.
 * - conditionIdsByName: Condition rows whose name equals embeddedConditionName.
 * - conditionIdsBySubcategory: Condition rows in the same (system, subcategory)
 *   grouping. A grouping is NOT a single concept, so >1 is ambiguous and 1 is
 *   still only a *suggestion* — never an auto-apply.
 * - medicalContentIdByCondition: a MedicalContent.id when a uniquely matched
 *   condition has linked content.
 * - semanticHashIsDuplicated: true when another unlinked row shares this hash.
 */
export interface UnlinkedCandidateContext {
  conditionIdsByName: string[];
  conditionIdsBySubcategory: string[];
  medicalContentIdByCondition: string | null;
  semanticHashIsDuplicated: boolean;
}

export interface UnlinkedClassificationResult {
  id: string;
  source: UnlinkedSource;
  classification: UnlinkedClassification;
  /** Highest-confidence single condition to link, only when unambiguous. */
  suggestedConditionId: string | null;
  /** MedicalContent.id to link, only when derived from an unambiguous condition. */
  suggestedMedicalContentId: string | null;
  /** Ambiguous candidate conditions surfaced for a human reviewer. */
  candidateConditionIds: string[];
  /** Whether an automated tool may act on this row without clinical judgment. */
  autoActionable: boolean;
  reason: string;
}

/** A row is degenerate (not salvageable as a study item) when content is missing. */
export function isDegenerate(record: UnlinkedQuestionRecord): boolean {
  const hasStem = record.stem.trim().length > 0;
  const hasEnoughOptions = record.options.filter((o) => o && o.trim().length > 0).length >= 2;
  const hasCorrect = record.correctAnswer != null && record.correctAnswer.trim().length > 0;
  return !(hasStem && hasEnoughOptions && hasCorrect);
}

/**
 * Classify a single unlinked question. Pure: same inputs → same output.
 *
 * Priority order is deliberately conservative:
 * 1. duplicate_candidate  — shares a semantic hash with another unlinked row.
 * 2. retire_candidate     — degenerate content (no stem/options/answer) AND never served.
 * 3. link_*_candidate     — exactly one unambiguous condition match (suggestion only).
 * 4. manual_review_required — salvageable but ambiguous or no deterministic link.
 * 5. unsafe_to_infer      — no system/subcategory/name to reason about at all.
 */
export function classifyUnlinkedQuestion(
  record: UnlinkedQuestionRecord,
  context: UnlinkedCandidateContext
): UnlinkedClassificationResult {
  const base = {
    id: record.id,
    source: record.source,
    suggestedConditionId: null as string | null,
    suggestedMedicalContentId: null as string | null,
    candidateConditionIds: [] as string[],
    autoActionable: false,
  };

  if (context.semanticHashIsDuplicated && record.semanticHash) {
    return {
      ...base,
      classification: 'duplicate_candidate',
      reason: `Shares semanticHash ${record.semanticHash} with another unlinked row; dedupe before linking.`,
    };
  }

  // Degenerate AND unused → safe to retire. A degenerate row that has been
  // served is escalated to manual review instead (it may have real history).
  if (isDegenerate(record)) {
    if (record.timesServed === 0) {
      return {
        ...base,
        classification: 'retire_candidate',
        reason: 'Missing stem, <2 options, or no resolvable correct answer; never served.',
      };
    }
    return {
      ...base,
      classification: 'manual_review_required',
      reason: 'Degenerate content but has serve history; needs human decision.',
    };
  }

  // Unambiguous name match → highest-confidence link suggestion.
  if (context.conditionIdsByName.length === 1) {
    return {
      ...base,
      classification: context.medicalContentIdByCondition
        ? 'link_medical_content_candidate'
        : 'link_condition_candidate',
      suggestedConditionId: context.conditionIdsByName[0] ?? null,
      suggestedMedicalContentId: context.medicalContentIdByCondition,
      candidateConditionIds: context.conditionIdsByName,
      reason: 'Embedded condition name matches exactly one Condition row.',
    };
  }

  // No reasoning surface at all.
  if (!record.system && !record.subcategory && !record.embeddedConditionName) {
    return {
      ...base,
      classification: 'unsafe_to_infer',
      reason: 'No system, subcategory, or condition name to infer linkage from.',
    };
  }

  // Salvageable clinical content but no unambiguous link. Surface candidates
  // (subcategory grouping or multiple name matches) for a human reviewer.
  const candidates =
    context.conditionIdsByName.length > 1
      ? context.conditionIdsByName
      : context.conditionIdsBySubcategory;
  return {
    ...base,
    classification: 'manual_review_required',
    candidateConditionIds: candidates,
    reason:
      candidates.length > 1
        ? `Subcategory/name maps to ${candidates.length} candidate conditions; clinical judgment needed to pick one.`
        : candidates.length === 1
          ? 'Single subcategory-group candidate is a grouping match, not a confirmed concept; needs review.'
          : 'Salvageable vignette but no matching Condition row exists yet.',
  };
}

export interface UnlinkedAuditSummary {
  total: number;
  bySource: Record<UnlinkedSource, number>;
  byClassification: Record<UnlinkedClassification, number>;
  autoActionable: number;
}

export function summarizeClassifications(
  results: UnlinkedClassificationResult[]
): UnlinkedAuditSummary {
  const byClassification: Record<UnlinkedClassification, number> = {
    link_condition_candidate: 0,
    link_medical_content_candidate: 0,
    retire_candidate: 0,
    manual_review_required: 0,
    duplicate_candidate: 0,
    unsafe_to_infer: 0,
  };
  const bySource: Record<UnlinkedSource, number> = {
    pre_generated: 0,
    question: 0,
  };
  let autoActionable = 0;

  for (const r of results) {
    byClassification[r.classification] += 1;
    bySource[r.source] += 1;
    if (r.autoActionable) autoActionable += 1;
  }

  return { total: results.length, bySource, byClassification, autoActionable };
}
