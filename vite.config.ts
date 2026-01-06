import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
          }
        }
      },
      plugins: [
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
                type: 'image/png'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 35 * 1024 * 1024, // 35MB to accommodate large condition data
            globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
            // AGGRESSIVE UPDATE STRATEGY - Force new SW to take control immediately
            skipWaiting: true,      // Don't wait for old SW to stop
            clientsClaim: true,     // Take control of page immediately after activation
            // Clean old caches on activation
            cleanupOutdatedCaches: true,
            // CRITICAL: v7 cache namespace with define-based CJS shim
            cacheId: 'panacea-v7-defines',
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
          }
        }),
        // Sentry plugin for source maps upload (production only)
        ...(isProduction && env.SENTRY_AUTH_TOKEN ? [
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
          })
        ] : []),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Hardcode Sentry DSN to bypass Cloudflare Dashboard env var lock (DSNs are public, safe in frontend)
        'import.meta.env.VITE_SENTRY_DSN': JSON.stringify('https://fcb4b9b78fce46cb919609702673a04b@o4510664011087872.ingest.us.sentry.io/4510664018231296'),
        // CRITICAL: Compile-time shim for CJS modules that try to assign to exports/global
        // 'global' -> 'window' prevents "global is not defined" errors
        'global': 'window',
      },
      resolve: {
        // Force all dependencies to use the SAME copy of lucide-react (prevents nested node_modules issues)
        dedupe: ['lucide-react', 'react', 'react-dom'],
        alias: {
          '@': path.resolve(__dirname, '.'),
          // REMOVED: lucide-react alias - let Vite optimizeDeps handle CJS/ESM conversion
          // The manual alias path differs between Mac and Linux build environments
        }
      },
      build: {
        // Transform mixed ES/CJS modules to prevent initialization errors
        commonjsOptions: {
          transformMixedEsModules: true,
          // Force these packages to be treated as ESM
          include: [/node_modules/],
          // Explicitly handle lucide-react as ESM
          esmExternals: true,
        },
        rollupOptions: {
          external: [
            // Externalize Prisma packages - they should never be in browser bundles
            '@prisma/client',
            '@prisma/client/edge',
            '.prisma/client',
            '.prisma/client/edge',
            '@prisma/extension-accelerate',
          ],
          output: {
            // Inject CommonJS polyfill at the start of each bundle chunk
            // This ensures 'exports' exists before any CJS code tries to assign to it
            intro: 'var exports = exports || {}; var global = global || window;',
            manualChunks: (id) => {
              // Group heavy libraries into separate vendor chunks
              // NOTE: Do NOT manually chunk lucide-react - let Vite tree-shake it naturally
              // Forcing it into a separate chunk breaks initialization order
              if (id.includes('node_modules')) {
                // Authentication - check FIRST before react (clerk-react contains 'react')
                if (id.includes('@clerk')) return 'vendor-clerk';
                // Sentry - keep separate to allow lazy loading
                if (id.includes('@sentry')) return 'vendor-sentry';
                // Core React libraries + lucide-react bundled together to ensure initialization order
                if (id.includes('lucide-react')) return 'vendor-react';
                if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                  return 'vendor-react';
                }
                // UI libraries - lucide-react excluded, let it tree-shake naturally
                if (id.includes('framer-motion') || id.includes('clsx') || id.includes('tailwind-merge')) {
                  return 'vendor-ui';
                }
                // Charts and visualization
                if (id.includes('recharts')) return 'vendor-animation-charts';
                // Utilities
                if (id.includes('date-fns') || id.includes('zod')) {
                  return 'vendor-utils';
                }
                // Default vendor chunk for remaining packages
                return 'vendor';
              }
              // Group data files
              if (id.includes('/data/')) {
                if (id.includes('conditionContent') || id.includes('conditionDrillData')) {
                  return 'data-conditions';
                }
                if (id.includes('drugData')) return 'data-drugs';
                if (id.includes('labData')) return 'data-labs';
                return 'data-other';
              }
              // Group drill components
              if (id.includes('/components/drill/')) return 'drill-modes';
              // Group components into logical chunks
              if (id.includes('/components/admin/')) return 'admin';
              if (id.includes('/components/modes/')) return 'chunk-modes';
              if (id.includes('/components/analytics/')) return 'chunk-analytics';
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
      optimizeDeps: {
        // FORCE Vite to pre-bundle lucide-react - this converts CJS to ESM at build time
        // and fixes the "Cannot set properties of undefined (setting 'Activity')" error
        include: [
          'lucide-react',
          'react',
          'react-dom',
          '@clerk/clerk-react',
          'framer-motion',
        ],
        // Force ESM format
        esbuildOptions: {
          target: 'esnext',
          format: 'esm',
        },
      },
    };
  }
);
