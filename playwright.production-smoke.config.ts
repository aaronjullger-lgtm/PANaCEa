import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:8788';

export default defineConfig({
  testDir: './e2e/production-smoke',
  outputDir: 'test-results/production-smoke',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/production-smoke', open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
