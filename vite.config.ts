import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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
            // Use runtime caching for large data chunks instead of precaching
            runtimeCaching: [
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
                // Split React core + lucide (lucide must load with React to avoid initialization issues)
                if (id.includes('react') && !id.includes('react-router') && !id.includes('react-markdown')) {
                  return 'vendor-react-core';
                }
                
                // Icons must be in react-core chunk to avoid "Cannot set properties of undefined"
                if (id.includes('lucide-react')) {
                  return 'vendor-react-core';
                }
                
                // Split React Router separately
                if (id.includes('react-router')) {
                  return 'vendor-router';
                }
                
                // Clerk authentication library
                if (id.includes('@clerk')) {
                  return 'vendor-clerk';
                }
                
                // Animation library (Framer Motion is large)
                if (id.includes('framer-motion')) {
                  return 'vendor-animation';
                }
                
                // Markdown rendering
                if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('unified')) {
                  return 'vendor-markdown';
                }
                
                // Charts library (if used)
                if (id.includes('recharts') || id.includes('chart')) {
                  return 'vendor-charts';
                }
                
                // UI components
                if (id.includes('@radix-ui')) {
                  return 'vendor-ui';
                }
                
                // AI library
                if (id.includes('@google/generative-ai')) {
                  return 'vendor-ai';
                }
                
                // Group remaining node_modules
                return 'vendor-common';
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
