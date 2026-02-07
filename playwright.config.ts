import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for StudyPANaCEa
 *
 * Optimized for localhost:3000 development testing
 * Includes authentication setup for Clerk
 */

export default defineConfig({
  testDir: './e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list'], // Console output
  ],

  /* Timeout for each test */
  timeout: 30000, // 30 seconds per test

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL for localhost development */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use saved authentication state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Unauthenticated tests (for audit and basic checks)
    {
      name: 'chromium-no-auth',
      testMatch: /systematic_audit\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // No authentication state - tests handle auth gracefully
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes to start
  },
});
