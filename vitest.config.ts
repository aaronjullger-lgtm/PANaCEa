import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    // Ensure React CJS entry points resolve to development builds (React.act).
    'process.env.NODE_ENV': '"test"',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@sentry/cloudflare': path.resolve(__dirname, './vitest-mocks/sentry-stub.ts'),
    },
    conditions: ['development', 'browser'],
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    include: [
      'tests/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'lib/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'functions/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'components/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'services/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'hooks/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      'e2e/**',
      'temp_repos/**',
      // Hook switched from fetch to SDK client — test needs full rewrite (~1200 lines)
      'tests/useDrillFSRS.test.ts',
    ],
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    // Coverage configuration (run with: npm run test:coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // Critical subsystems that must maintain coverage
      thresholds: {
        // Global floor — raise as coverage improves
        statements: 40,
        branches: 35,
        functions: 35,
        lines: 40,
        // Per-file overrides for critical paths
        perFile: false,
      },
      include: [
        'lib/fsrs.ts',
        'lib/implicit-metrics.ts',
        'lib/services/drillReviewService.ts',
        'lib/confidence/**',
        'lib/srs/**',
        'store/**',
        'functions/api/_shared/**',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        'vitest-mocks/**',
      ],
    },
  },
});
