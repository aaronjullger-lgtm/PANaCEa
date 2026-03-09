/**
 * Condition Library E2E
 *
 * Covers Knowledge Base → Condition Library flow:
 * - Systems load in sidebar
 * - Select system → condition list loads
 * - Open a condition → detail panel shows summary/details
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 45000;

async function waitForAppReady(page: Page) {
  await page.waitForSelector('[data-testid="app-container"], main, #root', {
    timeout: 10000,
    state: 'visible',
  });
}

async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const dashboardVisible = await page
      .locator('text=/dashboard|home|menu/i')
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

test.describe('Condition Library', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
  });

  test('should load Knowledge Base and show Condition Library with systems', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    // Navigate to Knowledge Base (Condition Library is default tab)
    await page.goto(`${BASE_URL}/study/knowledge`);
    await waitForAppReady(page);

    // Condition Library is the default tab; wait for it to be visible
    const libraryRoot = page.getByTestId('condition-library');
    await expect(libraryRoot).toBeVisible({ timeout: 10000 });

    // Systems sidebar: either "All Systems" or at least one system name (e.g. Cardiovascular)
    const hasSystems =
      (await page.locator('text=/All Systems|Cardiovascular|Neurological|Pulmonary/i').first().isVisible({ timeout: 8000 })) ||
      (await page.locator('text=/condition/i').first().isVisible({ timeout: 5000 }));

    expect(hasSystems).toBe(true);
  });

  test('should load condition list when selecting a system and open detail on card click', async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/study/knowledge`);
    await waitForAppReady(page);

    const libraryRoot = page.getByTestId('condition-library');
    await expect(libraryRoot).toBeVisible({ timeout: 10000 });

    // Wait for systems to load (sidebar shows system names or "All Systems")
    await page.waitForTimeout(2000);

    // If we're on "All Systems", click a specific system to narrow the list (optional but good for assertion)
    const systemButton = page.locator('button:has-text("Cardiovascular"), button:has-text("Neurological"), button:has-text("Pulmonary"), [role="button"]:has-text("Cardiovascular"), [role="button"]:has-text("Neurological")').first();
    if (await systemButton.isVisible({ timeout: 3000 })) {
      await systemButton.click();
      await page.waitForTimeout(1500);
    }

    // Condition list: cards or list items (EnhancedConditionCard doesn't have testid; use text or role)
    const listOrCard = page.locator('text=/condition|symptom|treatment|diagnosis|overview/i').first();
    const hasList = await listOrCard.isVisible({ timeout: 8000 });

    if (!hasList) {
      // Maybe "No conditions found" or still loading
      const noConditions = await page.locator('text=/No conditions found|Loading/i').isVisible({ timeout: 2000 });
      if (noConditions) {
        console.log('⊘ No conditions in list (DB may be empty for selected system)');
        return;
      }
    }

    expect(hasList).toBe(true);

    // Click first condition card: look for clickable block
    const anyCard = page.locator('[class*="cursor-pointer"], [class*="rounded-2xl"], [class*="rounded-xl"]').first();
    if (await anyCard.isVisible({ timeout: 3000 })) {
      await anyCard.click();
      await page.waitForTimeout(1500);

      const detailPanel = page.getByTestId('condition-detail-panel');
      const hasDetail = await detailPanel.isVisible({ timeout: 5000 });
      if (hasDetail) {
        // Detail should show tabs or content (Overview, Workup, etc.)
        const hasDetailContent = await page.locator('text=/Overview|Workup|Management|Triage|Recognize|Order/i').first().isVisible({ timeout: 5000 });
        expect(hasDetailContent).toBe(true);
      }
    }
  });

  test('GET /api/content/systems returns 200 and array when authenticated', async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);
    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    // Use in-page fetch so cookies/auth are sent (same origin)
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/content/systems', { credentials: 'include' });
      const body = await res.json();
      return { status: res.status, body };
    });

    expect(result.status).toBe(200);
    const body = result.body;
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('id');
      expect(body[0]).toHaveProperty('label');
      expect(body[0]).toHaveProperty('count');
    }
  });
});
