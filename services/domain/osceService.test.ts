import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeOSCESession, getRandomEncounterCase, gradeOSCESession } from './osceService';

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

  it('unwraps the random encounter case API envelope', async () => {
    const encounterCase = {
      id: 'case_acs',
      patientName: 'Jordan Lee',
      chiefComplaint: 'Chest pain',
      age: 58,
      sex: 'M',
      vitalSigns: { bp: '148/92', hr: 104, rr: 20, temp: 98.8, o2sat: 96 },
      historyData: { onset: 'Sudden substernal pressure' },
      physicalExamData: { heart: 'Regular tachycardia' },
      labData: { troponin: 'Elevated' },
      essentialQuestions: ['onset', 'radiation'],
      helpfulQuestions: ['risk factors'],
      unnecessaryQuestions: ['toe pain'],
      correctDiagnosis: 'Acute coronary syndrome',
      differentialDiagnoses: ['GERD', 'Pulmonary embolism'],
      idealWorkup: ['ECG', 'Troponin'],
      teachingPoints: ['Treat ACS as time-sensitive until ruled out'],
      targetSystem: 'cardiovascular',
      difficulty: 'moderate',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: encounterCase }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRandomEncounterCase('token_xyz', {
      targetSystems: ['cardiovascular'],
      difficulty: 'moderate',
    });

    expect(result).toEqual(encounterCase);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/osce/cases/random?targetSystem=cardiovascular&difficulty=moderate');
    expect(init.headers).toEqual({ Authorization: 'Bearer token_xyz' });
  });
});
