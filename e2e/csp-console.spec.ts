/**
 * CSP & Console E2E
 *
 * Ensures the app loads without Content-Security-Policy violations
 * (e.g. clerk-telemetry.com) and that response headers include expected CSP.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8788';

test.describe('CSP and console', () => {
  test('root returns 200 with CSP header including clerk-telemetry in connect-src', async ({
    request,
  }) => {
    const response = await request.get(BASE_URL + '/');
    expect(response.status()).toBe(200);
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://clerk-telemetry.com');
  });

  test('page loads without CSP violation for clerk-telemetry in console', async ({
    page,
  }) => {
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('Content-Security-Policy') ||
        text.includes('violates') ||
        text.includes('clerk-telemetry')
      ) {
        cspViolations.push(text);
      }
    });

    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const violating = cspViolations.filter(
      (v) =>
        v.toLowerCase().includes('clerk-telemetry') ||
        (v.toLowerCase().includes('violates') &&
          v.toLowerCase().includes('content-security'))
    );
    expect(violating).toHaveLength(0);
  });
});
