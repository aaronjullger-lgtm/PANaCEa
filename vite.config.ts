import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
        (p) => code.includes(`from '${p}'`) || code.includes(`from "${p}"`) || code.includes(`import('${p}')`) || code.includes(`import("${p}")`)
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

// Build cache buster: 2026-01-06-v10-force-esm-exclude
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isDevelopment = mode === 'development';
  const isProduction = mode === 'production';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
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
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'PANaCEa - PANCE Prep AI',
          short_name: 'PANaCEa',
          description: 'AI-powered PANCE/PANRE preparation platform',
          theme_color: '#ffffff',
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
          maximumFileSizeToCacheInBytes: 35 * 1024 * 1024, // 35MB to accommodate large condition data
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          // AGGRESSIVE UPDATE STRATEGY - Force new SW to take control immediately
          skipWaiting: true, // Don't wait for old SW to stop
          clientsClaim: true, // Take control of page immediately after activation
          // Clean old caches on activation
          cleanupOutdatedCaches: true,
          // New cache namespace - "compat" strategy with interop mode
          cacheId: 'panacea-v10-compat',
          // Use network-first for JS chunks to avoid stale cache issues
          runtimeCaching: [
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
          ],
        },
      }),
      // Sentry plugin for source maps upload (production only)
      ...(isProduction && env.SENTRY_AUTH_TOKEN
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
            }),
          ]
        : []),
    ],
    define: {
      // Global shim for CJS modules
      global: 'window',
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
      },
    },
    build: {
      rollupOptions: {
        // NOTE: Prisma packages are now handled by prismaExcludePlugin
        // which stubs them out instead of externalizing (which leaves bare imports)
        external: [],
        output: {
          // Add interop compatibility mode to handle CJS/ESM mixing gracefully
          interop: 'compat',
          // Safety net polyfill for CommonJS remnants
          intro: 'var global = global || window; var exports = exports || {};',
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
    worker: {
      format: 'es', // Use ES modules format for workers (required for WASM)
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@clerk/clerk-react', 'framer-motion'],
      // Avoid prebundling the entire lucide icon set; rely on per-icon ESM imports for tree-shaking
      exclude: ['lucide-react'],
    },
  };
});
