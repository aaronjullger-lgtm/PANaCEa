import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateVariant: vi.fn(),
}));

vi.mock('./questionVariantGenerator', () => ({
  generateVariant: (...args: unknown[]) => mocks.generateVariant(...args),
}));

import { ensureDueVariant, type PreGenQuestionForVariant } from './ensureDueVariant';

function makePrisma() {
  return {
    preGeneratedQuestion: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    confusionPair: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    weaknessPattern: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

const sourceQuestion: PreGenQuestionForVariant = {
  id: 'pregen-source',
  conditionId: 'condition-1',
  system: 'Pulmonary',
  difficulty: 'medium',
  questionType: 'mcq',
  questionData: {
    question: 'Which test confirms pulmonary embolism?',
    options: ['D-dimer', 'CT pulmonary angiography', 'Chest x-ray', 'Spirometry'],
    correctAnswerIndex: 1,
    explanation: 'CTPA confirms PE in stable patients.',
  },
};

describe('ensureDueVariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips storing generated variants when correctAnswer does not match an option', async () => {
    const prisma = makePrisma();
    mocks.generateVariant.mockResolvedValue({
      question: 'Variant question?',
      options: ['D-dimer', 'CT pulmonary angiography', 'Chest x-ray', 'Spirometry'],
      correctAnswer: 'Ventilation-perfusion scan',
      explanation: 'Explanation',
    });

    await ensureDueVariant(prisma as never, sourceQuestion, 'gemini-key');

    expect(prisma.preGeneratedQuestion.create).not.toHaveBeenCalled();
  });

  it('stores generated variants only with a resolvable correct answer', async () => {
    const prisma = makePrisma();
    mocks.generateVariant.mockResolvedValue({
      question: 'Variant question?',
      options: ['D-dimer', 'CT pulmonary angiography', 'Chest x-ray', 'Spirometry'],
      correctAnswer: 'CT pulmonary angiography',
      explanation: 'Explanation',
    });

    await ensureDueVariant(prisma as never, sourceQuestion, 'gemini-key');

    expect(prisma.preGeneratedQuestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conditionId: 'condition-1',
        questionData: expect.objectContaining({
          correctAnswer: 'CT pulmonary angiography',
          correctAnswerIndex: 1,
        }),
      }),
    });
  });
});
