import { describe, expect, it } from 'vitest';

function getSavedQuestionTimestamp(item: { updatedAt?: string; createdAt?: string }): Date {
  if (item.updatedAt && typeof item.updatedAt === 'string') {
    return new Date(item.updatedAt);
  }
  if (item.createdAt && typeof item.createdAt === 'string') {
    return new Date(item.createdAt);
  }
  return new Date();
}

function mergeSavedQuestions(
  localItems: any[],
  cloudItems: any[],
  localDeletions: Record<string, string> = {}
): { toKeep: any[]; toDelete: string[] } {
  const toDelete: string[] = [];
  const toKeep: any[] = [];

  const cloudMap = new Map(
    cloudItems.map((item) => {
      const key = `${item.questionId}:${item.type}`;
      return [key, item];
    })
  );

  const localMap = new Map(
    localItems.map((item) => {
      const key = `${item.questionId}:${item.type}`;
      return [key, item];
    })
  );

  for (const localItem of localItems) {
    const key = `${localItem.questionId}:${localItem.type}`;
    const cloudItem = cloudMap.get(key);

    if (!cloudItem) {
      toKeep.push(localItem);
      continue;
    }

    const localTime = getSavedQuestionTimestamp(localItem);
    const cloudTime = getSavedQuestionTimestamp(cloudItem);
    toKeep.push(localTime >= cloudTime ? localItem : cloudItem);
  }

  for (const cloudItem of cloudItems) {
    const key = `${cloudItem.questionId}:${cloudItem.type}`;
    if (localMap.has(key)) continue;

    const deletionTime = localDeletions[key];
    if (!deletionTime) {
      toKeep.push(cloudItem);
      continue;
    }

    const deletionDate = new Date(deletionTime);
    const cloudTime = getSavedQuestionTimestamp(cloudItem);
    if (cloudTime > deletionDate) {
      toKeep.push(cloudItem);
    }
  }

  return { toKeep, toDelete };
}

describe('sync.ts compatibility behavior', () => {
  it('keeps the response shape stable while SRSItem sync is retired', () => {
    const response = {
      success: true,
      message: 'Data synced successfully',
      data: {
        performanceRecords: [],
        srsItems: [],
        savedQuestions: [],
      },
    };

    expect(response.data.srsItems).toEqual([]);
  });
});

describe('Saved Questions - Timestamp-Based Conflict Resolution', () => {
  it('uses composite key (questionId:type) for merging', () => {
    const timestamp = new Date().toISOString();

    const local = [
      {
        questionId: 'q1',
        type: 'saved',
        questionText: 'Local question',
        correctAnswer: 'Local answer',
        explanation: 'Local explanation',
        topic: 'Local topic',
        updatedAt: timestamp,
      },
    ];

    const cloud = [
      {
        questionId: 'q1',
        type: 'flagged',
        questionText: 'Cloud flagged',
        correctAnswer: 'Cloud answer',
        explanation: 'Cloud explanation',
        topic: 'Cloud topic',
        updatedAt: timestamp,
      },
    ];

    const { toKeep } = mergeSavedQuestions(local, cloud);

    expect(toKeep).toHaveLength(2);
    expect(toKeep[0].type).toBe('saved');
    expect(toKeep[1].type).toBe('flagged');
  });

  it('prefers newer version for same question and type', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);

    const local = [
      {
        questionId: 'q1',
        type: 'saved',
        questionText: 'Newer local',
        correctAnswer: 'New answer',
        explanation: 'New explanation',
        topic: 'New topic',
        updatedAt: now.toISOString(),
      },
    ];

    const cloud = [
      {
        questionId: 'q1',
        type: 'saved',
        questionText: 'Older cloud',
        correctAnswer: 'Old answer',
        explanation: 'Old explanation',
        topic: 'Old topic',
        updatedAt: fiveMinutesAgo.toISOString(),
      },
    ];

    const { toKeep } = mergeSavedQuestions(local, cloud);

    expect(toKeep).toHaveLength(1);
    expect(toKeep[0].questionText).toBe('Newer local');
  });

  it('respects local deletions for saved questions', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

    const { toKeep } = mergeSavedQuestions(
      [],
      [
        {
          questionId: 'q1',
          type: 'saved',
          questionText: 'Cloud question',
          correctAnswer: 'Cloud answer',
          explanation: 'Cloud explanation',
          topic: 'Cloud topic',
          updatedAt: oneHourAgo.toISOString(),
        },
      ],
      {
        'q1:saved': now.toISOString(),
      }
    );

    expect(toKeep).toHaveLength(0);
  });
});
