import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || '[REDACTED]';

async function waitForAppReady(page: Page) {
  await page
    .locator('[data-testid="app-container"], main, #root')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
}

async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    return await page
      .locator('text=/dashboard|home|menu|command center|Start Session/i')
      .first()
      .isVisible({ timeout: 3000 });
  } catch {
    return false;
  }
}

test.describe('Reference Library interactions', () => {
  test('search, high-yield toggle, and detail panel controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/study/reference`);
    await waitForAppReady(page);

    if (!(await isAuthenticated(page))) {
      test.skip();
      return;
    }

    // Ensure sidebar and search are rendered.
    await expect(page.getByText('Reference Library').first()).toBeVisible({ timeout: 15000 });
    const searchInput = page.getByPlaceholder('Search conditions...').first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill('diabetes');
    await page.waitForTimeout(800);

    const highYieldToggle = page.getByRole('button', { name: /High Yield Only/i });
    await expect(highYieldToggle).toBeVisible();
    await highYieldToggle.click();

    // Cards are rendered as buttons; click first visible condition card.
    const firstConditionCard = page.locator('button:has-text("Key Clinical Features")').first();
    await expect(firstConditionCard).toBeVisible({ timeout: 10000 });
    await firstConditionCard.click();

    await expect(page.locator('button[title="Close (Esc)"]')).toBeVisible();
    await expect(page.locator('button[title="Next (→ or j)"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('button[title="Close (Esc)"]')).toBeHidden({ timeout: 5000 });
  });

  test('slash keyboard shortcut focuses the library search input', async ({ page }) => {
    await page.goto(`${BASE_URL}/study/reference`);
    await waitForAppReady(page);

    if (!(await isAuthenticated(page))) {
      test.skip();
      return;
    }

    const headerSearch = page
      .getByPlaceholder('Search conditions... (press /)')
      .first();
    await expect(headerSearch).toBeVisible({ timeout: 15000 });

    await page.keyboard.press('/');
    await expect(headerSearch).toBeFocused();
  });
});
