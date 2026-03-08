import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeOSCESession, gradeOSCESession } from './osceService';

describe('osceService request contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends /api/osce/complete payload in endpoint schema shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const ok = await completeOSCESession(
      'session_abc',
      'Acute coronary syndrome',
      'Aspirin + admit telemetry',
      'token_xyz'
    );

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/osce/complete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      body: {
        sessionId: 'session_abc',
        diagnosis: 'Acute coronary syndrome',
        treatmentPlan: 'Aspirin + admit telemetry',
      },
    });
  });

  it('posts wrapped sessionId to grade endpoint and parses response payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            resultId: 'result_1',
            score: 91,
            checklist: [],
            redFlagsMissed: [],
            clinicalReasoningScore: 88,
            billingCodeSuggestion: 'N/A',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await gradeOSCESession('session_grade_1', 'token_xyz');

    expect(result?.score).toBe(91);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      body: { sessionId: 'session_grade_1' },
    });
  });
});
