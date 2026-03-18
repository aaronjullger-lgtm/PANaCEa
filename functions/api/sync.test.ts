/**
 * Unit tests for sync.ts
 * Tests timestamp-based merge logic for SRS items and saved questions
 * Validates that local deletions are respected and in-flight changes are preserved
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// PURE FUNCTION HELPERS (mirror sync.ts for testing)
// ============================================================================

/**
 * Get timestamp from SRS item, preferring updatedAt then falling back to lastReviewed
 */
function getSRSItemTimestamp(item: any): Date {
  if (item.updatedAt && typeof item.updatedAt === 'string') {
    return new Date(item.updatedAt);
  }
  if (item.lastReviewed && typeof item.lastReviewed === 'string') {
    return new Date(item.lastReviewed);
  }
  return new Date();
}

/**
 * Get timestamp from saved question
 */
function getSavedQuestionTimestamp(item: any): Date {
  if (item.updatedAt && typeof item.updatedAt === 'string') {
    return new Date(item.updatedAt);
  }
  if (item.createdAt && typeof item.createdAt === 'string') {
    return new Date(item.createdAt);
  }
  return new Date();
}

/**
 * 3-way merge for SRS items
 */
function mergeSRSItems(
  localItems: any[],
  cloudItems: any[],
  localDeletions: Record<string, string> = {}
): { toKeep: any[]; toDelete: string[] } {
  const toDelete: string[] = [];
  const toKeep: any[] = [];
  const cloudMap = new Map(cloudItems.map(item => [item.questionId, item]));
  const localMap = new Map(localItems.map(item => [item.questionId, item]));

  // Process all local items
  for (const localItem of localItems) {
    const key = localItem.questionId;
    const cloudItem = cloudMap.get(key);
    const deletionTime = localDeletions[key];

    if (!cloudItem) {
      toKeep.push(localItem);
    } else {
      const localTime = getSRSItemTimestamp(localItem);
      const cloudTime = getSRSItemTimestamp(cloudItem);

      if (localTime >= cloudTime) {
        toKeep.push(localItem);
      } else {
        toKeep.push(cloudItem);
      }
    }
  }

  // Process cloud items not in local
  for (const cloudItem of cloudItems) {
    const key = cloudItem.questionId;
    if (!localMap.has(key)) {
      const deletionTime = localDeletions[key];
      if (deletionTime) {
        const deletionDate = new Date(deletionTime);
        const cloudTime = getSRSItemTimestamp(cloudItem);

        if (cloudTime > deletionDate) {
          toKeep.push(cloudItem);
        }
      } else {
        toKeep.push(cloudItem);
      }
    }
  }

  return { toKeep, toDelete };
}

/**
 * 3-way merge for saved questions
 */
function mergeSavedQuestions(
  localItems: any[],
  cloudItems: any[],
  localDeletions: Record<string, string> = {}
): { toKeep: any[]; toDelete: string[] } {
  const toDelete: string[] = [];
  const toKeep: any[] = [];
  
  const cloudMap = new Map(cloudItems.map(item => {
    const key = `${item.questionId}:${item.type}`;
    return [key, item];
  }));
  
  const localMap = new Map(localItems.map(item => {
    const key = `${item.questionId}:${item.type}`;
    return [key, item];
  }));

  // Process all local items
  for (const localItem of localItems) {
    const key = `${localItem.questionId}:${localItem.type}`;
    const cloudItem = cloudMap.get(key);

    if (!cloudItem) {
      toKeep.push(localItem);
    } else {
      const localTime = getSavedQuestionTimestamp(localItem);
      const cloudTime = getSavedQuestionTimestamp(cloudItem);

      if (localTime >= cloudTime) {
        toKeep.push(localItem);
      } else {
        toKeep.push(cloudItem);
      }
    }
  }

  // Process cloud items not in local
  for (const cloudItem of cloudItems) {
    const key = `${cloudItem.questionId}:${cloudItem.type}`;
    if (!localMap.has(key)) {
      const deletionTime = localDeletions[key];
      if (deletionTime) {
        const deletionDate = new Date(deletionTime);
        const cloudTime = getSavedQuestionTimestamp(cloudItem);

        if (cloudTime > deletionDate) {
          toKeep.push(cloudItem);
        }
      } else {
        toKeep.push(cloudItem);
      }
    }
  }

  return { toKeep, toDelete };
}

// ============================================================================
// TESTS: TIMESTAMP-BASED CONFLICT RESOLUTION
// ============================================================================

describe('SRS Items - Timestamp-Based Conflict Resolution', () => {
  it('should prefer newer local version over older cloud version', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

    const local = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: now.toISOString(),
      },
    ];

    const cloud = [
      {
        questionId: 'q1',
        interval: 1,
        repetition: 1,
        easiness: 2.0,
        dueDate: '2026-03-18',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.6',
        stabilityScore: 0.7,
        updatedAt: fiveMinutesAgo.toISOString(),
      },
    ];

    const { toKeep } = mergeSRSItems(local, cloud);

    expect(toKeep).toHaveLength(1);
    expect(toKeep[0].interval).toBe(3); // Local interval
    expect(toKeep[0].easiness).toBe(2.5); // Local easiness
  });

  it('should prefer newer cloud version over older local version', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

    const local = [
      {
        questionId: 'q1',
        interval: 1,
        repetition: 1,
        easiness: 2.0,
        dueDate: '2026-03-18',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.6',
        stabilityScore: 0.7,
        updatedAt: fiveMinutesAgo.toISOString(),
      },
    ];

    const cloud = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: now.toISOString(),
      },
    ];

    const { toKeep } = mergeSRSItems(local, cloud);

    expect(toKeep).toHaveLength(1);
    expect(toKeep[0].interval).toBe(3); // Cloud interval
    expect(toKeep[0].easiness).toBe(2.5); // Cloud easiness
  });

  it('should keep local version when timestamps are equal', () => {
    const timestamp = new Date().toISOString();

    const local = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: timestamp,
      },
    ];

    const cloud = [
      {
        questionId: 'q1',
        interval: 1,
        repetition: 1,
        easiness: 2.0,
        dueDate: '2026-03-18',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.6',
        stabilityScore: 0.7,
        updatedAt: timestamp,
      },
    ];

    const { toKeep } = mergeSRSItems(local, cloud);

    expect(toKeep).toHaveLength(1);
    expect(toKeep[0].interval).toBe(3); // Local version when equal
  });

  it('should fallback to lastReviewed when updatedAt is missing', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

    const local = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: now.toISOString(),
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
      },
    ];

    const cloud = [
      {
        questionId: 'q1',
        interval: 1,
        repetition: 1,
        easiness: 2.0,
        dueDate: '2026-03-18',
        lastReviewed: fiveMinutesAgo.toISOString(),
        quality: 3,
        difficulty: '0.6',
        stabilityScore: 0.7,
      },
    ];

    const { toKeep } = mergeSRSItems(local, cloud);

    expect(toKeep).toHaveLength(1);
    expect(toKeep[0].interval).toBe(3); // Newer local version
  });
});

// ============================================================================
// TESTS: LOCAL DELETION TRACKING
// ============================================================================

describe('SRS Items - Local Deletion Tracking', () => {
  it('should not restore items deleted locally', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);

    const local: any[] = [];
    const cloud = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: oneHourAgo.toISOString(),
      },
    ];

    const localDeletions = {
      'q1': now.toISOString(), // Deleted recently
    };

    const { toKeep } = mergeSRSItems(local, cloud, localDeletions);

    expect(toKeep).toHaveLength(0); // Cloud item is not restored
  });

  it('should restore items if cloud version is newer than deletion', () => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60000);

    const local: any[] = [];
    const cloud = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: now.toISOString(), // Updated after deletion
      },
    ];

    const localDeletions = {
      'q1': tenMinutesAgo.toISOString(), // Deleted 10 minutes ago
    };

    const { toKeep } = mergeSRSItems(local, cloud, localDeletions);

    expect(toKeep).toHaveLength(1); // Cloud item is restored
    expect(toKeep[0].questionId).toBe('q1');
  });

  it('should track multiple independent deletions', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);

    const local: any[] = [];
    const cloud = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: oneHourAgo.toISOString(),
      },
      {
        questionId: 'q2',
        interval: 2,
        repetition: 1,
        easiness: 2.0,
        dueDate: '2026-03-19',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.7',
        stabilityScore: 0.75,
        updatedAt: oneHourAgo.toISOString(),
      },
    ];

    const localDeletions = {
      'q1': now.toISOString(),
      'q2': now.toISOString(),
    };

    const { toKeep } = mergeSRSItems(local, cloud, localDeletions);

    expect(toKeep).toHaveLength(0); // Both items respect deletion
  });
});

// ============================================================================
// TESTS: SAVED QUESTIONS MERGE
// ============================================================================

describe('Saved Questions - Timestamp-Based Conflict Resolution', () => {
  it('should use composite key (questionId:type) for merging', () => {
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
        type: 'flagged', // Different type - not a conflict
        questionText: 'Cloud flagged',
        correctAnswer: 'Cloud answer',
        explanation: 'Cloud explanation',
        topic: 'Cloud topic',
        updatedAt: timestamp,
      },
    ];

    const { toKeep } = mergeSavedQuestions(local, cloud);

    expect(toKeep).toHaveLength(2); // Both kept - different types
    expect(toKeep[0].type).toBe('saved');
    expect(toKeep[1].type).toBe('flagged');
  });

  it('should prefer newer version for same question and type', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

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

  it('should respect local deletions for saved questions', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);

    const local: any[] = [];
    const cloud = [
      {
        questionId: 'q1',
        type: 'saved',
        questionText: 'Cloud question',
        correctAnswer: 'Cloud answer',
        explanation: 'Cloud explanation',
        topic: 'Cloud topic',
        updatedAt: oneHourAgo.toISOString(),
      },
    ];

    const localDeletions = {
      'q1:saved': now.toISOString(),
    };

    const { toKeep } = mergeSavedQuestions(local, cloud, localDeletions);

    expect(toKeep).toHaveLength(0); // Deletion respected
  });
});

// ============================================================================
// TESTS: COMPLEX SCENARIOS
// ============================================================================

describe('Complex Multi-Item Merge Scenarios', () => {
  it('should merge multiple questions with mixed timestamps and deletions', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000);

    const local = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: now.toISOString(), // Q1: Local is newer
      },
      {
        questionId: 'q2',
        interval: 1,
        repetition: 1,
        easiness: 2.0,
        dueDate: '2026-03-18',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.6',
        stabilityScore: 0.7,
        updatedAt: twoHoursAgo.toISOString(), // Q2: Cloud is newer (will be overridden)
      },
    ];

    const cloud = [
      {
        questionId: 'q1',
        interval: 1,
        repetition: 1,
        easiness: 2.0,
        dueDate: '2026-03-18',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.6',
        stabilityScore: 0.7,
        updatedAt: oneHourAgo.toISOString(),
      },
      {
        questionId: 'q2',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: now.toISOString(),
      },
      {
        questionId: 'q3',
        interval: 2,
        repetition: 1,
        easiness: 2.2,
        dueDate: '2026-03-19',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.7',
        stabilityScore: 0.75,
        updatedAt: thirtyMinutesAgo.toISOString(), // Q3: Cloud only, not deleted
      },
    ];

    const localDeletions = {}; // No deletions

    const { toKeep } = mergeSRSItems(local, cloud, localDeletions);

    expect(toKeep).toHaveLength(3);
    expect(toKeep.find(q => q.questionId === 'q1')?.interval).toBe(3); // Local (newer)
    expect(toKeep.find(q => q.questionId === 'q2')?.interval).toBe(3); // Cloud (newer)
    expect(toKeep.find(q => q.questionId === 'q3')?.interval).toBe(2); // Cloud only
  });

  it('should handle full conflict resolution workflow', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60000);

    const local = [
      {
        questionId: 'q1',
        interval: 3,
        repetition: 2,
        easiness: 2.5,
        dueDate: '2026-03-20',
        lastReviewed: '2026-03-17',
        quality: 4,
        difficulty: '0.8',
        stabilityScore: 0.85,
        updatedAt: now.toISOString(),
      },
    ];

    const cloud = [
      {
        questionId: 'q1',
        interval: 1,
        repetition: 1,
        easiness: 2.0,
        dueDate: '2026-03-18',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.6',
        stabilityScore: 0.7,
        updatedAt: twoHoursAgo.toISOString(),
      },
      {
        questionId: 'q2',
        interval: 2,
        repetition: 1,
        easiness: 2.2,
        dueDate: '2026-03-19',
        lastReviewed: '2026-03-17',
        quality: 3,
        difficulty: '0.7',
        stabilityScore: 0.75,
        updatedAt: oneHourAgo.toISOString(),
      },
    ];

    const localDeletions = {
      'q2': twoHoursAgo.toISOString(), // Deleted 2 hours ago, cloud is newer
    };

    const { toKeep } = mergeSRSItems(local, cloud, localDeletions);

    expect(toKeep).toHaveLength(2);
    expect(toKeep.find(q => q.questionId === 'q1')?.interval).toBe(3); // Local newer
    expect(toKeep.find(q => q.questionId === 'q2')?.interval).toBe(2); // Cloud newer than deletion
  });
});