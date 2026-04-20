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
  now: Date,
  timeZone?: string | null
): boolean {
  const currentMinutes = getCurrentMinutes(now, timeZone);

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

function getCurrentMinutes(now: Date, timeZone?: string | null): number {
  if (!timeZone) {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

function getTimezoneOffsetHours(now: Date, timeZone?: string | null): number {
  if (!timeZone) return 0;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(now)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value])
    );

    const localTimeAsUtc = Date.UTC(
      Number(parts.year ?? now.getUTCFullYear()),
      Number(parts.month ?? now.getUTCMonth() + 1) - 1,
      Number(parts.day ?? now.getUTCDate()),
      Number(parts.hour ?? now.getUTCHours()),
      Number(parts.minute ?? now.getUTCMinutes()),
      Number(parts.second ?? now.getUTCSeconds())
    );

    return Math.round((localTimeAsUtc - now.getTime()) / (60 * 60 * 1000));
  } catch {
    return 0;
  }
}

function derivePreferredHours(reminderTime?: string | null): number[] {
  const parsedHour = Number(reminderTime?.split(':')[0]);
  if (Number.isFinite(parsedHour) && parsedHour >= 0 && parsedHour <= 23) {
    return [parsedHour, 18, 21].filter(
      (hour, index, hours) => hours.indexOf(hour) === index
    );
  }

  return [9, 18, 21];
}

function computeAccuracyTrend(
  attempts: Array<{ createdAt: Date; wasCorrect: boolean }>,
  now: Date
): number {
  if (attempts.length < 6) return 0;

  const recentWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const priorWindowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recent = attempts.filter((attempt) => attempt.createdAt >= recentWindowStart);
  const prior = attempts.filter(
    (attempt) =>
      attempt.createdAt >= priorWindowStart && attempt.createdAt < recentWindowStart
  );

  if (recent.length < 3 || prior.length < 3) return 0;

  const recentAccuracy =
    recent.filter((attempt) => attempt.wasCorrect).length / recent.length;
  const priorAccuracy =
    prior.filter((attempt) => attempt.wasCorrect).length / prior.length;

  return recentAccuracy - priorAccuracy;
}

/**
 * Send a Web Push notification using the raw Web Push Protocol.
 * This is a simplified version that works without the `web-push` npm package.
 * For production, consider using `web-push` library for proper VAPID signing.
 *
 * Note: This sends a basic push without VAPID JWT signing.
 * For production deployments, set VAPID_PRIVATE_KEY and use proper signing.
 */
type PushStatus = 'SENT' | 'EXPIRED' | 'FAILED';

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  _env: { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string }
): Promise<PushStatus> {
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
      return 'SENT';
    }

    // 410 Gone = subscription expired, should be cleaned up
    if (response.status === 410) {
      console.log(`[push-reminders] Subscription expired: ${subscription.endpoint.slice(0, 50)}...`);
      return 'EXPIRED';
    }

    console.warn(`[push-reminders] Push failed: HTTP ${response.status}`);
    return 'FAILED';
  } catch (err) {
    console.error('[push-reminders] Push send error:', err);
    return 'FAILED';
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
          dailyGoal: true,
          pushQuietStart: true,
          pushQuietEnd: true,
          pushMaxPerDay: true,
          reminderTime: true,
          consolidationTimezone: true,
        },
      });

      let notificationsSent = 0;
      let usersSkipped = 0;
      const expiredEndpoints: string[] = [];

      for (const userPref of usersWithPush) {
        // Check quiet hours
        const quietStart = userPref.pushQuietStart || '22:00';
        const quietEnd = userPref.pushQuietEnd || '07:00';
        if (isQuietHours(quietStart, quietEnd, now, userPref.consolidationTimezone)) {
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

        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Study phenotype, streak profile, and stats for habit profile
        const [phenotype, learningProfile, stats, todayAttempts, systemProgress, recentAttempts] = await Promise.all([
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
          prisma.questionAttempt.findMany({
            where: {
              userId: userPref.userId,
              createdAt: { gte: fourteenDaysAgo },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
            select: { createdAt: true, wasCorrect: true },
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

        const accuracyTrend = computeAccuracyTrend(recentAttempts, now);

        const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const d7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [notificationsSent24h, notificationsSent7d] = await Promise.all([
          prisma.notificationLog.count({
            where: { userId: userPref.userId, sentAt: { gte: h24ago } },
          }),
          prisma.notificationLog.count({
            where: { userId: userPref.userId, sentAt: { gte: d7ago } },
          }),
        ]);

        const habitProfile: HabitProfile = {
          preferredHours: derivePreferredHours(userPref.reminderTime),
          avgDailyQuestions: phenotype?.averageDailyLoad ?? 0,
          currentStreak,
          longestStreak,
          hoursSinceLastSession,
          cardsDueNow: dueNowCount,
          cardsDueNext24h: dueNext24hCount,
          dailyGoal: userPref.dailyGoal || 20,
          questionsToday: todayAttempts,
          notificationsSent24h,
          notificationsSent7d,
          timezoneOffsetHours: getTimezoneOffsetHours(now, userPref.consolidationTimezone),
          systemStaleness,
          activeSystems,
          accuracyTrend,
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
          const pushStatus = await sendPushNotification(
            sub,
            payload,
            context.env as Record<string, string>
          );

          if (pushStatus === 'SENT') {
            notificationsSent++;
          } else if (pushStatus === 'EXPIRED') {
            expiredEndpoints.push(sub.endpoint);
          }

          // Write audit row — fire-and-forget, never fail the send loop
          prisma.notificationLog.create({
            data: {
              userId: sub.userId,
              channel: 'PUSH',
              notificationType: bestNotification.type,
              title: bestNotification.title,
              body: bestNotification.body,
              actionUrl: bestNotification.actionUrl || null,
              endpoint: sub.endpoint,
              status: pushStatus,
            },
          }).catch((err: unknown) => {
            console.warn('[push-reminders] NotificationLog write failed (table may not exist yet):', err);
          });
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
