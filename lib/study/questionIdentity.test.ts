import { describe, expect, it } from 'vitest';
import {
  getQuestionIdentity,
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

  it('derives correct answer indexes from alternate generated payload fields', () => {
    expect(
      resolveCorrectAnswerIndex({
        options: ['Alpha', 'Beta', 'Gamma'],
        answer: '1',
      })
    ).toBe(1);

    expect(
      resolveCorrectAnswerIndex({
        options: ['Alpha', 'Beta', 'Gamma'],
        correct_option: 'C',
      })
    ).toBe(2);

    expect(
      resolveCorrectAnswerIndex({
        options: ['Alpha', 'Beta', 'Gamma'],
        correctChoice: 'Beta',
      })
    ).toBe(1);
  });

  it('fails closed when the correct answer cannot be resolved', () => {
    expect(
      resolveCorrectAnswerIndex({
        options: ['Alpha', 'Beta', 'Gamma'],
        correctAnswer: 'Delta',
      })
    ).toBe(-1);

    expect(
      resolveCorrectAnswerIndex({
        options: ['Alpha', 'Beta', 'Gamma'],
      })
    ).toBe(-1);
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

  it('separates pre-generated source identity from canonical Question identity', () => {
    expect(
      getServerQuestionId({
        id: 'pgq_1',
        questionSource: 'pre_generated',
      })
    ).toBeNull();

    const normalized = normalizeStudyQuestion({
      id: 'pgq_1',
      questionSource: 'pre_generated',
      sourceQuestionId: 'pgq_1',
      medicalContentId: 'mc_1',
      question: 'What is the next step?',
      options: ['Observe', 'Treat'],
      correctAnswer: 'Treat',
      condition: 'Condition 1',
      topic: 'Cardiology',
    });
    expect(normalized.id).toBe('pgq_1');
    expect(normalized.questionId).toBeUndefined();
    expect(normalized.conditionId).toBe('mc_1');

    expect(
      getQuestionIdentity({
        id: 'pgq_1',
        questionSource: 'pre_generated',
        question: 'What is the next step?',
        options: ['Observe', 'Treat'],
      })
    ).toEqual({
      canonicalQuestionId: null,
      sourceQuestionId: 'pgq_1',
      questionSource: 'pre_generated',
    });

    expect(
      getQuestionIdentity({
        canonicalQuestionId: 'q_1',
        sourceQuestionId: 'pgq_1',
        questionSource: 'pre_generated',
      })
    ).toEqual({
      canonicalQuestionId: 'q_1',
      sourceQuestionId: 'pgq_1',
      questionSource: 'pre_generated',
    });
  });
});
