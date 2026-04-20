/**
 * Playwright config for the CI a11y gate.
 *
 * Used by: npm run test:e2e:a11y (and ci.yml e2e-a11y job)
 *
 * Key differences from the root playwright.config.ts:
 *  - Targets `vite preview` on port 4173 (no wrangler, no API runtime required).
 *  - Runs only the `a11y` project (a11y-regression.spec.ts).
 *  - reuseExistingServer: true so the job can pre-start the server if desired.
 *  - Single worker — axe tests are not CPU-intensive.
 *
 * The server will be started automatically if not already running.
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  timeout: 30000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'a11y',
      testMatch: /a11y-regression\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // `vite preview` serves the built SPA from dist/ on port 4173.
    // Does not start an API runtime — axe tests only need the HTML/JS to load.
    command: 'npm run preview -- --port 4173',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
