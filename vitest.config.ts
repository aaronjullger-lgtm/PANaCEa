import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@sentry/cloudflare': path.resolve(__dirname, './vitest-mocks/sentry-stub.ts'),
    },
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
      // React 19 + @testing-library/react compat: React.act is not a function
      // TODO: re-enable after upgrading @testing-library/react to v16+
      'tests/components/admin/**',
      'tests/components/Goals/**',
      'tests/components/offline/**',
      'tests/useDrillFSRS.test.ts',
      // tests/implicit-metrics.test.ts — re-enabled: no React dependency, pure function tests
      'lib/implicit-metrics.test.ts',
      'functions/api/_shared/auth.test.ts',
      'functions/api/osce/complete.test.ts',
      'hooks/game/use-mini-lab-drill.test.ts',
      'hooks/game/use-photo-drill.test.ts',
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
