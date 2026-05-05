import { describe, expect, it, vi } from 'vitest';

import {
  buildCanonicalQuestionMirrorData,
  createCanonicalQuestionMirrors,
  upsertCanonicalQuestionMirror,
} from './canonical-question-mirror';

describe('canonical question mirror helper', () => {
  it('normalizes pre-generated question payloads into active approved Question rows', () => {
    const generatedAt = new Date('2026-05-01T12:00:00.000Z');

    const data = buildCanonicalQuestionMirrorData({
      id: 'pgq-1',
      system: 'Pulmonary',
      difficulty: 'medium',
      conditionId: 'cond-1',
      medicalContentId: 'mc-1',
      generatedAt,
      questionData: {
        stem: 'What test confirms PE in a stable high-risk patient?',
        options: ['D-dimer', 'CT pulmonary angiography', 'Chest x-ray', 'Spirometry'],
        correctAnswer: 'B',
        rationale: { rationale: 'CTPA confirms pulmonary embolism in stable patients.' },
        subcategory: 'Vascular',
        conditionName: 'Pulmonary embolism',
      },
    }, {
      source: 'test_source',
    });

    expect(data).toEqual(
      expect.objectContaining({
        id: 'pgq-1',
        question: 'What test confirms PE in a stable high-risk patient?',
        correctAnswer: 'CT pulmonary angiography',
        source: 'test_source',
        conditionId: 'cond-1',
        medicalContentId: 'mc-1',
        category: 'Vascular',
        topic: 'Pulmonary embolism',
        generatedAt,
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        humanReviewed: true,
      })
    );
  });

  it('prefers a valid numeric answer index and rejects unscorable payloads', () => {
    const data = buildCanonicalQuestionMirrorData({
      id: 'pgq-2',
      questionData: {
        question: 'Which option is correct?',
        options: [{ text: 'Alpha' }, { text: 'Beta' }],
        correctAnswer: 'Alpha',
        correctAnswerIndex: 1,
      },
    });

    expect(data?.correctAnswer).toBe('Beta');

    expect(
      buildCanonicalQuestionMirrorData({
        id: 'bad-1',
        questionData: {
          question: 'Bad key?',
          options: ['A', 'B'],
          correctAnswer: 'Z',
        },
      })
    ).toBeNull();
  });

  it('upserts and bulk creates through the provided prisma delegate', async () => {
    const prisma = {
      question: {
        upsert: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const input = {
      id: 'pgq-3',
      questionData: {
        question: 'Which option is correct?',
        options: ['A answer', 'B answer'],
        correctAnswerIndex: 0,
      },
    };

    await expect(upsertCanonicalQuestionMirror(prisma, input)).resolves.toBe('pgq-3');
    expect(prisma.question.upsert).toHaveBeenCalledWith({
      where: { id: 'pgq-3' },
      create: expect.objectContaining({ id: 'pgq-3' }),
      update: expect.not.objectContaining({ id: expect.anything() }),
    });

    await expect(createCanonicalQuestionMirrors(prisma, [input])).resolves.toEqual(new Set(['pgq-3']));
    expect(prisma.question.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ id: 'pgq-3' })],
      skipDuplicates: true,
    });
  });
});
