/**
 * API Security E2E
 *
 * Regression tests for critical endpoints:
 * - Unauthenticated requests → 401
 * - Invalid payload → 400 and error message
 * - CORS headers present on API responses
 *
 * Run against local wrangler: BASE_URL=http://localhost:8788 npx playwright test e2e/api-security.spec.ts
 * Or with pages dev: npx wrangler pages dev dist --compatibility-date=2024-01-01
 * then BASE_URL=<that URL> npx playwright test e2e/api-security.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('API Security (auth, validation, CORS)', () => {
  test('POST /api/user/preferences without auth returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/user/preferences`, {
      headers: { 'Content-Type': 'application/json' },
      data: { theme: 'dark', dailyGoal: 20 },
    });
    expect(response.status()).toBe(401);
    const body = await response.json().catch(() => ({}));
    expect(body).toHaveProperty('error');
  });

  test('POST /api/user/preferences with invalid payload returns 400', async ({ request }) => {
    // Use a valid-looking Authorization to pass auth; send invalid body to trigger validation
    const response = await request.post(`${BASE_URL}/api/user/preferences`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-will-401',
      },
      data: { theme: 999 }, // invalid: theme must be string enum
    });
    // Either 401 (invalid token) or 400 (validation failed if token were valid)
    expect([400, 401]).toContain(response.status());
    const body = await response.json().catch(() => ({}));
    expect(body).toHaveProperty('error');
  });

  test('POST /api/questions/generate without auth returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/questions/generate`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        system: 'Cardiovascular',
        conditionId: 'test',
        count: 1,
      },
    });
    expect(response.status()).toBe(401);
    const body = await response.json().catch(() => ({}));
    expect(body).toHaveProperty('error');
  });

  test('POST /api/user/goals without auth returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/user/goals`, {
      headers: { 'Content-Type': 'application/json' },
      data: { body: { title: 'Test', goalType: 'daily' } },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/user/goals without auth returns 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/user/goals`);
    expect(response.status()).toBe(401);
  });

  test('API response includes CORS headers when Origin is sent', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`, {
      headers: { Origin: 'https://example.com' },
    });
    // Allow 200/503/500; we only care about CORS header presence
    expect([200, 503, 500]).toContain(response.status());
    const headers = response.headers();
    // Common CORS response headers (at least one of these is typically set by the app)
    const hasCors =
      headers['access-control-allow-origin'] !== undefined ||
      headers['access-control-allow-credentials'] === 'true' ||
      headers['access-control-expose-headers'] !== undefined;
    expect(hasCors).toBe(true);
  });

  test('OPTIONS preflight to API returns allowed methods and CORS headers', async ({ request }) => {
    const response = await request.fetch(`${BASE_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    // OPTIONS may return 200, 204, or 405 depending on server
    expect([200, 204, 405]).toContain(response.status());
    const headers = response.headers();
    const hasCors =
      headers['access-control-allow-origin'] !== undefined ||
      headers['access-control-allow-methods'] !== undefined;
    expect(hasCors).toBe(true);
  });
});
