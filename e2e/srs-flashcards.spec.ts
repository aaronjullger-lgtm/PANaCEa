/**
 * SRS Flashcards E2E
 *
 * Opens Study Tools → Resources, clicks SRS Flashcards, and asserts the view loads
 * (heading visible and either "No cards due" or card UI).
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

test.describe('SRS Flashcards', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(30000);
  });

  test('should open SRS Flashcards and show view or no cards message', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    // Open Clinical Resources tab (Study Tools section)
    const resourcesTab = page
      .locator('#study-tools-tab-resources, button:has-text("Clinical Resources")')
      .first();
    if (await resourcesTab.isVisible({ timeout: 5000 })) {
      await resourcesTab.click();
      await page.waitForTimeout(800);
    }

    // Click SRS Flashcards
    const srsButton = page.locator('button:has-text("SRS Flashcards")').first();
    await expect(srsButton).toBeVisible({ timeout: 8000 });
    await srsButton.click();

    await page.waitForTimeout(1500);

    // View should show heading "SRS Flashcards"
    await expect(page.getByTestId('srs-flashcards-heading')).toBeVisible({ timeout: 5000 });

    // Either: "No cards due" / error message, or card UI (rating buttons or loading)
    const noCards = page.locator('text=/No cards due|Could not load/i').first();
    const loading = page.locator('text=/Loading next card/i').first();
    const ratingButtons = page.locator('button:has-text("Again"), button:has-text("Good")').first();
    const backButton = page.locator('button[aria-label="Back"]').first();

    const hasNoCards = await noCards.isVisible({ timeout: 3000 }).catch(() => false);
    const hasLoading = await loading.isVisible({ timeout: 2000 }).catch(() => false);
    const hasRating = await ratingButtons.isVisible({ timeout: 3000 }).catch(() => false);
    const hasBack = await backButton.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasNoCards || hasLoading || hasRating || hasBack).toBe(true);
  });
});
