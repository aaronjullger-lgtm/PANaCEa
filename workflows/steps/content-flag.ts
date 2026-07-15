import type { ContentFlagDecision, ContentFlagReviewDecision } from '../types/content-flag';

/**
 * Apply admin decision to a ContentQualityFlag.
 * Mirrors PUT /api/admin/content-quality-flags/:id semantics.
 *
 * Does not disconnect the shared script Prisma pool — workflow steps may retry.
 */
export async function applyFlagDecision(
  flagId: string,
  decision: ContentFlagReviewDecision
): Promise<{ applied: boolean; message: string }> {
  'use step';

  const { prisma } = await import('../../scripts/helpers/prisma-client');

  try {
    const flag = await prisma.contentQualityFlag.findUnique({ where: { id: flagId } });
    if (!flag) {
      return { applied: false, message: `Flag not found: ${flagId}` };
    }

    if (decision.decision === 'approve') {
      if (!flag.regeneratedContent) {
        return {
          applied: false,
          message: 'Cannot approve: no regenerated content available',
        };
      }

      const regen = flag.regeneratedContent as Record<string, unknown>;
      const questionUpdate: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof regen.question === 'string') questionUpdate.question = regen.question;
      if (regen.options) questionUpdate.options = regen.options;
      if (typeof regen.correctAnswer === 'string') questionUpdate.correctAnswer = regen.correctAnswer;
      if (typeof regen.explanation === 'string' || typeof regen.explanation === 'object') {
        const explanation =
          typeof regen.explanation === 'object' &&
          regen.explanation !== null &&
          'rationale' in regen.explanation
            ? (regen.explanation as { rationale: string }).rationale
            : regen.explanation;
        questionUpdate.explanation = explanation;
      }
      if (typeof regen.difficulty === 'number') {
        questionUpdate.difficulty =
          regen.difficulty < 0.4 ? 'easy' : regen.difficulty > 0.6 ? 'hard' : 'medium';
      }

      await prisma.$transaction([
        prisma.contentQualityFlag.update({
          where: { id: flagId },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedBy: decision.reviewerId,
            critiqueFeedback: decision.notes ?? undefined,
          },
        }),
        prisma.question.update({
          where: { id: flag.questionId },
          data: questionUpdate,
        }),
      ]);

      return { applied: true, message: `Flag ${flagId} approved — question updated` };
    }

    if (decision.decision === 'reject') {
      await prisma.contentQualityFlag.update({
        where: { id: flagId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedBy: decision.reviewerId,
          critiqueFeedback: decision.notes ?? undefined,
        },
      });
      return { applied: true, message: `Flag ${flagId} rejected — original content kept` };
    }

    if (decision.decision === 'requeue') {
      if (flag.status === 'FLAGGED') {
        return { applied: false, message: 'Flag is already in flagged state' };
      }

      await prisma.contentQualityFlag.update({
        where: { id: flagId },
        data: {
          status: 'FLAGGED',
          regeneratedContent: null,
          critiqueFeedback: decision.notes ?? null,
          resolvedAt: null,
          resolvedBy: null,
        },
      });
      return { applied: true, message: `Flag ${flagId} requeued for regeneration` };
    }

    const exhaustive: never = decision.decision;
    return { applied: false, message: `Unsupported decision: ${exhaustive as ContentFlagDecision}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { applied: false, message };
  }
}
