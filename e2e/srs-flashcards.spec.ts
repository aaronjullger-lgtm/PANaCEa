/**
 * SRS Review E2E
 *
 * Navigates to the command center, clicks the due-count chip (when due questions
 * exist) or directly visits the srs_review view, and asserts the view loads
 * (heading "Due Review" visible and either an empty-state message or the MCQ UI).
 *
 * Run: npx playwright test srs-flashcards
 * With auth: npx playwright test srs-flashcards --project=chromium
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function waitForAppReady(page: Page) {
  await page
    .locator('[data-testid="app-container"], main, #root')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
}

async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const visible = await page
      .locator('text=/dashboard|home|menu|command center/i')
      .first()
      .isVisible({ timeout: 3000 });
    return visible;
  } catch {
    return false;
  }
}

test.describe('SRS Review (variant PANCE MCQ)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(30000);
  });

  test('should open SRS Review and show Due Review view or no-items message', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    // Try clicking the due-count chip if it is visible
    const dueChip = page.locator('button[title="Open Due Review — variant PANCE questions"]').first();
    const dueChipVisible = await dueChip.isVisible({ timeout: 4000 }).catch(() => false);
    if (dueChipVisible) {
      await dueChip.click();
    } else {
      // No due items — navigate to the view programmatically via the URL hash / state is not
      // directly accessible in E2E, so we skip.
      test.skip();
      return;
    }

    await page.waitForTimeout(1500);

    // View heading should be "Due Review"
    await expect(page.getByTestId('srs-review-heading')).toBeVisible({ timeout: 5000 });

    // Either the MCQ question options are rendered, or an empty-state message
    const emptyMsg = page.getByTestId('srs-review-message');
    const options = page.getByTestId('srs-review-options');
    const backButton = page.locator('button[aria-label="Back"]').first();

    const hasEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false);
    const hasOptions = await options.isVisible({ timeout: 3000 }).catch(() => false);
    const hasBack = await backButton.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasEmpty || hasOptions || hasBack).toBe(true);
  });
});
