/**
 * Tests for banditRerankQuestions in conceptQuestionSelector
 *
 * Tests the pure bandit reranking integration — no database.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  banditRerankQuestions,
  selectSessionQuestions,
  type SelectedQuestion,
} from '../lib/services/conceptQuestionSelector';
import { initBanditState, updateBanditState, type BanditState, type BanditReward } from '../lib/services/contextualBanditService';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<SelectedQuestion> & { source: 'due_review' | 'new_card' }): SelectedQuestion & { source: 'due_review' | 'new_card' } {
  return {
    id: 'q-001',
    question: 'Test question',
    vignette: null,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    correctAnswerIndex: 0,
    explanation: null,
    system: 'Cardiovascular',
    category: null,
    topic: 'Heart Failure',
    difficulty: '3',
    conditionId: 'cond-001',
    ...overrides,
  };
}

function buildTrainedState(): BanditState {
  // Train bandit with some reward signals so it has non-trivial params
  let state = initBanditState();
  const systems = ['Cardiovascular', 'Pulmonary', 'Neurology'];
  for (const system of systems) {
    for (let i = 0; i < 15; i++) {
      const reward: BanditReward = {
        questionId: `q-${system}-${i}`,
        system,
        context: {
          topicMastery: 0.4 + Math.random() * 0.3,
          overdueRatio: Math.random(),
          difficulty: 0.5,
          systemWeakness: system === 'Cardiovascular' ? 0.8 : 0.3,
          blueprintWeight: 0.10,
          timeSinceLastReview: 0.3,
          sessionPosition: i / 15,
        },
        correct: system === 'Cardiovascular' ? 0 : 1, // CV is weak
      };
      state = updateBanditState(state, reward);
    }
  }
  return state;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('banditRerankQuestions', () => {
  it('returns questions unchanged when no bandit state', () => {
    const questions = [
      makeQuestion({ id: 'q1', source: 'due_review' }),
      makeQuestion({ id: 'q2', source: 'new_card' }),
    ];

    const result = banditRerankQuestions(questions, {
      blueprintWeights: { Cardiovascular: 0.15 },
      size: 20,
    });

    expect(result.map(q => q.id)).toEqual(['q1', 'q2']);
  });

  it('returns single question unchanged', () => {
    const questions = [makeQuestion({ id: 'q1', source: 'due_review' })];
    const result = banditRerankQuestions(questions, {
      banditState: initBanditState(),
      blueprintWeights: { Cardiovascular: 0.15 },
      size: 20,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('q1');
  });

  it('reranks questions with trained bandit state', () => {
    const state = buildTrainedState();
    const questions = [
      makeQuestion({ id: 'q-cv', system: 'Cardiovascular', source: 'new_card', difficulty: '3' }),
      makeQuestion({ id: 'q-pulm', system: 'Pulmonary', source: 'new_card', difficulty: '3' }),
      makeQuestion({ id: 'q-neuro', system: 'Neurology', source: 'due_review', difficulty: '3' }),
    ];

    const result = banditRerankQuestions(questions, {
      banditState: state,
      blueprintWeights: { Cardiovascular: 0.15, Pulmonary: 0.10, Neurology: 0.10 },
      systemWeaknesses: { Cardiovascular: 0.8, Pulmonary: 0.3, Neurology: 0.3 },
      size: 20,
    });

    // Should have all 3 questions
    expect(result).toHaveLength(3);
    const ids = new Set(result.map(q => q.id));
    expect(ids.has('q-cv')).toBe(true);
    expect(ids.has('q-pulm')).toBe(true);
    expect(ids.has('q-neuro')).toBe(true);
  });

  it('preserves source labels after reranking', () => {
    const state = buildTrainedState();
    const questions = [
      makeQuestion({ id: 'q1', source: 'due_review' }),
      makeQuestion({ id: 'q2', source: 'new_card', system: 'Pulmonary' }),
    ];

    const result = banditRerankQuestions(questions, {
      banditState: state,
      blueprintWeights: { Cardiovascular: 0.15, Pulmonary: 0.10 },
      size: 20,
    });

    const q1Result = result.find(q => q.id === 'q1');
    const q2Result = result.find(q => q.id === 'q2');
    expect(q1Result?.source).toBe('due_review');
    expect(q2Result?.source).toBe('new_card');
  });

  it('uses topicMasteryMap for bandit context', () => {
    const state = buildTrainedState();
    const questions = [
      makeQuestion({ id: 'q1', conditionId: 'cond-known', source: 'due_review' }),
      makeQuestion({ id: 'q2', conditionId: 'cond-unknown', source: 'new_card' }),
    ];

    // Should not throw and should return all questions
    const result = banditRerankQuestions(questions, {
      banditState: state,
      blueprintWeights: { Cardiovascular: 0.15 },
      topicMasteryMap: { 'cond-known': 0.9, 'cond-unknown': 0.1 },
      size: 20,
    });

    expect(result).toHaveLength(2);
  });
});

describe('selectSessionQuestions serving safety', () => {
  it('adds active approved filters to scoped new-card queries', async () => {
    const prisma: any = {
      userProgress: { findMany: vi.fn().mockResolvedValue([]) },
      questionAttempt: { findMany: vi.fn().mockResolvedValue([]) },
      medicalContent: { findMany: vi.fn().mockResolvedValue([]) },
      question: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'q-safe',
            question: 'Q?',
            vignette: null,
            options: ['A', 'B'],
            correctAnswer: 'A',
            explanation: 'Because A.',
            system: 'Pulmonary',
            category: null,
            topic: 'Pneumonia',
            difficulty: 'medium',
            conditionId: 'cond-1',
            medicalContentId: 'mc-1',
          },
        ]),
      },
    };

    await selectSessionQuestions(prisma, {
      userId: 'user-1',
      mode: 'system',
      size: 5,
      blueprintWeights: { Pulmonary: 1 },
      system: 'Pulmonary',
      blueprintStage: 'pance_prep' as any,
      urgencyMultiplier: 1,
    });

    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          system: 'Pulmonary',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
  });

  it('adds active approved filters when hydrating due review questions', async () => {
    const prisma: any = {
      userProgress: {
        findMany: vi.fn().mockResolvedValue([
          {
            conditionId: 'cond-1',
            system: 'Pulmonary',
            fsrsStability: 2,
            nextReviewAt: new Date(Date.now() - 86_400_000),
          },
        ]),
      },
      questionAttempt: { findMany: vi.fn().mockResolvedValue([]) },
      medicalContent: { findMany: vi.fn().mockResolvedValue([]) },
      question: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'q-review',
            question: 'Q?',
            vignette: null,
            options: ['A', 'B'],
            correctAnswer: 'A',
            explanation: 'Because A.',
            system: 'Pulmonary',
            category: null,
            topic: 'Pneumonia',
            difficulty: 'medium',
            conditionId: 'cond-1',
            medicalContentId: null,
          },
        ]),
      },
      userQuestionSeen: { groupBy: vi.fn().mockResolvedValue([]) },
    };

    await selectSessionQuestions(prisma, {
      userId: 'user-1',
      mode: 'review',
      size: 5,
      blueprintWeights: { Pulmonary: 1 },
      blueprintStage: 'pance_prep' as any,
      urgencyMultiplier: 1,
    });

    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conditionId: { in: ['cond-1'] },
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
  });

  it('maps UserProgress MedicalContent ids to condition-scoped question pools', async () => {
    const prisma: any = {
      userProgress: {
        findMany: vi.fn().mockResolvedValue([
          {
            conditionId: 'mc-1',
            system: 'Pulmonary',
            fsrsStability: 2,
            nextReviewAt: new Date(Date.now() - 86_400_000),
          },
        ]),
      },
      questionAttempt: { findMany: vi.fn().mockResolvedValue([]) },
      medicalContent: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'mc-1', conditionId: 'cond-1' },
        ]),
      },
      question: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'q-review',
            question: 'Q?',
            vignette: null,
            options: ['A', 'B'],
            correctAnswer: 'A',
            explanation: 'Because A.',
            system: 'Pulmonary',
            category: null,
            topic: 'Pneumonia',
            difficulty: 'medium',
            conditionId: 'cond-1',
            medicalContentId: null,
          },
        ]),
      },
      preGeneratedQuestion: { findMany: vi.fn().mockResolvedValue([]) },
      userQuestionSeen: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    };

    const result = await selectSessionQuestions(prisma, {
      userId: 'user-1',
      mode: 'review',
      size: 5,
      blueprintWeights: { Pulmonary: 1 },
      blueprintStage: 'pance_prep' as any,
      urgencyMultiplier: 1,
    });

    expect(prisma.question.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { conditionId: { in: ['cond-1'] } },
            { medicalContentId: { in: ['mc-1'] } },
          ]),
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(result.questions[0]).toEqual(
      expect.objectContaining({
        id: 'q-review',
        conditionId: 'cond-1',
      })
    );
  });
});
