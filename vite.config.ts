import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
          }
        }
      },
      plugins: [react()],
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
                if (id.includes('react') || id.includes('react-dom')) {
                  return 'vendor-react';
                }
                if (id.includes('@clerk')) {
                  return 'vendor-clerk';
                }
                if (id.includes('framer-motion')) {
                  return 'vendor-animation';
                }
                if (id.includes('lucide-react')) {
                  return 'vendor-icons';
                }
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
