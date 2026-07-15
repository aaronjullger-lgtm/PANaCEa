import path from 'path';
import { defineConfig } from 'vitest/config';
import { workflow } from '@workflow/vitest';

/**
 * Integration tests for Workflow DevKit durable workflows.
 * Kept separate from the main jsdom Vitest config.
 */
export default defineConfig({
  plugins: [workflow()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['workflows/**/*.integration.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
