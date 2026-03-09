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

test.describe('Admin - curation and enrichment flows', () => {
  test('opens Question Curation and Library Enrichment panels', async ({ page }) => {
    await page.goto(APP_ORIGIN);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    await page.route('**/api/admin/check-access**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { role: 'admin' } }),
      });
    });

    await page.route('**/api/admin/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            totalUsers: 12,
            activeUsersToday: 4,
            totalStudySessions: 200,
            averageAccuracy: 71,
            pendingFlags: 2,
          },
        }),
      });
    });

    await page.route('**/api/questions/pool**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          questions: [
            {
              id: 'q-curation-1',
              questionType: 'multiple_choice',
              system: 'Cardiovascular',
              conditionId: 'condition-1',
              difficulty: 'medium',
              questionData: {
                question: 'A 64-year-old presents with exertional chest pain. Most likely diagnosis?',
                options: ['Stable angina', 'Pericarditis', 'Aortic dissection', 'Pulmonary embolism'],
                correctAnswerIndex: 0,
                rationale: 'Stable angina is classically exertional and relieved by rest.',
              },
              generatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/questions/curate**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/admin/library-enrichment-logs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 1,
          logs: [
            {
              timestamp: new Date().toISOString(),
              entityType: 'Condition',
              entityId: 'c1',
              entityName: 'Asthma',
              missingField: 'management',
              status: 'success',
            },
          ],
        }),
      });
    });

    await page.route('**/api/admin/library-enrichment-priority**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          priorityList: [
            {
              id: 'c1',
              name: 'Asthma',
              system: 'Pulmonary',
              missingFields: ['management'],
              existingValues: {},
              panceYield: 4,
            },
          ],
        }),
      });
    });

    await page.goto(`${APP_ORIGIN}/admin`);
    await expect(page.getByRole('heading', { name: /Admin Dashboard/i })).toBeVisible();

    await page.getByRole('button', { name: /Question Curation/i }).click();
    await expect(page.getByText(/Review and approve AI-generated questions/i)).toBeVisible();

    await page
      .locator('text=/exertional chest pain/i')
      .first()
      .click();
    await page.getByRole('button', { name: /Approve/i }).click();

    await page.getByLabel('Back to dashboard').click();
    await page.getByRole('button', { name: /Library Enrichment/i }).click();
    await expect(page.getByText(/Targeted RAG Library Enrichment/i)).toBeVisible();
    await expect(page.getByText('Asthma')).toBeVisible();
  });
});
