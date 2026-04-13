/**
 * Tests for Habit Formation & Notification Scheduling Service
 *
 * Validates quiet hours, notification generation, throttling,
 * implementation intentions, milestones, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import {
  isQuietHour,
  nextActiveHour,
  generateCandidateNotifications,
  throttleNotifications,
  generateImplementationIntention,
  generateIntentionLibrary,
  generateWeeklySummaryNotification,
  detectMilestone,
  DEFAULT_NOTIFICATION_CONFIG,
  type HabitProfile,
  type NotificationConfig,
  type ScheduledNotification,
  type WeeklySummary,
} from '@/lib/services/habitFormationService';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeProfile(overrides?: Partial<HabitProfile>): HabitProfile {
  return {
    preferredHours: [8, 18],
    avgDailyQuestions: 25,
    currentStreak: 12,
    longestStreak: 30,
    hoursSinceLastSession: 14,
    cardsDueNow: 15,
    cardsDueNext24h: 30,
    dailyGoal: 30,
    questionsToday: 10,
    notificationsSent24h: 1,
    notificationsSent7d: 5,
    timezoneOffsetHours: -5, // EST
    systemStaleness: {
      Cardiovascular: 3,
      Pulmonary: 5,
      Renal: 12,
      Neurology: 2,
    },
    activeSystems: ['Cardiovascular', 'Pulmonary', 'Renal', 'Neurology'],
    accuracyTrend: 0.02,
    totalQuestionsAnswered: 1500,
    notificationsEnabled: true,
    ...overrides,
  };
}

/** Create a Date at a specific UTC hour */
function dateAtHour(utcHour: number): Date {
  const d = new Date('2026-04-12T00:00:00Z');
  d.setUTCHours(utcHour);
  return d;
}

// ─── Quiet Hours ────────────────────────────────────────────────────────────

describe('isQuietHour', () => {
  it('detects quiet hour in wrap-around range (22-7)', () => {
    expect(isQuietHour(23, 22, 7)).toBe(true);
    expect(isQuietHour(0, 22, 7)).toBe(true);
    expect(isQuietHour(6, 22, 7)).toBe(true);
  });

  it('detects active hour outside wrap-around range', () => {
    expect(isQuietHour(8, 22, 7)).toBe(false);
    expect(isQuietHour(12, 22, 7)).toBe(false);
    expect(isQuietHour(21, 22, 7)).toBe(false);
  });

  it('handles simple range (1-6)', () => {
    expect(isQuietHour(3, 1, 6)).toBe(true);
    expect(isQuietHour(0, 1, 6)).toBe(false);
    expect(isQuietHour(6, 1, 6)).toBe(false);
    expect(isQuietHour(12, 1, 6)).toBe(false);
  });

  it('handles boundary values', () => {
    expect(isQuietHour(22, 22, 7)).toBe(true); // Start is inclusive
    expect(isQuietHour(7, 22, 7)).toBe(false); // End is exclusive
  });
});

describe('nextActiveHour', () => {
  it('returns same hour if not in quiet period', () => {
    expect(nextActiveHour(12, 22, 7)).toBe(12);
  });

  it('returns quiet end for hours within quiet period', () => {
    expect(nextActiveHour(23, 22, 7)).toBe(7);
    expect(nextActiveHour(3, 22, 7)).toBe(7);
  });
});

// ─── Notification Generation ────────────────────────────────────────────────

describe('generateCandidateNotifications', () => {
  it('returns empty if notifications disabled', () => {
    const profile = makeProfile({ notificationsEnabled: false });
    const candidates = generateCandidateNotifications(profile, dateAtHour(12));
    expect(candidates).toHaveLength(0);
  });

  it('generates REVIEW_DUE when cards are due', () => {
    const profile = makeProfile({ cardsDueNow: 20 });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13)); // 8 AM EST
    const reviewDue = candidates.find((c) => c.type === 'REVIEW_DUE');
    expect(reviewDue).toBeDefined();
    expect(reviewDue!.priority).toBe('high');
  });

  it('skips REVIEW_DUE when below threshold', () => {
    const profile = makeProfile({ cardsDueNow: 5 });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13));
    expect(candidates.find((c) => c.type === 'REVIEW_DUE')).toBeUndefined();
  });

  it('generates STREAK_RISK when streak at risk', () => {
    const profile = makeProfile({
      currentStreak: 10,
      hoursSinceLastSession: 22,
      questionsToday: 0,
    });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13));
    const streakRisk = candidates.find((c) => c.type === 'STREAK_RISK');
    expect(streakRisk).toBeDefined();
    expect(streakRisk!.title).toContain('10-day streak');
  });

  it('skips STREAK_RISK for short streaks', () => {
    const profile = makeProfile({
      currentStreak: 1,
      hoursSinceLastSession: 22,
      questionsToday: 0,
    });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13));
    expect(candidates.find((c) => c.type === 'STREAK_RISK')).toBeUndefined();
  });

  it('generates DAILY_GOAL in afternoon', () => {
    // 19 UTC - 5 = 14 local (2 PM) — afternoon window
    const profile = makeProfile({
      questionsToday: 15,
      dailyGoal: 30,
    });
    const candidates = generateCandidateNotifications(profile, dateAtHour(19));
    const goalNotif = candidates.find((c) => c.type === 'DAILY_GOAL');
    expect(goalNotif).toBeDefined();
    expect(goalNotif!.title).toContain('50%');
  });

  it('skips DAILY_GOAL in morning', () => {
    // 13 UTC - 5 = 8 local (8 AM) — before afternoon window
    const profile = makeProfile({
      questionsToday: 15,
      dailyGoal: 30,
    });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13));
    expect(candidates.find((c) => c.type === 'DAILY_GOAL')).toBeUndefined();
  });

  it('generates SYSTEM_NEGLECT for stale systems', () => {
    const profile = makeProfile({
      systemStaleness: {
        Cardiovascular: 3,
        Pulmonary: 15, // over threshold
      },
    });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13));
    const neglect = candidates.find(
      (c) => c.type === 'SYSTEM_NEGLECT' && c.title.includes('Pulmonary')
    );
    expect(neglect).toBeDefined();
  });

  it('generates HABIT_CUE at preferred study time', () => {
    // preferred hour 8, local hour = 13 UTC - 5 = 8
    const profile = makeProfile({
      preferredHours: [8],
      questionsToday: 0,
    });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13));
    const cue = candidates.find((c) => c.type === 'HABIT_CUE');
    expect(cue).toBeDefined();
    expect(cue!.body).toContain('8:00 AM');
  });

  it('includes action URLs on all notifications', () => {
    const profile = makeProfile({ cardsDueNow: 20 });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13));
    for (const c of candidates) {
      expect(c.actionUrl).toBeTruthy();
      expect(c.actions.length).toBeGreaterThan(0);
    }
  });
});

// ─── Throttling ─────────────────────────────────────────────────────────────

describe('throttleNotifications', () => {
  it('respects daily cap', () => {
    const profile = makeProfile({ notificationsSent24h: 3 }); // 1 remaining of 4 max
    const candidates: ScheduledNotification[] = [
      makeMockNotification('REVIEW_DUE', 'high'),
      makeMockNotification('STREAK_RISK', 'high'),
      makeMockNotification('DAILY_GOAL', 'medium'),
    ];
    const result = throttleNotifications(candidates, profile);
    expect(result).toHaveLength(1);
  });

  it('respects weekly cap', () => {
    const profile = makeProfile({
      notificationsSent24h: 0,
      notificationsSent7d: 14,
    }); // 1 remaining of 15 max
    const candidates = [
      makeMockNotification('REVIEW_DUE', 'high'),
      makeMockNotification('STREAK_RISK', 'high'),
    ];
    const result = throttleNotifications(candidates, profile);
    expect(result).toHaveLength(1);
  });

  it('prioritizes high priority notifications', () => {
    const profile = makeProfile({ notificationsSent24h: 2 }); // 2 remaining
    const candidates = [
      makeMockNotification('DAILY_GOAL', 'medium'),
      makeMockNotification('REVIEW_DUE', 'high'),
      makeMockNotification('SYSTEM_NEGLECT', 'low'),
    ];
    const result = throttleNotifications(candidates, profile);
    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe('REVIEW_DUE'); // high first
    expect(result[1]!.type).toBe('DAILY_GOAL'); // medium second
  });

  it('deduplicates by type', () => {
    const profile = makeProfile();
    const candidates = [
      makeMockNotification('SYSTEM_NEGLECT', 'low'),
      makeMockNotification('SYSTEM_NEGLECT', 'low'),
      makeMockNotification('SYSTEM_NEGLECT', 'low'),
    ];
    const result = throttleNotifications(candidates, profile);
    expect(result).toHaveLength(1);
  });

  it('returns empty when all caps exhausted', () => {
    const profile = makeProfile({
      notificationsSent24h: 4,
      notificationsSent7d: 15,
    });
    const candidates = [makeMockNotification('REVIEW_DUE', 'high')];
    const result = throttleNotifications(candidates, profile);
    expect(result).toHaveLength(0);
  });
});

// ─── Implementation Intentions ──────────────────────────────────────────────

describe('generateImplementationIntention', () => {
  it('generates time-based intention for active learner', () => {
    const profile = makeProfile({ preferredHours: [8], avgDailyQuestions: 20 });
    const intention = generateImplementationIntention(profile);
    expect(intention).not.toBeNull();
    expect(intention!.cueType).toBe('time');
    expect(intention!.when).toContain('8:00 AM');
    expect(intention!.then).toContain('20');
  });

  it('generates event-based intention for new user', () => {
    const profile = makeProfile({ preferredHours: [8], avgDailyQuestions: 0 });
    const intention = generateImplementationIntention(profile);
    expect(intention).not.toBeNull();
    expect(intention!.cueType).toBe('event');
  });

  it('returns null when no preferred hours', () => {
    const profile = makeProfile({ preferredHours: [] });
    expect(generateImplementationIntention(profile)).toBeNull();
  });
});

describe('generateIntentionLibrary', () => {
  it('generates multiple intentions', () => {
    const profile = makeProfile();
    const library = generateIntentionLibrary(profile);
    expect(library.length).toBeGreaterThanOrEqual(3);
  });

  it('includes emotion-based intention for long streaks', () => {
    const profile = makeProfile({ currentStreak: 14 });
    const library = generateIntentionLibrary(profile);
    const emotion = library.find((i) => i.cueType === 'emotion');
    expect(emotion).toBeDefined();
    expect(emotion!.when).toContain('skipping');
  });

  it('skips emotion intention for short streaks', () => {
    const profile = makeProfile({ currentStreak: 3 });
    const library = generateIntentionLibrary(profile);
    const emotion = library.find((i) => i.cueType === 'emotion');
    expect(emotion).toBeUndefined();
  });
});

// ─── Weekly Summary ─────────────────────────────────────────────────────────

describe('generateWeeklySummaryNotification', () => {
  it('generates valid notification', () => {
    const summary: WeeklySummary = {
      questionsThisWeek: 150,
      weeklyAccuracy: 0.78,
      streakDays: 7,
      systemsCovered: 8,
      totalSystems: 12,
      upcomingReviewLoad: 200,
      message: 'Great week! Your accuracy is improving.',
    };
    const notif = generateWeeklySummaryNotification(summary);
    expect(notif.type).toBe('WEEKLY_SUMMARY');
    expect(notif.title).toContain('150');
    expect(notif.title).toContain('78%');
    expect(notif.body).toContain('67%'); // 8/12 = 67%
    expect(notif.body).toContain('200 reviews');
  });

  it('handles zero systems gracefully', () => {
    const summary: WeeklySummary = {
      questionsThisWeek: 0,
      weeklyAccuracy: 0,
      streakDays: 0,
      systemsCovered: 0,
      totalSystems: 0,
      upcomingReviewLoad: 0,
      message: 'Let\'s get started!',
    };
    const notif = generateWeeklySummaryNotification(summary);
    expect(notif.body).toContain('0%');
  });
});

// ─── Milestone Detection ────────────────────────────────────────────────────

describe('detectMilestone', () => {
  it('detects streak milestones', () => {
    const profile = makeProfile({ currentStreak: 7 });
    const milestone = detectMilestone(profile);
    expect(milestone).not.toBeNull();
    expect(milestone!.type).toBe('streak_7');
  });

  it('detects question count milestones', () => {
    const profile = makeProfile({
      totalQuestionsAnswered: 1005,
      questionsToday: 10,
    });
    // 1005 >= 1000 AND 1005 - 10 = 995 < 1000 → crossed today
    const milestone = detectMilestone(profile);
    expect(milestone).not.toBeNull();
    expect(milestone!.type).toBe('questions_1000');
  });

  it('detects accuracy improvement', () => {
    const profile = makeProfile({
      currentStreak: 5, // not a streak milestone
      accuracyTrend: 0.08,
      totalQuestionsAnswered: 500,
      questionsToday: 0, // no question milestone crossing
    });
    const milestone = detectMilestone(profile);
    expect(milestone).not.toBeNull();
    expect(milestone!.type).toBe('accuracy_improving');
  });

  it('returns null for non-milestone state', () => {
    const profile = makeProfile({
      currentStreak: 5,
      totalQuestionsAnswered: 1500,
      questionsToday: 10,
      accuracyTrend: 0.01,
    });
    const milestone = detectMilestone(profile);
    expect(milestone).toBeNull();
  });

  it('prioritizes streak over question milestones', () => {
    const profile = makeProfile({
      currentStreak: 30,
      totalQuestionsAnswered: 1005,
      questionsToday: 10,
    });
    const milestone = detectMilestone(profile);
    expect(milestone!.type).toBe('streak_30');
  });
});

// ─── Config Defaults ────────────────────────────────────────────────────────

describe('DEFAULT_NOTIFICATION_CONFIG', () => {
  it('has sensible frequency limits', () => {
    expect(DEFAULT_NOTIFICATION_CONFIG.maxPerDay).toBeLessThanOrEqual(5);
    expect(DEFAULT_NOTIFICATION_CONFIG.maxPerWeek).toBeLessThanOrEqual(20);
  });

  it('has reasonable quiet hours', () => {
    expect(DEFAULT_NOTIFICATION_CONFIG.quietHoursStart).toBeGreaterThanOrEqual(20);
    expect(DEFAULT_NOTIFICATION_CONFIG.quietHoursEnd).toBeLessThanOrEqual(9);
  });

  it('has minimum interval between notifications', () => {
    expect(DEFAULT_NOTIFICATION_CONFIG.minIntervalHours).toBeGreaterThanOrEqual(1);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('handles zero preferred hours', () => {
    const profile = makeProfile({ preferredHours: [] });
    const candidates = generateCandidateNotifications(profile, dateAtHour(12));
    expect(candidates.find((c) => c.type === 'HABIT_CUE')).toBeUndefined();
  });

  it('handles negative timezone offset', () => {
    const profile = makeProfile({ timezoneOffsetHours: -12 });
    const candidates = generateCandidateNotifications(profile, dateAtHour(20));
    // Should not crash, local hour = 8 AM
    expect(candidates).toBeDefined();
  });

  it('handles positive timezone offset', () => {
    const profile = makeProfile({ timezoneOffsetHours: 9 });
    const candidates = generateCandidateNotifications(profile, dateAtHour(5));
    // local hour = 14 (2 PM)
    expect(candidates).toBeDefined();
  });

  it('handles empty active systems', () => {
    const profile = makeProfile({ activeSystems: [] });
    const candidates = generateCandidateNotifications(profile, dateAtHour(12));
    expect(candidates.filter((c) => c.type === 'SYSTEM_NEGLECT')).toHaveLength(0);
  });

  it('all notifications have valid TTL', () => {
    const profile = makeProfile({ cardsDueNow: 20 });
    const candidates = generateCandidateNotifications(profile, dateAtHour(13));
    for (const c of candidates) {
      expect(c.ttlSeconds).toBeGreaterThan(0);
    }
  });

  it('does not mutate the input Date object during quiet-hour deferral', () => {
    // Set up: 3 AM UTC, EST offset = local 22:00 (quiet hours)
    const now = dateAtHour(3);
    const originalTime = now.getTime();
    const profile = makeProfile({
      timezoneOffsetHours: -5,
      cardsDueNow: 20,
    });
    generateCandidateNotifications(profile, now);
    expect(now.getTime()).toBe(originalTime);
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMockNotification(
  type: ScheduledNotification['type'],
  priority: ScheduledNotification['priority']
): ScheduledNotification {
  return {
    type,
    priority,
    title: `Test ${type}`,
    body: 'Test body',
    scheduledAt: new Date().toISOString(),
    actionUrl: '/test',
    actions: [{ label: 'Test', url: '/test' }],
    ttlSeconds: 3600,
    metadata: {},
  };
}
