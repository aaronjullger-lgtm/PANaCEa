import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QuestionProgress } from '@prisma/client';
import { calculatePriorityScore } from '../lib/adaptiveQueue.js';
import { ProgressModel, QuestionWithProgress } from '../lib/progressModel.js';
import { QuestionEngine } from '../lib/questionEngine.js';

class InMemoryProgressModel implements ProgressModel {
  constructor(private readonly questions: QuestionWithProgress[]) {}

  async getQuestionsWithProgress(_userId: string): Promise<QuestionWithProgress[]> {
    return this.questions;
  }

  async upsertProgress(
    userId: string,
    questionId: string,
    updates: Partial<QuestionProgress>,
  ): Promise<QuestionProgress> {
    const target = this.questions.find((q) => q.id === questionId);
    if (!target) throw new Error('Question not found');
    target.progress = {
      id: target.progress?.id ?? 'progress-' + questionId,
      userId,
      questionId,
      attempts: updates?.attempts ?? target.progress?.attempts ?? 0,
      correct: updates?.correct ?? target.progress?.correct ?? 0,
      streak: updates?.streak ?? target.progress?.streak ?? 0,
      weight: updates?.weight ?? target.progress?.weight ?? 1,
      nextReview: updates?.nextReview ?? target.progress?.nextReview ?? null,
      lastAnswered: updates?.lastAnswered ?? target.progress?.lastAnswered ?? null,
    };
    return target.progress;
  }

  async updateQuestionDifficulty(questionId: string, difficulty: number) {
    const target = this.questions.find((q) => q.id === questionId);
    if (!target) throw new Error('Question not found');
    target.difficulty = difficulty;
    return target;
  }

  async upsertQueueEntry(userId: string, questionId: string, priorityScore: number) {
    return {
      id: 'queue',
      userId,
      questionId,
      priorityScore,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

test('calculatePriorityScore favors lower accuracy and streak', () => {
  const question = { id: 'q1', conditionId: 'c1', text: 'text', difficulty: 0.5 } as QuestionWithProgress;
  const score = calculatePriorityScore({ question });
  assert.equal(score, 0.9);
});

test('QuestionEngine returns the highest priority due question', async () => {
  const now = new Date('2024-01-01T00:00:00Z');
  const questions: QuestionWithProgress[] = [
    {
      id: 'question-1',
      conditionId: 'cond-1',
      text: 'Q1',
      difficulty: 0.2,
      progress: {
        id: 'p1',
        userId: 'user-1',
        questionId: 'question-1',
        attempts: 5,
        correct: 4,
        streak: 3,
        weight: 1,
        nextReview: now,
        lastAnswered: now,
      },
    },
    {
      id: 'question-2',
      conditionId: 'cond-1',
      text: 'Q2',
      difficulty: 0.8,
      progress: {
        id: 'p2',
        userId: 'user-1',
        questionId: 'question-2',
        attempts: 1,
        correct: 0,
        streak: 0,
        weight: 1,
        nextReview: now,
        lastAnswered: now,
      },
    },
  ];

  const engine = new QuestionEngine({
    progressModel: new InMemoryProgressModel(questions),
    now: () => now,
  });

  const selected = await engine.getNextQuestion('user-1');
  assert.ok(selected);
  assert.equal(selected?.question.id, 'question-2');
});

test('submitAnswer updates streak, difficulty, and weight', async () => {
  const now = new Date('2024-01-01T00:00:00Z');
  const questions: QuestionWithProgress[] = [
    {
      id: 'question-1',
      conditionId: 'cond-1',
      text: 'Q1',
      difficulty: 0.5,
      progress: undefined,
    },
  ];

  const progressModel = new InMemoryProgressModel(questions);
  const engine = new QuestionEngine({ progressModel, now: () => now });

  const result = await engine.submitAnswer('user-1', 'question-1', true);
  assert.equal(result.attempts, 1);
  assert.equal(result.correct, 1);
  assert.equal(result.streak, 1);
  assert.ok(result.nextReview);
  assert.equal(questions[0].difficulty, 0.45);
  assert.equal(result.weight, calculatePriorityScore({
    question: questions[0],
    progress: result,
  }));
});
