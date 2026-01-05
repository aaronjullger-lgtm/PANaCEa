import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Build cache buster: 2026-01-03-v3-force-sw-update
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
            // Force SW update - increment this to bust cache
            skipWaiting: true,
            clientsClaim: true,
            // Clean old caches on activation
            cleanupOutdatedCaches: true,
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
          output: {
            manualChunks: (id) => {
              // Vendor chunks for better caching and performance
              if (id.includes('node_modules')) {
                // NOTE: lucide-react is NOT manually chunked - let Vite bundle it naturally
                // to avoid import initialization conflicts (Activity icon crash issue)
                
                // Markdown rendering (check before generic 'react' since react-markdown contains 'react')
                if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('unified')) {
                  return 'vendor-markdown';
                }
                
                // Clerk authentication library (contains 'clerk-react', check before 'react')
                if (id.includes('@clerk')) {
                  return 'vendor-clerk';
                }
                
                // Charts library - recharts contains 'react', check before generic react
                if (id.includes('recharts') || id.includes('d3-')) {
                  return 'vendor-charts';
                }
                
                // Animation library (Framer Motion is large)
                if (id.includes('framer-motion')) {
                  return 'vendor-animation';
                }
                
                // React core ecosystem - AFTER all react-* package checks above
                // This includes react, react-dom, react-router, scheduler
                if (id.includes('/react@') || id.includes('/react-dom@') || 
                    id.includes('/react-router') || id.includes('/scheduler@') ||
                    id.includes('react-is')) {
                  return 'vendor-react';
                }
                
                // AI library
                if (id.includes('@google/generative-ai')) {
                  return 'vendor-ai';
                }
                
                // Radix UI components (can be large)
                if (id.includes('@radix-ui')) {
                  return 'vendor-radix';
                }
                
                // Date/time utilities
                if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
                  return 'vendor-date';
                }
                
                // Form validation
                if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) {
                  return 'vendor-forms';
                }
                
                // State management
                if (id.includes('zustand') || id.includes('immer') || id.includes('jotai')) {
                  return 'vendor-state';
                }
                
                // Utility libraries
                if (id.includes('lodash') || id.includes('underscore') || id.includes('clsx') || id.includes('class-variance-authority') || id.includes('tailwind-merge')) {
                  return 'vendor-utils';
                }
                
                // CLMR/sonner toasts  
                if (id.includes('sonner') || id.includes('react-hot-toast')) {
                  return 'vendor-toast';
                }
                
                // Group remaining node_modules into smaller chunks by first letter
                // This prevents one giant vendor chunk
                const packageMatch = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
                if (packageMatch) {
                  const pkgName = packageMatch[1].replace('@', '').replace('/', '-');
                  const firstChar = pkgName.charAt(0).toLowerCase();
                  // Group by first letter to create multiple smaller chunks
                  return `vendor-other-${firstChar}`;
                }
                
                return 'vendor-misc';
              }
              
              // Split large data registries into separate chunks
              if (id.includes('conditionRegistry') || id.includes('conditionContent')) {
                return 'data-conditions';
              }
              if (id.includes('drugRegistry')) {
                return 'data-drugs';
              }
              if (id.includes('labRegistry') || id.includes('imagingRegistry') || id.includes('findingRegistry')) {
                return 'data-labs';
              }
              
              // Split drill mode components for lazy loading
              if (id.includes('components/drill/') || id.includes('components/modes/')) {
                const match = id.match(/components\/(drill|modes)\/(\w+)/);
                if (match) {
                  return `drill-${match[2].toLowerCase()}`;
                }
              }
              
              // Split analytics and admin components
              if (id.includes('components/analytics/')) {
                return 'analytics';
              }
              if (id.includes('components/admin/') || id.includes('pages/admin/')) {
                return 'admin';
              }
              
              // Split integrations
              if (id.includes('components/integrations/')) {
                return 'integrations';
              }
            }
          }
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
