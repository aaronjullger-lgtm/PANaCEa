// SAFE-OVERRIDE: Writing test file for secondChanceEngine
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDetectRecognitionRisk, mockQuickRecognitionCheck, mockGetLearningTargetWeight, mockInferTaskType } = vi.hoisted(() => ({
  mockDetectRecognitionRisk: vi.fn().mockResolvedValue({ riskScore: 0, shouldForceVariant: false }),
  mockQuickRecognitionCheck: vi.fn().mockResolvedValue(false),
  mockGetLearningTargetWeight: vi.fn().mockReturnValue(0.1),
  mockInferTaskType: vi.fn((_text: string) => 'diagnosis'),
}));

vi.mock('../lib/services/recognitionRiskDetector', () => ({
  detectRecognitionRisk: mockDetectRecognitionRisk,
  quickRecognitionCheck: mockQuickRecognitionCheck,
}));

vi.mock('../lib/services/blueprintMappingService', () => ({
  getLearningTargetWeight: mockGetLearningTargetWeight,
}));

vi.mock('@/lib/taskTypes', () => ({
  inferTaskType: mockInferTaskType,
  TASK_TYPES: { DIAGNOSIS: 'diagnosis', TREATMENT: 'treatment', MECHANISM: 'mechanism', WORKUP: 'workup', PREVENTION: 'prevention', PROGNOSIS: 'prognosis', COMPLICATION: 'complication', CLINICAL_PEARL: 'clinical_pearl' },
}));

import {
  resolveLearningTarget,
  selectSecondChanceQuestion,
  mapQuestionToLearningTarget,
  fetchSubdomainDueReviews,
  buildSecondChanceReviewSet,
  type LearningTarget,
} from '../lib/services/secondChanceEngine';

beforeEach(() => {
  vi.clearAllMocks();
  mockDetectRecognitionRisk.mockResolvedValue({ riskScore: 0, shouldForceVariant: false });
  mockGetLearningTargetWeight.mockReturnValue(0.1);
  mockInferTaskType.mockReturnValue('diagnosis');
});

function makeMockPrisma(o: Record<string, any> = {}): any {
  return {
    userTopicProgress: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    condition: { findUnique: vi.fn().mockResolvedValue({ system: 'Cardiovascular' }), findMany: vi.fn().mockResolvedValue([]) },
    question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([]) },
    ...o,
  };
}

describe('secondChanceEngine', () => {
  describe('resolveLearningTarget', () => {
    it('returns null when no topic progress exists', async () => {
      const p = makeMockPrisma({ userTopicProgress: { findMany: vi.fn().mockResolvedValue([]) } });
      expect(await resolveLearningTarget(p, 'user-1', 'cond-1')).toBeNull();
    });

    it('returns the weakest subdomain based on scoring', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue([
          { taskType: 'diagnosis', stability: 5.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() + 86400_000) },
          { taskType: 'treatment', stability: 1.0, difficulty: 8.0, lapses: 5, nextReviewDate: new Date(Date.now() - 86400_000) },
          { taskType: 'mechanism', stability: 3.0, difficulty: 6.0, lapses: 2, nextReviewDate: new Date(Date.now() + 86400_000) },
        ]) },
      });
      const result = await resolveLearningTarget(p, 'user-1', 'cond-1');
      expect(result).not.toBeNull();
      expect(result!.weakestTaskType).toBe('treatment');
      expect(result!.allSubdomains).toHaveLength(3);
    });

    it('handles overdue items (lower score = weaker)', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue([
          { taskType: 'diagnosis', stability: 2.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() + 86400_000) },
          { taskType: 'treatment', stability: 2.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
        ]) },
      });
      expect((await resolveLearningTarget(p, 'user-1', 'cond-1'))!.weakestTaskType).toBe('treatment');
    });

    it('handles null stability with default 1.0', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue([
          { taskType: 'diagnosis', stability: null, difficulty: null, lapses: null, nextReviewDate: null },
        ]) },
      });
      const result = await resolveLearningTarget(p, 'user-1', 'cond-1');
      expect(result).not.toBeNull();
      expect(result!.weakestTaskType).toBe('diagnosis');
    });

    it('returns correct conditionId', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue([
          { taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: null },
        ]) },
      });
      expect((await resolveLearningTarget(p, 'user-1', 'cond-abc'))!.conditionId).toBe('cond-abc');
    });
  });

  describe('selectSecondChanceQuestion', () => {
    it('returns null when no questions exist at all', async () => {
      expect(await selectSecondChanceQuestion(makeMockPrisma(), 'user-1', 'cond-1', 'diagnosis')).toBeNull();
    });

    it('selects canonical fallback when no variants or candidates', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findUnique: vi.fn().mockResolvedValue(null) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([]) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue({ id: 'q-canonical' }) },
      });
      const result = await selectSecondChanceQuestion(p, 'user-1', 'cond-1', 'diagnosis');
      expect(result!.questionId).toBe('q-canonical');
      expect(result!.selectionMethod).toBe('canonical_fallback');
      expect(result!.isVariant).toBe(false);
    });

    it('returns null when no questions at all', async () => {
      const p = makeMockPrisma({
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      });
      expect(await selectSecondChanceQuestion(p, 'user-1', 'cond-1', 'diagnosis')).toBeNull();
    });

    it('uses PreGeneratedQuestion sibling when available', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findUnique: vi.fn().mockResolvedValue(null) },
        condition: { findUnique: vi.fn().mockResolvedValue({ system: 'CV' }) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([{ id: 'pg-1', questionData: { taskType: 'diagnosis' } }]) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      });
      const result = await selectSecondChanceQuestion(p, 'user-1', 'cond-1', 'diagnosis');
      expect(result!.questionId).toBe('pg-1');
      expect(result!.selectionMethod).toBe('unused_variant');
      expect(result!.isVariant).toBe(true);
    });

    it('respects excludeQuestionIds', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findUnique: vi.fn().mockResolvedValue(null) },
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((args: any) => {
          const excluded = args?.where?.id?.notIn ?? [];
          if (excluded.includes('pg-1')) return Promise.resolve([]);
          return Promise.resolve([{ id: 'pg-1', questionData: { taskType: 'diagnosis' } }]);
        }) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue({ id: 'q-canonical' }) },
      });
      const result = await selectSecondChanceQuestion(p, 'user-1', 'cond-1', 'diagnosis', new Set(['pg-1']));
      expect(result!.questionId).toBe('q-canonical');
      expect(result!.selectionMethod).toBe('canonical_fallback');
    });

    it('builds learning target with correct metadata', async () => {
      const now = new Date();
      const p = makeMockPrisma({
        userTopicProgress: { findUnique: vi.fn().mockResolvedValue({
          stability: 2.5, difficulty: 7.0, lapses: 3,
          nextReviewDate: new Date(now.getTime() - 86400_000), variantsUsed: [],
        }) },
        condition: { findUnique: vi.fn().mockResolvedValue({ system: 'Pulmonary' }) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([{ id: 'pg-1', questionData: { taskType: 'treatment' } }]) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      });
      const result = await selectSecondChanceQuestion(p, 'user-1', 'cond-1', 'treatment');
      expect(result!.learningTarget.stability).toBe(2.5);
      expect(result!.learningTarget.difficulty).toBe(7.0);
      expect(result!.learningTarget.lapses).toBe(3);
      expect(result!.learningTarget.isOverdue).toBe(true);
      expect(result!.learningTarget.system).toBe('Pulmonary');
    });

    it('uses defaults when topic progress is null', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findUnique: vi.fn().mockResolvedValue(null) },
        condition: { findUnique: vi.fn().mockResolvedValue(null) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([{ id: 'pg-1', questionData: { taskType: 'diagnosis' } }]) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      });
      const result = await selectSecondChanceQuestion(p, 'user-1', 'cond-1', 'diagnosis');
      expect(result!.learningTarget.stability).toBe(1.0);
      expect(result!.learningTarget.difficulty).toBe(5.0);
      expect(result!.learningTarget.lapses).toBe(0);
      expect(result!.learningTarget.system).toBe('General');
    });
  });

  describe('mapQuestionToLearningTarget', () => {
    it('returns null when conditionId is null', () => {
      expect(mapQuestionToLearningTarget({ conditionId: null })).toBeNull();
    });

    it('returns null when conditionId is empty string', () => {
      expect(mapQuestionToLearningTarget({ conditionId: '' })).toBeNull();
    });

    it('uses explicit taskType when provided', () => {
      const result = mapQuestionToLearningTarget({ conditionId: 'cond-1', taskType: 'treatment' });
      expect(result).toEqual({ conditionId: 'cond-1', taskType: 'treatment' });
    });

    it('reverse-maps taskCategory to taskType', () => {
      expect(mapQuestionToLearningTarget({ conditionId: 'cond-1', taskCategory: 'pharmaceutical' })!.taskType).toBe('treatment');
    });

    it('reverse-maps diagnostic_lab taskCategory', () => {
      expect(mapQuestionToLearningTarget({ conditionId: 'cond-1', taskCategory: 'diagnostic_lab' })!.taskType).toBe('workup');
    });

    it('reverse-maps history_physical taskCategory', () => {
      expect(mapQuestionToLearningTarget({ conditionId: 'cond-1', taskCategory: 'history_physical' })!.taskType).toBe('diagnosis');
    });

    it('falls back to DEFAULT_TASK_TYPE for unknown taskCategory', () => {
      expect(mapQuestionToLearningTarget({ conditionId: 'cond-1', taskCategory: 'unknown_category' })!.taskType).toBe('diagnosis');
    });

    it('infers from stem text when no taskType or taskCategory', () => {
      const result = mapQuestionToLearningTarget({ conditionId: 'cond-1', stem: 'What is the most likely diagnosis?' });
      expect(result!.conditionId).toBe('cond-1');
      expect(typeof result!.taskType).toBe('string');
    });

    it('infers from question text', () => {
      expect(mapQuestionToLearningTarget({ conditionId: 'cond-1', question: 'What treatment is indicated?' })!.conditionId).toBe('cond-1');
    });

    it('uses text field as fallback', () => {
      expect(mapQuestionToLearningTarget({ conditionId: 'cond-1', text: 'Some question text' })!.conditionId).toBe('cond-1');
    });

    it('defaults to diagnosis when no text and no task info', () => {
      expect(mapQuestionToLearningTarget({ conditionId: 'cond-1' })!.taskType).toBe('diagnosis');
    });
  });

  describe('fetchSubdomainDueReviews', () => {
    it('returns empty array when no due topics', async () => {
      const p = makeMockPrisma({ userTopicProgress: { findMany: vi.fn().mockResolvedValue([]) } });
      expect(await fetchSubdomainDueReviews(p, 'user-1')).toEqual([]);
    });

    it('returns learning targets sorted by priority', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue([
          { conditionId: 'c1', taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
          { conditionId: 'c2', taskType: 'treatment', stability: 5.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
        ]) },
        condition: { findMany: vi.fn().mockResolvedValue([{ id: 'c1', system: 'Cardiovascular' }, { id: 'c2', system: 'Pulmonary' }]) },
      });
      const result = await fetchSubdomainDueReviews(p, 'user-1');
      expect(result).toHaveLength(2);
      expect(result[0].conditionId).toBe('c1');
    });

    it('filters by conditionId when scopeFilter provided', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockImplementation((args: any) =>
          args.where.conditionId === 'c1'
            ? Promise.resolve([{ conditionId: 'c1', taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) }])
            : Promise.resolve([])
        ) },
        condition: { findMany: vi.fn().mockResolvedValue([{ id: 'c1', system: 'CV' }]) },
      });
      const result = await fetchSubdomainDueReviews(p, 'user-1', 50, 'PANCE', { conditionId: 'c1' });
      expect(result).toHaveLength(1);
      expect(result[0].conditionId).toBe('c1');
    });

    it('respects limit parameter', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 100 }, (_, i) => ({ conditionId: 'c' + i, taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) }))
        ) },
        condition: { findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 100 }, (_, i) => ({ id: 'c' + i, system: 'CV' }))
        ) },
      });
      expect((await fetchSubdomainDueReviews(p, 'user-1', 5)).length).toBeLessThanOrEqual(5);
    });

    it('handles null stability/difficulty/lapses with defaults', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue([
          { conditionId: 'c1', taskType: 'diagnosis', stability: null, difficulty: null, lapses: null, nextReviewDate: new Date(Date.now() - 86400_000) },
        ]) },
        condition: { findMany: vi.fn().mockResolvedValue([{ id: 'c1', system: 'CV' }]) },
      });
      const result = await fetchSubdomainDueReviews(p, 'user-1');
      expect(result[0].stability).toBe(1.0);
      expect(result[0].difficulty).toBe(5.0);
      expect(result[0].lapses).toBe(0);
    });

    it('uses General system when condition not found', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue([
          { conditionId: 'c-unknown', taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
        ]) },
        condition: { findMany: vi.fn().mockResolvedValue([]) },
      });
      expect((await fetchSubdomainDueReviews(p, 'user-1'))[0].system).toBe('General');
    });

    it('filters by system when scopeFilter has system', async () => {
      const p = makeMockPrisma({
        userTopicProgress: { findMany: vi.fn().mockResolvedValue([
          { conditionId: 'c1', taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
          { conditionId: 'c2', taskType: 'treatment', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
        ]) },
        condition: { findMany: vi.fn().mockResolvedValue([{ id: 'c1', system: 'Cardiovascular' }, { id: 'c2', system: 'Pulmonary' }]) },
      });
      const result = await fetchSubdomainDueReviews(p, 'user-1', 50, 'PANCE', { system: 'Cardiovascular' });
      expect(result).toHaveLength(1);
      expect(result[0].conditionId).toBe('c1');
    });
  });

  describe('buildSecondChanceReviewSet', () => {
    it('returns empty array when no due targets', async () => {
      expect(await buildSecondChanceReviewSet(makeMockPrisma({ userTopicProgress: { findMany: vi.fn().mockResolvedValue([]) } }), 'user-1', 5)).toEqual([]);
    });

    it('builds review set with correct count', async () => {
      const p = makeMockPrisma({
        userTopicProgress: {
          findMany: vi.fn().mockResolvedValue([
            { conditionId: 'c1', taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
            { conditionId: 'c2', taskType: 'treatment', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
          ]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        condition: { findUnique: vi.fn().mockResolvedValue({ system: 'CV' }), findMany: vi.fn().mockResolvedValue([{ id: 'c1', system: 'CV' }, { id: 'c2', system: 'Pulm' }]) },
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((a: any) => {
          const cid = a.where?.conditionId;
          return cid ? Promise.resolve([{ id: 'pg-' + cid, questionData: { taskType: 'diagnosis' } }]) : Promise.resolve([]);
        }) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      });
      expect((await buildSecondChanceReviewSet(p, 'user-1', 2)).length).toBe(2);
    });

    it('respects count limit', async () => {
      const p = makeMockPrisma({
        userTopicProgress: {
          findMany: vi.fn().mockResolvedValue([
            { conditionId: 'c1', taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
            { conditionId: 'c2', taskType: 'treatment', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
            { conditionId: 'c3', taskType: 'mechanism', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
          ]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        condition: { findUnique: vi.fn().mockResolvedValue({ system: 'CV' }), findMany: vi.fn().mockResolvedValue([{ id: 'c1', system: 'CV' }, { id: 'c2', system: 'Pulm' }, { id: 'c3', system: 'GI' }]) },
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((a: any) => {
          const cid = a.where?.conditionId;
          return cid ? Promise.resolve([{ id: 'pg-' + cid, questionData: { taskType: 'diagnosis' } }]) : Promise.resolve([]);
        }) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      });
      expect((await buildSecondChanceReviewSet(p, 'user-1', 2)).length).toBeLessThanOrEqual(2);
    });

    it('skips targets where no question is found', async () => {
      const p = makeMockPrisma({
        userTopicProgress: {
          findMany: vi.fn().mockResolvedValue([
            { conditionId: 'c-empty', taskType: 'diagnosis', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
            { conditionId: 'c-has-q', taskType: 'treatment', stability: 1.0, difficulty: 5.0, lapses: 0, nextReviewDate: new Date(Date.now() - 86400_000) },
          ]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        condition: { findUnique: vi.fn().mockResolvedValue({ system: 'CV' }), findMany: vi.fn().mockResolvedValue([{ id: 'c-empty', system: 'CV' }, { id: 'c-has-q', system: 'Pulm' }]) },
        preGeneratedQuestion: { findMany: vi.fn().mockImplementation((a: any) =>
          a.where?.conditionId === 'c-has-q' ? Promise.resolve([{ id: 'pg-found', questionData: { taskType: 'treatment' } }]) : Promise.resolve([])
        ) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockImplementation((a: any) =>
          a.where?.conditionId === 'c-has-q' ? Promise.resolve({ id: 'q-canonical' }) : Promise.resolve(null)
        ) },
      });
      const result = await buildSecondChanceReviewSet(p, 'user-1', 5);
      expect(result.length).toBeLessThanOrEqual(2);
      expect(result.every((s: any) => s.questionId !== undefined)).toBe(true);
    });

    it('applies priorityScore from due targets', async () => {
      const p = makeMockPrisma({
        userTopicProgress: {
          findMany: vi.fn().mockResolvedValue([
            { conditionId: 'c1', taskType: 'diagnosis', stability: 0.5, difficulty: 8.0, lapses: 5, nextReviewDate: new Date(Date.now() - 86400_000) },
          ]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        condition: { findUnique: vi.fn().mockResolvedValue({ system: 'Cardiovascular' }), findMany: vi.fn().mockResolvedValue([{ id: 'c1', system: 'Cardiovascular' }]) },
        preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([{ id: 'pg-1', questionData: { taskType: 'diagnosis' } }]) },
        question: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      });
      const result = await buildSecondChanceReviewSet(p, 'user-1', 1);
      expect(result[0].learningTarget.priorityScore).toBeGreaterThan(0);
    });
  });

  describe('type exports', () => {
    it('LearningTarget interface has required fields', () => {
      const target: LearningTarget = {
        conditionId: 'c1', taskType: 'diagnosis', system: 'CV',
        stability: 1.0, difficulty: 5.0, lapses: 0,
        isOverdue: false, priorityScore: 0.5,
      };
      expect(target.conditionId).toBe('c1');
      expect(target.isOverdue).toBe(false);
    });
  });
});
