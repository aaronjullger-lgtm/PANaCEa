/**
 * TanStack Query Key Factory — Phase 6
 *
 * Centralised, type-safe query key definitions for every domain.
 * Follows the "query key factory" pattern recommended by TkDodo:
 *   https://tkdodo.eu/blog/effective-react-query-keys
 *
 * Usage:
 *   import { queryKeys } from '@/lib/queryKeys';
 *
 *   useQuery({ queryKey: queryKeys.analytics.metacognitive(30), ... });
 *   queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
 *
 * Conventions:
 *   - `.all`       → invalidates everything in that domain
 *   - `.lists()`   → list queries (filterable)
 *   - `.detail(id)` → single-entity queries
 *   - Params are appended as readonly tuples for cache granularity
 */

// ─── Analytics ──────────────────────────────────────────────────────────────

export const analyticsKeys = {
  all: ['analytics'] as const,
  metacognitive: (days?: number) => ['analytics', 'metacognitive', days ?? 30] as const,
  blueprintCoverage: () => ['analytics', 'blueprint-coverage'] as const,
  accuracyTrend: (system?: string) => ['analytics', 'accuracy-trend', system] as const,
  activitySummary: (range?: string) => ['analytics', 'activity-summary', range] as const,
};

// ─── Topics & Conditions ────────────────────────────────────────────────────

export const topicKeys = {
  all: ['topics'] as const,
  progress: (conditionId: string) => ['topics', 'progress', conditionId] as const,
  mastery: (system?: string) => ['topics', 'mastery', system] as const,
};

// ─── User ───────────────────────────────────────────────────────────────────

export const userKeys = {
  all: ['user'] as const,
  profile: () => ['user', 'profile'] as const,
  stats: () => ['user', 'stats'] as const,
  fsrsParams: () => ['user', 'fsrs-params'] as const,
  srsConfig: () => ['user', 'srs-config'] as const,
  streaks: () => ['user', 'streaks'] as const,
  achievements: () => ['user', 'achievements'] as const,
  studyWellness: () => ['user', 'study-wellness'] as const,
  goals: (filters?: { status?: string; type?: string }) =>
    ['user', 'goals', filters] as const,
};

// ─── Sessions & Drills ──────────────────────────────────────────────────────

export const sessionKeys = {
  all: ['sessions'] as const,
  current: () => ['sessions', 'current'] as const,
  history: (page?: number) => ['sessions', 'history', page ?? 1] as const,
};

export const drillKeys = {
  all: ['drills'] as const,
  list: () => ['drills', 'list'] as const,
  detail: (drillId: string) => ['drills', 'detail', drillId] as const,
};

// ─── SRS ────────────────────────────────────────────────────────────────────

export const srsKeys = {
  all: ['srs'] as const,
  due: () => ['srs', 'due'] as const,
};

// ─── Questions & Reservoir ──────────────────────────────────────────────────

export const questionKeys = {
  all: ['questions'] as const,
  dueQueue: () => ['questions', 'due-queue'] as const,
  reservoir: () => ['questions', 'reservoir'] as const,
  statistics: (questionId: string) => ['questions', 'statistics', questionId] as const,
};

// ─── Grand Rounds & Targeted Daily ─────────────────────────────────────────

export const grandRoundsKeys = {
  all: ['grand-rounds'] as const,
  today: () => ['grand-rounds', 'today'] as const,
  leaderboard: () => ['grand-rounds', 'leaderboard'] as const,
  review: (challengeId: string) => ['grand-rounds', 'review', challengeId] as const,
};

export const targetedDailyKeys = {
  all: ['targeted-daily'] as const,
  today: (system?: string) => ['targeted-daily', 'today', system] as const,
};

// ─── Content & Library ──────────────────────────────────────────────────────

export const contentKeys = {
  all: ['content'] as const,
  search: (query: string) => ['content', 'search', query] as const,
  condition: (conditionId: string) => ['content', 'condition', conditionId] as const,
  drugs: (query?: string) => ['content', 'drugs', query] as const,
};

// ─── Dashboard ──────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => ['dashboard', 'summary'] as const,
  recommendations: () => ['dashboard', 'recommendations'] as const,
};

// ─── Admin ──────────────────────────────────────────────────────────────────

export const adminKeys = {
  all: ['admin'] as const,
  reviewQueue: (filters?: Record<string, unknown>) =>
    ['admin', 'review-queue', filters] as const,
  poolStats: () => ['admin', 'pool-stats'] as const,
};

// ─── Unified export ─────────────────────────────────────────────────────────

export const queryKeys = {
  analytics: analyticsKeys,
  topics: topicKeys,
  user: userKeys,
  srs: srsKeys,
  sessions: sessionKeys,
  drills: drillKeys,
  questions: questionKeys,
  grandRounds: grandRoundsKeys,
  targetedDaily: targetedDailyKeys,
  content: contentKeys,
  dashboard: dashboardKeys,
  admin: adminKeys,
} as const;
