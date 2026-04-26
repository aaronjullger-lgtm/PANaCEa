import { describe, expect, it, vi } from 'vitest';
import {
  beginSubmissionIdempotency,
  completeSubmissionIdempotency,
  failSubmissionIdempotency,
} from '../submission-idempotency';

function makePrisma() {
  const rows = new Map<string, any>();
  const keyFor = (where: any) => {
    const compound = where.userId_endpoint_idempotencyKey;
    return `${compound.userId}:${compound.endpoint}:${compound.idempotencyKey}`;
  };

  return {
    rows,
    submissionIdempotency: {
      create: vi.fn(async ({ data, select }: any) => {
        const key = `${data.userId}:${data.endpoint}:${data.idempotencyKey}`;
        if (rows.has(key)) {
          const error = new Error('Unique constraint failed');
          (error as any).code = 'P2002';
          throw error;
        }
        const row = {
          ...data,
          id: `idem-${rows.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(key, row);
        return select?.id ? { id: row.id } : row;
      }),
      findUnique: vi.fn(async ({ where }: any) => rows.get(keyFor(where)) ?? null),
      update: vi.fn(async ({ where, data, select }: any) => {
        let row: any | null = null;
        if (where.id) {
          row = [...rows.values()].find((candidate) => candidate.id === where.id) ?? null;
        } else {
          row = rows.get(keyFor(where)) ?? null;
        }
        if (!row) throw new Error('Record not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return select?.id ? { id: row.id } : row;
      }),
    },
  };
}

describe('submission idempotency helper', () => {
  it('starts, completes, and returns stored response on duplicate', async () => {
    const prisma = makePrisma() as any;

    const started = await beginSubmissionIdempotency(prisma, {
      userId: 'user-1',
      endpoint: '/api/drills/submit-review',
      idempotencyKey: 'key-12345678',
    });

    expect(started).toMatchObject({ state: 'started', id: 'idem-1' });

    await completeSubmissionIdempotency(prisma, 'idem-1', { success: true, isCorrect: true });

    const duplicate = await beginSubmissionIdempotency(prisma, {
      userId: 'user-1',
      endpoint: '/api/drills/submit-review',
      idempotencyKey: 'key-12345678',
    });

    expect(duplicate).toEqual({
      state: 'completed',
      response: { success: true, isCorrect: true },
    });
  });

  it('returns in-progress for an active duplicate', async () => {
    const prisma = makePrisma() as any;

    await beginSubmissionIdempotency(prisma, {
      userId: 'user-1',
      endpoint: '/api/drills/submit-review',
      idempotencyKey: 'key-12345678',
    });

    const duplicate = await beginSubmissionIdempotency(prisma, {
      userId: 'user-1',
      endpoint: '/api/drills/submit-review',
      idempotencyKey: 'key-12345678',
    });

    expect(duplicate).toEqual({ state: 'in_progress', retryAfterSeconds: 5 });
  });

  it('reclaims failed rows for retry', async () => {
    const prisma = makePrisma() as any;
    const started = await beginSubmissionIdempotency(prisma, {
      userId: 'user-1',
      endpoint: '/api/drills/submit-review',
      idempotencyKey: 'key-12345678',
    });
    if (started?.state !== 'started') throw new Error('expected started');

    await failSubmissionIdempotency(prisma, started.id, 'INTERNAL_ERROR');

    const retry = await beginSubmissionIdempotency(prisma, {
      userId: 'user-1',
      endpoint: '/api/drills/submit-review',
      idempotencyKey: 'key-12345678',
    });

    expect(retry).toMatchObject({ state: 'started', id: started.id });
  });
});
