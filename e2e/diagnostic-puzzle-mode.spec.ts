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
      .locator('text=/dashboard|command center|study/i')
      .first()
      .isVisible({ timeout: 3000 });
    return dashboardVisible;
  } catch {
    return false;
  }
}

test.describe('Diagnostic Puzzle Mode', () => {
  test('supports guess submission and win state', async ({ page }) => {
    await page.goto(APP_ORIGIN);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    await page.route('**/api/diagnostic-puzzle/daily**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'daily-2026-03-09',
            date: '2026-03-09',
            puzzle: {
              id: 'puzzle-1',
              conditionId: 'condition-1',
              conditionName: 'Pneumonia',
              system: 'Pulmonary',
              title: 'Pulmonary challenge',
              difficulty: 3,
              clues: ['Fever, productive cough, pleuritic chest pain'],
              totalClues: 6,
            },
            userState: {
              guesses: [],
              status: 'playing',
              cluesRevealed: 1,
              attemptsLeft: 6,
              maxAttempts: 6,
            },
          },
        }),
      });
    });

    await page.route('**/api/diagnostic-puzzle/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            total: 8,
            wins: 5,
            losses: 3,
            winRate: 62.5,
            streak: 2,
            guessDistribution: { 1: 1, 2: 2, 3: 1, 4: 1, 5: 0, 6: 0 },
          },
        }),
      });
    });

    let submitCount = 0;
    await page.route('**/api/diagnostic-puzzle/submit', async (route) => {
      submitCount += 1;
      const won = submitCount >= 2;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'daily-2026-03-09',
            date: '2026-03-09',
            puzzle: {
              id: 'puzzle-1',
              conditionId: 'condition-1',
              conditionName: 'Pneumonia',
              system: 'Pulmonary',
              title: 'Pulmonary challenge',
              difficulty: 3,
              clues: ['Fever, productive cough, pleuritic chest pain', 'Crackles at right base'],
              totalClues: 6,
            },
            userState: {
              guesses: won ? ['asthma', 'pneumonia'] : ['asthma'],
              status: won ? 'won' : 'playing',
              cluesRevealed: 2,
              attemptsLeft: won ? 4 : 5,
              maxAttempts: 6,
            },
          },
        }),
      });
    });

    await page.goto(`${APP_ORIGIN}/modes/diagnostic-puzzle`);
    await expect(page.getByRole('heading', { name: /Daily Diagnostic Puzzle/i })).toBeVisible();

    await page.getByPlaceholder(/Enter diagnosis/i).fill('Asthma');
    await page.getByRole('button', { name: /Submit Guess/i }).click();
    await expect(page.getByText(/Your Guesses/i)).toBeVisible();
    await expect(page.getByText(/Incorrect/i).first()).toBeVisible();

    await page.getByPlaceholder(/Enter diagnosis/i).fill('Pneumonia');
    await page.getByRole('button', { name: /Submit Guess/i }).click();
    await expect(page.getByText(/Excellent Diagnosis/i)).toBeVisible();
  });
});
