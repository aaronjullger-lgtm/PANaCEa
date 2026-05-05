import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSaveToStaging = vi.hoisted(() => vi.fn());

vi.mock('./staging-questions', () => ({
  saveToStaging: mockSaveToStaging,
}));

import {
  getGeneratedQuestionStem,
  markGeneratedQuestionPreviewOnly,
  normalizeGeneratedQuestionExplanation,
  stageGeneratedQuestionPreview,
} from './generated-question-preview';

describe('generated-question-preview helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveToStaging.mockResolvedValue({ id: 'staging-1' });
  });

  it('marks generated questions as preview-only without dropping existing metadata', () => {
    const preview = markGeneratedQuestionPreviewOnly(
      {
        id: 'generated-1',
        question: 'Question text',
        metadata: { source: 'test-source' },
      },
      { conditionId: 'cond-1' }
    );

    expect(preview).toMatchObject({
      id: 'generated-1',
      question: 'Question text',
      submissionReady: false,
      requiresApproval: true,
      metadata: {
        source: 'test-source',
        conditionId: 'cond-1',
        submissionReady: false,
        requiresApproval: true,
      },
    });
  });

  it('normalizes common generated question stem and explanation shapes', () => {
    expect(getGeneratedQuestionStem({ question: 'Question field' })).toBe('Question field');
    expect(getGeneratedQuestionStem({ stem: 'Stem field' })).toBe('Stem field');
    expect(getGeneratedQuestionStem({ text: 'Text field' })).toBe('Text field');
    expect(
      normalizeGeneratedQuestionExplanation({
        explanation: { rationale: 'Rationale text', text: 'Fallback text' },
      })
    ).toBe('Rationale text');
    expect(normalizeGeneratedQuestionExplanation({ rationale: 'Top-level rationale' })).toBe(
      'Top-level rationale'
    );
  });

  it('stages preview questions and annotates returned metadata with staging identity', async () => {
    const preview = await stageGeneratedQuestionPreview(
      {},
      {
        question: {
          id: 'generated-1',
          text: 'A patient presents with dyspnea. What is the best test?',
          options: ['CTPA', 'CXR', 'Spirometry', 'D-dimer'],
          correctAnswer: 'CTPA',
          explanation: { rationale: 'CTPA confirms pulmonary embolism.' },
          metadata: { originalQuery: 'Pulmonary embolism' },
        },
        metadata: {
          source: 'learner_question_generate_endpoint',
          conditionId: 'cond-1',
        },
        system: 'Pulmonary',
        subcategory: 'Vascular',
      }
    );

    expect(mockSaveToStaging).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        question: 'A patient presents with dyspnea. What is the best test?',
        system: 'Pulmonary',
        subcategory: 'Vascular',
        difficulty: 'medium',
        explanation: 'CTPA confirms pulmonary embolism.',
        metadata: expect.objectContaining({
          originalQuery: 'Pulmonary embolism',
          source: 'learner_question_generate_endpoint',
          conditionId: 'cond-1',
          submissionReady: false,
          requiresApproval: true,
        }),
      })
    );
    expect(preview).toMatchObject({
      submissionReady: false,
      requiresApproval: true,
      metadata: {
        stagingQuestionId: 'staging-1',
        persistence: 'staged_for_review',
        conditionId: 'cond-1',
      },
    });
  });
});
