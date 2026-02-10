/**
 * Playwright config for E2E tests against Cloudflare Pages (Wrangler)
 *
 * Use when testing against the real production stack:
 * - npm run build && npx wrangler pages dev dist --port 3000 &
 * - npm run test:e2e:wrangler
 *
 * Does NOT start a web server - assumes Wrangler is already running on baseURL.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [['html'], ['list']],
  timeout: 30000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // API health - no auth, validates CF Functions routing
    { name: 'api-health', testMatch: /api-health\.spec\.ts/ },
    // CSP headers and console (no clerk-telemetry violation)
    { name: 'csp-console', testMatch: /csp-console\.spec\.ts/ },
  ],

  /* No webServer - Wrangler must be started separately */
  webServer: undefined,
});
