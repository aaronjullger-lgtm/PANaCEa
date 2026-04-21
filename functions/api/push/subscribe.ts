/**
 * Push Subscription Management API
 * POST /api/push/subscribe — Store a push subscription
 * DELETE /api/push/subscribe — Remove a push subscription
 *
 * Stores Web Push API subscriptions for sending SRS review reminders.
 * Each user can have multiple subscriptions (phone + laptop).
 *
 * @see hooks/usePushNotifications.ts — client-side subscription management
 * @see functions/api/cron/push-reminders.ts — scheduled notification sender
 */

import { authenticatedEndpoint, withCors} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

// ─── POST: Subscribe ────────────────────────────────────────────────

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  subscribeSchema,
  async (context) => {
    const { endpoint, keys } = context.data;
    const userId = context.auth.userId;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Upsert: update existing subscription or create new
      await prisma.pushSubscription.upsert({
        where: {
          userId_endpoint: { userId, endpoint },
        },
        create: {
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        update: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
      });

      // Enable push notifications in user preferences
      await prisma.userPreferences.upsert({
        where: { userId },
        create: {
          userId,
          pushNotifications: true,
        },
        update: {
          pushNotifications: true,
        },
      });

      return Response.json({
        data: { success: true, message: 'Subscription stored' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

// ─── DELETE: Unsubscribe ────────────────────────────────────────────

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const onRequestDelete = authenticatedEndpoint(
  unsubscribeSchema,
  async (context) => {
    const { endpoint } = context.data;
    const userId = context.auth.userId;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Remove this specific subscription
      await prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });

      // Check if user has any remaining subscriptions
      const remaining = await prisma.pushSubscription.count({
        where: { userId },
      });

      // If no subscriptions left, disable push in preferences
      if (remaining === 0) {
        await prisma.userPreferences.update({
          where: { userId },
          data: { pushNotifications: false },
        });
      }

      return Response.json({
        data: { success: true, message: 'Subscription removed' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
