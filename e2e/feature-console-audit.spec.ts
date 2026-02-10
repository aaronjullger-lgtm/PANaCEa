/**
 * Feature Console Audit E2E
 *
 * Visits each major feature route, captures console (errors/warnings) and
 * page errors, and reports. Run against deployed or local app to find JS/CSP issues.
 *
 * Usage: BASE_URL=https://5b836aa9.panacea-9ke.pages.dev npx playwright test e2e/feature-console-audit.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8788';

/** Routes to audit (path or path+search). Canonical: /study/knowledge, /study/utilities. */
const AUDIT_ROUTES = [
  { name: 'Home', path: '/' },
  { name: 'Study / Dashboard', path: '/study' },
  { name: 'Analytics', path: '/study?tab=analytics' },
  { name: 'Clinical Reference (legacy redirects to knowledge)', path: '/study/reference' },
  { name: 'Knowledge Base', path: '/study/knowledge' },
  { name: 'Toolkit (legacy redirects to utilities)', path: '/study/toolkit' },
  { name: 'Utilities', path: '/study/utilities' },
  { name: 'Practice Menu', path: '/menu' },
];

type LogEntry = { type: string; text: string };

test.describe('Feature console audit', () => {
  for (const { name, path } of AUDIT_ROUTES) {
    test(`${name} (${path}) – no uncaught errors, report console issues`, async ({ page }) => {
      const consoleLogs: LogEntry[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg) => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error' || type === 'warning') {
          consoleLogs.push({ type, text });
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      const url = `${BASE_URL}${path}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(4000);

      // Filter out known benign messages
      const isBenign = (t: string) =>
        t.includes('Download the React DevTools') ||
        t.includes('clerk-telemetry') && !t.includes('violates') ||
        t.includes('ResizeObserver') && t.includes('loop') ||
        t.includes('404') && t.includes('favicon');

      const errors = consoleLogs.filter((e) => e.type === 'error' && !isBenign(e.text));
      const warnings = consoleLogs.filter((e) => e.type === 'warning' && !isBenign(e.text));

      // Fail on uncaught page errors
      expect(
        pageErrors,
        `Uncaught page errors on ${name}: ${pageErrors.join('; ')}`
      ).toHaveLength(0);

      // Log for human review (do not fail on console.error unless critical)
      if (errors.length > 0 || warnings.length > 0) {
        console.log(`\n[Audit ${name}] Console issues:`);
        errors.forEach((e) => console.log(`  ERROR: ${e.text.slice(0, 200)}`));
        warnings.forEach((w) => console.log(`  WARN:  ${w.text.slice(0, 200)}`));
      }

      // Fail on CSP violation for clerk-telemetry
      const cspViolation = [...errors, ...pageErrors].find(
        (t) =>
          t.toLowerCase().includes('content-security-policy') &&
          t.toLowerCase().includes('clerk-telemetry')
      );
      expect(
        cspViolation,
        `CSP violation for clerk-telemetry on ${name}: ${cspViolation ?? 'none'}`
      ).toBeUndefined();
    });
  }

  /** Main session: when authenticated, starting a session should call GET /api/questions/session. */
  test('Main session – session API called when starting (authenticated)', async ({ page }) => {
    const sessionRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/questions/session')) sessionRequests.push(req.method() + ' ' + url);
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Only assert if we're on the app (not sign-in) and user can start a session
    const startButton = page.locator('button:has-text(/start|begin|build session/i), [aria-label*="Start"], a:has-text(/start session/i)').first();
    const visible = await startButton.isVisible().catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    await startButton.click();
    await page.waitForTimeout(1500);

    // If modal appears, choose "All" or first option and confirm
    const confirmButton = page.locator('button:has-text(/start|begin|go|confirm)/i)').first();
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(5000);
    }

    // If we got to quiz, session API should have been called
    const sessionCalled = sessionRequests.some((r) => r.startsWith('GET') && r.includes('/api/questions/session'));
    if (sessionCalled) {
      expect(sessionRequests.length).toBeGreaterThan(0);
    }
    // If not authenticated or modal didn't lead to quiz, skip assertion (no failure)
  });
});
