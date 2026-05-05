import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./panceDistributionService', () => ({
  getWeightedRandomSystem: vi.fn(() => 'Pulmonary'),
  getWeightedRandomTask: vi.fn(() => 'Using Diagnostic Studies'),
  recordQuestion: vi.fn(),
  normalizeSystemCode: vi.fn((value: string) => value),
  PANCE_SYSTEM_PERCENTAGES: {},
}));

import { generateEnhancedQuestion } from './enhancedQuestionService';
import { recordQuestion } from './panceDistributionService';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('generateEnhancedQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.startsWith('/api/conditions?')) {
        return jsonResponse({
          conditions: [
            {
              id: 'mc-1',
              name: 'Pulmonary embolism',
              system: 'Pulmonary',
              subcategory: 'Vascular',
              content: {
                overview: 'Venous thromboembolism.',
                diagnostics: 'CT pulmonary angiography.',
              },
            },
          ],
        });
      }
      if (target.startsWith('/api/labtests?')) return jsonResponse({ labTests: [] });
      if (target.startsWith('/api/imaging?')) return jsonResponse({ imagingStudies: [] });
      if (target.startsWith('/api/drugs?')) return jsonResponse({ drugs: [] });
      if (target === '/api/questions/generate-enhanced') {
        expect(init).toEqual(
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer clerk-token',
            }),
          })
        );
        expect(JSON.parse(String(init?.body))).toEqual(
          expect.objectContaining({
            conditionId: 'mc-1',
            conditionName: 'Pulmonary embolism',
            system: 'Pulmonary',
            task: 'Using Diagnostic Studies',
            difficulty: 'same',
          })
        );
        return jsonResponse({
          success: true,
          data: {
            question: {
              id: 'enh-1',
              vignette: 'A postoperative patient develops pleuritic pain.',
              question: 'Which test confirms the diagnosis?',
              options: ['D-dimer', 'CT pulmonary angiography'],
              correctAnswerIndex: 1,
              rationale: 'CTPA confirms PE in stable high-risk patients.',
              pearls: ['Match pretest probability to testing.'],
            },
          },
        });
      }
      return jsonResponse({}, { status: 404 });
    }) as typeof fetch;
  });

  it('sends auth, required difficulty, and unwraps the endpoint response envelope', async () => {
    const question = await generateEnhancedQuestion(
      { mode: 'core_adaptive', focus: 'all' } as any,
      [],
      undefined,
      'clerk-token'
    );

    expect(question).toEqual(
      expect.objectContaining({
        id: 'enh-1',
        question: 'A postoperative patient develops pleuritic pain.',
        options: ['D-dimer', 'CT pulmonary angiography'],
        correctAnswerIndex: 1,
        conditionId: 'mc-1',
        condition: 'Pulmonary embolism',
        source: 'enhanced-generation',
      })
    );
    expect(recordQuestion).toHaveBeenCalledWith('Pulmonary', 'Using Diagnostic Studies');
  });

  it('does not surface review-held generated questions as usable session questions', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const target = String(url);
      if (target.startsWith('/api/conditions?')) {
        return jsonResponse({
          conditions: [
            {
              id: 'mc-1',
              name: 'Pulmonary embolism',
              system: 'Pulmonary',
            },
          ],
        });
      }
      if (target.startsWith('/api/labtests?')) return jsonResponse({ labTests: [] });
      if (target.startsWith('/api/imaging?')) return jsonResponse({ imagingStudies: [] });
      if (target.startsWith('/api/drugs?')) return jsonResponse({ drugs: [] });
      if (target === '/api/questions/generate-enhanced') {
        return jsonResponse(
          {
            success: false,
            data: {
              submissionReady: false,
              requiresApproval: true,
              stagingQuestionId: 'staging-1',
              message: 'Question generated but held for review.',
            },
          },
          { status: 202 }
        );
      }
      return jsonResponse({}, { status: 404 });
    });

    const question = await generateEnhancedQuestion(
      { mode: 'core_adaptive', focus: 'all' } as any,
      [],
      undefined,
      'clerk-token'
    );

    expect(question).toBeNull();
    expect(recordQuestion).not.toHaveBeenCalled();
  });
});
