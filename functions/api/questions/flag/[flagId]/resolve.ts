import { adminEndpoint } from '../../../_shared/middleware';
import { z } from 'zod';

// Schema for resolving a flag (admin only)
const ResolveFlagSchema = z.object({
  reviewedBy: z.string().min(1).max(200),
  resolutionNote: z.string().min(1).max(2000),
});

export const onRequestPost = adminEndpoint(
  ResolveFlagSchema,
  async ({ env, params, validated }) => {
    const { createEdgePrismaClient, safePrismaDisconnect } =
      await import('../../../_shared/prisma-edge');
    const { sendFlagResolvedNotification } = await import('../../../_shared/notifications');

    const { flagId } = params;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Update flag status
      const flag = await prisma.questionFlag.update({
        where: { id: flagId as string },
        data: {
          status: 'fixed',
          reviewedBy: validated.reviewedBy,
          reviewedAt: new Date(),
          resolutionNote: validated.resolutionNote,
        },
      });

      // Send notification to user
      if (flag.userEmail) {
        const notificationSent = await sendFlagResolvedNotification({
          userEmail: flag.userEmail,
          userFirstName: flag.userFirstName || undefined,
          questionId: flag.questionId,
          questionText: flag.questionText,
          flagType: flag.flagType,
          resolutionNote: validated.resolutionNote,
        });

        if (notificationSent) {
          await prisma.questionFlag.update({
            where: { id: flagId as string },
            data: {
              notificationSent: true,
              notifiedAt: new Date(),
            },
          });
        }
      }

      return {
        status: 200,
        data: {
          success: true,
          message: 'Flag resolved and user notified',
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
