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

test.describe('Enhanced settings tab', () => {
  test('updates exam focus and streak preference', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    if (!(await isAuthenticated(page))) {
      test.skip();
      return;
    }

    await page.getByRole('button', { name: /Settings and Stats/i }).click();
    await page.getByRole('tab', { name: 'Settings' }).click();

    await expect(page.getByText('Your Exam Focus')).toBeVisible();

    await page.getByRole('button', { name: /Practicing PA/i }).click();
    await expect(page.getByText(/PANRE-LA Maintenance/i)).toBeVisible();

    await page.getByRole('button', { name: /Streak & Rest/i }).click();
    await page.getByRole('button', { name: /Weekdays only/i }).click();
    await expect(page.getByText(/weekends don’t break your streak/i)).toBeVisible();
  });
});
