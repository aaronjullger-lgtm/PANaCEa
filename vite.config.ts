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
            // New cache namespace to break any lingering caches
            cacheId: 'panacea-v9-esm-force',
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
        // Global shim for CJS modules
        'global': 'window',
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
        }
      },
      build: {
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
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                // React core only (strict paths)
                if (/node_modules\/react\//.test(id) || /node_modules\/react-dom\//.test(id) || /node_modules\/scheduler\//.test(id)) {
                  return 'vendor-react';
                }
                // Router
                if (/node_modules\/react-router/.test(id)) {
                  return 'vendor-router';
                }
                // Lucide isolated
                if (id.includes('node_modules/lucide-react')) {
                  return 'vendor-lucide';
                }
                // UI / icons / animation / auth UI
                if (id.includes('@radix-ui') || id.includes('framer-motion') || id.includes('@clerk')) {
                  return 'vendor-ui';
                }
                // Sentry separate
                if (id.includes('@sentry')) return 'vendor-sentry';
                // Charts and visualization
                if (id.includes('recharts')) return 'vendor-animation-charts';
                // Utilities
                if (id.includes('date-fns') || id.includes('zod') || id.includes('clsx') || id.includes('tailwind-merge')) {
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
        include: [
          'react',
          'react-dom',
          '@clerk/clerk-react',
          'framer-motion',
        ],
      },
    };
  }
);
