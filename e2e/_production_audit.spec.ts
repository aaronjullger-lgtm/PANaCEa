/**
 * Production Readiness Audit ("Hunter-Killer" Test)
 *
 * This test suite validates production readiness by:
 * 1. Checking for console errors (not warnings)
 * 2. Detecting network 500 errors
 * 3. Verifying critical pages load without crashes
 * 4. Validating API endpoint health
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000;

interface AuditResult {
  consoleErrors: string[];
  networkErrors: Array<{ url: string; status: number; statusText: string }>;
  pageLoadFailures: string[];
}

/**
 * Setup audit tracking for a page
 */
function setupAuditTracking(page: Page, results: AuditResult) {
  // Track console errors (but not warnings)
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  // Track network errors (500+ status codes)
  page.on('response', (response) => {
    if (response.status() >= 500) {
      results.networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  });

  // Track page errors (uncaught exceptions)
  page.on('pageerror', (error) => {
    results.consoleErrors.push(`[PAGE ERROR] ${error.message}`);
  });
}

test.describe('Production Audit - Hunter Killer', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('should load app without console errors or 500 responses', async ({ page }) => {
    const auditResults: AuditResult = {
      consoleErrors: [],
      networkErrors: [],
      pageLoadFailures: [],
    };

    setupAuditTracking(page, auditResults);

    // Navigate to home page
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (error) {
      auditResults.pageLoadFailures.push(`Home page load failed: ${error}`);
    }

    // Wait for app to initialize
    await page.waitForTimeout(2000);

    // Check results
    if (auditResults.consoleErrors.length > 0) {
      console.error('\n❌ Console Errors Detected:');
      auditResults.consoleErrors.forEach((err) => console.error(`  - ${err}`));
    }

    if (auditResults.networkErrors.length > 0) {
      console.error('\n❌ Network 500 Errors Detected:');
      auditResults.networkErrors.forEach((err) =>
        console.error(`  - ${err.status} ${err.statusText}: ${err.url}`)
      );
    }

    if (auditResults.pageLoadFailures.length > 0) {
      console.error('\n❌ Page Load Failures:');
      auditResults.pageLoadFailures.forEach((err) => console.error(`  - ${err}`));
    }

    // Fail the test if any critical issues found
    expect(
      auditResults.consoleErrors.length,
      `Found ${auditResults.consoleErrors.length} console errors`
    ).toBe(0);
    expect(
      auditResults.networkErrors.length,
      `Found ${auditResults.networkErrors.length} network 500 errors`
    ).toBe(0);
    expect(
      auditResults.pageLoadFailures.length,
      `Found ${auditResults.pageLoadFailures.length} page load failures`
    ).toBe(0);
  });

  test('should verify API health endpoint', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);

    // Accept 200 (healthy), 503 (degraded), but not 500 (critical failure)
    expect(response.status()).not.toBe(500);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');

    // Log health status
    console.log(`\n✓ API Health Status: ${body.status}`);
    if (body.checks) {
      Object.entries(body.checks).forEach(([key, value]: [string, any]) => {
        const status = value?.status || 'unknown';
        const emoji = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✗';
        console.log(`  ${emoji} ${key}: ${status}`);
      });
    }
  });

  test('should load critical pages without crashes', async ({ page }) => {
    const auditResults: AuditResult = {
      consoleErrors: [],
      networkErrors: [],
      pageLoadFailures: [],
    };

    setupAuditTracking(page, auditResults);

    const criticalPages = ['/', '/menu', '/settings', '/analytics'];

    for (const pagePath of criticalPages) {
      try {
        await page.goto(`${BASE_URL}${pagePath}`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await page.waitForTimeout(1000);

        // Check if page rendered (not a blank error screen)
        const bodyText = await page.textContent('body');
        if (!bodyText || bodyText.trim().length === 0) {
          auditResults.pageLoadFailures.push(`${pagePath} - Page rendered but is blank`);
        }
      } catch (error: any) {
        auditResults.pageLoadFailures.push(`${pagePath} - ${error.message}`);
      }
    }

    // Report results
    if (auditResults.pageLoadFailures.length > 0) {
      console.error('\n❌ Critical Page Load Failures:');
      auditResults.pageLoadFailures.forEach((err) => console.error(`  - ${err}`));
    } else {
      console.log('\n✓ All critical pages loaded successfully');
    }

    // We allow some console errors on navigation but not page load failures
    expect(
      auditResults.pageLoadFailures.length,
      `Found ${auditResults.pageLoadFailures.length} page load failures`
    ).toBe(0);
  });
});
