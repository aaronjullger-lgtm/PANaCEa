import { describe, expect, it } from 'vitest';
import { onRequestPost as completeExam } from './complete';
import { onRequestPost as startExam } from './start';

function contextFor(path: string, env: Record<string, unknown> = {}) {
  return {
    request: new Request(`https://panacea.test${path}`, {
      method: 'POST',
      body: JSON.stringify({ configId: 'exam-config-test', attemptId: 'attempt-test' }),
      headers: { 'content-type': 'application/json' },
    }),
    env,
    params: {},
  } as any;
}

async function readJson(response: Response): Promise<any> {
  return response.json();
}

describe('legacy exam launch gates', () => {
  it('disables exam start by default with a standard error envelope', async () => {
    const response = await startExam(contextFor('/api/exam/start'));
    const body = await readJson(response);

    expect(response.status).toBe(410);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: 'FEATURE_DISABLED',
        message: 'Legacy exam API is disabled for this launch.',
      },
    });
  });

  it('disables exam complete by default with a standard error envelope', async () => {
    const response = await completeExam(contextFor('/api/exam/complete'));
    const body = await readJson(response);

    expect(response.status).toBe(410);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: 'FEATURE_DISABLED',
        message: 'Legacy exam API is disabled for this launch.',
      },
    });
  });

  it('allows the existing handler path to run when explicitly enabled', async () => {
    const response = await startExam(
      contextFor('/api/exam/start', { ENABLE_LEGACY_EXAM_API: 'true' })
    );
    const body = await readJson(response);

    expect(body.error?.code).not.toBe('FEATURE_DISABLED');
  });
});
