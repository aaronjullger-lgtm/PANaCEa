/**
 * API Health Check E2E
 *
 * Validates /api/health when running against Cloudflare Pages (Wrangler).
 * This confirms the Functions runtime and routing work correctly.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('API Health (Cloudflare Functions)', () => {
  test('GET /api/health returns public liveness only', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('endpoint', '/api/health');
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('checks');
    expect(body).not.toHaveProperty('diagnostics');

    expect(body.checks).toHaveProperty('functionDeployed');
    expect(body.checks.functionDeployed).toMatchObject({
      status: 'pass',
      message: expect.stringContaining('Cloudflare'),
    });
    expect(body.checks).not.toHaveProperty('environment');
    expect(body.checks).not.toHaveProperty('database');
    expect(body.checks).not.toHaveProperty('content');
  });

  test('GET /api/health returns valid JSON', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/application\/json/);
  });
});
