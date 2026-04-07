/**
 * Question Review Gate
 *
 * Determines the initial validationStatus for newly generated questions.
 * High-quality questions are auto-approved; others require manual review.
 *
 * Phase 2 Audit Improvement #4: AI Question Review Queue
 * Phase 3 Update (Behavioral Analysis Audit): Added 4-component quality gate.
 *   Auto-approve now requires ALL four quality components >= 0.85
 *   (see lib/services/questionQualityService.ts for component definitions).
 *
 * Legacy thresholds (for composite qualityScore):
 *   - qualityScore >= 0.9  → auto-approved (high confidence)
 *   - qualityScore >= 0.7  → pending (needs review but likely acceptable)
 *   - qualityScore < 0.7   → needs_revision (likely has issues)
 *   - flagCount >= 3       → rejected (community flagged)
 *
 * Usage:
 *   import { determineValidationStatus, autoApproveHighQuality } from './questionReviewGate';
 *
 *   // After generating a question:
 *   const status = determineValidationStatus(qualityScore, flagCount);
 *
 *   // Or use the 4-component gate:
 *   import { assessQuestionQuality } from './questionQualityService';
 *   const result = assessQuestionQuality(input);
 *   // result.recommendedStatus respects the all-components-pass rule
 *
 *   // Batch auto-approve existing pool:
 *   await autoApproveHighQuality(prisma);
 */

import type { QualityComponents } from './questionQualityService';
import { COMPONENT_APPROVE_THRESHOLD } from './questionQualityService';

/** Auto-approval threshold: questions with qualityScore >= this are auto-approved */
const AUTO_APPROVE_THRESHOLD = 0.9;

/** Below this threshold, questions are flagged for revision */
const NEEDS_REVISION_THRESHOLD = 0.7;

/** Maximum flag count before auto-rejection */
const MAX_FLAG_COUNT = 3;

export type ReviewStatus = 'approved' | 'pending' | 'needs_revision' | 'rejected';

/**
 * Determine the initial validation status for a question based on quality signals.
 */
export function determineValidationStatus(
  qualityScore: number | null | undefined,
  flagCount: number = 0
): ReviewStatus {
  // Community-flagged questions are rejected
  if (flagCount >= MAX_FLAG_COUNT) {
    return 'rejected';
  }

  // No quality score yet — default to pending (needs review)
  if (qualityScore === null || qualityScore === undefined) {
    return 'pending';
  }

  // High quality → auto-approve
  if (qualityScore >= AUTO_APPROVE_THRESHOLD) {
    return 'approved';
  }

  // Medium quality → needs human review
  if (qualityScore >= NEEDS_REVISION_THRESHOLD) {
    return 'pending';
  }

  // Low quality → needs revision
  return 'needs_revision';
}

/**
 * Batch auto-approve existing PreGeneratedQuestions that meet the quality threshold.
 * Call this once to bootstrap the approved pool, then rely on determineValidationStatus
 * for new questions.
 *
 * Returns the number of questions auto-approved.
 */
export async function autoApproveHighQuality(
  prisma: any,
  options: { dryRun?: boolean; threshold?: number } = {}
): Promise<{ approved: number; alreadyApproved: number }> {
  const threshold = options.threshold ?? AUTO_APPROVE_THRESHOLD;

  // Count already-approved
  const alreadyApproved = await prisma.preGeneratedQuestion.count({
    where: { validationStatus: 'approved' },
  });

  if (options.dryRun) {
    const wouldApprove = await prisma.preGeneratedQuestion.count({
      where: {
        validationStatus: 'pending',
        qualityScore: { gte: threshold },
        flagCount: { lt: MAX_FLAG_COUNT },
      },
    });
    return { approved: wouldApprove, alreadyApproved };
  }

  // Batch update: pending → approved where qualityScore >= threshold
  const result = await prisma.preGeneratedQuestion.updateMany({
    where: {
      validationStatus: 'pending',
      qualityScore: { gte: threshold },
      flagCount: { lt: MAX_FLAG_COUNT },
    },
    data: {
      validationStatus: 'approved',
      validatedAt: new Date(),
      validatedBy: 'auto-approve-gate',
      validationNotes: `Auto-approved: qualityScore >= ${threshold}`,
    },
  });

  return { approved: result.count, alreadyApproved };
}

/**
 * Get review queue statistics for the admin dashboard.
 */
export async function getReviewQueueStats(prisma: any): Promise<{
  pending: number;
  needsRevision: number;
  approved: number;
  rejected: number;
  total: number;
}> {
  const [pending, needsRevision, approved, rejected, total] = await Promise.all([
    prisma.preGeneratedQuestion.count({ where: { validationStatus: 'pending' } }),
    prisma.preGeneratedQuestion.count({ where: { validationStatus: 'needs_revision' } }),
    prisma.preGeneratedQuestion.count({ where: { validationStatus: 'approved' } }),
    prisma.preGeneratedQuestion.count({ where: { validationStatus: 'rejected' } }),
    prisma.preGeneratedQuestion.count(),
  ]);

  return { pending, needsRevision, approved, rejected, total };
}

/**
 * 4-component quality gate (Phase 3 — Behavioral Analysis Audit).
 *
 * Checks whether ALL four quality components meet the per-component threshold.
 * This is stricter than the legacy composite-only check and prevents questions
 * with one weak dimension from being auto-approved.
 *
 * @returns 'approved' only if ALL components >= 0.85 AND composite >= 0.90
 */
export function determineStatusFromComponents(
  components: QualityComponents,
  compositeScore: number,
  flagCount: number = 0
): ReviewStatus {
  if (flagCount >= MAX_FLAG_COUNT) {
    return 'rejected';
  }

  const allPass =
    components.difficultyAlignment >= COMPONENT_APPROVE_THRESHOLD &&
    components.discriminationIndex >= COMPONENT_APPROVE_THRESHOLD &&
    components.distractorEffectiveness >= COMPONENT_APPROVE_THRESHOLD &&
    components.clinicalRelevance >= COMPONENT_APPROVE_THRESHOLD;

  if (allPass && compositeScore >= AUTO_APPROVE_THRESHOLD) {
    return 'approved';
  }

  if (compositeScore < 0.40) {
    return 'needs_revision';
  }

  return 'pending';
}

export { AUTO_APPROVE_THRESHOLD, NEEDS_REVISION_THRESHOLD, MAX_FLAG_COUNT };
