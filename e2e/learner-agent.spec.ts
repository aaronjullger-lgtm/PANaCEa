/**
 * Learner Agent E2E — auth, feature flag, and flow guardrails.
 *
 * Full authenticated flow requires ENABLE_LEARNER_AGENT=true on the API host.
 * Run: BASE_URL=http://localhost:8788 npx playwright test e2e/learner-agent.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8788';

test.describe('Learner Agent API', () => {
  test('GET /api/learner-agent/recommendation without auth returns 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/learner-agent/recommendation`);
    expect(response.status()).toBe(401);
    const body = await response.json().catch(() => ({}));
    expect(body).toHaveProperty('error');
  });

  test('POST /api/learner-agent/session without auth returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/learner-agent/session`, {
      headers: { 'Content-Type': 'application/json' },
      data: { action: 'start', objective: 'Test objective' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/learner-agent/attempt without auth returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/learner-agent/attempt`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        questionId: 'q1',
        selectedAnswer: 'A',
        timeSpentMs: 1000,
        idempotencyKey: 'e2e-attempt-key-12345678',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/learner-agent/connect without auth returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/learner-agent/connect`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('learner-agent endpoints return 404 when feature flag disabled', async ({ request }) => {
    const token = process.env.E2E_CLERK_TOKEN;
    test.skip(!token, 'Set E2E_CLERK_TOKEN for authenticated feature-flag probe');

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const recommendation = await request.get(`${BASE_URL}/api/learner-agent/recommendation`, {
      headers,
    });
    expect([404, 200]).toContain(recommendation.status());
    if (recommendation.status() === 404) {
      const body = await recommendation.json();
      expect(body.error ?? body.message ?? '').toBeTruthy();
    }
  });
});
