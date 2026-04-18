/**
 * Lighthouse CI configuration — production / preview gate.
 *
 * Unlike the existing `lighthouserc.js` (localhost dev, lenient warnings),
 * this config is intended for CI runs against a real deployed preview URL
 * with stricter thresholds tied to release readiness.
 *
 * Usage:
 *   LHCI_URL=https://<preview>.panacea.pages.dev \
 *     npx @lhci/cli autorun --config=./lighthouserc.prod.js
 *
 * See docs/CI-GATES.md for the ratchet plan — this starts as advisory,
 * promotes to blocking once three consecutive main-branch runs are green.
 */
const BASE_URL = process.env.LHCI_URL || 'https://studypanacea.com/';

module.exports = {
  ci: {
    collect: {
      url: [
        BASE_URL,
        // Add more critical flows here as the app stabilizes — e.g.
        // `${BASE_URL}dashboard`, `${BASE_URL}sign-in`. Keep it short:
        // each URL costs ~1 minute of CI time per run.
      ],
      numberOfRuns: 3, // median of 3 is far less flaky than a single run
      settings: {
        // Throttle to mobile-3G to catch real-world regressions, not ideal-network ones.
        preset: 'mobile',
        // Skip PWA category since we have a separate a11y gate via axe-core.
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo',
        ],
      },
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        // Category floors — start conservative, ratchet up in CI-GATES.md.
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals — these matter more than the rolled-up score.
        'first-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 400 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'speed-index': ['warn', { maxNumericValue: 4300 }],

        // Best-practices specifics that catch real bugs.
        'errors-in-console': ['error', { maxNumericValue: 0 }],
        'no-document-write': 'error',
        'uses-https': 'error',
        'uses-http2': 'warn',

        // Accessibility specifics that block merges.
        'color-contrast': 'error',
        'button-name': 'error',
        'link-name': 'error',
        'image-alt': 'error',
        'html-has-lang': 'error',
        'document-title': 'error',
        'meta-viewport': 'error',

        // Allow: larger bundle is enforced by build:check-size, not here.
        'total-byte-weight': 'off',
        'unused-javascript': 'off',
      },
    },
    upload: {
      target: 'temporary-public-storage',
      // When a permanent LHCI server exists, swap target + add serverBaseUrl.
      // target: 'lhci',
      // serverBaseUrl: 'https://lhci.panacea.internal',
      // token: process.env.LHCI_TOKEN,
    },
  },
};
