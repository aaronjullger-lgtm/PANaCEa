import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@/types';
import type { CustomSessionConfig } from '@/types/custom-session';
import { fetchSessionQuestions } from './customSessionService';

describe('customSessionService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps custom-session question responses from the API envelope', async () => {
    const config: CustomSessionConfig = {
      systems: ['CV'],
      subcategories: [],
      conditions: [],
      focusAreas: ['diagnosis'],
      questionsPerIncrement: 5,
      difficulty: 'same',
      retryMissedQuestions: true,
    };
    const question: Question = {
      id: 'question_1',
      question: 'Which diagnosis best explains exertional substernal chest pain?',
      options: ['Stable angina', 'Costochondritis', 'Panic disorder', 'GERD'],
      correctAnswerIndex: 0,
      rationale: 'Predictable exertional chest pressure suggests stable angina.',
      topic: 'Cardiology',
      system: 'CV',
      conditionId: 'stable-angina',
      condition: 'Stable angina',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            questions: [question],
            totalAvailable: 1,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const questions = await fetchSessionQuestions(config, 5);

    expect(questions).toEqual([question]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/questions/custom-session');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ config, count: 5 });
  });
});
