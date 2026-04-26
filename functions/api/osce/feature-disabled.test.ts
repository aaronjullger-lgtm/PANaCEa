import { describe, expect, it } from 'vitest';
import { onRequestPost as evaluateSession } from './evaluate';
import { onRequestPost as classifyIntent } from './intent';
import { onRequestPost as patientResponse } from './patient';

function contextFor(path: string, env: Record<string, unknown> = {}) {
  return {
    request: new Request(`https://panacea.test${path}`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'session-test',
        studentText: 'When did the pain start?',
        classifiedIntent: 'ONSET',
        studentQuestion: 'When did it start?',
      }),
      headers: { 'content-type': 'application/json' },
    }),
    env,
    params: {},
  } as any;
}

async function expectDisabled(response: Response) {
  const body = await response.json();

  expect(response.status).toBe(404);
  expect(body).toMatchObject({
    ok: false,
    error: {
      code: 'FEATURE_DISABLED',
      message: 'OSCE beta endpoints are disabled for this launch.',
    },
  });
}

describe('OSCE beta launch gates', () => {
  it('disables OSCE intent classification by default', async () => {
    await expectDisabled(await classifyIntent(contextFor('/api/osce/intent')));
  });

  it('disables OSCE patient responses by default', async () => {
    await expectDisabled(await patientResponse(contextFor('/api/osce/patient')));
  });

  it('disables OSCE evaluation by default', async () => {
    await expectDisabled(await evaluateSession(contextFor('/api/osce/evaluate')));
  });

  it('allows the existing handler path to run when explicitly enabled', async () => {
    const response = await classifyIntent(
      contextFor('/api/osce/intent', { ENABLE_OSCE_BETA: 'true' })
    );
    const body = await response.json();

    expect(body.error?.code).not.toBe('FEATURE_DISABLED');
  });
});
