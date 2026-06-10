/**
 * Human-confirmed linking workflow for unlinked study questions — pure helpers.
 *
 * The audit (scripts/audit-unlinked-questions.ts) classifies unlinked rows; this
 * module defines the review template a human fills in and the validation rules
 * the apply script enforces. Pure and DB-free so every rule is unit-testable.
 *
 * Invariants (enforced by validateReviewedRow):
 * - The tooling NEVER infers a link. Only human-filled reviewed* fields apply.
 * - link decisions require exactly ONE reviewed target (condition XOR content).
 * - retire / keep_quarantined / needs_more_information require reviewNotes.
 * - Unreviewed rows (empty reviewDecision) are skipped, never applied.
 */

import type { UnlinkedSource } from './unlinkedQuestionClassifier';

export const REVIEW_DECISIONS = [
  'link_condition',
  'link_medical_content',
  'retire',
  'keep_quarantined',
  'needs_more_information',
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface LinkingCandidate {
  conditionId: string;
  conditionName: string | null;
  /** MedicalContent.id when this condition has linked content; null otherwise. */
  medicalContentId: string | null;
}

export interface LinkingTemplateRow {
  // ── Source identity (read-only context for the reviewer) ──
  source: UnlinkedSource;
  id: string;
  stem: string;
  options: string[];
  correctAnswer: string | null;
  rationale: string | null;
  system: string | null;
  subcategory: string | null;
  difficulty: string | null;
  embeddedConditionName: string | null;
  /** Candidate links surfaced by the audit — suggestions only, never auto-applied. */
  candidates: LinkingCandidate[];

  // ── Reviewer-filled fields (blank in a fresh template) ──
  reviewedConditionId: string;
  reviewedMedicalContentId: string;
  reviewDecision: ReviewDecision | '';
  reviewNotes: string;
  reviewedBy: string;
  reviewedAt: string;
}

export interface LinkingTemplateSourceRow {
  source: UnlinkedSource;
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
}

/** Build a fresh (unreviewed) template row. Deterministic for a given input. */
export function buildLinkingTemplateRow(row: LinkingTemplateSourceRow): LinkingTemplateRow {
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
    reviewedConditionId: '',
    reviewedMedicalContentId: '',
    reviewDecision: '',
    reviewNotes: '',
    reviewedBy: '',
    reviewedAt: '',
  };
}

/**
 * Build the full template, sorted deterministically (source, then id) so
 * re-generation produces stable diffs. When `previous` rows are provided
 * (an existing, possibly partially reviewed template), their reviewer-filled
 * fields are preserved by (source, id) — re-running the generator must never
 * clobber human work.
 */
export function buildLinkingTemplate(
  rows: LinkingTemplateSourceRow[],
  previous: LinkingTemplateRow[] = []
): LinkingTemplateRow[] {
  const previousByKey = new Map(previous.map((r) => [`${r.source}::${r.id}`, r]));
  return [...rows]
    .sort((a, b) => (a.source === b.source ? a.id.localeCompare(b.id) : a.source.localeCompare(b.source)))
    .map((row) => {
      const fresh = buildLinkingTemplateRow(row);
      const prior = previousByKey.get(`${row.source}::${row.id}`);
      if (!prior) return fresh;
      return {
        ...fresh,
        reviewedConditionId: prior.reviewedConditionId ?? '',
        reviewedMedicalContentId: prior.reviewedMedicalContentId ?? '',
        reviewDecision: prior.reviewDecision ?? '',
        reviewNotes: prior.reviewNotes ?? '',
        reviewedBy: prior.reviewedBy ?? '',
        reviewedAt: prior.reviewedAt ?? '',
      };
    });
}

export interface RowValidationContext {
  /** Condition.id values that exist in the database. */
  knownConditionIds: ReadonlySet<string>;
  /** MedicalContent.id values that exist in the database. */
  knownMedicalContentIds: ReadonlySet<string>;
}

export interface RowValidationResult {
  /** 'skip' = unreviewed row, ignore silently. 'invalid' = refuse the whole run. */
  status: 'apply' | 'report_only' | 'skip' | 'invalid';
  errors: string[];
}

const trimmed = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Validate a single reviewed row against the workflow rules.
 *
 * - skip:        reviewDecision empty (row not reviewed yet).
 * - apply:       link_condition / link_medical_content / retire with valid fields.
 * - report_only: keep_quarantined / needs_more_information with required notes —
 *                recorded in the application report, DB untouched.
 * - invalid:     any rule violation; the apply script must refuse the run.
 */
export function validateReviewedRow(
  row: LinkingTemplateRow,
  context: RowValidationContext
): RowValidationResult {
  const errors: string[] = [];
  const decision = trimmed(row.reviewDecision);
  const conditionId = trimmed(row.reviewedConditionId);
  const medicalContentId = trimmed(row.reviewedMedicalContentId);
  const notes = trimmed(row.reviewNotes);
  const reviewedBy = trimmed(row.reviewedBy);

  if (!decision) {
    if (conditionId || medicalContentId) {
      return {
        status: 'invalid',
        errors: [`${row.id}: reviewed target supplied without a reviewDecision`],
      };
    }
    return { status: 'skip', errors: [] };
  }

  if (!(REVIEW_DECISIONS as readonly string[]).includes(decision)) {
    return { status: 'invalid', errors: [`${row.id}: unknown reviewDecision "${decision}"`] };
  }

  if (!reviewedBy) {
    errors.push(`${row.id}: reviewedBy is required for any decision`);
  }

  if (conditionId && medicalContentId) {
    errors.push(`${row.id}: supply reviewedConditionId OR reviewedMedicalContentId, not both`);
  }

  switch (decision as ReviewDecision) {
    case 'link_condition': {
      if (!conditionId) {
        errors.push(`${row.id}: link_condition requires reviewedConditionId`);
      } else if (!context.knownConditionIds.has(conditionId)) {
        errors.push(`${row.id}: reviewedConditionId "${conditionId}" does not exist in Condition`);
      }
      if (medicalContentId) {
        errors.push(`${row.id}: link_condition must not set reviewedMedicalContentId`);
      }
      break;
    }
    case 'link_medical_content': {
      if (!medicalContentId) {
        errors.push(`${row.id}: link_medical_content requires reviewedMedicalContentId`);
      } else if (!context.knownMedicalContentIds.has(medicalContentId)) {
        errors.push(
          `${row.id}: reviewedMedicalContentId "${medicalContentId}" does not exist in MedicalContent`
        );
      }
      if (conditionId) {
        errors.push(`${row.id}: link_medical_content must not set reviewedConditionId`);
      }
      break;
    }
    case 'retire':
    case 'keep_quarantined':
    case 'needs_more_information': {
      if (!notes) {
        errors.push(`${row.id}: ${decision} requires reviewNotes`);
      }
      if (conditionId || medicalContentId) {
        errors.push(`${row.id}: ${decision} must not set reviewed link targets`);
      }
      break;
    }
  }

  if (errors.length > 0) return { status: 'invalid', errors };

  const isMutation = decision === 'link_condition' || decision === 'link_medical_content' || decision === 'retire';
  return { status: isMutation ? 'apply' : 'report_only', errors: [] };
}

export interface TemplateValidationSummary {
  total: number;
  skipped: number;
  toApply: LinkingTemplateRow[];
  reportOnly: LinkingTemplateRow[];
  invalid: Array<{ row: LinkingTemplateRow; errors: string[] }>;
}

/** Validate the whole template. The apply script refuses to run if any row is invalid. */
export function validateTemplate(
  rows: LinkingTemplateRow[],
  context: RowValidationContext
): TemplateValidationSummary {
  const summary: TemplateValidationSummary = {
    total: rows.length,
    skipped: 0,
    toApply: [],
    reportOnly: [],
    invalid: [],
  };
  for (const row of rows) {
    const result = validateReviewedRow(row, context);
    if (result.status === 'skip') summary.skipped += 1;
    else if (result.status === 'apply') summary.toApply.push(row);
    else if (result.status === 'report_only') summary.reportOnly.push(row);
    else summary.invalid.push({ row, errors: result.errors });
  }
  return summary;
}
