/**
 * API Health Check E2E
 *
 * Validates /api/health when running against Cloudflare Pages (Wrangler).
 * This confirms the Functions runtime and routing work correctly.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('API Health (Cloudflare Functions)', () => {
  test('GET /api/health returns diagnostics (200, 503, or 500)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    // 200 = healthy, 503 = degraded, 500 = error (e.g. DB/stack failure)
    expect([200, 503, 500]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('endpoint', '/api/health');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');

    // Expected checks from health.ts
    expect(body.checks).toHaveProperty('functionDeployed');
    expect(body.checks.functionDeployed).toMatchObject({
      status: 'pass',
      message: expect.stringContaining('Cloudflare'),
    });

    expect(body.checks).toHaveProperty('environment');
    expect(body.checks).toHaveProperty('database');
  });

  test('GET /api/health returns valid JSON', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/application\/json/);
  });
});
