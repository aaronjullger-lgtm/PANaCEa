/**
 * FIRe — Fractional Implicit Repetition Service
 *
 * Implements hierarchical stability credit propagation for PANaCEa's TARGETED
 * session FSRS writer.
 *
 * When a student correctly answers a higher-hierarchy question (level 2 or 3),
 * lower-hierarchy siblings in the same conditionFamily receive a partial
 * stability extension reflecting the implicit recall required.
 *
 * Hierarchy model:
 *   Level 1 — Pathophysiology / Mechanism
 *   Level 2 — Diagnosis / Recognition
 *   Level 3 — Management / Therapeutics
 *
 * Fractional credit schedule:
 *   level 3 correct → level 2 gets 0.40 × current stability
 *   level 3 correct → level 1 gets 0.20 × current stability
 *   level 2 correct → level 1 gets 0.40 × current stability
 *
 * Cap: implicit credit cannot push the next due date beyond originalDue + 14 days.
 * This prevents a single correct answer from eliminating many upcoming reviews.
 *
 * Only runs for TARGETED sessions (writesFSRS = true) on CORRECT answers.
 * Silently skips if conditionFamily or hierarchyLevel is null on the question.
 *
 * @module lib/services/fireImplicitCreditService
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FIReCreditResult {
  siblingsUpdated: number;
  siblingsSkipped: number;
  creditsApplied: Array<{
    conditionId: string;
    siblingLevel: number;
    fractionalCredit: number;
    oldStability: number;
    newStability: number;
    oldNextDue: Date | null;
    newNextDue: Date;
    capped: boolean;
  }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Days of implicit credit cap: cannot advance due date by more than this. */
const IMPLICIT_CREDIT_CAP_DAYS = 14;

/** Fractional credit per answered level → sibling level transition. */
const FRACTIONAL_CREDIT: Record<number, Record<number, number>> = {
  3: { 2: 0.4, 1: 0.2 },
  2: { 1: 0.4 },
};

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Apply FIRe implicit credit to sibling conditions when a TARGETED-session
 * CORRECT answer is submitted.
 *
 * @param prisma           Prisma client (may be a transaction tx or root client)
 * @param userId           Internal user UUID
 * @param answeredQuestionId  The question that was just answered correctly
 * @param conditionFamily  From question.conditionFamily — null = no-op
 * @param hierarchyLevel   From question.hierarchyLevel — null or 1 = no-op
 * @param progressContext  TARGETED context partition key
 */
export async function applyFIReImplicitCredit(
  prisma: PrismaClient,
  userId: string,
  answeredQuestionId: string,
  conditionFamily: string | null | undefined,
  hierarchyLevel: number | null | undefined,
  progressContext: 'TARGETED' | 'READINESS' = 'TARGETED'
): Promise<FIReCreditResult> {
  const result: FIReCreditResult = {
    siblingsUpdated: 0,
    siblingsSkipped: 0,
    creditsApplied: [],
  };

  // Guard: only propagate if question has valid conditionFamily and hierarchyLevel > 1
  if (!conditionFamily || hierarchyLevel == null || hierarchyLevel <= 1) {
    return result;
  }

  const creditSchedule = FRACTIONAL_CREDIT[hierarchyLevel];
  if (!creditSchedule || Object.keys(creditSchedule).length === 0) {
    return result;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const capMs = IMPLICIT_CREDIT_CAP_DAYS * 24 * 60 * 60 * 1000;

  // ── Find sibling questions at lower hierarchy levels ──────────────────────
  // Collect unique conditionIds for each eligible sibling hierarchy level.
  const siblingLevels = Object.keys(creditSchedule).map(Number);

  // Query all questions in this conditionFamily at lower hierarchy levels.
  const siblingQuestions = await prisma.question.findMany({
    where: {
      conditionFamily,
      hierarchyLevel: { in: siblingLevels },
    },
    select: {
      conditionId: true,
      hierarchyLevel: true,
    },
  });

  if (siblingQuestions.length === 0) {
    return result;
  }

  // Group by hierarchyLevel — we only need one conditionId per level to find UserProgress.
  // Multiple questions can share the same conditionId, so deduplicate.
  const conditionsByLevel: Map<number, Set<string>> = new Map();
  for (const q of siblingQuestions) {
    if (!q.conditionId || q.hierarchyLevel == null) continue;
    const level = q.hierarchyLevel;
    if (!conditionsByLevel.has(level)) conditionsByLevel.set(level, new Set());
    conditionsByLevel.get(level)!.add(q.conditionId);
  }

  // ── Apply credit to each sibling UserProgress record ─────────────────────
  for (const [siblingLevel, conditionIds] of conditionsByLevel.entries()) {
    const fractionalCredit = creditSchedule[siblingLevel];
    if (fractionalCredit == null) continue;

    for (const conditionId of conditionIds) {
      try {
        const progress = await prisma.userProgress.findUnique({
          where: {
            userId_conditionId_progressContext: {
              userId,
              conditionId,
              progressContext,
            },
          },
          select: {
            fsrsStability: true,
            nextReviewAt: true,
          },
        });

        if (!progress || progress.fsrsStability == null || progress.fsrsStability <= 0) {
          result.siblingsSkipped++;
          continue;
        }

        const oldStability = progress.fsrsStability;
        const rawNewStability = oldStability + fractionalCredit * oldStability;

        // Cap: new due date cannot exceed originalDue + 14 days
        const originalDueMs = progress.nextReviewAt?.getTime() ?? nowMs;
        const rawNewDueMs = nowMs + rawNewStability * 24 * 60 * 60 * 1000;
        const cappedDueMs = Math.min(rawNewDueMs, originalDueMs + capMs);
        const capped = rawNewDueMs > originalDueMs + capMs;

        // Derive capped stability from capped due date
        const cappedStabilityDays = (cappedDueMs - nowMs) / (24 * 60 * 60 * 1000);
        const newStability = Math.max(oldStability, cappedStabilityDays);
        const newNextDue = new Date(cappedDueMs);

        await prisma.userProgress.update({
          where: {
            userId_conditionId_progressContext: {
              userId,
              conditionId,
              progressContext,
            },
          },
          data: {
            fsrsStability: newStability,
            nextReviewAt: newNextDue,
            lastImplicitCredit: now,
            implicitCreditSource: answeredQuestionId,
            updatedAt: now,
            // Do NOT touch: reps, difficulty, fsrsState, reviewHistory
          },
        });

        result.siblingsUpdated++;
        result.creditsApplied.push({
          conditionId,
          siblingLevel,
          fractionalCredit,
          oldStability,
          newStability,
          oldNextDue: progress.nextReviewAt,
          newNextDue,
          capped,
        });
      } catch {
        // Non-fatal: sibling credit is best-effort
        result.siblingsSkipped++;
      }
    }
  }

  return result;
}
