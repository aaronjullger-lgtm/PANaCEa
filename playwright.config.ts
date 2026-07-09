import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for StudyPANaCEa
 *
 * Optimized for localhost:3000 development testing
 * Includes authentication setup for Clerk
 */

const hasClerkE2ECredentials = Boolean(
  process.env.E2E_CLERK_TEST_EMAIL?.trim() &&
    (process.env.CLERK_SECRET_KEY?.trim() || process.env.E2E_CLERK_TEST_PASSWORD?.trim())
);

const authenticatedProjects = hasClerkE2ECredentials
  ? [
      {
        name: 'setup',
        testMatch: /auth\.setup\.ts/,
      },
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
          storageState: 'playwright/.auth/user.json',
        },
        dependencies: ['setup'],
      },
    ]
  : [];

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
    ...authenticatedProjects,

    // Unauthenticated tests (for audit and basic checks)
    {
      name: 'chromium-no-auth',
      testMatch: /systematic_audit\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // No authentication state - tests handle auth gracefully
      },
    },

    // A11y regression (axe-core) - WCAG 2.1 AA on landing page
    {
      name: 'a11y',
      testMatch: /a11y-regression\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // UX Polish: run without auth so design police runs on landing/dashboard without manual login
    {
      name: 'ux-polish',
      testMatch: /ux_polish\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Mobile layout audit: 320px viewport (iPhone SE)
    {
      name: 'mobile-layout',
      testMatch: /mobile_layout_audit\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 568 },
      },
    },

    // Cross-browser smoke (Firefox, WebKit) - api-health + a11y for Roo browser matrix
    {
      name: 'firefox-smoke',
      testMatch: /(api-health|a11y-regression)\.spec\.ts/,
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'webkit-smoke',
      testMatch: /(api-health|a11y-regression)\.spec\.ts/,
      use: {
        ...devices['Desktop Safari'],
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
