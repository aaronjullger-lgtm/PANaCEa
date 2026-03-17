import { test, expect, type Page } from '@playwright/test';

const APP_ORIGIN = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'; // pragma: allowlist secret

async function waitForAppReady(page: Page) {
  await page.waitForSelector('[data-testid="app-container"], main, #root', {
    timeout: 10000,
    state: 'visible',
  });
}

async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const dashboardVisible = await page
      .locator('text=/dashboard|command center|study|daily challenges/i')
      .first()
      .isVisible({ timeout: 3000 });
    return dashboardVisible;
  } catch {
    return false;
  }
}

test.describe('Daily Challenges', () => {
  test('renders challenge cards and launches Diagnostic Puzzle mode', async ({ page }) => {
    await page.goto(`${APP_ORIGIN}/daily-challenges`);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    await expect(page.getByRole('heading', { name: /Daily Challenges/i })).toBeVisible();
    await expect(page.getByText('Grand Rounds')).toBeVisible();
    await expect(page.getByText('Diagnostic Puzzle')).toBeVisible();
    await expect(page.getByText('Medical Wordle')).toBeVisible();

    await page.getByRole('button', { name: /Start Puzzle|Review/i }).click();
    await page.waitForURL('**/modes/diagnostic-puzzle', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Daily Diagnostic Puzzle/i })).toBeVisible();
  });

  test('challenge buttons navigate to canonical mode routes', async ({ page }) => {
    await page.goto(`${APP_ORIGIN}/daily-challenges`);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    await page.getByRole('button', { name: /Start Challenge|Review/i }).click();
    await page.waitForURL('**/modes/grand-rounds', { timeout: 10000 });
    await expect(page.locator('text=/404|Page Not Found/i')).toHaveCount(0);

    await page.goto(`${APP_ORIGIN}/daily-challenges`);
    await page.getByRole('button', { name: /Start Wordle|Review/i }).click();
    await page.waitForURL('**/modes/medical-wordle', { timeout: 10000 });
    await expect(page.locator('text=/404|Page Not Found/i')).toHaveCount(0);
  });
});
