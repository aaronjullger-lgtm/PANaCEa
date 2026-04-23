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
} from './habitFormationService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<HabitProfile> = {}): HabitProfile {
  return {
    preferredHours: [8],
    avgDailyQuestions: 20,
    currentStreak: 5,
    longestStreak: 10,
    hoursSinceLastSession: 2,
    cardsDueNow: 5,
    cardsDueNext24h: 10,
    dailyGoal: 30,
    questionsToday: 15,
    notificationsSent24h: 0,
    notificationsSent7d: 0,
    timezoneOffsetHours: 0,
    systemStaleness: {},
    activeSystems: [],
    accuracyTrend: 0,
    totalQuestionsAnswered: 200,
    notificationsEnabled: true,
    ...overrides,
  };
}

function makeCandidate(type = 'REVIEW_DUE', priority: 'high' | 'medium' | 'low' = 'high'): ScheduledNotification {
  return {
    type: type as any,
    priority,
    title: 'Test',
    body: 'Test body',
    scheduledAt: new Date().toISOString(),
    actionUrl: '/study',
    actions: [],
    ttlSeconds: 3600,
    metadata: {},
  };
}

// ─── isQuietHour ──────────────────────────────────────────────────────────────

describe('isQuietHour', () => {
  it('returns true when hour is within simple quiet range (no wrap)', () => {
    // quiet 01:00 - 06:00
    expect(isQuietHour(3, 1, 6)).toBe(true);
    expect(isQuietHour(1, 1, 6)).toBe(true);
  });

  it('returns false when hour is outside simple quiet range', () => {
    expect(isQuietHour(0, 1, 6)).toBe(false);
    expect(isQuietHour(6, 1, 6)).toBe(false); // exclusive end
    expect(isQuietHour(12, 1, 6)).toBe(false);
  });

  it('returns true for wrap-around quiet hours (overnight)', () => {
    // quiet 22:00 - 07:00
    expect(isQuietHour(22, 22, 7)).toBe(true);
    expect(isQuietHour(23, 22, 7)).toBe(true);
    expect(isQuietHour(0, 22, 7)).toBe(true);
    expect(isQuietHour(6, 22, 7)).toBe(true);
  });

  it('returns false outside wrap-around quiet hours', () => {
    // quiet 22:00 - 07:00
    expect(isQuietHour(7, 22, 7)).toBe(false);
    expect(isQuietHour(12, 22, 7)).toBe(false);
    expect(isQuietHour(21, 22, 7)).toBe(false);
  });

  it('default config quiet hours 22-7 work correctly', () => {
    const { quietHoursStart: qs, quietHoursEnd: qe } = DEFAULT_NOTIFICATION_CONFIG;
    expect(isQuietHour(23, qs, qe)).toBe(true);
    expect(isQuietHour(8, qs, qe)).toBe(false);
  });
});

// ─── nextActiveHour ───────────────────────────────────────────────────────────

describe('nextActiveHour', () => {
  it('returns same hour if not in quiet hours', () => {
    expect(nextActiveHour(10, 22, 7)).toBe(10);
  });

  it('returns quietEnd when in quiet hours', () => {
    // quiet 22-07; from hour 23 → next active = 7
    expect(nextActiveHour(23, 22, 7)).toBe(7);
    expect(nextActiveHour(0, 22, 7)).toBe(7);
  });

  it('returns quietEnd for simple (non-wrap) quiet range', () => {
    // quiet 2-5; from hour 3 → next active = 5
    expect(nextActiveHour(3, 2, 5)).toBe(5);
  });

  it('returns current hour if exactly at quietEnd', () => {
    // hour 7 is NOT quiet (exclusive end) → returns 7
    expect(nextActiveHour(7, 22, 7)).toBe(7);
  });
});

// ─── generateCandidateNotifications ──────────────────────────────────────────

describe('generateCandidateNotifications', () => {
  const now = new Date('2026-04-01T15:00:00.000Z'); // 15:00 UTC

  it('returns empty array when notifications disabled', () => {
    const profile = makeProfile({ notificationsEnabled: false });
    expect(generateCandidateNotifications(profile, now)).toHaveLength(0);
  });

  it('generates REVIEW_DUE when cardsDueNow >= threshold', () => {
    const profile = makeProfile({ cardsDueNow: 15 }); // default threshold = 10
    const candidates = generateCandidateNotifications(profile, now);
    const types = candidates.map((c) => c.type);
    expect(types).toContain('REVIEW_DUE');
  });

  it('does NOT generate REVIEW_DUE when cardsDueNow < threshold', () => {
    const profile = makeProfile({ cardsDueNow: 5 });
    const candidates = generateCandidateNotifications(profile, now);
    const types = candidates.map((c) => c.type);
    expect(types).not.toContain('REVIEW_DUE');
  });

  it('generates STREAK_RISK when streak ≥ 3, hoursSinceLastSession >= threshold, questionsToday = 0', () => {
    const profile = makeProfile({
      currentStreak: 5,
      hoursSinceLastSession: 22, // > streakRiskHours (20)
      questionsToday: 0,
    });
    const candidates = generateCandidateNotifications(profile, now);
    expect(candidates.map((c) => c.type)).toContain('STREAK_RISK');
  });

  it('does NOT generate STREAK_RISK when streak < 3', () => {
    const profile = makeProfile({
      currentStreak: 2,
      hoursSinceLastSession: 22,
      questionsToday: 0,
    });
    const candidates = generateCandidateNotifications(profile, now);
    expect(candidates.map((c) => c.type)).not.toContain('STREAK_RISK');
  });

  it('does NOT generate STREAK_RISK when questionsToday > 0', () => {
    const profile = makeProfile({
      currentStreak: 5,
      hoursSinceLastSession: 22,
      questionsToday: 1,
    });
    const candidates = generateCandidateNotifications(profile, now);
    expect(candidates.map((c) => c.type)).not.toContain('STREAK_RISK');
  });

  it('generates DAILY_GOAL in afternoon when partially complete', () => {
    // 15:00 UTC → 15 local (timezone 0) → falls within 14-20
    const profile = makeProfile({ questionsToday: 10, dailyGoal: 30 });
    const candidates = generateCandidateNotifications(profile, now);
    expect(candidates.map((c) => c.type)).toContain('DAILY_GOAL');
  });

  it('does NOT generate DAILY_GOAL when goal already met', () => {
    const profile = makeProfile({ questionsToday: 30, dailyGoal: 30 });
    const candidates = generateCandidateNotifications(profile, now);
    expect(candidates.map((c) => c.type)).not.toContain('DAILY_GOAL');
  });

  it('generates SYSTEM_NEGLECT for stale systems', () => {
    const profile = makeProfile({
      activeSystems: ['Cardiovascular'],
      systemStaleness: { Cardiovascular: 12 }, // > systemNeglectDays (10)
    });
    const candidates = generateCandidateNotifications(profile, now);
    expect(candidates.map((c) => c.type)).toContain('SYSTEM_NEGLECT');
  });

  it('generates ENCOURAGEMENT when milestone detected', () => {
    const profile = makeProfile({ currentStreak: 7 }); // streak milestone
    const candidates = generateCandidateNotifications(profile, now);
    expect(candidates.map((c) => c.type)).toContain('ENCOURAGEMENT');
  });

  it('all candidates have required fields', () => {
    const profile = makeProfile({ cardsDueNow: 15 });
    const candidates = generateCandidateNotifications(profile, now);
    for (const c of candidates) {
      expect(c.type).toBeTruthy();
      expect(c.priority).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.body).toBeTruthy();
      expect(c.scheduledAt).toBeTruthy();
      expect(c.ttlSeconds).toBeGreaterThan(0);
    }
  });
});

// ─── throttleNotifications ────────────────────────────────────────────────────

describe('throttleNotifications', () => {
  it('returns empty array when daily cap is exhausted', () => {
    const profile = makeProfile({ notificationsSent24h: 4 }); // maxPerDay = 4
    const candidates = [makeCandidate('REVIEW_DUE', 'high')];
    expect(throttleNotifications(candidates, profile)).toHaveLength(0);
  });

  it('returns empty array when weekly cap is exhausted', () => {
    const profile = makeProfile({ notificationsSent7d: 15 }); // maxPerWeek = 15
    const candidates = [makeCandidate('REVIEW_DUE', 'high')];
    expect(throttleNotifications(candidates, profile)).toHaveLength(0);
  });

  it('deduplicates by notification type', () => {
    const profile = makeProfile();
    const candidates = [
      makeCandidate('REVIEW_DUE', 'high'),
      makeCandidate('REVIEW_DUE', 'medium'), // duplicate type
      makeCandidate('STREAK_RISK', 'high'),
    ];
    const result = throttleNotifications(candidates, profile);
    const types = result.map((n) => n.type);
    const uniqueTypes = new Set(types);
    expect(types.length).toBe(uniqueTypes.size); // no duplicate types
  });

  it('returns high priority before low priority', () => {
    const profile = makeProfile();
    const candidates = [
      makeCandidate('DAILY_GOAL', 'low'),
      makeCandidate('REVIEW_DUE', 'high'),
    ];
    const result = throttleNotifications(candidates, profile);
    expect(result[0]!.priority).toBe('high');
  });

  it('caps to maxPerDay - notificationsSent24h', () => {
    const profile = makeProfile({ notificationsSent24h: 2 }); // 4-2=2 remaining
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate(`type_${i}` as any, 'medium')
    );
    const result = throttleNotifications(candidates, profile);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('passes through all candidates when no limits hit', () => {
    const profile = makeProfile();
    const candidates = [
      makeCandidate('REVIEW_DUE', 'high'),
      makeCandidate('STREAK_RISK', 'high'),
    ];
    const result = throttleNotifications(candidates, profile);
    expect(result).toHaveLength(2);
  });
});

// ─── generateImplementationIntention ─────────────────────────────────────────

describe('generateImplementationIntention', () => {
  it('returns null when no preferred hours', () => {
    const profile = makeProfile({ preferredHours: [] });
    expect(generateImplementationIntention(profile)).toBeNull();
  });

  it('returns time-based intention when avgDailyQuestions > 0', () => {
    const profile = makeProfile({ preferredHours: [8], avgDailyQuestions: 20 });
    const intention = generateImplementationIntention(profile);
    expect(intention).not.toBeNull();
    expect(intention!.cueType).toBe('time');
    expect(intention!.when).toContain('8:00 AM');
  });

  it('returns event-based intention for new users (no avg questions)', () => {
    const profile = makeProfile({ preferredHours: [8], avgDailyQuestions: 0 });
    const intention = generateImplementationIntention(profile);
    expect(intention).not.toBeNull();
    expect(intention!.cueType).toBe('event');
  });

  it('intention then phrase mentions question count', () => {
    const profile = makeProfile({ preferredHours: [14], avgDailyQuestions: 25, dailyGoal: 30 });
    const intention = generateImplementationIntention(profile);
    expect(intention!.then).toMatch(/\d+.*question/i);
  });
});

// ─── generateIntentionLibrary ────────────────────────────────────────────────

describe('generateIntentionLibrary', () => {
  it('returns an array of intentions', () => {
    const profile = makeProfile({ preferredHours: [8] });
    const library = generateIntentionLibrary(profile);
    expect(Array.isArray(library)).toBe(true);
    expect(library.length).toBeGreaterThan(0);
  });

  it('each intention has when, then, and cueType', () => {
    const profile = makeProfile({ preferredHours: [8] });
    const library = generateIntentionLibrary(profile);
    for (const i of library) {
      expect(i.when).toBeTruthy();
      expect(i.then).toBeTruthy();
      expect(['time', 'event', 'emotion', 'location']).toContain(i.cueType);
    }
  });

  it('includes streak emotion cue when streak >= 7', () => {
    const profile = makeProfile({ preferredHours: [8], currentStreak: 7 });
    const library = generateIntentionLibrary(profile);
    const hasEmotion = library.some((i) => i.cueType === 'emotion');
    expect(hasEmotion).toBe(true);
  });

  it('does NOT include emotion cue when streak < 7', () => {
    const profile = makeProfile({ preferredHours: [8], currentStreak: 3 });
    const library = generateIntentionLibrary(profile);
    const hasEmotion = library.some((i) => i.cueType === 'emotion');
    expect(hasEmotion).toBe(false);
  });

  it('has no preferred-hour entry when preferredHours is empty', () => {
    const profile = makeProfile({ preferredHours: [] });
    const library = generateIntentionLibrary(profile);
    const timeBased = library.filter((i) => i.cueType === 'time');
    expect(timeBased).toHaveLength(0);
  });
});

// ─── generateWeeklySummaryNotification ───────────────────────────────────────

describe('generateWeeklySummaryNotification', () => {
  const summary: WeeklySummary = {
    questionsThisWeek: 120,
    weeklyAccuracy: 0.82,
    streakDays: 5,
    systemsCovered: 8,
    totalSystems: 12,
    upcomingReviewLoad: 45,
    message: 'Great week!',
  };

  it('returns a WEEKLY_SUMMARY type notification', () => {
    const n = generateWeeklySummaryNotification(summary);
    expect(n.type).toBe('WEEKLY_SUMMARY');
  });

  it('title includes questions count and accuracy', () => {
    const n = generateWeeklySummaryNotification(summary);
    expect(n.title).toContain('120');
    expect(n.title).toContain('82%');
  });

  it('body includes coverage percentage', () => {
    const n = generateWeeklySummaryNotification(summary);
    // 8/12 = 67%
    expect(n.body).toContain('67%');
  });

  it('body includes upcoming review load', () => {
    const n = generateWeeklySummaryNotification(summary);
    expect(n.body).toContain('45');
  });

  it('ttlSeconds is 24 hours', () => {
    const n = generateWeeklySummaryNotification(summary);
    expect(n.ttlSeconds).toBe(24 * 3600);
  });

  it('has low priority', () => {
    const n = generateWeeklySummaryNotification(summary);
    expect(n.priority).toBe('low');
  });
});

// ─── detectMilestone ──────────────────────────────────────────────────────────

describe('detectMilestone', () => {
  it('returns null when no milestone is hit', () => {
    const profile = makeProfile({ currentStreak: 5, totalQuestionsAnswered: 200, questionsToday: 10, accuracyTrend: 0 });
    expect(detectMilestone(profile)).toBeNull();
  });

  it('detects 7-day streak milestone', () => {
    const profile = makeProfile({ currentStreak: 7 });
    const m = detectMilestone(profile);
    expect(m).not.toBeNull();
    expect(m!.type).toBe('streak_7');
  });

  it('detects 30-day streak milestone', () => {
    const profile = makeProfile({ currentStreak: 30 });
    const m = detectMilestone(profile);
    expect(m).not.toBeNull();
    expect(m!.type).toBe('streak_30');
  });

  it('detects crossing 100 questions milestone', () => {
    // totalQuestionsAnswered = 105, questionsToday = 10 → was 95 before today (< 100)
    const profile = makeProfile({ totalQuestionsAnswered: 105, questionsToday: 10, currentStreak: 5, accuracyTrend: 0 });
    const m = detectMilestone(profile);
    expect(m).not.toBeNull();
    expect(m!.type).toBe('questions_100');
  });

  it('does NOT detect crossing 100 if crossed before today', () => {
    // totalQuestionsAnswered = 150, questionsToday = 5 → was 145 before (>= 100)
    const profile = makeProfile({ totalQuestionsAnswered: 150, questionsToday: 5, currentStreak: 5, accuracyTrend: 0 });
    const m = detectMilestone(profile);
    expect(m).toBeNull();
  });

  it('detects accuracy improvement milestone', () => {
    const profile = makeProfile({ accuracyTrend: 0.06, currentStreak: 5, totalQuestionsAnswered: 200, questionsToday: 10 });
    const m = detectMilestone(profile);
    expect(m).not.toBeNull();
    expect(m!.type).toBe('accuracy_improving');
  });

  it('streak milestone takes priority over accuracy milestone', () => {
    const profile = makeProfile({ currentStreak: 7, accuracyTrend: 0.10 });
    const m = detectMilestone(profile);
    expect(m!.type).toContain('streak');
  });
});
