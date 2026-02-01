/**
 * Authentication Setup for Playwright Tests
 *
 * This script runs ONCE before all tests. It allows you to manually log in through Clerk,
 * then saves your authentication session to playwright/.auth/user.json.
 *
 * All subsequent tests will reuse this saved session without logging in again.
 *
 * HOW TO RUN:
 * 1. Start your dev server: npm run dev
 * 2. Run this setup with headed browser: npx playwright test auth.setup.ts --headed
 * 3. Manually log in when the browser opens
 * 4. Wait for the script to detect successful login and save the session
 * 5. Run your tests: npx playwright test
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate with Clerk', async ({ page }) => {
  // Increase timeout to 2 minutes for manual login
  setup.setTimeout(120000);

  console.log('🔐 Starting authentication setup...');
  console.log(`⏱️  Test timeout set to: ${120000}ms (2 minutes)`);
  console.log(`📁 Auth file path: ${authFile}`);
  console.log('📍 Navigating to app...');

  try {
    // Navigate to the app with explicit wait
    console.log('🌐 Calling page.goto("/")...');
    const gotoStartTime = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const gotoEndTime = Date.now();
    console.log(`✅ page.goto() completed in ${gotoEndTime - gotoStartTime}ms`);
    console.log(`📊 Current URL: ${page.url()}`);
    console.log(`📄 Page title: ${await page.title()}`);

    // Wait for either the sign-in button or authenticated content
    console.log('⏳ Waiting for page to load...');

    // Check if already authenticated (user might be logged in from previous session)
    console.log('🔍 Checking if already authenticated...');
    console.log('🔎 Looking for selector: text=/Dashboard|Quiz|Start Session/');

    const checkStartTime = Date.now();
    const isAuthenticated = await page
      .locator('text=/Dashboard|Quiz|Start Session/')
      .first()
      .isVisible({ timeout: 5000 })
      .catch((error) => {
        console.log(
          `⚠️  Auth check failed after ${Date.now() - checkStartTime}ms: ${error.message}`
        );
        return false;
      });
    const checkEndTime = Date.now();
    console.log(
      `🔍 Auth check completed in ${checkEndTime - checkStartTime}ms, result: ${isAuthenticated}`
    );

    if (isAuthenticated) {
      console.log('✅ Already authenticated! Saving session...');
    } else {
      console.log('🔓 Not authenticated. Waiting for manual login...');
      console.log('\n⚠️  PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW ⚠️\n');
      console.log('    The test will wait for up to 2 minutes for you to log in.\n');
      console.log(`    Current URL: ${page.url()}\n`);

      // Wait for user to manually log in
      // Look for indicators that user is logged in (adjust these selectors based on your app)
      console.log('⏳ Starting waitForSelector with 120s timeout...');
      const waitStartTime = Date.now();

      await page
        .waitForSelector('text=/Dashboard|Quiz|Start Session/', {
          timeout: 120000, // 2 minutes for manual login
        })
        .then(() => {
          const waitEndTime = Date.now();
          console.log(`✅ Selector found after ${waitEndTime - waitStartTime}ms`);
        })
        .catch((error) => {
          const waitEndTime = Date.now();
          console.log(`❌ waitForSelector failed after ${waitEndTime - waitStartTime}ms`);
          console.log(`❌ Error: ${error.message}`);
          throw new Error('❌ Authentication timeout. Please ensure you logged in successfully.');
        });

      console.log('✅ Login detected! Saving authentication state...');
    }

    // Wait a moment for all cookies/storage to be set
    console.log('⏳ Waiting 2s for cookies/storage to settle...');
    await page.waitForTimeout(2000);
    console.log('✅ Wait complete');

    // Save the authenticated state
    console.log('💾 Saving authentication state...');
    await page.context().storageState({ path: authFile });
    console.log(`✅ Authentication state saved to: ${authFile}`);
    console.log('🎉 Setup complete! All tests will now use this authenticated session.\n');
  } catch (error) {
    console.error('❌ FATAL ERROR in authentication setup:');
    console.error(`   Error type: ${error.constructor.name}`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Current URL: ${page.url()}`);
    console.error(`   Page title: ${await page.title().catch(() => 'N/A')}`);
    throw error;
  }
});
