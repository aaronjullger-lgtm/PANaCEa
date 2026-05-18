import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getClerkE2ECredentials,
  hasActiveClerkSession,
  signInWithClerkCredentials,
  waitForClerk,
} from './helpers/clerkAuth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate with Clerk', async ({ page }) => {
  setup.setTimeout(120000);

  const credentials = getClerkE2ECredentials();

  try {
    console.log('Starting Playwright authentication setup.');
    console.log(`Auth file path: ${authFile}`);

    await page.goto('/study', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForClerk(page);

    if (await hasActiveClerkSession(page)) {
      console.log('Existing Clerk session detected. Saving storage state.');
    } else if (credentials) {
      console.log('E2E Clerk credentials detected. Signing in programmatically.');
      await signInWithClerkCredentials(page, credentials, { startPath: '/study' });
    } else {
      console.log('No E2E Clerk credentials found. Waiting up to 2 minutes for manual login.');
      console.log('Set E2E_CLERK_TEST_EMAIL and E2E_CLERK_TEST_PASSWORD to avoid manual login.');

      await expect
        .poll(async () => hasActiveClerkSession(page), {
          timeout: 120000,
        })
        .toBe(true);
    }

    await page.waitForTimeout(2000);
    await page.context().storageState({ path: authFile });
    console.log(`Authentication state saved to: ${authFile}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Authentication setup failed.');
    console.error(`Current URL: ${page.url()}`);
    console.error(`Page title: ${await page.title().catch(() => 'N/A')}`);
    console.error(message);
    throw error;
  }
});
