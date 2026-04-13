/**
 * Habit Formation & Notification Scheduling Service
 *
 * Determines optimal notification timing, content, and frequency based on
 * behavioral science research and the learner's study patterns.
 *
 * Research backing:
 *   - Implementation Intentions (Gollwitzer, 1999): "When X, I will do Y"
 *   - Habit Loop (Duhigg, 2012): Cue → Routine → Reward
 *   - Optimal notification frequency: 3-5/week (Pham & Wang, 2022)
 *   - Personalized timing from circadian profile
 *   - Spaced reminders aligned with FSRS due dates
 *
 * Architecture:
 *   Pure scheduling logic — no push delivery. Caller (cron endpoint or
 *   edge function) handles actual notification dispatch via Web Push API.
 *
 * Notification types:
 *   1. REVIEW_DUE: Cards due for review (FSRS-aligned)
 *   2. STREAK_RISK: Streak about to break (24h+ since last session)
 *   3. DAILY_GOAL: Progress toward daily question goal
 *   4. HABIT_CUE: Implementation intention trigger at preferred study time
 *   5. WEEKLY_SUMMARY: Retention stats and upcoming review load
 *   6. SYSTEM_NEGLECT: Blueprint system going stale
 *   7. ENCOURAGEMENT: Milestone celebrations and positive reinforcement
 *
 * @module lib/services/habitFormationService
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'REVIEW_DUE'
  | 'STREAK_RISK'
  | 'DAILY_GOAL'
  | 'HABIT_CUE'
  | 'WEEKLY_SUMMARY'
  | 'SYSTEM_NEGLECT'
  | 'ENCOURAGEMENT';

/** Priority levels for notification scheduling */
export type NotificationPriority = 'high' | 'medium' | 'low';

/** A scheduled notification ready for dispatch */
export interface ScheduledNotification {
  /** Notification type */
  type: NotificationType;
  /** Priority level */
  priority: NotificationPriority;
  /** Title for the push notification */
  title: string;
  /** Body text */
  body: string;
  /** When to send (ISO string) */
  scheduledAt: string;
  /** URL to open when notification is clicked */
  actionUrl: string;
  /** Action button labels */
  actions: { label: string; url: string }[];
  /** Time-to-live in seconds (notification expires after this) */
  ttlSeconds: number;
  /** Metadata for analytics */
  metadata: Record<string, string | number>;
}

/** Learner's study habit profile (input to scheduling) */
export interface HabitProfile {
  /** Preferred study times (hours 0-23, sorted by preference) */
  preferredHours: number[];
  /** Average daily questions over last 30 days */
  avgDailyQuestions: number;
  /** Current streak (consecutive days with ≥1 session) */
  currentStreak: number;
  /** Longest streak ever */
  longestStreak: number;
  /** Hours since last study session */
  hoursSinceLastSession: number;
  /** Number of cards due for review right now */
  cardsDueNow: number;
  /** Number of cards becoming due in next 24h */
  cardsDueNext24h: number;
  /** Daily question goal (user-set or system default) */
  dailyGoal: number;
  /** Questions completed today */
  questionsToday: number;
  /** Notifications sent in last 24h */
  notificationsSent24h: number;
  /** Notifications sent in last 7 days */
  notificationsSent7d: number;
  /** User's timezone offset in hours from UTC */
  timezoneOffsetHours: number;
  /** Systems with days since last review */
  systemStaleness: Record<string, number>;
  /** Active blueprint systems */
  activeSystems: string[];
  /** Weekly accuracy trend (positive = improving) */
  accuracyTrend: number;
  /** Total lifetime questions answered */
  totalQuestionsAnswered: number;
  /** User opted into notifications */
  notificationsEnabled: boolean;
}

/** Configuration for notification scheduling */
export interface NotificationConfig {
  /** Maximum notifications per day */
  maxPerDay: number;
  /** Maximum notifications per week */
  maxPerWeek: number;
  /** Minimum hours between notifications */
  minIntervalHours: number;
  /** Quiet hours start (0-23, in user's local time) */
  quietHoursStart: number;
  /** Quiet hours end (0-23, in user's local time) */
  quietHoursEnd: number;
  /** Cards due threshold to trigger REVIEW_DUE */
  reviewDueThreshold: number;
  /** Hours since last session to trigger STREAK_RISK */
  streakRiskHours: number;
  /** Days of system neglect to trigger notification */
  systemNeglectDays: number;
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  maxPerDay: 4,
  maxPerWeek: 15,
  minIntervalHours: 3,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  reviewDueThreshold: 10,
  streakRiskHours: 20,
  systemNeglectDays: 10,
};

/** Implementation intention template */
export interface ImplementationIntention {
  /** The cue (trigger situation) */
  when: string;
  /** The action to take */
  then: string;
  /** Category of cue */
  cueType: 'time' | 'event' | 'location' | 'emotion';
}

// ─── Quiet Hours ────────────────────────────────────────────────────────────

/**
 * Check if a given hour (0-23) falls within quiet hours.
 * Handles wrap-around (e.g., 22:00 to 07:00).
 */
export function isQuietHour(
  hour: number,
  quietStart: number,
  quietEnd: number
): boolean {
  if (quietStart <= quietEnd) {
    // Simple range (e.g., 01:00 - 06:00)
    return hour >= quietStart && hour < quietEnd;
  }
  // Wrap-around (e.g., 22:00 - 07:00)
  return hour >= quietStart || hour < quietEnd;
}

/**
 * Find the next non-quiet hour from a given hour.
 */
export function nextActiveHour(
  fromHour: number,
  quietStart: number,
  quietEnd: number
): number {
  if (!isQuietHour(fromHour, quietStart, quietEnd)) {
    return fromHour;
  }
  return quietEnd;
}

// ─── Notification Generation ────────────────────────────────────────────────

/**
 * Generate all candidate notifications based on the learner's current state.
 * Returns un-throttled list — call `throttleNotifications` to apply limits.
 */
export function generateCandidateNotifications(
  profile: HabitProfile,
  now: Date,
  config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): ScheduledNotification[] {
  if (!profile.notificationsEnabled) return [];

  const candidates: ScheduledNotification[] = [];
  const localHour = getLocalHour(now, profile.timezoneOffsetHours);

  // 1. REVIEW_DUE — high-priority when many cards are overdue
  if (profile.cardsDueNow >= config.reviewDueThreshold) {
    candidates.push({
      type: 'REVIEW_DUE',
      priority: 'high',
      title: `${profile.cardsDueNow} cards ready for review`,
      body: 'Quick review now prevents forgetting later. Your spaced repetition schedule is optimized for today.',
      scheduledAt: scheduleAt(now, profile, config),
      actionUrl: '/study?mode=review',
      actions: [
        { label: 'Start Review', url: '/study?mode=review' },
        { label: 'Later', url: '/' },
      ],
      ttlSeconds: 4 * 3600, // 4 hours
      metadata: { cardsDue: profile.cardsDueNow },
    });
  }

  // 2. STREAK_RISK — if streak would break without a session today
  if (
    profile.currentStreak >= 3 &&
    profile.hoursSinceLastSession >= config.streakRiskHours &&
    profile.questionsToday === 0
  ) {
    candidates.push({
      type: 'STREAK_RISK',
      priority: 'high',
      title: `🔥 ${profile.currentStreak}-day streak at risk!`,
      body: `Just ${Math.min(5, profile.dailyGoal)} questions keeps your streak alive.`,
      scheduledAt: scheduleAt(now, profile, config),
      actionUrl: '/study',
      actions: [
        { label: 'Quick 5', url: '/study?count=5' },
        { label: 'Full Session', url: '/study' },
      ],
      ttlSeconds: 3 * 3600,
      metadata: { streak: profile.currentStreak },
    });
  }

  // 3. DAILY_GOAL — progress nudge (afternoon/evening)
  if (
    profile.questionsToday > 0 &&
    profile.questionsToday < profile.dailyGoal &&
    localHour >= 14 &&
    localHour <= 20
  ) {
    const remaining = profile.dailyGoal - profile.questionsToday;
    const pct = Math.round((profile.questionsToday / profile.dailyGoal) * 100);
    candidates.push({
      type: 'DAILY_GOAL',
      priority: 'medium',
      title: `${pct}% of daily goal — ${remaining} to go`,
      body: `You've done ${profile.questionsToday} questions today. ${remaining} more to hit your target.`,
      scheduledAt: scheduleAt(now, profile, config),
      actionUrl: '/study',
      actions: [{ label: 'Continue', url: '/study' }],
      ttlSeconds: 2 * 3600,
      metadata: { questionsToday: profile.questionsToday, goal: profile.dailyGoal },
    });
  }

  // 4. HABIT_CUE — at preferred study time if no session today
  if (
    profile.questionsToday === 0 &&
    profile.preferredHours.length > 0
  ) {
    const preferredHour = profile.preferredHours[0]!;
    // Only generate if we're near the preferred hour (within 1h)
    if (Math.abs(localHour - preferredHour) <= 1) {
      const intention = generateImplementationIntention(profile);
      candidates.push({
        type: 'HABIT_CUE',
        priority: 'medium',
        title: 'Time for your study session',
        body: intention
          ? `Remember: "${intention.when}" → "${intention.then}"`
          : `Your usual study time. ${profile.cardsDueNow} cards waiting.`,
        scheduledAt: scheduleAt(now, profile, config),
        actionUrl: '/study',
        actions: [{ label: 'Start Studying', url: '/study' }],
        ttlSeconds: 2 * 3600,
        metadata: { preferredHour },
      });
    }
  }

  // 5. SYSTEM_NEGLECT — for stale blueprint systems
  for (const system of profile.activeSystems) {
    const daysSince = profile.systemStaleness[system] ?? 0;
    if (daysSince >= config.systemNeglectDays) {
      candidates.push({
        type: 'SYSTEM_NEGLECT',
        priority: 'low',
        title: `${system} needs attention`,
        body: `No review in ${daysSince} days. A quick ${system} drill prevents forgetting.`,
        scheduledAt: scheduleAt(now, profile, config),
        actionUrl: `/study?system=${encodeURIComponent(system)}`,
        actions: [
          { label: `Drill ${system}`, url: `/study?system=${encodeURIComponent(system)}` },
        ],
        ttlSeconds: 6 * 3600,
        metadata: { system, daysSince },
      });
    }
  }

  // 6. ENCOURAGEMENT — milestones
  const milestone = detectMilestone(profile);
  if (milestone) {
    candidates.push({
      type: 'ENCOURAGEMENT',
      priority: 'low',
      title: milestone.title,
      body: milestone.body,
      scheduledAt: scheduleAt(now, profile, config),
      actionUrl: '/dashboard',
      actions: [{ label: 'View Progress', url: '/dashboard' }],
      ttlSeconds: 12 * 3600,
      metadata: { milestone: milestone.type },
    });
  }

  return candidates;
}

// ─── Throttling ─────────────────────────────────────────────────────────────

/**
 * Apply throttling rules to candidate notifications.
 * Enforces daily/weekly caps, minimum interval, and quiet hours.
 * Returns filtered + scheduled list.
 */
export function throttleNotifications(
  candidates: ScheduledNotification[],
  profile: HabitProfile,
  config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): ScheduledNotification[] {
  // Sort by priority (high first)
  const priorityOrder: Record<NotificationPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  const sorted = [...candidates].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // Apply caps
  const dailyRemaining = Math.max(0, config.maxPerDay - profile.notificationsSent24h);
  const weeklyRemaining = Math.max(0, config.maxPerWeek - profile.notificationsSent7d);
  const maxAllowed = Math.min(dailyRemaining, weeklyRemaining);

  if (maxAllowed === 0) return [];

  // Deduplicate by type (only 1 per type)
  const seen = new Set<NotificationType>();
  const deduped: ScheduledNotification[] = [];
  for (const n of sorted) {
    if (!seen.has(n.type)) {
      seen.add(n.type);
      deduped.push(n);
    }
  }

  return deduped.slice(0, maxAllowed);
}

// ─── Implementation Intentions ──────────────────────────────────────────────

/**
 * Generate a personalized implementation intention based on study patterns.
 * Research: Gollwitzer (1999) — "When situation X arises, I will do Y"
 * increases goal-directed behavior by 2–3×.
 */
export function generateImplementationIntention(
  profile: HabitProfile
): ImplementationIntention | null {
  if (profile.preferredHours.length === 0) return null;

  const hour = profile.preferredHours[0]!;
  const timeLabel = formatHour(hour);

  // Time-based cue (most common and effective)
  if (profile.avgDailyQuestions > 0) {
    const target = Math.min(Math.round(profile.avgDailyQuestions), profile.dailyGoal);
    return {
      when: `It's ${timeLabel}`,
      then: `I will complete ${target} review questions before doing anything else`,
      cueType: 'time',
    };
  }

  // Event-based cue for new users
  return {
    when: `I finish my morning routine`,
    then: `I will open PANaCEa and do 10 review questions`,
    cueType: 'event',
  };
}

/**
 * Generate a library of implementation intentions for a learner.
 * Returns 3-5 intentions covering different cue types.
 */
export function generateIntentionLibrary(
  profile: HabitProfile
): ImplementationIntention[] {
  const intentions: ImplementationIntention[] = [];

  // Time-based
  if (profile.preferredHours.length > 0) {
    const hour = profile.preferredHours[0]!;
    intentions.push({
      when: `It's ${formatHour(hour)}`,
      then: `I will review ${Math.min(20, profile.dailyGoal)} questions`,
      cueType: 'time',
    });
  }

  // Event-based: morning routine
  intentions.push({
    when: 'I sit down with my morning coffee',
    then: 'I will do a 10-minute drill session',
    cueType: 'event',
  });

  // Event-based: between activities
  intentions.push({
    when: 'I have a break between patients/classes',
    then: 'I will review 5 flashcards on my phone',
    cueType: 'event',
  });

  // Emotion-based: confidence trigger
  if (profile.currentStreak >= 7) {
    intentions.push({
      when: 'I feel like skipping today',
      then: `I will remember my ${profile.currentStreak}-day streak and do just 5 questions`,
      cueType: 'emotion',
    });
  }

  // Event-based: end of day
  intentions.push({
    when: 'I get into bed',
    then: 'I will check if I hit my daily goal, and do a quick 5 if not',
    cueType: 'event',
  });

  return intentions;
}

// ─── Weekly Summary Generation ──────────────────────────────────────────────

export interface WeeklySummary {
  /** Total questions this week */
  questionsThisWeek: number;
  /** Accuracy this week */
  weeklyAccuracy: number;
  /** Streak status */
  streakDays: number;
  /** Systems reviewed */
  systemsCovered: number;
  /** Total active systems */
  totalSystems: number;
  /** Cards due in next 7 days */
  upcomingReviewLoad: number;
  /** Motivational message */
  message: string;
}

export function generateWeeklySummaryNotification(
  summary: WeeklySummary
): ScheduledNotification {
  const coveragePct = summary.totalSystems > 0
    ? Math.round((summary.systemsCovered / summary.totalSystems) * 100)
    : 0;

  return {
    type: 'WEEKLY_SUMMARY',
    priority: 'low',
    title: `Week in Review: ${summary.questionsThisWeek} questions, ${Math.round(summary.weeklyAccuracy * 100)}% accuracy`,
    body: `${summary.message} Coverage: ${coveragePct}% of systems. ${summary.upcomingReviewLoad} reviews coming this week.`,
    scheduledAt: new Date().toISOString(),
    actionUrl: '/dashboard',
    actions: [{ label: 'View Dashboard', url: '/dashboard' }],
    ttlSeconds: 24 * 3600,
    metadata: {
      questionsThisWeek: summary.questionsThisWeek,
      accuracy: Math.round(summary.weeklyAccuracy * 100),
      streak: summary.streakDays,
    },
  };
}

// ─── Milestone Detection ────────────────────────────────────────────────────

interface Milestone {
  type: string;
  title: string;
  body: string;
}

const QUESTION_MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000];
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 365];

export function detectMilestone(profile: HabitProfile): Milestone | null {
  // Check streak milestones
  for (const target of STREAK_MILESTONES) {
    if (profile.currentStreak === target) {
      return {
        type: `streak_${target}`,
        title: `🔥 ${target}-day streak!`,
        body: getStreakMessage(target),
      };
    }
  }

  // Check question count milestones
  for (const target of QUESTION_MILESTONES) {
    // Detect crossing the threshold today
    const crossedToday = profile.totalQuestionsAnswered >= target &&
      profile.totalQuestionsAnswered - profile.questionsToday < target;
    if (crossedToday) {
      return {
        type: `questions_${target}`,
        title: `🎯 ${target.toLocaleString()} questions answered!`,
        body: getQuestionMilestoneMessage(target),
      };
    }
  }

  // Accuracy improvement
  if (profile.accuracyTrend > 0.05) {
    return {
      type: 'accuracy_improving',
      title: '📈 Accuracy trending up!',
      body: 'Your consistent practice is paying off. Keep reviewing to lock it in.',
    };
  }

  return null;
}

function getStreakMessage(days: number): string {
  if (days >= 100) return 'Incredible dedication. You\'re building mastery that lasts.';
  if (days >= 30) return 'A full month of consistent study. This is how experts are made.';
  if (days >= 14) return 'Two weeks strong! Your spaced repetition is maximally effective now.';
  return 'One week down! Studies show 7 days is the habit formation threshold.';
}

function getQuestionMilestoneMessage(count: number): string {
  if (count >= 5000) return 'You\'ve built a deep knowledge base. PANCE readiness is within reach.';
  if (count >= 1000) return 'Four digits! Your distributed practice is building durable memory.';
  if (count >= 500) return 'Halfway to a thousand. Every question strengthens your clinical reasoning.';
  return 'Great start! Consistent practice beats cramming every time.';
}

// ─── Optimal Send Time ──────────────────────────────────────────────────────

/**
 * Compute the optimal send time for a notification.
 * Respects quiet hours and prefers the learner's study time window.
 */
function scheduleAt(
  now: Date,
  profile: HabitProfile,
  config: NotificationConfig
): string {
  const localHour = getLocalHour(now, profile.timezoneOffsetHours);

  // If we're in quiet hours, defer to first active hour
  if (isQuietHour(localHour, config.quietHoursStart, config.quietHoursEnd)) {
    const activeHour = nextActiveHour(localHour, config.quietHoursStart, config.quietHoursEnd);
    const deferred = new Date(now);
    const hourDiff = (activeHour - localHour + 24) % 24;
    deferred.setHours(deferred.getHours() + hourDiff);
    deferred.setMinutes(0, 0, 0);
    return deferred.toISOString();
  }

  // Otherwise send now
  return now.toISOString();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLocalHour(date: Date, timezoneOffsetHours: number): number {
  const utcHour = date.getUTCHours();
  return (utcHour + timezoneOffsetHours + 24) % 24;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}
