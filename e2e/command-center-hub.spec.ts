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

test.describe('Command Center Hub controls', () => {
  test('current curriculum quick controls update state and open settings', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    if (!(await isAuthenticated(page))) {
      test.skip();
      return;
    }

    const disableAll = page.getByRole('button', { name: 'Disable All' });
    if (!(await disableAll.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Visible only in student context.
      test.skip();
      return;
    }

    await disableAll.click();
    await expect(page.getByText(/Enable at least one system to test/i)).toBeVisible();

    await page.getByRole('button', { name: 'Enable All' }).click();
    await expect(page.getByText(/All systems enabled/i)).toBeVisible();

    await page.getByRole('button', { name: /More options/i }).click();
    await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
  });
});
