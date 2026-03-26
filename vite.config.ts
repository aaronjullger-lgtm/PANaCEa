import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

/**
 * JSX Dev Shim path — a real file that re-exports react/jsx-runtime's `jsx` as `jsxDEV`.
 * Using a real file avoids virtual-module edge cases with Rollup's resolution.
 */
const JSX_DEV_SHIM_PATH = path.resolve(__dirname, 'src/lib/jsx-dev-shim.ts');

/**
 * Vite plugin to completely remove Prisma imports from browser bundles.
 * Uses transform to strip out Prisma imports before they reach Rollup.
 */
function prismaExcludePlugin(): Plugin {
  const prismaPatterns = [
    '@prisma/client',
    '@prisma/client/edge',
    '.prisma/client',
    '@prisma/extension-accelerate',
  ];

  return {
    name: 'prisma-exclude',
    enforce: 'pre',
    resolveId(source, importer) {
      // Don't intercept imports from server-side code (functions/)
      if (importer && importer.includes('/functions/')) {
        return null;
      }

      // Intercept @prisma/client and related packages
      if (prismaPatterns.some((p) => source === p || source.includes(p))) {
        return { id: 'virtual:prisma-stub', moduleSideEffects: false };
      }
      // Intercept lib/prisma imports (various forms)
      if (
        source.endsWith('lib/prisma') ||
        source.endsWith('lib/prisma.ts') ||
        source === '../prisma' ||
        source === '../../lib/prisma' ||
        source === '@/lib/prisma'
      ) {
        return { id: 'virtual:prisma-stub', moduleSideEffects: false };
      }
      return null;
    },
    load(id) {
      if (id === 'virtual:prisma-stub') {
        // Return a stub module that exports empty objects/functions
        return `
          export const PrismaClient = class PrismaClient {
            constructor() {
              if (typeof window !== 'undefined') {
                console.warn('[Browser] PrismaClient is not available in browser bundles');
              }
            }
          };
          export const Prisma = {};
          export const prisma = null;
          export default { PrismaClient, Prisma };
        `;
      }
      return null;
    },
    // Transform hook to catch imports that slip through resolveId
    transform(code, id) {
      // Skip node_modules and functions/ (server-side code)
      if (id.includes('node_modules') || id.includes('/functions/')) return null;

      // Check if the file contains Prisma imports
      const hasPrismaImport = prismaPatterns.some(
        (p) =>
          code.includes(`from '${p}'`) ||
          code.includes(`from "${p}"`) ||
          code.includes(`import('${p}')`) ||
          code.includes(`import("${p}")`)
      );

      if (hasPrismaImport) {
        // Replace import statements with stub imports
        let transformed = code;
        let importCounter = 0;

        for (const pattern of prismaPatterns) {
          const escapedPattern = pattern.replace('/', '\\/').replace('.', '\\.');

          // Replace static imports with unique variable names
          transformed = transformed.replace(
            new RegExp(`import\\s*{[^}]*}\\s*from\\s*['"]${escapedPattern}['"]`, 'g'),
            () => {
              importCounter++;
              return `/* [Prisma removed ${importCounter}] */ const { PrismaClient: _PC${importCounter}, Prisma: _P${importCounter} } = { PrismaClient: class {}, Prisma: {} }`;
            }
          );
          // Replace default imports
          transformed = transformed.replace(
            new RegExp(`import\\s+\\w+\\s+from\\s*['"]${escapedPattern}['"]`, 'g'),
            () => {
              importCounter++;
              return `/* [Prisma removed ${importCounter}] */ const _prismaDefault${importCounter} = { PrismaClient: class {}, Prisma: {} }`;
            }
          );
          // Replace dynamic imports with a null promise
          transformed = transformed.replace(
            new RegExp(`import\\(['"]${escapedPattern}['"]\\)`, 'g'),
            `Promise.resolve({ PrismaClient: class {}, Prisma: {}, prisma: null })`
          );
        }
        return { code: transformed, map: null };
      }

      return null;
    },
  };
}

// Build cache buster: 2026-03-24-v12-reduced-motion-deterministic-skeleton
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isDevelopment = mode === 'development';
  const isProduction = mode === 'production';
  const useMockMode = env.VITE_USE_MOCK === 'true';
  const hasSentryConfig = Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);
  const shouldUploadSentry = isProduction && hasSentryConfig && env.SENTRY_UPLOAD === 'true';

  // Log mock mode status during build
  if (useMockMode) {
    console.log('🎭 MOCK MODE ENABLED - Build will use MockSessionService');
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // When using npm run dev (Vite only), proxy to Express (npm run dev:all) or to wrangler pages dev for CF parity
      proxy: {
        '/geminiProxy': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      prismaExcludePlugin(),
      react({
        // Use automatic JSX runtime for React 19
        jsxRuntime: 'automatic',
        // Ensure proper JSX transform
        jsxImportSource: 'react',
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'PANaCEa - PANCE Prep AI',
          short_name: 'PANaCEa',
          description: 'AI-powered PANCE/PANRE preparation platform',
          theme_color: 'var(--color-bg-primary)',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8MB — covers 6MB+ clinical training images; JS vendor is ~1.8MB after bundle splitting
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          // AGGRESSIVE UPDATE STRATEGY - Force new SW to take control immediately
          skipWaiting: true, // Don't wait for old SW to stop
          clientsClaim: true, // Take control of page immediately after activation
          // Clean old caches on activation
          cleanupOutdatedCaches: true,
          // New cache namespace - "compat" strategy with interop mode
          cacheId: 'panacea-v12-offline-first',
          // Runtime caching strategies for offline-first experience
          runtimeCaching: [
            // =================================================================
            // SPRINT 7: OFFLINE-FIRST - Aggressive Question Pool Caching
            // =================================================================
            {
              // Question pool JSONs - Cache aggressively for offline study
              urlPattern: /\/api\/questions\/(pool|fetch|session)/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'questions-pool-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                // Background sync for failed requests
                backgroundSync: {
                  name: 'questions-queue',
                  options: {
                    maxRetentionTime: 24 * 60, // Retry for 24 hours
                  },
                },
              },
            },
            {
              // Staging Lake / Question seeds - Cache first for offline
              urlPattern: /\/api\/questions\/seeds/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'staging-lake-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Clinical pearls - Cache for offline review
              urlPattern: /\/api\/(pearls|conditions\/.*\/pearls)/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'pearls-cache',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Condition data - Essential for offline study
              urlPattern: /\/api\/conditions/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'conditions-cache',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // =================================================================
            // END SPRINT 7 CHANGES
            // =================================================================
            {
              // Vendor chunks should use network-first to avoid stale cache
              urlPattern: /^.*\/assets\/vendor.*\.js$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'vendor-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^.*\/(data-conditions|data-drugs|data-labs)-.*\.js$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'data-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              // Images and media - Cache first
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
        },
      }),
      // Sentry plugin for source maps upload (production only)
      ...(shouldUploadSentry
        ? [
            sentryVitePlugin({
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              authToken: env.SENTRY_AUTH_TOKEN,
              sourcemaps: {
                assets: './dist/**',
                ignore: ['node_modules'],
                filesToDeleteAfterUpload: ['./dist/**/*.map'],
              },
              telemetry: false,
              errorHandler: (err) => {
                console.warn(
                  '[Sentry] Source map upload failed (build continues):',
                  err?.message || err
                );
              },
            }),
          ]
        : []),
    ],
    define: {
      // Make VITE_USE_MOCK available to client code
      'import.meta.env.VITE_USE_MOCK': JSON.stringify(env.VITE_USE_MOCK || 'false'),
      // Global shim for CJS modules
      global: 'window',
      // Process shims for browser compatibility
      // Note: Using 'typeof process' pattern to avoid breaking code that checks for process existence
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VITEST': 'undefined',
      'process.env.VITEST_WORKER_ID': 'undefined',
      'process.env.API_BASE_URL': 'undefined',
      'process.env.DATABASE_URL': 'undefined',
      'process.env.GEMINI_API_KEY': 'undefined',
      // Fallback for any other process.env access
      'process.env': '{}',
      // Define process object for typeof checks
      'process.browser': 'true',
      'process.version': '""',
    },
    resolve: {
      dedupe: ['lucide-react', 'react', 'react-dom'],
      alias: {
        // Preserve legacy absolute imports that assume repo root
        '@': path.resolve(__dirname, '.'),
        // Preferred alias for source files
        '@src': path.resolve(__dirname, './src'),
        // Force ESM build of lucide-react
        'lucide-react': 'lucide-react/dist/esm/lucide-react.js',
        // Always alias jsx-dev-runtime to a shim that re-exports jsx as jsxDEV.
        // Fixes "jsxDEV is not a function" in dev, preview, and production builds.
        'react/jsx-dev-runtime': JSX_DEV_SHIM_PATH,
        'react/jsx-dev-runtime.js': JSX_DEV_SHIM_PATH,
      },
    },
    build: {
      rollupOptions: {
        // NOTE: Prisma packages are now handled by prismaExcludePlugin
        // which stubs them out instead of externalizing (which leaves bare imports)
        // sharp is a Node.js-only image processing library - must never be bundled for browser
        external: ['sharp'],
        onwarn(warning, warn) {
          if (
            warning.code === 'SOURCEMAP_ERROR' &&
            warning.loc?.file &&
            (warning.loc.file.includes('components/navigation/CommandCenterHub.tsx') ||
              warning.loc.file.includes('components/dashboard/TrainingMenu.tsx'))
          ) {
            return;
          }
          warn(warning);
        },
        output: {
          // Add interop compatibility mode to handle CJS/ESM mixing gracefully
          interop: 'auto',
          externalLiveBindings: false,
          // Manual chunks for better bundle splitting
          manualChunks(id) {
            // Vendor chunks
            if (id.includes('node_modules')) {
              // Charting - heavy; split out so route-level chunks load it on demand
              if (id.includes('recharts')) {
                return 'charting';
              }
              // UI libraries
              if (id.includes('framer-motion') || id.includes('lucide-react')) {
                return 'vendor-ui';
              }
              // State management and utilities
              if (id.includes('zustand') || id.includes('immer') || id.includes('date-fns')) {
                return 'vendor-state';
              }
              // Clerk authentication
              if (id.includes('@clerk')) {
                return 'vendor-auth';
              }
              // Zod and validation
              if (id.includes('zod')) {
                return 'vendor-validation';
              }
              // Heavy libraries used ONLY by specific lazy-loaded routes.
              // Returning undefined lets Rollup co-locate them with their
              // consumer chunk so they are NOT included in the initial vendor.js.
              // Without this, the catch-all below pulls them into vendor.js even
              // though they are never needed for the first render, bloating it by
              // 200-500 KB per package.
              if (
                id.includes('/cytoscape/') ||  // ~200 KB – CrossSystemExplorer only
                id.includes('/jspdf/')          // ~250 KB – DataExport (Settings) only
              ) {
                return undefined;
              }
              // Default vendor chunk for everything else
              return 'vendor';
            }
            // Split large components into separate chunks
            if (id.includes('components/') && id.includes('.tsx')) {
              const componentName = id.split('/').pop()?.replace('.tsx', '');
              // Large components that should be split
              const largeComponents = [
                'CommandCenterHub',
                'EnhancedSettingsTab',
                'MenuView',
                'PatientEncounterMode',
                'QuizView',
                'ToolkitHub',
                'AdminDashboard',
              ];
              if (largeComponents.some(name => componentName?.includes(name))) {
                return `component-${componentName?.toLowerCase()}`;
              }
            }
            return undefined;
          },
          // Safety net polyfill for CommonJS remnants and Node.js globals
          intro: '',
        },
        // Ensure lucide-react is treated as side-effect-free for optimal tree-shaking
        treeshake: {
          moduleSideEffects: (id) => {
            if (id && id.includes('lucide-react')) return false;
            // Explicitly return true for all other modules to satisfy Rollup boolean return
            return true;
          },
        },
      },
      chunkSizeWarningLimit: 700, // Increased limit for larger vendor chunks
      // Conditionally enable source maps based on environment
      // In production, use 'hidden' to generate maps but not reference them in the bundle
      sourcemap: mode === 'production' ? 'hidden' : true,
      // Improve build performance
      minify: 'esbuild',
      target: 'esnext',
    },
    // Strip console.log/warn/debug in production builds
    // Preserves console.error for Sentry error tracking
    ...(isProduction && {
      esbuild: {
        pure: ['console.log', 'console.warn', 'console.debug'],
      },
    }),
    worker: {
      format: 'es', // Use ES modules format for workers (required for WASM)
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@clerk/clerk-react',
        'framer-motion',
        '@tanstack/react-virtual',
      ],
      // Avoid prebundling the entire lucide icon set; rely on per-icon ESM imports for tree-shaking
      exclude: ['lucide-react'],
    },
  };
});
