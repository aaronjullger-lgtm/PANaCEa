import { describe, expect, it } from 'vitest';
import {
  getServerQuestionId,
  getStableQuestionId,
  normalizeStudyQuestion,
  resolveCorrectAnswerIndex,
} from '@/lib/study/questionIdentity';

describe('questionIdentity', () => {
  it('derives correct answer indexes from letters and option text', () => {
    expect(
      resolveCorrectAnswerIndex({
        options: ['Alpha', 'Beta', 'Gamma'],
        correctAnswer: 'B',
      })
    ).toBe(1);

    expect(
      resolveCorrectAnswerIndex({
        options: ['Alpha', 'Beta', 'Gamma'],
        correctAnswer: 'Gamma',
      })
    ).toBe(2);
  });

  it('creates deterministic derived ids when no server id exists', () => {
    const question = {
      question: 'What is the diagnosis?',
      options: ['A', 'B', 'C'],
      condition: 'Asthma',
    };

    expect(getStableQuestionId(question)).toBe(getStableQuestionId(question));
  });

  it('preserves canonical ids separately from stable runtime ids', () => {
    const normalized = normalizeStudyQuestion({
      id: 'q_123',
      question: 'What is the next step?',
      options: ['Observe', 'Treat'],
      correctAnswer: 'Treat',
      conditionId: 'cond_1',
      condition: 'Condition 1',
      topic: 'Cardiology',
    });

    expect(normalized.id).toBe('q_123');
    expect(getServerQuestionId(normalized)).toBe('q_123');
    expect(normalized.correctAnswerIndex).toBe(1);
  });
});
