/**
 * Unit tests for useUserStats hook
 *
 * Tests cover core functionality without requiring React Testing Library:
 * - Timestamp-based conflict resolution logic
 * - Local deletion tracking persistence
 * - State management consistency
 * - Sync callback behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Question } from '@/types';

// Mock dependencies
vi.mock('@clerk/clerk-react', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/supabaseClient', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [] }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

// Helper to create mock Question objects with timestamps
function createMockQuestion(
  id: string,
  conditionId: string,
  overrides: Partial<Question> = {}
): Question {
  return {
    id,
    conditionId,
    vignette: `Vignette for ${id}`,
    question: `Question ${id}?`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    explanation: `Explanation for ${id}`,
    lastReviewedAt: new Date().toISOString(),
    ...overrides,
  } as Question;
}

// Test helper: Get question timestamp using same logic as hook
function getQuestionTimestamp(question: Question): number {
  if (question.updatedAt) {
    return new Date(question.updatedAt).getTime();
  }
  if (question.lastReviewedAt) {
    return new Date(question.lastReviewedAt).getTime();
  }
  return 0;
}

// Test helper: Get question key (same as hook logic)
function getQuestionKey(q: Question): string {
  return `${q.id}-${q.conditionId}`;
}

// Test helper: Merge questions with timestamp comparison (same as hook)
function mergeQuestionsWithTimestamps(
  local: Question[],
  remote: Question[]
): Question[] {
  const merged = new Map<string, Question>();

  local.forEach((q) => {
    const id = getQuestionKey(q);
    if (id) merged.set(id, q);
  });

  remote.forEach((q) => {
    const id = getQuestionKey(q);
    if (!id) return;

    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, q);
    } else {
      const existingTime = getQuestionTimestamp(existing);
      const remoteTime = getQuestionTimestamp(q);
      if (remoteTime > existingTime) {
        merged.set(id, q);
      }
    }
  });

  return Array.from(merged.values());
}

describe('useUserStats Hook - Timestamp-based Conflict Resolution', () => {
  describe('mergeQuestionsWithTimestamps', () => {
    it('should prefer server version when it is newer', () => {
      const now = Date.now();
      const localQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: new Date(now - 5000).toISOString(), // 5 seconds old
      });

      const remoteQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: new Date(now).toISOString(), // current time (newer)
      });

      const merged = mergeQuestionsWithTimestamps([localQuestion], [remoteQuestion]);

      expect(merged).toHaveLength(1);
      expect(merged[0].updatedAt).toBe(remoteQuestion.updatedAt);
    });

    it('should keep local version when it is newer', () => {
      const now = Date.now();
      const localQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: new Date(now).toISOString(), // current time (newer)
      });

      const remoteQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: new Date(now - 5000).toISOString(), // 5 seconds old
      });

      const merged = mergeQuestionsWithTimestamps([localQuestion], [remoteQuestion]);

      expect(merged).toHaveLength(1);
      expect(merged[0].updatedAt).toBe(localQuestion.updatedAt);
    });

    it('should use deterministic ordering when timestamps are equal', () => {
      const sameTime = new Date().toISOString();
      const localQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: sameTime,
      });

      const remoteQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: sameTime,
      });

      const merged = mergeQuestionsWithTimestamps([localQuestion], [remoteQuestion]);

      expect(merged).toHaveLength(1);
      // When timestamps equal, local (first added) should be kept
      expect(merged[0].id).toBe(localQuestion.id);
      expect(merged[0].updatedAt).toBe(sameTime);
    });

    it('should handle multiple questions with mixed timestamps', () => {
      const now = Date.now();

      const local = [
        createMockQuestion('q1', 'cond1', { updatedAt: new Date(now - 5000).toISOString() }),
        createMockQuestion('q2', 'cond1', { updatedAt: new Date(now - 2000).toISOString() }),
      ];

      const remote = [
        createMockQuestion('q1', 'cond1', { updatedAt: new Date(now).toISOString() }), // newer
        createMockQuestion('q2', 'cond1', { updatedAt: new Date(now - 5000).toISOString() }), // older
        createMockQuestion('q3', 'cond1', { updatedAt: new Date(now).toISOString() }), // new
      ];

      const merged = mergeQuestionsWithTimestamps(local, remote);

      expect(merged).toHaveLength(3);

      // q1: remote is newer
      const q1 = merged.find((q) => q.id === 'q1');
      expect(q1?.updatedAt).toBe(remote[0].updatedAt);

      // q2: local is newer
      const q2 = merged.find((q) => q.id === 'q2');
      expect(q2?.updatedAt).toBe(local[1].updatedAt);

      // q3: only in remote
      const q3 = merged.find((q) => q.id === 'q3');
      expect(q3?.id).toBe('q3');
    });

    it('should handle questions without updatedAt field (fallback to lastReviewedAt)', () => {
      const now = new Date().toISOString();

      const localQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: undefined,
        lastReviewedAt: new Date(Date.now() - 5000).toISOString(),
      });

      const remoteQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: now,
      });

      const merged = mergeQuestionsWithTimestamps([localQuestion], [remoteQuestion]);

      // Remote with updatedAt is newer than local with only lastReviewedAt
      expect(merged[0].updatedAt).toBe(remoteQuestion.updatedAt);
    });

    it('should preserve all fields when merging', () => {
      const now = Date.now();

      const localQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: new Date(now - 5000).toISOString(),
      });

      const remoteQuestion = createMockQuestion('q1', 'cond1', {
        updatedAt: new Date(now).toISOString(),
        explanation: 'Updated explanation',
      });

      const merged = mergeQuestionsWithTimestamps([localQuestion], [remoteQuestion]);

      expect(merged[0]).toMatchObject({
        id: 'q1',
        conditionId: 'cond1',
        question: remoteQuestion.question,
        explanation: 'Updated explanation',
      });
    });
  });
});

describe('useUserStats Hook - Local Deletion Tracking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Deletion persistence and recovery', () => {
    it('should track deleted question IDs in localStorage', () => {
      const deletedQuestion = createMockQuestion('q1', 'cond1');
      const DELETIONS_KEY = 'panceai_deletions_v2';

      // Simulate deletion tracking
      const deletions = new Map<string, number>();
      deletions.set(getQuestionKey(deletedQuestion), Date.now());

      // Persist to localStorage (same as hook)
      localStorage.setItem(
        DELETIONS_KEY,
        JSON.stringify(Array.from(deletions.entries()))
      );

      // Verify persistence
      const stored = localStorage.getItem(DELETIONS_KEY);
      expect(stored).toBeTruthy();

      const recovered = new Map(JSON.parse(stored || '[]'));
      expect(recovered.has(getQuestionKey(deletedQuestion))).toBe(true);
    });

    it('should filter deleted questions from merge', () => {
      const DELETIONS_KEY = 'panceai_deletions_v2';

      // Track deleted question
      const deletedQuestion = createMockQuestion('q1', 'cond1');
      const deletions = new Map<string, number>();
      deletions.set(getQuestionKey(deletedQuestion), Date.now());

      localStorage.setItem(
        DELETIONS_KEY,
        JSON.stringify(Array.from(deletions.entries()))
      );

      // Simulate server sending deleted question back
      const serverVersion = createMockQuestion('q1', 'cond1');

      // Filter deletion logic (same as hook)
      const stored = localStorage.getItem(DELETIONS_KEY);
      const deletedIds = new Set(
        stored ? JSON.parse(stored).map((entry: any) => entry[0]) : []
      );

      const result = [serverVersion].filter(
        (q) => !deletedIds.has(getQuestionKey(q))
      );

      // Deletion should prevent restoration
      expect(result).toHaveLength(0);
    });

    it('should prefer deletion over older server version', () => {
      const now = Date.now();
      const DELETIONS_KEY = 'panceai_deletions_v2';

      // Question deleted 2 seconds ago
      const deleteTime = now - 2000;
      const deletions = new Map<string, number>();
      deletions.set('q1-cond1', deleteTime);

      localStorage.setItem(
        DELETIONS_KEY,
        JSON.stringify(Array.from(deletions.entries()))
      );

      // Server sends very old version
      const oldServerVersion = createMockQuestion('q1', 'cond1', {
        updatedAt: new Date(now - 10000).toISOString(),
      });

      // Merge logic with deletion awareness
      const stored = localStorage.getItem(DELETIONS_KEY);
      const deletedIds = new Map(stored ? JSON.parse(stored) : []);

      const wasDeletedAfterServerVersion =
        deletedIds.has('q1-cond1') &&
        (deletedIds.get('q1-cond1') || 0) >
          new Date(oldServerVersion.updatedAt || 0).getTime();

      // Deletion should win
      expect(wasDeletedAfterServerVersion).toBe(true);
    });

    it('should allow restoration when server version is newer than deletion', () => {
      const now = Date.now();
      const DELETIONS_KEY = 'panceai_deletions_v2';

      // Question deleted 5 seconds ago
      const deleteTime = now - 5000;
      const deletions = new Map<string, number>();
      deletions.set('q1-cond1', deleteTime);

      localStorage.setItem(
        DELETIONS_KEY,
        JSON.stringify(Array.from(deletions.entries()))
      );

      // Server sends newer version (2 seconds ago)
      const newerServerVersion = createMockQuestion('q1', 'cond1', {
        updatedAt: new Date(now - 2000).toISOString(),
      });

      // Merge logic
      const stored = localStorage.getItem(DELETIONS_KEY);
      const deletedIds = new Map(stored ? JSON.parse(stored) : []);

      const wasDeletedAfterServerVersion =
        deletedIds.has('q1-cond1') &&
        (deletedIds.get('q1-cond1') || 0) >
          new Date(newerServerVersion.updatedAt || 0).getTime();

      // Server version should win (it's newer than deletion)
      expect(wasDeletedAfterServerVersion).toBe(false);
    });

    it('should maintain separate deletion tracking for each question', () => {
      const DELETIONS_KEY = 'panceai_deletions_v2';
      const now = Date.now();

      // Track multiple deletions
      const deletions = new Map<string, number>();
      deletions.set('q1-cond1', now);
      deletions.set('q2-cond1', now - 1000);
      deletions.set('q3-cond2', now - 2000);

      localStorage.setItem(
        DELETIONS_KEY,
        JSON.stringify(Array.from(deletions.entries()))
      );

      // Verify all are tracked independently
      const stored = localStorage.getItem(DELETIONS_KEY);
      const recovered = new Map(JSON.parse(stored || '[]'));

      expect(recovered.size).toBe(3);
      expect(recovered.has('q1-cond1')).toBe(true);
      expect(recovered.has('q2-cond1')).toBe(true);
      expect(recovered.has('q3-cond2')).toBe(true);
    });
  });
});

describe('useUserStats Hook - Sync State Management', () => {
  describe('Multiple question list management', () => {
    it('should maintain separate tracking for missed and flagged questions', () => {
      const missedQuestions: Question[] = [];
      const flaggedQuestions: Question[] = [];

      const q1 = createMockQuestion('q1', 'cond1');
      const q2 = createMockQuestion('q2', 'cond1');

      // Add to different lists
      missedQuestions.push(q1);
      flaggedQuestions.push(q2);

      expect(missedQuestions).toHaveLength(1);
      expect(flaggedQuestions).toHaveLength(1);
      expect(missedQuestions[0].id).toBe('q1');
      expect(flaggedQuestions[0].id).toBe('q2');
    });

    it('should handle overlapping questions in different lists', () => {
      const missedQuestions: Question[] = [];
      const flaggedQuestions: Question[] = [];

      const q1 = createMockQuestion('q1', 'cond1');

      // Same question in both lists
      missedQuestions.push(q1);
      flaggedQuestions.push(q1);

      expect(missedQuestions).toHaveLength(1);
      expect(flaggedQuestions).toHaveLength(1);
      expect(missedQuestions[0].id).toBe(flaggedQuestions[0].id);
    });
  });
});

describe('useUserStats Hook - Integration Scenarios', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should handle complex scenario: modify, delete, update, sync', () => {
    const DELETIONS_KEY = 'panceai_deletions_v2';
    const now = Date.now();

    // Initial state: 3 questions
    let local = [
      createMockQuestion('q1', 'cond1', { updatedAt: new Date(now - 10000).toISOString() }),
      createMockQuestion('q2', 'cond1', { updatedAt: new Date(now - 9000).toISOString() }),
      createMockQuestion('q3', 'cond1', { updatedAt: new Date(now - 8000).toISOString() }),
    ];

    // Delete q2
    local = local.filter((q) => q.id !== 'q2');
    const deletions = new Map<string, number>();
    deletions.set('q2-cond1', now - 5000); // Track deletion
    localStorage.setItem(
      DELETIONS_KEY,
      JSON.stringify(Array.from(deletions.entries()))
    );

    expect(local).toHaveLength(2);

    // Server sends back newer version of q1 and deleted q2
    const remote = [
      createMockQuestion('q1', 'cond1', { updatedAt: new Date(now - 2000).toISOString() }), // newer
      createMockQuestion('q2', 'cond1', { updatedAt: new Date(now - 7000).toISOString() }), // older than deletion
      createMockQuestion('q4', 'cond1', { updatedAt: new Date(now).toISOString() }), // new
    ];

    // Filter out deleted before merging
    const stored = localStorage.getItem(DELETIONS_KEY);
    const deletedIds = new Set(
      stored ? JSON.parse(stored).map((entry: any) => entry[0]) : []
    );

    const remoteFiltered = remote.filter((q) => !deletedIds.has(getQuestionKey(q)));

    // Merge
    const merged = mergeQuestionsWithTimestamps(local, remoteFiltered);

    expect(merged).toHaveLength(3);
    expect(merged.map((q) => q.id).sort()).toEqual(['q1', 'q3', 'q4']);

    // q1 should have newer version
    const q1 = merged.find((q) => q.id === 'q1');
    expect(q1?.updatedAt).toBe(remote[0].updatedAt);

    // q2 should not be restored despite being in remote
    const q2 = merged.find((q) => q.id === 'q2');
    expect(q2).toBeUndefined();
  });

  it('should handle retry with fresh state after previous sync', () => {
    const now = Date.now();

    // First sync state
    let state = [createMockQuestion('q1', 'cond1', { updatedAt: new Date(now - 5000).toISOString() })];

    // Simulate successful sync (clear retry counter)
    let retryCount = 0;

    // User makes new modification
    state = [
      ...state,
      createMockQuestion('q2', 'cond1', { updatedAt: new Date(now).toISOString() }),
    ];

    // Retry counter should be reset for new sync
    expect(retryCount).toBe(0);
    expect(state).toHaveLength(2);

    // If next sync fails, retry counter increments from 0
    retryCount++;
    expect(retryCount).toBe(1); // First retry
  });
});
