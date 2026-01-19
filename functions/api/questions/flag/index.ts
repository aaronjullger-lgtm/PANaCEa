import { authenticatedEndpoint } from '../../_shared/middleware';
import { z } from 'zod';

// Schema for flagging a question (any authenticated user can flag)
const FlagQuestionSchema = z.object({
  userEmail: z.string().email().optional(),
  userFirstName: z.string().max(100).optional(),
  questionId: z.string().min(1).max(100),
  questionText: z.string().optional(),
  correctAnswer: z.string().max(500).optional(),
  topic: z.string().max(100).optional(),
  system: z.string().max(100).optional(),
  flagType: z.enum(['typo', 'incorrect_answer', 'unclear', 'outdated', 'other']),
  description: z.string().min(1).max(1000),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

export const onRequestPost = authenticatedEndpoint(FlagQuestionSchema, async ({ env, auth, validated }) => {
  const { createEdgePrismaClient, safePrismaDisconnect } = await import('../../_shared/prisma-edge');
  const { sendAdminFlagNotification } = await import('../../_shared/notifications');

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Create flag in database
    const flag = await prisma.questionFlag.create({
      data: {
        userId: auth.userId,
        userEmail: validated.userEmail || null,
        userFirstName: validated.userFirstName || null,
        questionId: validated.questionId,
        questionText: validated.questionText || '',
        correctAnswer: validated.correctAnswer || null,
        topic: validated.topic || null,
        system: validated.system || null,
        flagType: validated.flagType,
        description: validated.description,
        priority: validated.priority || 'medium',
      },
    });

    // Check for auto-demotion: if question has >= 3 pending flags, demote it
    const pendingFlagCount = await prisma.questionFlag.count({
      where: {
        questionId: validated.questionId,
        status: 'pending',
      },
    });

    let demoted = false;
    if (pendingFlagCount >= 3) {
      // Try to demote from PreGeneratedQuestion to StagingQuestion
      try {
        const preGenQuestion = await prisma.preGeneratedQuestion.findFirst({
          where: { id: validated.questionId },
        });

        if (preGenQuestion) {
          // Create staging question for review
          await prisma.stagingQuestion.create({
            data: {
              id: `staging-${validated.questionId}`,
              questionText: preGenQuestion.questionText,
              answers: preGenQuestion.answers as string[],
              correctIndex: preGenQuestion.correctIndex,
              explanation: preGenQuestion.explanation,
              system: preGenQuestion.system,
              conditionId: preGenQuestion.conditionId,
              difficulty: preGenQuestion.difficulty,
              tags: preGenQuestion.tags as string[],
              status: 'flagged_for_review',
              rejectionReason: `Auto-demoted: ${pendingFlagCount} user flags received`,
            },
          });

          // Mark the pre-generated question as demoted (set usedAt to prevent serving)
          await prisma.preGeneratedQuestion.update({
            where: { id: validated.questionId },
            data: {
              usedAt: new Date(),
            },
          });

          demoted = true;
          console.log(
            `[AutoDemotion] Question ${validated.questionId} demoted after ${pendingFlagCount} flags`
          );
        }
      } catch (demotionError) {
        console.error('[AutoDemotion] Failed to demote question:', demotionError);
        // Don't fail the flag creation if demotion fails
      }
    }

    // Send notification to admin (if configured)
    const adminEmail = env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendAdminFlagNotification(adminEmail, {
        id: flag.id,
        questionId: validated.questionId,
        questionText: validated.questionText || '',
        flagType: validated.flagType,
        description: validated.description,
        userEmail: validated.userEmail,
        userFirstName: validated.userFirstName,
      });
    }

    return {
      status: 200,
      data: {
        success: true,
        flagId: flag.id,
        demoted,
        pendingFlagCount,
        message: demoted
          ? 'Question flagged and automatically removed from pool for review. Thank you for your feedback!'
          : 'Question flagged successfully. We will review it soon!',
      },
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});