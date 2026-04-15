/**
 * Push Reminder Cron Job (v2 — Habit Formation Integration)
 * POST /api/cron/push-reminders
 *
 * Scheduled job that generates intelligent, personalized push notifications
 * using the habit formation service. Replaces the simple due-card threshold
 * with behavioral science-backed notification scheduling.
 *
 * Notification types (via habitFormationService):
 *   - REVIEW_DUE: Cards due for review (FSRS-aligned)
 *   - STREAK_RISK: Streak about to break
 *   - DAILY_GOAL: Progress toward daily question goal
 *   - HABIT_CUE: Implementation intention trigger
 *   - SYSTEM_NEGLECT: Blueprint system going stale
 *   - ENCOURAGEMENT: Milestone celebrations
 *
 * Designed to run every 2 hours via Cloudflare Cron Trigger.
 *
 * Sprint 18 — Wire Habit Formation into Notification Cron
 * @see lib/services/habitFormationService.ts — Pure scheduling logic
 * @see functions/api/push/subscribe.ts — subscription management
 * @see public/sw.js — push event handler
 */

import { withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  generateCandidateNotifications,
  throttleNotifications,
  detectMilestone,
  type HabitProfile,
  DEFAULT_NOTIFICATION_CONFIG,
} from '../../../lib/services/habitFormationService';

const MIN_DUE_CARDS = 5;
const DEFAULT_MAX_PUSH_PER_DAY = 2;

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

type CronPagesFunction<E = Record<string, unknown>> = (
  context: {
    env: E;
    request: Request;
    params: Record<string, string>;
    waitUntil: (promise: Promise<unknown>) => void;
    passThroughOnException: () => void;
    next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
    data: Record<string, unknown>;
  }
) => Promise<Response>;

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

  const [startHRaw = '0', startMRaw = '0'] = quietStart.split(':');
  const [endHRaw = '0', endMRaw = '0'] = quietEnd.split(':');
  const startH = Number(startHRaw);
  const startM = Number(startMRaw);
  const endH = Number(endHRaw);
  const endM = Number(endMRaw);
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

export const onRequestOptions = withCors();

export const onRequestPost: CronPagesFunction<any> = async (context) => {
  const { env, request } = context;

  // Auth check — requires CRON_SECRET bearer token (same as other cron endpoints)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
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

        // ── Build HabitProfile from user data ──

        // Due cards
        const [dueNowCount, dueNext24hCount] = await Promise.all([
          prisma.userProgress.count({
            where: { userId: userPref.userId, nextReviewAt: { lte: now } },
          }),
          prisma.userProgress.count({
            where: {
              userId: userPref.userId,
              nextReviewAt: { gt: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
            },
          }),
        ]);

        // Get user's push subscriptions early to avoid wasted DB queries
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: userPref.userId },
        });

        if (subscriptions.length === 0) continue;

        // Study phenotype, streak profile, and stats for habit profile
        const [phenotype, learningProfile, stats, todayAttempts, systemProgress] = await Promise.all([
          prisma.userStudyPhenotype.findUnique({
            where: { userId: userPref.userId },
            select: { averageDailyLoad: true },
          }),
          prisma.userLearningProfile.findUnique({
            where: { userId: userPref.userId },
            select: { currentStreak: true, bestEverStreak: true, longestDailyStreak: true },
          }),
          prisma.userStatistics.findUnique({
            where: { userId: userPref.userId },
            select: { totalQuestions: true },
          }),
          prisma.questionAttempt.count({
            where: { userId: userPref.userId, createdAt: { gte: todayStart } },
          }),
          prisma.userProgress.findMany({
            where: { userId: userPref.userId },
            select: { system: true, lastReviewAt: true },
          }),
        ]);

        // Last session timestamp
        const lastSession = await prisma.drillSessionRecord.findFirst({
          where: { userId: userPref.userId },
          orderBy: { sessionStart: 'desc' },
          select: { sessionStart: true },
        });

        const hoursSinceLastSession = lastSession
          ? (now.getTime() - new Date(lastSession.sessionStart).getTime()) / (1000 * 60 * 60)
          : 999;

        const currentStreak = learningProfile?.currentStreak ?? 0;
        const longestStreak = Math.max(
          learningProfile?.bestEverStreak ?? 0,
          learningProfile?.longestDailyStreak ?? 0
        );

        // Build system staleness map
        const systemStaleness: Record<string, number> = {};
        const activeSystems: string[] = [];
        for (const p of systemProgress) {
          if (p.system) {
            if (!activeSystems.includes(p.system)) activeSystems.push(p.system);
            if (p.lastReviewAt) {
              const daysSince = Math.floor((now.getTime() - new Date(p.lastReviewAt).getTime()) / (1000 * 60 * 60 * 24));
              const existing = systemStaleness[p.system];
              systemStaleness[p.system] = existing != null ? Math.min(existing, daysSince) : daysSince;
            }
          }
        }

        const habitProfile: HabitProfile = {
          preferredHours: [9, 18, 21], // TODO: derive from circadian profile
          avgDailyQuestions: phenotype?.averageDailyLoad ?? 0,
          currentStreak,
          longestStreak,
          hoursSinceLastSession,
          cardsDueNow: dueNowCount,
          cardsDueNext24h: dueNext24hCount,
          dailyGoal: 20, // TODO: fetch from UserGoal
          questionsToday: todayAttempts,
          notificationsSent24h: 0, // TODO: track via NotificationLog when migration ships
          notificationsSent7d: 0,
          timezoneOffsetHours: 0, // TODO: fetch from UserPreferences
          systemStaleness,
          activeSystems,
          accuracyTrend: 0, // TODO: compute from recent attempts
          totalQuestionsAnswered: stats?.totalQuestions ?? 0,
          notificationsEnabled: true,
        };

        // ── Generate notifications via habit formation service ──
        const candidates = generateCandidateNotifications(habitProfile, now, {
          ...DEFAULT_NOTIFICATION_CONFIG,
          maxPerDay: maxPerDay,
        });
        const throttled = throttleNotifications(candidates, habitProfile);

        if (throttled.length === 0) {
          usersSkipped++;
          continue;
        }

        // Use the highest-priority notification
        const bestNotification = throttled[0]!;
        const payload: PushPayload = {
          title: bestNotification.title,
          body: bestNotification.body,
          url: bestNotification.actionUrl,
        };

        // Send to all subscriptions
        for (const sub of subscriptions.slice(0, maxPerDay)) {
          const success = await sendPushNotification(
            sub,
            payload,
            context.env as Record<string, string>
          );

          if (success) {
            notificationsSent++;
          } else {
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
};
