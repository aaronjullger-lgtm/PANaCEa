/**
 * Accessibility Regression (axe-core)
 *
 * WCAG 2.1 AA compliance via axe across critical user flows:
 *   - Landing page (unauthenticated)
 *   - Study hub / dashboard
 *   - Core adaptive (quiz session)
 *   - Practice modes launcher
 *   - Drill pages (ECG, rapid recall, pharmacology as representatives)
 *   - Patient encounter (OSCE)
 *   - Progress / analytics
 *
 * NOTE: Most routes behind Clerk auth will redirect to landing in CI.
 * The tests still catch a11y regressions on the redirect target and
 * any partially-rendered shell. Auth-gated deep testing requires a
 * Clerk test user (future enhancement).
 *
 * @module e2e/a11y-regression
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for the app shell to be visible before running axe. */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-container"], main, #root', {
    timeout: 10000,
    state: 'visible',
  });
}

/** Run axe-core against the current page and return violations grouped by impact. */
async function runAxe(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  return {
    critical: results.violations.filter((v) => v.impact === 'critical'),
    serious: results.violations.filter((v) => v.impact === 'serious'),
    all: results.violations,
  };
}

// ── Landing Page ─────────────────────────────────────────────────────────────

test.describe('A11y Regression — Landing Page', () => {
  test('no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);

    const { critical } = await runAxe(page);
    expect(critical, `Critical violations:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });

  test('no serious a11y violations', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);

    const { serious } = await runAxe(page);
    expect(serious, `Serious violations:\n${JSON.stringify(serious, null, 2)}`).toHaveLength(0);
  });
});

// ── Study Hub (Dashboard) ────────────────────────────────────────────────────

test.describe('A11y Regression — Study Hub', () => {
  test('no critical a11y violations on /study', async ({ page }) => {
    await page.goto('/study');
    await waitForApp(page);

    const { critical } = await runAxe(page);
    expect(critical, `Critical violations:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });

  test('no serious a11y violations on /study', async ({ page }) => {
    await page.goto('/study');
    await waitForApp(page);

    const { serious } = await runAxe(page);
    expect(serious, `Serious violations:\n${JSON.stringify(serious, null, 2)}`).toHaveLength(0);
  });
});

// ── Core Adaptive (Quiz Session) ─────────────────────────────────────────────

test.describe('A11y Regression — Core Adaptive (Quiz)', () => {
  test('no critical a11y violations on /core-adaptive', async ({ page }) => {
    await page.goto('/core-adaptive');
    await waitForApp(page);

    const { critical } = await runAxe(page);
    expect(critical, `Critical violations:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });
});

// ── Practice Modes Launcher ──────────────────────────────────────────────────

test.describe('A11y Regression — Practice Modes', () => {
  test('no critical a11y violations on /practice', async ({ page }) => {
    await page.goto('/practice');
    await waitForApp(page);

    const { critical } = await runAxe(page);
    expect(critical, `Critical violations:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });
});

// ── Representative Drill Pages ───────────────────────────────────────────────

test.describe('A11y Regression — Drill Pages', () => {
  const drillPaths = [
    '/modes/ecg-drill',
    '/modes/rapid-recall',
    '/modes/pharmacology',
  ];

  for (const drillPath of drillPaths) {
    test(`no critical a11y violations on ${drillPath}`, async ({ page }) => {
      await page.goto(drillPath);
      await waitForApp(page);

      const { critical } = await runAxe(page);
      expect(critical, `Critical violations on ${drillPath}:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
    });
  }
});

// ── OSCE / Patient Encounter ─────────────────────────────────────────────────

test.describe('A11y Regression — OSCE Patient Encounter', () => {
  test('no critical a11y violations on /modes/patient-encounter', async ({ page }) => {
    await page.goto('/modes/patient-encounter');
    await waitForApp(page);

    const { critical } = await runAxe(page);
    expect(critical, `Critical violations:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });
});

// ── Progress / Analytics ─────────────────────────────────────────────────────

test.describe('A11y Regression — Progress Dashboard', () => {
  test('no critical a11y violations on /progress', async ({ page }) => {
    await page.goto('/progress');
    await waitForApp(page);

    const { critical } = await runAxe(page);
    expect(critical, `Critical violations:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });

  test('no serious a11y violations on /progress', async ({ page }) => {
    await page.goto('/progress');
    await waitForApp(page);

    const { serious } = await runAxe(page);
    expect(serious, `Serious violations:\n${JSON.stringify(serious, null, 2)}`).toHaveLength(0);
  });
});
