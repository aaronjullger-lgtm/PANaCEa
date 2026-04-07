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
  },
});
