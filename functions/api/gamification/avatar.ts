/**
 * API: User Avatar Management
 * GET/POST /api/gamification/avatar
 *
 * Manages user avatar, XP, and accessory unlocks.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// GET: Fetch user avatar
export const onRequestGet = authenticatedEndpoint(z.object({}), async ({ env, auth }) => {
  const log = createEndpointLogger('/api/gamification/avatar [GET]', auth.userId);
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      include: { UserAvatarV2: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    if (!user.UserAvatarV2) {
      // Create default avatar
      const avatar = await prisma.userAvatar.create({
        data: {
          userId: user.id,
          stage: 'student_year_1',
          equippedAccessories: [],
          xp: 0,
        },
      });

      log.info('Created default avatar');
      return { data: { success: true, avatar } };
    }

    return { data: { success: true, avatar: user.UserAvatarV2 } };
  } catch (error: any) {
    log.error('Error fetching avatar', error);
    return { status: 500, error: 'Internal server error' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// POST: Award XP and check for unlocks
const AwardXPSchema = z.object({
  body: z.object({
    xp: z.number().min(0).max(1000),
    reason: z.string().optional(),
  }),
});

export const onRequestPost = authenticatedEndpoint(
  AwardXPSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/gamification/avatar [POST]', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        include: { UserAvatarV2: true },
      });

      if (!user || !user.UserAvatarV2) {
        return { status: 404, error: 'Avatar not found' };
      }

      const oldXP = user.UserAvatarV2.xp;
      const newXP = oldXP + validated.body.xp;
      const oldLevel = Math.floor(oldXP / 100);
      const newLevel = Math.floor(newXP / 100);

      const leveledUp = newLevel > oldLevel;

      const updated = await prisma.userAvatar.update({
        where: { id: user.UserAvatarV2.id },
        data: {
          xp: newXP,
          updatedAt: new Date(),
        },
      });

      log.info('XP awarded', { xp: validated.body.xp, newXP, leveledUp });

      return {
        data: {
          success: true,
          avatar: updated,
          leveledUp,
          newLevel,
        },
      };
    } catch (error: any) {
      log.error('Error awarding XP', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
