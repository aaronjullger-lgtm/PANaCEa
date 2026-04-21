import { authenticatedEndpoint, withCors} from '../../_shared/middleware';

// Shared schema — single source of truth for this endpoint's request contract.
// To change the /api/questions/flag contract, edit lib/api/schemas/questions.ts.
import { FlagQuestionRequestSchema as FlagQuestionSchema } from '../../../../lib/api/schemas/questions';

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  FlagQuestionSchema,
  async ({ env, auth, validated }) => {
    const { createEdgePrismaClient, safePrismaDisconnect } =
      await import('../../_shared/prisma-edge');
    const { sendAdminFlagNotification } = await import('../../_shared/notifications');

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true, email: true, firstName: true },
      });
      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      // Create flag in database
      const flag = await prisma.questionFlag.create({
        data: {
          id: `flag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: user.id,
          userEmail: validated.userEmail ?? user.email ?? null,
          userFirstName: validated.userFirstName ?? user.firstName ?? null,
          questionId: validated.questionId,
          questionText: validated.questionText ?? '',
          correctAnswer: validated.correctAnswer ?? null,
          topic: validated.topic ?? null,
          system: validated.system ?? null,
          flagType: validated.flagType,
          description: validated.description,
          priority: validated.priority ?? 'medium',
          updatedAt: new Date(),
        },
      });

      // Kill switch (Crowdsourced Recall): if questionId is a PreGeneratedQuestion,
      // update flagCount, flagRate; auto-reject when flagRate > 15% and timesServed > 20.
      let killSwitchTriggered = false;
      try {
        const preGen = await prisma.preGeneratedQuestion.findUnique({
          where: { id: validated.questionId },
          select: { id: true, flagCount: true, timesServed: true, validationStatus: true },
        });
        if (preGen) {
          const newFlagCount = preGen.flagCount + 1;
          const timesServed = Math.max(1, preGen.timesServed);
          const flagRate = newFlagCount / timesServed;
          const shouldReject =
            flagRate > 0.15 && preGen.timesServed > 20 && preGen.validationStatus !== 'rejected';
          await prisma.preGeneratedQuestion.update({
            where: { id: validated.questionId },
            data: {
              flagCount: newFlagCount,
              flagRate,
              ...(shouldReject ? { validationStatus: 'rejected' } : {}),
            },
          });
          if (shouldReject) killSwitchTriggered = true;
        }
      } catch (killSwitchError) {
        console.error(
          '[KillSwitch] Failed to update PreGeneratedQuestion flag stats:',
          killSwitchError
        );
      }

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
            const qd = (preGenQuestion.questionData as Record<string, unknown>) || {};
            const question = typeof qd.question === 'string' ? qd.question : '';
            const options = Array.isArray(qd.options) ? qd.options : [];
            const correctAnswer = typeof qd.correctAnswer === 'string' ? qd.correctAnswer : 'A';
            const explanation = typeof qd.explanation === 'string' ? qd.explanation : 'See review.';
            const vignette = typeof qd.vignette === 'string' ? qd.vignette : '';

            await prisma.stagingQuestion.create({
              data: {
                id: `staging-${validated.questionId}`,
                question,
                vignette,
                options,
                correctAnswer,
                explanation,
                system: preGenQuestion.system ?? 'other',
                difficulty: preGenQuestion.difficulty,
                status: 'pending',
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

      let message = 'Question flagged successfully. We will review it soon!';
      if (killSwitchTriggered) {
        message =
          'Question flagged; high flag rate triggered automatic removal from the pool. Thank you for your feedback!';
      } else if (demoted) {
        message =
          'Question flagged and automatically removed from pool for review. Thank you for your feedback!';
      }
      return {
        status: 200,
        data: {
          success: true,
          flagId: flag.id,
          demoted,
          killSwitchTriggered,
          pendingFlagCount,
          message,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
