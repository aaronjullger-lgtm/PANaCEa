import { describe, it, expect, beforeEach } from 'vitest';
import {
  proposeLearnerMemory,
  confirmLearnerMemory,
  listLearnerMemories,
  deleteLearnerMemory,
} from '@/lib/services/learner/learnerMemoryStore';

function createMockPrisma() {
  let customSettings: Record<string, unknown> = {};
  const userId = 'user-1';

  return {
    user: {
      findUnique: async () => ({ examDate: null }),
    },
    userPreferences: {
      findUnique: async () =>
        Object.keys(customSettings).length
          ? { id: 'prefs-1', customSettings }
          : null,
      update: async ({ data }: { data: { customSettings: Record<string, unknown> } }) => {
        customSettings = data.customSettings;
        return { id: 'prefs-1' };
      },
      create: async ({ data }: { data: { customSettings: Record<string, unknown> } }) => {
        customSettings = data.customSettings;
        return { id: 'prefs-1' };
      },
    },
    _getSettings: () => customSettings,
    userId,
  } as any;
}

describe('learnerMemoryStore (Postgres customSettings)', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it('stores confirmed preference without pending queue', async () => {
    const result = await proposeLearnerMemory(prisma, prisma.userId, {
      proposed: 'Prefer 20-minute sessions',
      category: 'preference',
      source: 'learner_stated',
    });

    expect(result.pendingConfirmation).toBe(false);
    expect(result.stored?.proposed).toBe('Prefer 20-minute sessions');

    const listed = await listLearnerMemories(prisma, prisma.userId);
    expect(listed.confirmed).toHaveLength(1);
    expect(listed.pending).toHaveLength(0);
  });

  it('queues inferred schedule memories for confirmation', async () => {
    const result = await proposeLearnerMemory(prisma, prisma.userId, {
      proposed: 'Study mornings before clinic',
      category: 'schedule',
      source: 'inferred',
      confidence: 0.6,
    });

    expect(result.pendingConfirmation).toBe(true);
    const listed = await listLearnerMemories(prisma, prisma.userId);
    expect(listed.pending).toHaveLength(1);
    expect(listed.confirmed).toHaveLength(0);
  });

  it('confirms pending memory into canonical store', async () => {
    const proposed = await proposeLearnerMemory(prisma, prisma.userId, {
      proposed: 'Target surgery rotation this week',
      category: 'goal',
      source: 'learner_stated',
    });
    expect(proposed.pendingConfirmation).toBe(true);

    const confirmed = await confirmLearnerMemory(prisma, prisma.userId, proposed.candidate.id);
    expect(confirmed.confirmedAt).toBeTruthy();

    const listed = await listLearnerMemories(prisma, prisma.userId);
    expect(listed.confirmed).toHaveLength(1);
    expect(listed.pending).toHaveLength(0);
  });

  it('deletes confirmed memory', async () => {
    const result = await proposeLearnerMemory(prisma, prisma.userId, {
      proposed: 'Focus cardiology',
      category: 'preference',
      source: 'learner_stated',
    });
    const memoryId = result.stored!.id;
    await deleteLearnerMemory(prisma, prisma.userId, memoryId);
    const listed = await listLearnerMemories(prisma, prisma.userId);
    expect(listed.confirmed).toHaveLength(0);
  });
});
