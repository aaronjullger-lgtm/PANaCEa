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
          output: {
            manualChunks: (id) => {
              // Vendor chunks for better caching
              if (id.includes('node_modules')) {
                // Don't manually chunk React to avoid initialization issues with React 19
                // if (id.includes('react') || id.includes('react-dom')) {
                //   return 'vendor-react';
                // }
                if (id.includes('@clerk')) {
                  return 'vendor-clerk';
                }
                if (id.includes('framer-motion')) {
                  return 'vendor-animation';
                }
                // Keep lucide-react with vendor-common to avoid module initialization issues
                // if (id.includes('lucide-react')) {
                //   return 'vendor-icons';
                // }
                if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('unified')) {
                  return 'vendor-markdown';
                }
                if (id.includes('@google/generative-ai')) {
                  return 'vendor-ai';
                }
                // Group other node_modules into a common vendor chunk
                return 'vendor-common';
              }
              
              // Split large data files into separate chunks for lazy loading
              if (id.includes('drugData.json')) {
                return 'data-drugs';
              }
              if (id.includes('conditionContent')) {
                return 'data-conditions';
              }
              if (id.includes('labCases.json')) {
                return 'data-labs';
              }
              
              // Split drill mode components for better code splitting
              if (id.includes('components/drill/')) {
                const match = id.match(/components\/drill\/(\w+)/);
                if (match) {
                  return `drill-${match[1].toLowerCase()}`;
                }
              }
              
              // Split analytics and admin components
              if (id.includes('components/analytics/')) {
                return 'analytics';
              }
              if (id.includes('components/admin/') || id.includes('pages/admin/')) {
                return 'admin';
              }
            }
          }
        },
        chunkSizeWarningLimit: 1000,
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
