import express from 'express';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockTx = vi.hoisted(() => ({
  performanceRecord: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  sRSItem: {
    upsert: vi.fn(),
  },
  savedQuestion: {
    upsert: vi.fn(),
  },
  questionIdentity: {
    upsert: vi.fn(),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  performanceRecord: {
    findMany: vi.fn(),
  },
  sRSItem: {
    findMany: vi.fn(),
  },
  savedQuestion: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('../lib/middleware/clerkAuth', () => ({
  requireAuth: vi.fn((req: any, _res: any, next: () => void) => {
    req.auth = { userId: 'clerk-user-1' };
    next();
  }),
}));

import syncRouter from '../routes/sync';

async function postSync(body: unknown): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use('/', syncRouter);

  const server = app.listen(0);
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('Express sync routes', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://test';
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockTx));
    mockTx.questionIdentity.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({ id: `qi_${create.questionSource}_${create.sourceQuestionId}` })
    );
    mockTx.savedQuestion.upsert.mockResolvedValue({});
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('links synced saved questions to canonical question identities', async () => {
    const { status, body } = await postSync({
      savedQuestions: [
        {
          id: 'saved-1',
          questionId: 'pg-1',
          questionSource: 'pre_generated',
          sourceQuestionId: 'pg-1',
          canonicalQuestionId: 'q-1',
          medicalContentId: 'content-1',
          conditionId: 'cond-1',
          type: 'bookmarked',
          questionText: 'Which finding supports pulmonary embolism?',
          correctAnswer: 'B',
          explanation: 'CTPA is preferred in high-risk presentations.',
          topic: 'Pulmonary embolism',
          system: 'Pulmonary',
          userNote: 'Review Wells criteria.',
          repetitionLevel: 2,
          nextReviewDate: '2026-05-20T00:00:00.000Z',
        },
      ],
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockTx.questionIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          questionSource_sourceQuestionId: {
            questionSource: 'pre_generated',
            sourceQuestionId: 'pg-1',
          },
        },
        create: expect.objectContaining({
          questionSource: 'pre_generated',
          sourceQuestionId: 'pg-1',
          canonicalQuestionId: 'q-1',
          preGeneratedQuestionId: 'pg-1',
          provenance: expect.objectContaining({
            writer: 'express-sync',
            type: 'bookmarked',
            medicalContentId: 'content-1',
            system: 'Pulmonary',
            conditionId: 'cond-1',
          }),
        }),
      })
    );
    expect(mockTx.savedQuestion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          questionIdentityId: 'qi_pre_generated_pg-1',
        }),
        create: expect.objectContaining({
          questionIdentityId: 'qi_pre_generated_pg-1',
        }),
      })
    );
  });

  it('acknowledges local sync without touching persistence when no database is configured', async () => {
    delete process.env.DATABASE_URL;

    const { status, body } = await postSync({
      savedQuestions: [{ questionId: 'q-1', type: 'bookmarked' }],
    });

    expect(status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Sync acknowledged (No DB configured)',
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
