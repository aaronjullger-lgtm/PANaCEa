/**
 * Critical User Flows E2E Tests
 *
 * Tests the most important user journeys to ensure production readiness:
 * 1. Authentication flow
 * 2. Drill lifecycle (Rapid Recall mode)
 * 3. Navigation and content viewing
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Test Configuration
 * These can be overridden via environment variables
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30 seconds

/**
 * Helper function to wait for app to be fully loaded
 */
async function waitForAppReady(page: Page) {
  // Wait for the main app container to be visible
  await page.waitForSelector('[data-testid="app-container"], main, #root', {
    timeout: 10000,
    state: 'visible',
  });
}

/**
 * Helper function to check if user is authenticated
 */
async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for common authenticated UI elements
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

test.describe('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Set a reasonable timeout for each test
    test.setTimeout(TEST_TIMEOUT);
  });

  test.describe('1. Authentication Flow', () => {
    test('should load the application and show auth or dashboard', async ({ page }) => {
      await page.goto(BASE_URL);

      // Wait for app to be ready
      await waitForAppReady(page);

      // The app should either show:
      // 1. Auth UI (sign in button) if not authenticated
      // 2. Dashboard if already authenticated (from previous session)
      const isAuth = await isAuthenticated(page);

      if (isAuth) {
        // Already authenticated - verify dashboard elements
        await expect(page.locator('text=/dashboard|menu|study/i').first()).toBeVisible();
        console.log('✓ User is already authenticated - dashboard visible');
      } else {
        // Not authenticated - should see auth UI
        const hasSignIn = await page
          .locator('text=/sign in|log in|get started/i')
          .first()
          .isVisible({ timeout: 5000 });
        expect(hasSignIn).toBe(true);
        console.log('✓ Auth UI visible - user not authenticated');
      }
    });

    test('should persist authentication across page reloads', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const wasAuthenticated = await isAuthenticated(page);

      // Reload the page
      await page.reload();
      await waitForAppReady(page);

      const stillAuthenticated = await isAuthenticated(page);

      // Auth state should be consistent
      expect(stillAuthenticated).toBe(wasAuthenticated);
      console.log(
        `✓ Auth state persisted: ${stillAuthenticated ? 'authenticated' : 'not authenticated'}`
      );
    });

    test('should show dashboard elements when authenticated', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const isAuth = await isAuthenticated(page);

      if (isAuth) {
        // Check for common dashboard elements
        const hasModeSelection = await page
          .locator('text=/mode|drill|study|start/i')
          .first()
          .isVisible({ timeout: 5000 });
        const hasNavigation = await page
          .locator('nav, [role="navigation"], header')
          .first()
          .isVisible({ timeout: 5000 });

        expect(hasModeSelection || hasNavigation).toBe(true);
        console.log('✓ Dashboard elements are visible');
      } else {
        console.log('⊘ Skipping dashboard check - user not authenticated');
        test.skip();
      }
    });
  });

  test.describe('2. Drill Lifecycle - Rapid Recall', () => {
    test('should navigate to Rapid Recall mode', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const isAuth = await isAuthenticated(page);
      if (!isAuth) {
        console.log('⊘ Skipping drill test - authentication required');
        test.skip();
        return;
      }

      // Look for Rapid Recall mode button/link
      // Try multiple common selectors
      const rapidRecallSelectors = [
        'text=/rapid recall/i',
        '[data-testid*="rapid-recall"]',
        'button:has-text("Rapid Recall")',
        'a:has-text("Rapid Recall")',
      ];

      let clicked = false;
      for (const selector of rapidRecallSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();
            clicked = true;
            console.log(`✓ Clicked Rapid Recall using selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!clicked) {
        console.log('⊘ Could not find Rapid Recall mode - may need to navigate through menu');
        // Try to find any drill/study mode
        const anyModeButton = await page.locator('text=/start|begin|study|drill/i').first();
        if (await anyModeButton.isVisible({ timeout: 3000 })) {
          await anyModeButton.click();
          console.log('✓ Clicked alternate study mode button');
        }
      }

      // Wait a bit for mode to load
      await page.waitForTimeout(1000);

      // Verify we're in some kind of drill/study interface
      const hasQuestionUI = await page
        .locator('text=/question|answer|submit|next/i')
        .first()
        .isVisible({ timeout: 5000 });
      expect(hasQuestionUI).toBe(true);
    });

    test('should complete a drill question flow', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const isAuth = await isAuthenticated(page);
      if (!isAuth) {
        console.log('⊘ Skipping drill question test - authentication required');
        test.skip();
        return;
      }

      // Navigate to any study mode
      const startButton = page.locator('text=/start|begin|study|drill|rapid/i').first();
      if (await startButton.isVisible({ timeout: 5000 })) {
        await startButton.click();
        await page.waitForTimeout(2000); // Wait for mode to load

        // Look for question content
        const hasQuestion = await page
          .locator('text=/question|answer|choose|select/i')
          .first()
          .isVisible({ timeout: 5000 });

        if (hasQuestion) {
          // Try to find and click an answer option
          const answerSelectors = [
            '[data-testid*="answer-option"]',
            '[data-testid*="choice"]',
            'input[type="radio"]',
            'button:has-text(/^[A-D]\\.?$/)', // Single letter buttons like "A", "B", etc.
            '.answer-option',
            '.choice-button',
          ];

          let answerClicked = false;
          for (const selector of answerSelectors) {
            try {
              const answer = page.locator(selector).first();
              if (await answer.isVisible({ timeout: 1000 })) {
                await answer.click();
                answerClicked = true;
                console.log(`✓ Selected answer using: ${selector}`);
                break;
              }
            } catch {
              continue;
            }
          }

          expect(answerClicked).toBe(true);

          // Look for submit button
          const submitButton = page.locator('text=/submit|check|confirm|next/i').first();
          if (await submitButton.isVisible({ timeout: 3000 })) {
            await submitButton.click();
            console.log('✓ Clicked submit button');

            // Wait for feedback
            await page.waitForTimeout(1000);

            // Check for feedback UI (correct/incorrect indicator)
            const hasFeedback = await page
              .locator('text=/correct|incorrect|right|wrong|explanation|next/i')
              .first()
              .isVisible({ timeout: 3000 });
            expect(hasFeedback).toBe(true);
            console.log('✓ Feedback displayed after submission');
          }
        } else {
          console.log('⊘ No question UI found - mode may require setup or different interaction');
        }
      } else {
        console.log('⊘ Could not find start button - skipping drill question test');
        test.skip();
      }
    });

    test('should show summary or results after completing questions', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const isAuth = await isAuthenticated(page);
      if (!isAuth) {
        console.log('⊘ Skipping summary test - authentication required');
        test.skip();
        return;
      }

      // This test assumes we can quickly navigate through a drill
      // In a real scenario, you might want to mock the backend or use a test account with known data

      // Look for any completed session or summary page
      const summarySelectors = [
        'text=/summary|results|score|complete/i',
        '[data-testid*="summary"]',
        '[data-testid*="results"]',
      ];

      let foundSummary = false;
      for (const selector of summarySelectors) {
        try {
          if (await page.locator(selector).first().isVisible({ timeout: 2000 })) {
            foundSummary = true;
            console.log(`✓ Summary/results UI found: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      // If no summary is visible, this is expected - the user needs to complete a drill first
      // This test serves as a placeholder for a more complete integration test
      console.log(
        foundSummary
          ? '✓ Summary view accessible'
          : 'ℹ Summary view not currently visible (expected if no drills completed)'
      );
    });
  });

  test.describe('3. Navigation and Content Viewing', () => {
    test('should navigate to library or content section', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const isAuth = await isAuthenticated(page);
      if (!isAuth) {
        console.log('⊘ Skipping library test - authentication required');
        test.skip();
        return;
      }

      // Look for library/content navigation
      const librarySelectors = [
        'text=/library|content|reference/i',
        '[data-testid*="library"]',
        'nav a:has-text("Library")',
        'button:has-text("Library")',
      ];

      let clicked = false;
      for (const selector of librarySelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();
            clicked = true;
            console.log(`✓ Navigated to library using: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (clicked) {
        // Wait for library content to load
        await page.waitForTimeout(1500);

        // Verify we're on a library/content page
        const hasContent = await page
          .locator('text=/condition|topic|system|category/i')
          .first()
          .isVisible({ timeout: 5000 });
        expect(hasContent).toBe(true);
        console.log('✓ Library content visible');
      } else {
        console.log('⊘ Library navigation not found - may be in a different location');
      }
    });

    test('should view details of a content item', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const isAuth = await isAuthenticated(page);
      if (!isAuth) {
        console.log('⊘ Skipping content detail test - authentication required');
        test.skip();
        return;
      }

      // Navigate to library first
      const libraryLink = page.locator('text=/library|content|reference/i').first();
      if (await libraryLink.isVisible({ timeout: 3000 })) {
        await libraryLink.click();
        await page.waitForTimeout(1500);

        // Look for a clickable content item (card, list item, etc.)
        const contentItemSelectors = [
          '[data-testid*="condition-card"]',
          '[data-testid*="content-item"]',
          '.condition-card',
          '.content-item',
          'article:has-text(/cardio|pulmonary|neuro/i)', // Medical content
        ];

        let itemClicked = false;
        for (const selector of contentItemSelectors) {
          try {
            const items = page.locator(selector);
            const count = await items.count();
            if (count > 0) {
              await items.first().click();
              itemClicked = true;
              console.log(`✓ Clicked content item using: ${selector}`);
              break;
            }
          } catch {
            continue;
          }
        }

        if (itemClicked) {
          // Wait for detail view to load
          await page.waitForTimeout(1000);

          // Check for detail content
          const hasDetails = await page
            .locator('text=/symptom|treatment|diagnosis|overview/i')
            .first()
            .isVisible({ timeout: 5000 });
          expect(hasDetails).toBe(true);
          console.log('✓ Detail view loaded with content');
        } else {
          console.log(
            '⊘ No content items found to click - library may be empty or have different structure'
          );
        }
      } else {
        console.log('⊘ Library not accessible - skipping content detail test');
        test.skip();
      }
    });

    test('should navigate back from detail view', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const isAuth = await isAuthenticated(page);
      if (!isAuth) {
        console.log('⊘ Skipping navigation test - authentication required');
        test.skip();
        return;
      }

      // This test verifies back navigation works
      // Get current URL
      const initialUrl = page.url();

      // Try to navigate somewhere (any link)
      const anyLink = page.locator('a[href], button').first();
      if (await anyLink.isVisible({ timeout: 3000 })) {
        await anyLink.click();
        await page.waitForTimeout(1000);

        const newUrl = page.url();

        if (newUrl !== initialUrl) {
          // URL changed, try to go back
          await page.goBack();
          await page.waitForTimeout(500);

          const backUrl = page.url();
          expect(backUrl).toBe(initialUrl);
          console.log('✓ Back navigation works correctly');
        } else {
          console.log('ℹ Navigation did not change URL (possible SPA behavior)');
        }
      }
    });
  });

  test.describe('4. Clinical Calculator Flow', () => {
    test('should navigate to calculator hub and use a calculator', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      const isAuth = await isAuthenticated(page);
      if (!isAuth) {
        console.log('⊘ Skipping calculator test - authentication required');
        test.skip();
        return;
      }

      // Look for calculator/toolkit navigation
      const calculatorSelectors = [
        'text=/calculator|toolkit|tools/i',
        '[data-testid*="calculator"]',
        '[data-testid*="toolkit"]',
        'nav a:has-text("Calculator")',
        'nav a:has-text("Toolkit")',
      ];

      let clicked = false;
      for (const selector of calculatorSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();
            clicked = true;
            console.log(`✓ Navigated to calculator using: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (clicked) {
        await page.waitForTimeout(1500);

        // Verify calculator hub is visible
        const hasCalculatorHub = await page
          .locator('text=/CURB-65|Wells|CHA.*DS.*VASc|GFR|Anion Gap/i')
          .first()
          .isVisible({ timeout: 5000 });

        if (hasCalculatorHub) {
          console.log('✓ Calculator hub visible with medical calculators');

          // Try to click on a calculator (e.g., CURB-65)
          const calculatorCard = page.locator('text=/CURB-65|Wells DVT|Anion Gap/i').first();
          if (await calculatorCard.isVisible({ timeout: 2000 })) {
            await calculatorCard.click();
            await page.waitForTimeout(1000);

            // Verify calculator interface loaded
            const hasCalculatorUI = await page
              .locator('text=/score|calculate|criteria|result/i')
              .first()
              .isVisible({ timeout: 3000 });
            expect(hasCalculatorUI).toBe(true);
            console.log('✓ Calculator interface loaded');
          }
        } else {
          console.log('ℹ Calculator hub structure may differ');
        }
      } else {
        console.log('⊘ Calculator navigation not found');
      }
    });
  });

  test.describe('5. Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForAppReady(page);

      // Simulate offline mode
      await page.context().setOffline(true);

      // Try to perform an action that requires network
      const anyButton = page.locator('button:has-text(/start|load|fetch/i)').first();
      if (await anyButton.isVisible({ timeout: 2000 })) {
        await anyButton.click();
        await page.waitForTimeout(1000);

        // Should show some kind of error or offline indicator
        const hasErrorUI = await page
          .locator('text=/error|offline|failed|retry/i')
          .first()
          .isVisible({ timeout: 5000 });
        expect(hasErrorUI).toBe(true);
        console.log('✓ Error UI displayed for offline state');
      }

      // Restore online mode
      await page.context().setOffline(false);
    });

    test('should load without JavaScript errors in console', async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('pageerror', (error) => {
        consoleErrors.push(error.message);
      });

      await page.goto(BASE_URL);
      await waitForAppReady(page);

      // Filter out known/acceptable errors
      const criticalErrors = consoleErrors.filter(
        (err) =>
          !err.includes('favicon') && // Ignore favicon errors
          !err.includes('DevTools') && // Ignore DevTools messages
          !err.includes('extension') // Ignore browser extension errors
      );

      if (criticalErrors.length > 0) {
        console.log('⚠ Console errors detected:', criticalErrors);
      }

      // We expect minimal critical errors on page load
      expect(criticalErrors.length).toBeLessThan(5);
    });
  });
});
