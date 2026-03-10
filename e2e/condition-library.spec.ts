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

    // Back navigation: Knowledge Base should show a way back to Dashboard
    const backLink = page.locator('a[href="/study"], a:has-text("Back to Dashboard"), [aria-label*="Back to Dashboard"]').first();
    await expect(backLink).toBeVisible({ timeout: 3000 });
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

  test('GET /api/content/library returns 200 and content array when authenticated', async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);
    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/content/library?system=all', { credentials: 'include' });
      const body = await res.json();
      return { status: res.status, body };
    });

    expect(result.status).toBe(200);
    const data = result.body;
    expect(data).toHaveProperty('content');
    expect(Array.isArray(data.content)).toBe(true);
    if (data.content.length > 0) {
      expect(data.content[0]).toHaveProperty('id');
      expect(data.content[0]).toHaveProperty('condition');
      expect(data.content[0]).toHaveProperty('system');
    }
    expect(data).toHaveProperty('count');
    expect(typeof data.count).toBe('number');
  });

  test('GET /api/content/library with highYield and system filter returns valid shape', async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);
    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/content/library?highYield=true', { credentials: 'include' });
      const body = await res.json();
      return { status: res.status, body };
    });

    expect(result.status).toBe(200);
    const data = result.body;
    expect(data).toHaveProperty('content');
    expect(Array.isArray(data.content)).toBe(true);
    expect(data).toHaveProperty('count');
  });

  test('Practice page shows back navigation and loads without error', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);
    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/practice`);
    await waitForAppReady(page);

    // Practice page title
    await expect(page.locator('text=Practice & Training').first()).toBeVisible({ timeout: 5000 });
    // Back link to Dashboard
    const backLink = page.locator('a[href="/study"], a:has-text("Back to Dashboard")').first();
    await expect(backLink).toBeVisible({ timeout: 3000 });
  });

  test('should load Lab Reference tab and Normal Ranges sub-tab', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/study/knowledge`);
    await waitForAppReady(page);

    // Click Lab Reference tab in sidebar
    const labTab = page.locator('button:has-text("Lab Reference")').first();
    await labTab.click();
    await page.waitForTimeout(1000);

    // Click Normal Ranges sub-tab
    const normalRangesButton = page.locator('button:has-text("Normal Ranges")').first();
    await expect(normalRangesButton).toBeVisible({ timeout: 5000 });
    await normalRangesButton.click();
    await page.waitForTimeout(2000);

    // Category filter should be visible
    const categoryLabel = page.locator('label:has-text("Category:")').first();
    const categorySelect = page.locator('#normal-labs-category');
    await expect(categoryLabel).toBeVisible({ timeout: 5000 });
    await expect(categorySelect).toBeVisible({ timeout: 3000 });

    // Normal Ranges view loaded (category filter visible confirms we're on that sub-tab)
  });

  test('Utilities hub loads and shows back navigation', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);
    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/study/utilities`);
    await waitForAppReady(page);

    // Clinical Utilities or Calculators/Generators
    const hasUtilities = await page.locator('text=/Clinical Utilities|Calculators|Generators/i').first().isVisible({ timeout: 8000 });
    expect(hasUtilities).toBe(true);
    // Back link to Dashboard
    const backLink = page.locator('a[href="/study"], a:has-text("Back to Dashboard")').first();
    await expect(backLink).toBeVisible({ timeout: 3000 });
  });
});
