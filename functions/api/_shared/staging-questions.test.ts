import { describe, expect, it, vi } from 'vitest';

const gatewayMock = vi.hoisted(() => ({
  callText: vi.fn(),
}));

vi.mock('../../../lib/ai/aiGateway', () => ({
  gateway: gatewayMock,
  GatewayError: class GatewayError extends Error {
    code = 'TEST_GATEWAY_ERROR';
  },
}));

import {
  getStagingQuestionValidationErrors,
  processStagingQueue,
  processStagingQueueWithCritic,
  promoteToLive,
  runAdequacyCheck,
  saveToStaging,
} from './staging-questions';

describe('staging question edge helper', () => {
  it('normalizes generated question payloads before staging', async () => {
    const prisma = {
      stagingQuestion: {
        create: vi
          .fn()
          .mockImplementation((args) => Promise.resolve({ id: args.data.id, ...args.data })),
      },
    };

    await saveToStaging(prisma, {
      question: 'Which diagnosis is most likely?',
      options: ['Pulmonary embolism', 'Pneumonia'],
      correctAnswer: 'Pulmonary embolism',
      explanation: { rationale: 'A focused explanation.' },
      difficulty: 0.65,
      system: 'Pulmonary',
      questionOrder: 'third',
      taskCategory: 'diagnosis',
      metadata: {
        taxonomyCode: 'PULM',
        subcategory: 'Vascular',
        conditionId: 'cond-1',
        medicalContentId: 'mc-1',
        conditionName: 'Pulmonary embolism',
        generatorUserId: 'clerk-admin-1',
      },
    });

    expect(prisma.stagingQuestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        difficulty: 'medium',
        options: ['Pulmonary embolism', 'Pneumonia'],
        tags: expect.arrayContaining([
          'taxonomy:PULM',
          'subcategory:Vascular',
          'condition:cond-1',
          'medicalContent:mc-1',
        'conditionName:Community-acquired pneumonia',
          'questionOrder:third',
          'taskCategory:diagnosis',
        ]),
      }),
    });
  });

  it('rejects malformed generated payloads before they reach staging storage', async () => {
    const errors = getStagingQuestionValidationErrors({
      question: 'Which diagnosis is most likely?',
      options: ['Pulmonary embolism', 'Pneumonia'],
      correctAnswer: 'Heart failure',
      explanation: 'A focused explanation.',
    });

    expect(errors).toContain('correctAnswer must resolve to one of the answer options');

    const prisma = {
      stagingQuestion: {
        create: vi.fn(),
      },
    };

    await expect(
      saveToStaging(prisma, {
        question: 'Which diagnosis is most likely?',
        options: ['Pulmonary embolism', 'Pneumonia'],
        correctAnswer: 'Heart failure',
        explanation: 'A focused explanation.',
      })
    ).rejects.toThrow('Invalid staging question payload');
    expect(prisma.stagingQuestion.create).not.toHaveBeenCalled();
  });

  it('promotes staging questions with identity, provenance, and approved serving status', async () => {
    const stagingQuestion = {
      id: 'stg-1',
      status: 'graded',
      system: 'Pulmonary',
      difficulty: 'medium',
      vignette: '',
      question: 'Which diagnosis is most likely?',
      options: ['Pulmonary embolism', 'Pneumonia'],
      correctAnswer: 'Pulmonary embolism',
      explanation: 'A focused explanation.',
      aiGrade: { score: 0.9 },
      tags: [
        'taxonomy:PULM',
        'subcategory:Vascular',
        'condition:cond-1',
        'medicalContent:mc-1',
        'conditionName:Community-acquired pneumonia',
        'questionOrder:third',
        'taskCategory:diagnosis',
        'generatorUser:clerk-admin-1',
      ],
    };
    const prisma = {
      stagingQuestion: {
        findUnique: vi.fn().mockResolvedValue(stagingQuestion),
        update: vi.fn().mockResolvedValue({}),
      },
      preGeneratedQuestion: {
        upsert: vi
          .fn()
          .mockImplementation((args) => Promise.resolve({ id: args.create.id, ...args.create })),
      },
      question: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      questionAnswerChoice: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      questionExplanation: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    await promoteToLive(prisma, 'stg-1');

    expect(prisma.preGeneratedQuestion.upsert).toHaveBeenCalledWith({
      where: { id: 'stg-1' },
      create: expect.objectContaining({
        id: 'stg-1',
        conditionId: 'cond-1',
        medicalContentId: 'mc-1',
        questionOrder: 'third',
        taskCategory: 'diagnosis',
        validationStatus: 'approved',
        validatedAt: expect.any(Date),
        questionData: expect.objectContaining({
          conditionId: 'cond-1',
          medicalContentId: 'mc-1',
          conditionName: 'Community-acquired pneumonia',
          provenance: expect.objectContaining({
            taxonomyCode: 'PULM',
            subcategory: 'Vascular',
            generatorUserId: 'clerk-admin-1',
            aiGrade: { score: 0.9 },
          }),
        }),
      }),
      update: expect.objectContaining({
        validationStatus: 'approved',
      }),
    });
    expect(prisma.question.upsert).toHaveBeenCalledWith({
      where: { id: 'stg-1' },
      create: expect.objectContaining({
        id: 'stg-1',
        source: 'staging_promoted_pre_generated',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        medicalContentId: 'mc-1',
      }),
      update: expect.objectContaining({
        source: 'staging_promoted_pre_generated',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        medicalContentId: 'mc-1',
      }),
    });
    expect(prisma.questionAnswerChoice.upsert).toHaveBeenCalledWith({
      where: {
        questionId_choiceKey: {
          questionId: 'stg-1',
          choiceKey: 'A',
        },
      },
      create: expect.objectContaining({
        questionId: 'stg-1',
        choiceKey: 'A',
        choiceText: 'Pulmonary embolism',
        isCorrect: true,
        displayOrder: 0,
      }),
      update: expect.objectContaining({
        choiceText: 'Pulmonary embolism',
        isCorrect: true,
        displayOrder: 0,
      }),
    });
    expect(prisma.questionExplanation.upsert).toHaveBeenCalledWith({
      where: {
        questionId_explanationType_version: {
          questionId: 'stg-1',
          explanationType: 'CORRECT_RATIONALE',
          version: 1,
        },
      },
      create: expect.objectContaining({
        questionId: 'stg-1',
        explanationType: 'CORRECT_RATIONALE',
        body: 'A focused explanation.',
        isActive: true,
      }),
      update: expect.objectContaining({
        body: 'A focused explanation.',
        isActive: true,
      }),
    });
  });

  it('rejects promotion before a staging question has passed adequacy review', async () => {
    const prisma = {
      stagingQuestion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'stg-pending',
          status: 'pending',
        }),
      },
      preGeneratedQuestion: {
        upsert: vi.fn(),
      },
      question: {
        upsert: vi.fn(),
      },
    };

    await expect(promoteToLive(prisma, 'stg-pending')).rejects.toThrow(
      'Question has not passed adequacy check'
    );
    expect(prisma.preGeneratedQuestion.upsert).not.toHaveBeenCalled();
  });

  it('allows explicit human-reviewed pending staging promotion after structural validation', async () => {
    const stagingQuestion = {
      id: 'stg-human',
      status: 'pending',
      system: 'Pulmonary',
      difficulty: 'medium',
      vignette: '',
      question: 'Which diagnostic test confirms pulmonary embolism?',
      options: ['D-dimer', 'CT pulmonary angiography'],
      correctAnswer: 'CT pulmonary angiography',
      explanation: 'CT pulmonary angiography confirms PE in stable patients.',
      aiGrade: null,
      tags: ['medicalContent:mc-1', 'conditionName:Pulmonary embolism'],
    };
    const prisma = {
      stagingQuestion: {
        findUnique: vi.fn().mockResolvedValue(stagingQuestion),
        update: vi.fn().mockResolvedValue({}),
      },
      preGeneratedQuestion: {
        upsert: vi
          .fn()
          .mockImplementation((args) => Promise.resolve({ id: args.create.id, ...args.create })),
      },
      question: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      questionAnswerChoice: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      questionExplanation: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    await promoteToLive(prisma, 'stg-human', {
      allowPendingHumanReview: true,
      reviewedBy: 'admin-clerk-1',
    });

    expect(prisma.preGeneratedQuestion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: 'stg-human',
          validationStatus: 'approved',
          questionData: expect.objectContaining({
            provenance: expect.objectContaining({
              humanReviewedBy: 'admin-clerk-1',
            }),
          }),
        }),
      })
    );
    expect(prisma.question.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stg-human' },
      })
    );
    expect(prisma.stagingQuestion.update).toHaveBeenCalledWith({
      where: { id: 'stg-human' },
      data: expect.objectContaining({
        status: 'approved',
        adminReview: expect.stringContaining('Approved by human reviewer'),
      }),
    });
  });

  it('rejects promotion for graded staging questions that are structurally unscorable', async () => {
    const prisma = {
      stagingQuestion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'stg-bad',
          status: 'graded',
          system: 'Pulmonary',
          difficulty: 'medium',
          question: 'Which diagnosis is most likely?',
          options: ['Pulmonary embolism', 'Pneumonia'],
          correctAnswer: 'Heart failure',
          explanation: 'This explanation is long enough but the answer key does not resolve.',
        }),
        update: vi.fn(),
      },
      preGeneratedQuestion: {
        upsert: vi.fn(),
      },
      question: {
        upsert: vi.fn(),
      },
    };

    await expect(promoteToLive(prisma, 'stg-bad')).rejects.toThrow(
      'Question cannot be promoted: correctAnswer must resolve to one of the answer options'
    );
    expect(prisma.preGeneratedQuestion.upsert).not.toHaveBeenCalled();
    expect(prisma.stagingQuestion.update).not.toHaveBeenCalled();
  });

  it('does not mark questions graded when the medical accuracy check is unavailable', async () => {
    const prisma = {
      stagingQuestion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'stg-1',
          correctAnswer: 'Pulmonary embolism',
          explanation:
            'This detailed explanation is intentionally long enough to pass the local word-count threshold while still requiring medical accuracy review before approval. It includes a structured diagnostic rationale, a comparison against pneumonia, a treatment implication, and a brief clinical pearl so the local validation path has enough prose. No external critic result is available in this test.',
          options: ['Pulmonary embolism', 'Pneumonia'],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await runAdequacyCheck(prisma, {}, 'stg-1');

    expect(result.isValid).toBe(false);
    expect(result.accuracyCheckCompleted).toBe(false);
    expect(prisma.stagingQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          aiGrade: expect.objectContaining({
            accuracyCheckCompleted: false,
            isValid: false,
          }),
        }),
      })
    );
  });

  it('does not grade questions whose correct answer cannot resolve to an option', async () => {
    const prisma = {
      stagingQuestion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'stg-1',
          correctAnswer: 'Not in options',
          explanation:
            'This explanation has enough words to exceed the basic adequacy length threshold for the local validation path.',
          options: ['A', 'B'],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await runAdequacyCheck(prisma, {}, 'stg-1');

    expect(result.isValid).toBe(false);
    expect(result.hasCorrectAnswer).toBe(false);
    expect(prisma.stagingQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
        }),
      })
    );
  });

  it('keeps pending queue items when the AI adequacy critic is unavailable', async () => {
    const prisma = {
      stagingQuestion: {
        findMany: vi.fn().mockResolvedValue([{ id: 'stg-1' }]),
        findUnique: vi.fn().mockResolvedValue({
          id: 'stg-1',
          correctAnswer: 'Pulmonary embolism',
          explanation:
            'This detailed explanation is intentionally long enough to pass the local word-count threshold while still requiring medical accuracy review before approval. It explains why acute pleuritic pain with tachycardia after surgery raises concern for pulmonary embolism and contrasts this with pneumonia using focused diagnostic reasoning.',
          options: ['Pulmonary embolism', 'Pneumonia'],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      preGeneratedQuestion: {
        upsert: vi.fn(),
      },
    };

    const results = await processStagingQueue(prisma, {}, 1);

    expect(results).toEqual([
      {
        id: 'stg-1',
        status: 'skipped_pending',
        score: 0.5,
        error: 'AI check unavailable',
      },
    ]);
    expect(prisma.preGeneratedQuestion.upsert).not.toHaveBeenCalled();
    expect(prisma.stagingQuestion.update).toHaveBeenCalledTimes(1);
    expect(prisma.stagingQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          aiGrade: expect.objectContaining({
            accuracyCheckCompleted: false,
          }),
        }),
      })
    );
  });

  it('does not auto-promote high-scoring critic items that fail structural validation', async () => {
    gatewayMock.callText.mockResolvedValueOnce({
      blocked: false,
      text: '{"score":95,"briefReason":"Clear and concise"}',
    });
    const prisma = {
      stagingQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'stg-bad',
            status: 'pending',
            system: 'Pulmonary',
            difficulty: 'medium',
            vignette: '',
            question: 'Which diagnosis is most likely?',
            options: ['Pulmonary embolism', 'Pneumonia'],
            correctAnswer: 'Heart failure',
            explanation: 'This explanation is long enough but the answer key does not resolve.',
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      preGeneratedQuestion: {
        upsert: vi.fn(),
      },
    };

    const results = await processStagingQueueWithCritic(prisma, { GEMINI_API_KEY: 'test-key' }, 1);

    expect(results).toEqual([{ id: 'stg-bad', status: 'flagged_for_review', score: 95 }]);
    expect(prisma.preGeneratedQuestion.upsert).not.toHaveBeenCalled();
    expect(prisma.stagingQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stg-bad' },
        data: expect.objectContaining({
          status: 'flagged_for_review',
          adminReview: expect.stringContaining('promotion validation failed'),
        }),
      })
    );
  });
});
