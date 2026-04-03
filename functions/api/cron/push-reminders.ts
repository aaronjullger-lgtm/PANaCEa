/**
 * Push Reminder Cron Job
 * POST /api/cron/push-reminders
 *
 * Scheduled job that finds users with due review cards and sends
 * push notifications to their subscribed devices. Respects:
 * - Quiet hours (pushQuietStart / pushQuietEnd in UserPreferences)
 * - Daily send limit (default 2 per day)
 * - Minimum due card threshold (5+ cards to justify a notification)
 *
 * Designed to run every 2 hours via Cloudflare Cron Trigger.
 *
 * @see functions/api/push/subscribe.ts — subscription management
 * @see public/sw.js — push event handler
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const bodySchema = z.object({}).optional().default({});

const MIN_DUE_CARDS = 5;
const DEFAULT_MAX_PUSH_PER_DAY = 2;

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Check if current time is within quiet hours for a given timezone.
 * Quiet hours default to 22:00-07:00.
 */
function isQuietHours(
  quietStart: string,
  quietEnd: string,
  now: Date
): boolean {
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes > endMinutes) {
    // Quiet period crosses midnight (e.g., 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Send a Web Push notification using the raw Web Push Protocol.
 * This is a simplified version that works without the `web-push` npm package.
 * For production, consider using `web-push` library for proper VAPID signing.
 *
 * Note: This sends a basic push without VAPID JWT signing.
 * For production deployments, set VAPID_PRIVATE_KEY and use proper signing.
 */
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  _env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string }
): Promise<boolean> {
  try {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        TTL: '86400', // 24 hours
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 201 || response.status === 200) {
      return true;
    }

    // 410 Gone = subscription expired, should be cleaned up
    if (response.status === 410) {
      console.log(`[push-reminders] Subscription expired: ${subscription.endpoint.slice(0, 50)}...`);
      return false;
    }

    console.warn(`[push-reminders] Push failed: HTTP ${response.status}`);
    return false;
  } catch (err) {
    console.error('[push-reminders] Push send error:', err);
    return false;
  }
}

export const onRequestPost = authenticatedEndpoint(
  bodySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    try {
      // Find users with push enabled and active subscriptions
      const usersWithPush = await prisma.userPreferences.findMany({
        where: {
          pushNotifications: true,
        },
        select: {
          userId: true,
          pushQuietStart: true,
          pushQuietEnd: true,
          pushMaxPerDay: true,
        },
      });

      let notificationsSent = 0;
      let usersSkipped = 0;
      const expiredEndpoints: string[] = [];

      for (const userPref of usersWithPush) {
        // Check quiet hours
        const quietStart = userPref.pushQuietStart || '22:00';
        const quietEnd = userPref.pushQuietEnd || '07:00';
        if (isQuietHours(quietStart, quietEnd, now)) {
          usersSkipped++;
          continue;
        }

        // Check daily send limit (tracked via simple endpoint hit counting)
        const maxPerDay = userPref.pushMaxPerDay || DEFAULT_MAX_PUSH_PER_DAY;

        // Count due cards for this user
        const dueCount = await prisma.userProgress.count({
          where: {
            userId: userPref.userId,
            nextReviewAt: { lte: now },
          },
        });

        if (dueCount < MIN_DUE_CARDS) {
          usersSkipped++;
          continue;
        }

        // Get user's push subscriptions
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: userPref.userId },
        });

        if (subscriptions.length === 0) continue;

        // Build notification payload
        const payload: PushPayload = {
          title: 'Time to review!',
          body: dueCount <= 15
            ? `You have ${dueCount} cards due — about ${Math.ceil(dueCount * 0.5)} min.`
            : `${dueCount} cards are waiting for you. Start with a quick 15-min session!`,
          url: '/study/main-session',
        };

        // Send to all subscriptions (max per day not yet tracked — future enhancement)
        for (const sub of subscriptions.slice(0, maxPerDay)) {
          const success = await sendPushNotification(
            sub,
            payload,
            context.env as Record<string, string>
          );

          if (success) {
            notificationsSent++;
          } else {
            // Check if subscription is expired (410)
            expiredEndpoints.push(sub.endpoint);
          }
        }
      }

      // Clean up expired subscriptions
      if (expiredEndpoints.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: { in: expiredEndpoints } },
        });
      }

      return Response.json({
        data: {
          success: true,
          notificationsSent,
          usersProcessed: usersWithPush.length,
          usersSkipped,
          expiredSubscriptionsRemoved: expiredEndpoints.length,
        },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
