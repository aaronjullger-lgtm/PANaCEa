/**
 * Accessibility Regression (axe-core)
 *
 * Roo Code quality: WCAG 2.1 AA compliance check via axe.
 * Runs on key pages to catch a11y regressions in E2E.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('A11y Regression (axe-core)', () => {
  test('landing page has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="app-container"], main, #root', {
      timeout: 10000,
      state: 'visible',
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical, `Critical a11y violations: ${JSON.stringify(critical, null, 2)}`).toHaveLength(
      0
    );
  });

  test('landing page has no serious a11y violations', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="app-container"], main, #root', {
      timeout: 10000,
      state: 'visible',
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === 'serious');
    expect(serious, `Serious a11y violations: ${JSON.stringify(serious, null, 2)}`).toHaveLength(0);
  });
});
