import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'; // pragma: allowlist secret

async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="app-container"], main, #root', {
    timeout: 10000,
    state: 'visible',
  });
}

async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const dashboardVisible = await page
      .locator('text=/dashboard|command center|study/i')
      .first()
      .isVisible({ timeout: 2000 });
    const userMenuVisible = await page
      .locator('[data-testid="user-menu"], [aria-label*="user"], button:has-text("Sign Out")')
      .first()
      .isVisible({ timeout: 2000 });
    return dashboardVisible || userMenuVisible;
  } catch {
    return false;
  }
}

test.describe('Patient Encounter flow', () => {
  test('opens mode, starts interview, submits history question', async ({ page }) => {
    test.setTimeout(60000);

    const osceRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        url.includes('/api/osce/cases/random') ||
        url.includes('/api/osce/session') ||
        url.includes('/api/osce/chat')
      ) {
        osceRequests.push(`${request.method()} ${url}`);
      }
    });

    // Keep this deterministic without external model dependencies.
    await page.route('**/api/gemini-proxy', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            text: 'It started about two hours ago and gets worse when I walk upstairs.',
          },
        }),
      });
    });

    await page.goto(BASE_URL);
    await waitForAppReady(page);

    if (!(await isAuthenticated(page))) {
      test.skip();
      return;
    }

    const startEncounterButton = page.getByRole('button', { name: /start encounter/i }).first();
    if (await startEncounterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startEncounterButton.click();
    } else {
      // Fallback keeps the test useful when command-center layout changes.
      await page.goto(`${BASE_URL}/?view=patient_encounter`);
    }

    await expect(page.getByText(/virtual patient encounter/i).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /start interview/i }).click();

    await expect(page.getByText(/virtual osce/i).first()).toBeVisible({ timeout: 15000 });

    const questionInput = page.getByPlaceholder(/when did the chest pain start/i);
    await questionInput.fill('When did your pain start?');
    await page.getByRole('button', { name: /send question/i }).click();

    await expect(page.getByText(/Q:\s*When did your pain start\?/i).first()).toBeVisible({
      timeout: 15000,
    });

    expect(osceRequests.some((r) => r.includes('/api/osce/cases/random'))).toBe(true);
    expect(osceRequests.some((r) => r.includes('/api/osce/session'))).toBe(true);
  });
});
