import { MIN_REVIEWS_FOR_OPTIMIZATION } from '../fsrs-optimizer';
import { FSRS } from '../fsrs';

export type StudyHistoryRange = '7d' | '30d' | '90d' | 'all';

export interface StudyHistoryReviewEvent {
  id: string;
  questionId: string | null;
  conditionId: string | null;
  medicalContentId: string | null;
  reviewedAt: string;
  rating: number;
  gradeContinuous: number | null;
  wasCorrect: boolean;
  responseTimeMs: number | null;
  stability: number;
  difficulty: number;
  retrievability: number | null;
  sessionType: string;
  reviewType: string;
  system: string | null;
  telemetryQuality: string | null;
}

export interface UpcomingReviewItem {
  id: string;
  source: 'card' | 'user_progress';
  questionId: string | null;
  conditionId: string | null;
  dueAt: string;
  overdueDays: number;
  stability: number | null;
  difficulty: number | null;
  state: number | null;
  retrievability: number | null;
  progressContext: string | null;
  system: string | null;
}

export interface StudyHistoryAnalytics {
  reviewCount: number;
  correctCount: number;
  retentionRate: number;
  averageRating: number | null;
  averageResponseTimeMs: number | null;
  averageStability: number | null;
  averageDifficulty: number | null;
  averageRetrievability: number | null;
  optimizer: {
    eligible: boolean;
    reviewCount: number;
    minimumRequired: number;
    reviewsNeeded: number;
  };
  trends: Array<{
    date: string;
    reviews: number;
    correct: number;
    retentionRate: number;
    averageRating: number | null;
  }>;
  bySystem: Array<{
    system: string;
    reviews: number;
    correct: number;
    retentionRate: number;
    averageStability: number | null;
    averageDifficulty: number | null;
  }>;
  recentReviews: StudyHistoryReviewEvent[];
  upcomingReviews: UpcomingReviewItem[];
}

interface StudyHistoryOptions {
  range?: StudyHistoryRange;
  limit?: number;
  includeRapidGuesses?: boolean;
}

interface UpcomingReviewOptions {
  horizonDays?: number;
  limit?: number;
}

const REAL_REVIEW_SESSION_TYPES = ['MAIN', 'DRILL'] as const;
const MS_PER_DAY = 86_400_000;

function rangeStart(range: StudyHistoryRange, now = new Date()): Date {
  if (range === 'all') return new Date(0);
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  return new Date(now.getTime() - days * MS_PER_DAY);
}

function toBoundedLimit(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.round(value ?? fallback)));
}

function telemetryQualityFrom(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const telemetry = raw as Record<string, unknown>;
  const serverComputed = telemetry.server_computed;
  if (!serverComputed || typeof serverComputed !== 'object' || Array.isArray(serverComputed)) {
    return null;
  }
  const quality = (serverComputed as Record<string, unknown>).telemetry_quality;
  return typeof quality === 'string' ? quality : null;
}

function finiteAverage(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function round(value: number | null, digits = 3): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toDateKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function overdueDays(now: Date, due: Date): number {
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / MS_PER_DAY));
}

function computeCurrentRetrievability(
  stability: number | null | undefined,
  lastReview: Date | string | null | undefined,
  now: Date
): number | null {
  if (!stability || stability <= 0 || !lastReview) return null;
  const elapsed = Math.max(0, (now.getTime() - new Date(lastReview).getTime()) / MS_PER_DAY);
  return new FSRS().calculateRetrievability(elapsed, stability);
}

export async function getUserStudyHistory(
  prisma: any,
  userId: string,
  options: StudyHistoryOptions = {}
): Promise<StudyHistoryReviewEvent[]> {
  const now = new Date();
  const range = options.range ?? '30d';
  const limit = toBoundedLimit(options.limit, 500, 2000);
  const reviewTypes = options.includeRapidGuesses ? ['real', 'rapid_guess'] : ['real'];

  const rows = await prisma.reviewLog.findMany({
    where: {
      userId,
      reviewedAt: { gte: rangeStart(range, now) },
      review_type: { in: reviewTypes },
      sessionType: { in: [...REAL_REVIEW_SESSION_TYPES] },
    },
    orderBy: { reviewedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      questionId: true,
      conditionId: true,
      medicalContentId: true,
      reviewedAt: true,
      grade: true,
      grade_continuous: true,
      wasCorrect: true,
      responseTimeMs: true,
      stability: true,
      difficulty: true,
      retrievability: true,
      sessionType: true,
      review_type: true,
      system: true,
      telemetry: true,
    },
  });

  return rows.map((row: any) => ({
    id: row.id,
    questionId: row.questionId ?? null,
    conditionId: row.conditionId ?? null,
    medicalContentId: row.medicalContentId ?? null,
    reviewedAt: new Date(row.reviewedAt).toISOString(),
    rating: Number(row.grade),
    gradeContinuous: row.grade_continuous ?? null,
    wasCorrect: Boolean(row.wasCorrect),
    responseTimeMs: row.responseTimeMs ?? null,
    stability: Number(row.stability ?? 0),
    difficulty: Number(row.difficulty ?? 0),
    retrievability: row.retrievability ?? null,
    sessionType: String(row.sessionType ?? 'MAIN'),
    reviewType: String(row.review_type ?? 'real'),
    system: row.system ?? null,
    telemetryQuality: telemetryQualityFrom(row.telemetry),
  }));
}

export async function getUpcomingReviews(
  prisma: any,
  userId: string,
  options: UpcomingReviewOptions = {}
): Promise<UpcomingReviewItem[]> {
  const now = new Date();
  const horizonDays = Math.max(1, Math.min(options.horizonDays ?? 7, 30));
  const limit = toBoundedLimit(options.limit, 50, 200);
  const horizon = new Date(now.getTime() + horizonDays * MS_PER_DAY);

  const [cards, progressRows] = await Promise.all([
    prisma.card.findMany({
      where: {
        userId,
        due: { lte: horizon },
      },
      orderBy: [{ due: 'asc' }, { difficulty: 'desc' }],
      take: limit,
      select: {
        id: true,
        questionId: true,
        progressContext: true,
        due: true,
        stability: true,
        difficulty: true,
        state: true,
        last_review: true,
        Question: {
          select: {
            conditionId: true,
            medicalContentId: true,
            system: true,
          },
        },
      },
    }),
    prisma.userProgress.findMany({
      where: {
        userId,
        nextReviewAt: { lte: horizon },
      },
      orderBy: [{ nextReviewAt: 'asc' }, { fsrsDifficulty: 'desc' }],
      take: limit,
      select: {
        id: true,
        conditionId: true,
        progressContext: true,
        nextReviewAt: true,
        lastReviewAt: true,
        fsrsStability: true,
        fsrsDifficulty: true,
        fsrsState: true,
        system: true,
      },
    }),
  ]);

  const cardItems: UpcomingReviewItem[] = cards
    .filter((card: any) => card.due)
    .map((card: any) => ({
      id: card.id,
      source: 'card',
      questionId: card.questionId,
      conditionId: card.Question?.medicalContentId ?? card.Question?.conditionId ?? null,
      dueAt: new Date(card.due).toISOString(),
      overdueDays: overdueDays(now, new Date(card.due)),
      stability: card.stability ?? null,
      difficulty: card.difficulty ?? null,
      state: card.state ?? null,
      retrievability: computeCurrentRetrievability(card.stability, card.last_review, now),
      progressContext: card.progressContext ?? null,
      system: card.Question?.system ?? null,
    }));

  const progressItems: UpcomingReviewItem[] = progressRows
    .filter((row: any) => row.nextReviewAt)
    .map((row: any) => ({
      id: row.id,
      source: 'user_progress',
      questionId: null,
      conditionId: row.conditionId ?? null,
      dueAt: new Date(row.nextReviewAt).toISOString(),
      overdueDays: overdueDays(now, new Date(row.nextReviewAt)),
      stability: row.fsrsStability ?? null,
      difficulty: row.fsrsDifficulty ?? null,
      state: row.fsrsState ?? null,
      retrievability: computeCurrentRetrievability(row.fsrsStability, row.lastReviewAt, now),
      progressContext: row.progressContext ?? null,
      system: row.system ?? null,
    }));

  return [...cardItems, ...progressItems]
    .sort((left, right) => {
      const dueDelta = new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
      return dueDelta !== 0 ? dueDelta : right.overdueDays - left.overdueDays;
    })
    .slice(0, limit);
}

export async function getStudyHistoryAnalytics(
  prisma: any,
  userId: string,
  options: StudyHistoryOptions & UpcomingReviewOptions = {}
): Promise<StudyHistoryAnalytics> {
  const [recentReviews, optimizerReviewCount, upcomingReviews] = await Promise.all([
    getUserStudyHistory(prisma, userId, {
      range: options.range ?? '30d',
      limit: options.limit ?? 500,
      includeRapidGuesses: options.includeRapidGuesses,
    }),
    prisma.reviewLog.count({
      where: {
        userId,
        review_type: 'real',
        sessionType: { in: [...REAL_REVIEW_SESSION_TYPES] },
      },
    }),
    getUpcomingReviews(prisma, userId, {
      horizonDays: options.horizonDays,
      limit: Math.min(options.limit ?? 50, 100),
    }),
  ]);

  const reviewCount = recentReviews.length;
  const correctCount = recentReviews.filter((review) => review.wasCorrect).length;
  const retentionRate = reviewCount > 0 ? correctCount / reviewCount : 0;

  const dayMap = new Map<string, { reviews: StudyHistoryReviewEvent[] }>();
  for (const review of recentReviews) {
    const key = toDateKey(review.reviewedAt);
    const entry = dayMap.get(key) ?? { reviews: [] };
    entry.reviews.push(review);
    dayMap.set(key, entry);
  }

  const trends = Array.from(dayMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entry]) => {
      const reviews = entry.reviews;
      const correct = reviews.filter((review) => review.wasCorrect).length;
      return {
        date,
        reviews: reviews.length,
        correct,
        retentionRate: reviews.length > 0 ? round(correct / reviews.length, 3)! : 0,
        averageRating: round(finiteAverage(reviews.map((review) => review.rating)), 2),
      };
    });

  const systemMap = new Map<string, StudyHistoryReviewEvent[]>();
  for (const review of recentReviews) {
    const system = review.system ?? 'Unknown';
    systemMap.set(system, [...(systemMap.get(system) ?? []), review]);
  }

  const bySystem = Array.from(systemMap.entries())
    .map(([system, reviews]) => {
      const correct = reviews.filter((review) => review.wasCorrect).length;
      return {
        system,
        reviews: reviews.length,
        correct,
        retentionRate: reviews.length > 0 ? round(correct / reviews.length, 3)! : 0,
        averageStability: round(finiteAverage(reviews.map((review) => review.stability)), 2),
        averageDifficulty: round(finiteAverage(reviews.map((review) => review.difficulty)), 2),
      };
    })
    .sort((left, right) => right.reviews - left.reviews);

  const reviewsNeeded = Math.max(0, MIN_REVIEWS_FOR_OPTIMIZATION - optimizerReviewCount);

  return {
    reviewCount,
    correctCount,
    retentionRate: round(retentionRate, 3) ?? 0,
    averageRating: round(finiteAverage(recentReviews.map((review) => review.rating)), 2),
    averageResponseTimeMs: round(finiteAverage(recentReviews.map((review) => review.responseTimeMs)), 0),
    averageStability: round(finiteAverage(recentReviews.map((review) => review.stability)), 2),
    averageDifficulty: round(finiteAverage(recentReviews.map((review) => review.difficulty)), 2),
    averageRetrievability: round(finiteAverage(recentReviews.map((review) => review.retrievability)), 3),
    optimizer: {
      eligible: optimizerReviewCount >= MIN_REVIEWS_FOR_OPTIMIZATION,
      reviewCount: optimizerReviewCount,
      minimumRequired: MIN_REVIEWS_FOR_OPTIMIZATION,
      reviewsNeeded,
    },
    trends,
    bySystem,
    recentReviews,
    upcomingReviews,
  };
}
