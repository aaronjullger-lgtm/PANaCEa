import { describe, expect, it, vi } from 'vitest';
import { logDrillAttempt } from './drillSessionManager';

function makePrisma() {
  return {
    questionAttempt: {
      create: vi.fn().mockResolvedValue({ id: 'attempt-1', isMainSession: false }),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    studySession: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    reviewLog: {
      count: vi.fn(),
    },
    userRolling360Stats: {
      findUnique: vi.fn(),
    },
    $disconnect: vi.fn(),
  };
}

describe('logDrillAttempt', () => {
  it('preserves question identity while keeping drill attempts isolated from main-session FSRS', async () => {
    const prisma = makePrisma();

    await logDrillAttempt(prisma, {
      userId: 'user-1',
      questionId: 'q-1',
      questionIdentityId: 'qi_pre_generated_pg-1',
      conditionId: 'cond-1',
      drillType: 'photo_drill',
      wasCorrect: true,
      durationMs: 2500,
      metadata: { source: 'photo-drill' },
    });

    expect(prisma.questionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        questionId: 'q-1',
        questionIdentityId: 'qi_pre_generated_pg-1',
        conditionId: 'cond-1',
        questionType: 'photo_drill',
        wasCorrect: true,
        durationMs: 2500,
        isMainSession: false,
        telemetryJson: { source: 'photo-drill' },
      }),
    });
  });
});
