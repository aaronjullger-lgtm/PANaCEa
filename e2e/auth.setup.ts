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

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate with Clerk', async ({ page }) => {
  console.log('🔐 Starting authentication setup...');
  console.log('📍 Navigating to app...');

  // Navigate to the app
  await page.goto('/');

  // Wait for either the sign-in button or authenticated content
  console.log('⏳ Waiting for page to load...');

  // Check if already authenticated (user might be logged in from previous session)
  const isAuthenticated = await page
    .locator('text=Dashboard, text=Quiz, text=Start Session')
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (isAuthenticated) {
    console.log('✅ Already authenticated! Saving session...');
  } else {
    console.log('🔓 Not authenticated. Waiting for manual login...');
    console.log('\n⚠️  PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW ⚠️\n');
    console.log('    The test will wait for up to 2 minutes for you to log in.\n');

    // Wait for user to manually log in
    // Look for indicators that user is logged in (adjust these selectors based on your app)
    await page
      .waitForSelector('text=Dashboard, text=Quiz, text=Start Session', {
        timeout: 120000, // 2 minutes for manual login
      })
      .catch(() => {
        throw new Error('❌ Authentication timeout. Please ensure you logged in successfully.');
      });

    console.log('✅ Login detected! Saving authentication state...');
  }

  // Wait a moment for all cookies/storage to be set
  await page.waitForTimeout(2000);

  // Save the authenticated state
  await page.context().storageState({ path: authFile });

  console.log(`✅ Authentication state saved to: ${authFile}`);
  console.log('🎉 Setup complete! All tests will now use this authenticated session.\n');
});
