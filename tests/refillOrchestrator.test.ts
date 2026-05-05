import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestRefill, triggerRefillsForLowUsers } from '../lib/services/reservoir/refillOrchestrator';
import { createJob } from '../lib/services/queue/jobQueue';

vi.mock('../lib/services/queue/jobQueue', () => ({
  createJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
}));

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    backgroundJob: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    studentReservoirItem: {
      count: vi.fn().mockResolvedValue(0),
    },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any;
}

describe('refillOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createJob).mockResolvedValue({ id: 'job-1' });
  });

  it('deduplicates reservoir refill jobs by user and scope', async () => {
    const prisma = makePrisma();

    await requestRefill(prisma, 'user-1', 'system:CV', 'cron');

    expect(prisma.backgroundJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { payload: { path: ['userId'], equals: 'user-1' } },
            { payload: { path: ['scope'], equals: 'system:CV' } },
            { payload: { path: ['isReservoirRefill'], equals: true } },
          ]),
        }),
      })
    );
  });

  it('includes onboarded users with zero reservoir rows in low-water maintenance', async () => {
    const prisma = makePrisma({
      $queryRawUnsafe: vi.fn().mockResolvedValue([
        { userId: 'user-zero', scope: 'adaptive', queued_count: 0 },
      ]),
    });

    const result = await triggerRefillsForLowUsers(prisma);

    expect(result).toEqual({ checked: 1, triggered: 1, skipped: 0 });
    expect(String(prisma.$queryRawUnsafe.mock.calls[0][0])).toContain('LEFT JOIN queued');
    expect(createJob).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        payload: expect.objectContaining({
          userId: 'user-zero',
          scope: 'adaptive',
          isReservoirRefill: true,
        }),
      })
    );
  });
});
