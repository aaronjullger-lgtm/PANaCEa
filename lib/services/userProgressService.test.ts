import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FSRSState, Rating, type FSRSCard } from '../fsrs';
import { updateUserProgressWithHistory } from './userProgressService';

function makeCard(overrides: Partial<FSRSCard> = {}): FSRSCard {
  return {
    stability: 2,
    difficulty: 5,
    state: FSRSState.Review,
    elapsed_days: 1,
    scheduled_days: 3,
    reps: 1,
    lapses: 0,
    last_review: new Date('2026-04-26T12:00:00Z'),
    ...overrides,
  };
}

function makePrisma(existing: any = null) {
  return {
    userProgress: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('updateUserProgressWithHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates progress with a non-null future review date after a correct answer', async () => {
    const prisma = makePrisma();

    await updateUserProgressWithHistory(prisma, {
      userId: 'user-db-1',
      conditionId: 'cond-1',
      fsrsCard: makeCard({ scheduled_days: 4, stability: 4 }),
      rating: Rating.Good,
      accuracy: 1,
    });

    const create = prisma.userProgress.upsert.mock.calls[0][0].create;
    expect(create.userId).toBe('user-db-1');
    expect(create.conditionId).toBe('cond-1');
    expect(create.totalAttempts).toBe(1);
    expect(create.correctCount).toBe(1);
    expect(create.nextReviewAt).toBeInstanceOf(Date);
    expect(create.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('schedules incorrect answers sooner than correct answers when FSRS supplies a shorter interval', async () => {
    const correctPrisma = makePrisma();
    const incorrectPrisma = makePrisma();

    await updateUserProgressWithHistory(correctPrisma, {
      userId: 'user-db-1',
      conditionId: 'cond-1',
      fsrsCard: makeCard({ scheduled_days: 5, lapses: 0 }),
      rating: Rating.Good,
      accuracy: 1,
    });

    await updateUserProgressWithHistory(incorrectPrisma, {
      userId: 'user-db-1',
      conditionId: 'cond-1',
      fsrsCard: makeCard({ scheduled_days: 1, lapses: 1 }),
      rating: Rating.Again,
      accuracy: 0,
    });

    const correctDue = correctPrisma.userProgress.upsert.mock.calls[0][0].create.nextReviewAt as Date;
    const incorrectDue = incorrectPrisma.userProgress.upsert.mock.calls[0][0].create.nextReviewAt as Date;

    expect(incorrectDue.getTime()).toBeLessThan(correctDue.getTime());
    expect(incorrectPrisma.userProgress.upsert.mock.calls[0][0].create.correctCount).toBe(0);
  });

  it('honors an explicit clamped nextReviewAt date', async () => {
    const prisma = makePrisma();
    const clamped = new Date('2026-04-27T12:00:00Z');

    await updateUserProgressWithHistory(prisma, {
      userId: 'user-db-1',
      conditionId: 'cond-1',
      fsrsCard: makeCard({ scheduled_days: 10 }),
      rating: Rating.Good,
      accuracy: 1,
      nextReviewAt: clamped,
    });

    expect(prisma.userProgress.upsert.mock.calls[0][0].create.nextReviewAt).toEqual(clamped);
  });
});
