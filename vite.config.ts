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
            manualChunks: {
              // Vendor chunks for better caching
              'vendor-react': ['react', 'react-dom'],
              'vendor-clerk': ['@clerk/clerk-react', '@clerk/backend'],
              'vendor-animation': ['framer-motion'],
              'vendor-icons': ['lucide-react'],
              'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw', 'unified', 'remark-parse'],
              'vendor-ai': ['@google/generative-ai'],
            }
          }
        },
        chunkSizeWarningLimit: 1000,
        // Conditionally enable source maps based on environment
        // In production, use 'hidden' to generate maps but not reference them in the bundle
        sourcemap: mode === 'production' ? 'hidden' : true,
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
