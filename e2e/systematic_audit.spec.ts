/**
 * SYSTEMATIC FEATURE AUDIT
 *
 * Phase 1: Intent Discovery - Maps every route and identifies primary actions
 * Phase 2: Visual & Functional Verification - Tests each feature's core intent
 * Phase 3: Auto-Fix - Logs failures for context-aware fixes
 *
 * Mobile responsiveness check at 375x812 (iPhone X)
 */

import { test, expect, type Page } from '@playwright/test';

// =====================================================
// CONFIGURATION
// =====================================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MOBILE_VIEWPORT = { width: 375, height: 812 };

// Timeout configuration
const SHORT_TIMEOUT = 5000;
const MEDIUM_TIMEOUT = 10000;

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Wait for app to be fully loaded
 */
async function waitForAppReady(page: Page) {
  await page.waitForSelector('[data-testid="app-container"], main, #root', {
    timeout: MEDIUM_TIMEOUT,
    state: 'visible',
  });
  // Wait for any initial animations to complete
  await page.waitForTimeout(500);
}

/**
 * Check if user is authenticated
 */
async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    return await page
      .locator(
        [
          '[data-testid="command-center-workspace"]',
          'header:has-text("Search conditions")',
          'nav a[href="/study"]',
          'button:has-text(/start|begin|build session/i)',
        ].join(', ')
      )
      .first()
      .isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

/**
 * Listen for console errors
 */
function setupErrorListeners(page: Page) {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`[Page Error] ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    const status = request.failure()?.errorText || 'Unknown';
    if (request.url().includes('/api/')) {
      errors.push(`[Network Error] ${request.method()} ${request.url()} - ${status}`);
    }
  });

  return errors;
}

/**
 * Check for horizontal scrollbar (mobile responsiveness issue)
 */
async function hasHorizontalScrollbar(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
}

/**
 * Log audit finding to file
 */
function logFinding(
  category: string,
  route: string,
  status: 'PASS' | 'FAIL' | 'WARN',
  message: string
) {
  console.log(`[${status}] [${category}] ${route}: ${message}`);
}

// =====================================================
// PHASE 1: INTENT DISCOVERY & ROUTE MAPPING
// =====================================================

test.describe('Phase 1: Route Discovery', () => {
  test('should map all primary routes', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);

    if (!isAuth) {
      logFinding('ROUTE_MAP', '/', 'WARN', 'User not authenticated - limited route access');
      test.skip();
      return;
    }

    // Route map based on App.tsx analysis
    const routes = [
      { path: '/', name: 'Command Center', intent: 'Dashboard with training modes' },
      { path: '/study', name: 'Study Hub', intent: 'Study tools and resources' },
      { path: '/study/reference', name: 'Reference Library', intent: 'Clinical reference content' },
      { path: '/study/toolkit', name: 'Toolkit Hub', intent: 'Clinical calculators and tools' },
      { path: '/admin', name: 'Admin Dashboard', intent: 'Admin controls' },
    ];

    logFinding('ROUTE_MAP', 'ALL', 'PASS', `Mapped ${routes.length} primary routes`);

    for (const route of routes) {
      console.log(`  - ${route.path}: ${route.name} (${route.intent})`);
    }

    expect(errors.length).toBe(0);
  });
});

// =====================================================
// PHASE 2: VISUAL & FUNCTIONAL VERIFICATION
// =====================================================

test.describe('Phase 2A: Command Center (Dashboard)', () => {
  test('should render command center with primary components', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      logFinding('COMMAND_CENTER', '/', 'WARN', 'Authentication required');
      test.skip();
      return;
    }

    // Primary Action: Start a training session
    const hasStartButton = await page
      .locator('button:has-text(/start|begin|build session/i), text=/start session/i')
      .first()
      .isVisible({ timeout: SHORT_TIMEOUT })
      .catch(() => false);

    if (!hasStartButton) {
      logFinding(
        'COMMAND_CENTER',
        '/',
        'FAIL',
        'Primary action (Start Session) button not visible'
      );
    } else {
      logFinding('COMMAND_CENTER', '/', 'PASS', 'Start Session button visible');
    }

    // Check for training modes grid
    const hasDrillModes = await page
      .locator('text=/drill|mode|training/i')
      .first()
      .isVisible({ timeout: SHORT_TIMEOUT })
      .catch(() => false);

    if (hasDrillModes) {
      logFinding('COMMAND_CENTER', '/', 'PASS', 'Training modes visible');
    }

    // Check for analytics/stats section
    const hasAnalytics = await page
      .locator('text=/progress|performance|mastery|analytics/i')
      .first()
      .isVisible({ timeout: SHORT_TIMEOUT })
      .catch(() => false);

    if (hasAnalytics) {
      logFinding('COMMAND_CENTER', '/', 'PASS', 'Analytics section visible');
    }

    // Critical errors check
    if (errors.length > 0) {
      logFinding('COMMAND_CENTER', '/', 'FAIL', `Console errors detected: ${errors.length}`);
      console.log(errors);
    }

    expect(hasStartButton || hasDrillModes).toBe(true);
  });

  test('should be mobile responsive (no horizontal scroll)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const hasHScroll = await hasHorizontalScrollbar(page);

    if (hasHScroll) {
      logFinding('COMMAND_CENTER', '/ (mobile)', 'FAIL', 'Horizontal scrollbar detected on mobile');
    } else {
      logFinding('COMMAND_CENTER', '/ (mobile)', 'PASS', 'No horizontal scroll on mobile');
    }

    expect(hasHScroll).toBe(false);
  });

  test('should navigate to drill mode', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    // Try to click any drill mode card
    const drillSelectors = [
      'text=/rapid recall/i',
      'text=/photo drill/i',
      'text=/pharmacology/i',
      'button:has-text(/drill|mode/i)',
    ];

    let clicked = false;
    for (const selector of drillSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          clicked = true;
          logFinding('DRILL_NAVIGATION', selector, 'PASS', 'Drill mode accessible');
          break;
        }
      } catch {
        continue;
      }
    }

    if (clicked) {
      // Wait for drill interface to load
      await page.waitForTimeout(2000);

      // Check if drill UI is visible
      const hasDrillUI = await page
        .locator('text=/start drill|begin|question|card/i')
        .first()
        .isVisible({ timeout: SHORT_TIMEOUT })
        .catch(() => false);

      if (!hasDrillUI) {
        logFinding('DRILL_NAVIGATION', 'drill_mode', 'FAIL', 'Drill interface did not load');
      } else {
        logFinding('DRILL_NAVIGATION', 'drill_mode', 'PASS', 'Drill interface loaded');
      }
    } else {
      logFinding('DRILL_NAVIGATION', 'all', 'FAIL', 'No drill modes clickable');
    }

    expect(errors.length).toBeLessThan(3);
  });
});

test.describe('Phase 2B: Reference Library', () => {
  test('should render reference library', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/study/reference`);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      logFinding('REFERENCE_LIBRARY', '/study/reference', 'WARN', 'Authentication required');
      test.skip();
      return;
    }

    // Primary Action: Search or browse clinical content
    const hasSearch = await page
      .locator('input[type="search"], input[placeholder*="search" i], [role="searchbox"]')
      .first()
      .isVisible({ timeout: SHORT_TIMEOUT })
      .catch(() => false);

    const hasBrowse = await page
      .locator('text=/condition|category|system|browse/i')
      .first()
      .isVisible({ timeout: SHORT_TIMEOUT })
      .catch(() => false);

    if (!hasSearch && !hasBrowse) {
      logFinding(
        'REFERENCE_LIBRARY',
        '/study/reference',
        'FAIL',
        'No search or browse interface visible'
      );
    } else {
      logFinding(
        'REFERENCE_LIBRARY',
        '/study/reference',
        'PASS',
        'Search/browse interface visible'
      );
    }

    if (errors.length > 0) {
      logFinding('REFERENCE_LIBRARY', '/study/reference', 'FAIL', `Errors: ${errors.length}`);
      console.log(errors);
    }

    expect(hasSearch || hasBrowse).toBe(true);
  });

  test('should search and view content', async ({ page }) => {
    await page.goto(`${BASE_URL}/study/reference`);
    await waitForAppReady(page);

    // Try to search for "diabetes"
    const searchBox = page.locator('input[type="search"], input[placeholder*="search" i]').first();

    if (await searchBox.isVisible({ timeout: 3000 })) {
      await searchBox.fill('diabetes');
      await page.waitForTimeout(1000);

      // Check if results appear
      const hasResults = await page
        .locator('text=/diabetes/i')
        .nth(1) // Not the input itself
        .isVisible({ timeout: SHORT_TIMEOUT })
        .catch(() => false);

      if (hasResults) {
        logFinding('REFERENCE_LIBRARY', 'search', 'PASS', 'Search results displayed');

        // Try to click a result
        const resultCard = page.locator('article, .card, [role="button"]').first();
        if (await resultCard.isVisible({ timeout: 2000 })) {
          await resultCard.click();
          await page.waitForTimeout(1000);

          // Check if detail view loaded
          const hasDetail = await page
            .locator('text=/overview|treatment|symptoms/i')
            .first()
            .isVisible({ timeout: SHORT_TIMEOUT })
            .catch(() => false);

          if (hasDetail) {
            logFinding('REFERENCE_LIBRARY', 'detail_view', 'PASS', 'Content detail view loaded');
          } else {
            logFinding('REFERENCE_LIBRARY', 'detail_view', 'FAIL', 'Content detail did not load');
          }
        }
      } else {
        logFinding('REFERENCE_LIBRARY', 'search', 'WARN', 'No search results for "diabetes"');
      }
    } else {
      logFinding('REFERENCE_LIBRARY', 'search', 'WARN', 'Search box not found');
    }
  });

  test('should be mobile responsive', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/study/reference`);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      logFinding('REFERENCE_LIBRARY', '/study/reference (mobile)', 'WARN', 'Authentication required');
      test.skip();
      return;
    }

    const hasHScroll = await hasHorizontalScrollbar(page);

    if (hasHScroll) {
      logFinding(
        'REFERENCE_LIBRARY',
        '/study/reference (mobile)',
        'FAIL',
        'Horizontal scrollbar on mobile'
      );
    } else {
      logFinding('REFERENCE_LIBRARY', '/study/reference (mobile)', 'PASS', 'Mobile responsive');
    }

    expect(hasHScroll).toBe(false);
  });
});

test.describe('Phase 2C: Toolkit Hub (Calculators)', () => {
  test('should render toolkit hub', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/study/toolkit`);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      logFinding('TOOLKIT', '/study/toolkit', 'WARN', 'Authentication required');
      test.skip();
      return;
    }

    // Primary Action: Access clinical calculators
    const hasCalculators = await page
      .locator('text=/calculator|CURB-65|Wells|CHA.*DS.*VASc|GFR/i')
      .first()
      .isVisible({ timeout: SHORT_TIMEOUT })
      .catch(() => false);

    if (!hasCalculators) {
      logFinding('TOOLKIT', '/study/toolkit', 'FAIL', 'No calculators visible');
    } else {
      logFinding('TOOLKIT', '/study/toolkit', 'PASS', 'Calculators visible');
    }

    if (errors.length > 0) {
      logFinding('TOOLKIT', '/study/toolkit', 'FAIL', `Errors: ${errors.length}`);
      console.log(errors);
    }

    expect(hasCalculators).toBe(true);
  });

  test('should open and use a calculator', async ({ page }) => {
    await page.goto(`${BASE_URL}/study/toolkit`);
    await waitForAppReady(page);

    // Try to click CURB-65 or any calculator
    const calculatorCard = page.locator('text=/CURB-65|Wells|Anion Gap/i').first();

    if (await calculatorCard.isVisible({ timeout: 3000 })) {
      await calculatorCard.click();
      await page.waitForTimeout(1000);

      // Check if calculator UI loaded
      const hasCalculatorUI = await page
        .locator('text=/calculate|score|criteria|result/i, input, select')
        .first()
        .isVisible({ timeout: SHORT_TIMEOUT })
        .catch(() => false);

      if (hasCalculatorUI) {
        logFinding('TOOLKIT', 'calculator_ui', 'PASS', 'Calculator interface loaded');
      } else {
        logFinding('TOOLKIT', 'calculator_ui', 'FAIL', 'Calculator interface did not load');
      }
    } else {
      logFinding('TOOLKIT', 'calculator_access', 'WARN', 'Calculator card not found');
    }
  });

  test('should be mobile responsive', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/study/toolkit`);
    await waitForAppReady(page);

    const hasHScroll = await hasHorizontalScrollbar(page);

    if (hasHScroll) {
      logFinding('TOOLKIT', '/study/toolkit (mobile)', 'FAIL', 'Horizontal scrollbar on mobile');
    } else {
      logFinding('TOOLKIT', '/study/toolkit (mobile)', 'PASS', 'Mobile responsive');
    }

    expect(hasHScroll).toBe(false);
  });
});

test.describe('Phase 2D: SRS Flashcard System', () => {
  test('should access SRS flashcards from command center', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    // Look for SRS/Flashcard link
    const flashcardLink = page.locator('text=/flashcard|SRS|spaced repetition/i').first();

    if (await flashcardLink.isVisible({ timeout: 3000 })) {
      await flashcardLink.click();
      await page.waitForTimeout(1500);

      // Check if flashcard UI loaded
      const hasFlashcardUI = await page
        .locator('text=/deck|card|review|study/i, button:has-text(/flip|show/i)')
        .first()
        .isVisible({ timeout: SHORT_TIMEOUT })
        .catch(() => false);

      if (hasFlashcardUI) {
        logFinding('SRS_FLASHCARD', 'access', 'PASS', 'Flashcard interface loaded');
      } else {
        logFinding('SRS_FLASHCARD', 'access', 'FAIL', 'Flashcard interface did not load');
      }

      if (errors.length > 0) {
        logFinding('SRS_FLASHCARD', 'errors', 'FAIL', `Errors: ${errors.length}`);
        console.log(errors);
      }
    } else {
      logFinding('SRS_FLASHCARD', 'access', 'WARN', 'Flashcard link not found in command center');
    }
  });

  test('should interact with flashcard (flip)', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForAppReady(page);

    const isAuth = await isAuthenticated(page);
    if (!isAuth) {
      test.skip();
      return;
    }

    // Navigate to flashcards
    const flashcardLink = page.locator('text=/flashcard|SRS/i').first();
    if (await flashcardLink.isVisible({ timeout: 3000 })) {
      await flashcardLink.click();
      await page.waitForTimeout(1500);

      // Try to flip a card
      const flipButton = page.locator('button').filter({ hasText: /flip|show|reveal/i }).first();

      if (await flipButton.isVisible({ timeout: 3000 })) {
        await flipButton.click();
        await page.waitForTimeout(500);

        // Check if answer/back of card is visible
        const hasAnswer = await page
          .locator('text=/answer|explanation|back/i')
          .first()
          .isVisible({ timeout: SHORT_TIMEOUT })
          .catch(() => false);

        if (hasAnswer) {
          logFinding('SRS_FLASHCARD', 'flip', 'PASS', 'Card flip worked');
        } else {
          logFinding('SRS_FLASHCARD', 'flip', 'WARN', 'Card flip result unclear');
        }
      } else {
        logFinding('SRS_FLASHCARD', 'flip', 'WARN', 'Flip button not found (might not have cards)');
      }
    }
  });
});

test.describe('Phase 2E: Admin Dashboard', () => {
  test('should access admin dashboard', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/admin`);
    await waitForAppReady(page);

    // Check if admin UI loaded (might require admin role)
    const hasAdminUI = await page
      .locator('text=/admin|user management|content management|dashboard/i')
      .first()
      .isVisible({ timeout: SHORT_TIMEOUT })
      .catch(() => false);

    if (hasAdminUI) {
      logFinding('ADMIN', '/admin', 'PASS', 'Admin dashboard accessible');
    } else {
      logFinding(
        'ADMIN',
        '/admin',
        'WARN',
        'Admin dashboard not accessible (may require admin role)'
      );
    }

    if (errors.length > 0) {
      logFinding('ADMIN', '/admin', 'WARN', `Errors: ${errors.length}`);
    }
  });
});

// =====================================================
// PHASE 3: GLOBAL ERROR DETECTION
// =====================================================

test.describe('Phase 3: Global Error Detection', () => {
  test('should detect network errors across routes', async ({ page }) => {
    const networkErrors: string[] = [];

    page.on('requestfailed', (request) => {
      const url = request.url();
      if (url.includes('/api/') && !url.includes('/api/sync')) {
        const failure = request.failure();
        networkErrors.push(`${request.method()} ${url} - ${failure?.errorText}`);
      }
    });

    const routes = ['/', '/study/reference', '/study/toolkit'];

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`);
      await waitForAppReady(page);
    }

    if (networkErrors.length > 0) {
      logFinding('NETWORK', 'all_routes', 'FAIL', `${networkErrors.length} API errors detected`);
      console.log(networkErrors);
    } else {
      logFinding('NETWORK', 'all_routes', 'PASS', 'No API errors detected');
    }

    expect(networkErrors.length).toBe(0);
  });

  test('should detect console errors across routes', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known acceptable errors
        if (
          !text.includes('favicon') &&
          !text.includes('DevTools') &&
          !text.includes('extension')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    const routes = ['/', '/study/reference', '/study/toolkit'];

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`);
      await waitForAppReady(page);
    }

    if (consoleErrors.length > 0) {
      logFinding(
        'CONSOLE',
        'all_routes',
        'FAIL',
        `${consoleErrors.length} console errors detected`
      );
      console.log(consoleErrors);
    } else {
      logFinding('CONSOLE', 'all_routes', 'PASS', 'No console errors detected');
    }

    expect(consoleErrors.length).toBeLessThan(5);
  });
});
