import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Build cache buster: 2026-01-05-v2-force-rebuild
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            // Force SW update - increment this to bust cache: v2-lucide-fix-2026-01-05
            skipWaiting: true,
            clientsClaim: true,
            // Clean old caches on activation
            cleanupOutdatedCaches: true,
            // Force precache invalidation by adding version to cache name
            cacheId: 'panacea-v2',
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
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
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
          // Let Vite handle code splitting automatically
          // Removed manualChunks to fix lucide-react circular dependency issue
        },
        chunkSizeWarningLimit: 500,
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
          'lucide-react',
        ]
      }
    };
});
