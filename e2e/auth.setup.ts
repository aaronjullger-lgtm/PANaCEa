import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getClerkE2ECredentials,
  hasActiveClerkSession,
  hasClerkBackendAuth,
  signInWithClerkBackend,
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
    } else if (hasClerkBackendAuth()) {
      console.log('Clerk backend auth available. Signing in via Clerk Backend API (bypasses MFA).');
      try {
        await signInWithClerkBackend(page, credentials!.email, { startPath: '/study' });
      } catch (backendError) {
        const message =
          backendError instanceof Error ? backendError.message : String(backendError);
        if (credentials?.password) {
          console.warn(
            `Clerk backend sign-in failed (${message}). Falling back to browser password sign-in.`
          );
          await signInWithClerkCredentials(
            page,
            { email: credentials.email, password: credentials.password },
            { startPath: '/study' }
          );
        } else {
          throw backendError;
        }
      }
    } else if (credentials?.password) {
      console.log('E2E Clerk password credentials detected. Signing in via browser form.');
      await signInWithClerkCredentials(
        page,
        { email: credentials.email, password: credentials.password },
        { startPath: '/study' }
      );
    } else {
      console.log('No E2E Clerk credentials found. Waiting up to 2 minutes for manual login.');
      console.log(
        'For backend-based sign-in (recommended, bypasses MFA): set CLERK_SECRET_KEY + test email (E2E_CLERK_TEST_EMAIL or PANACEA_E2E_EMAIL) in .env.'
      );
      console.log(
        'For browser-based sign-in: also set E2E_CLERK_TEST_PASSWORD. ' +
          'Ensure the Clerk user has MFA / Client Trust disabled.'
      );

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
