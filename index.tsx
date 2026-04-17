// Must be first import - polyfills for browser compatibility
import './polyfills/cjs-shim';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from './lib/queryClient';
import App from './App';
import './index.css';
import { AuthProvider } from './components/auth/AuthProvider';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import { ShortcutProvider } from './contexts/ShortcutContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MasteryHeatmapProvider } from './contexts/MasteryHeatmapContext';

// Initialize error tracking asynchronously only in production to avoid dev DSN access
if (import.meta.env.PROD) {
  import('./lib/monitoring/sentry')
    .then(({ initializeSentry }) => {
      initializeSentry();
    })
    .catch(() => {
      console.warn('[Sentry] Failed to load error tracking');
    });
}

// ─── Global Unhandled Error Handlers ──────────────────────────────────────────
// Catches promise rejections and errors that escape React's error boundary tree.
// In production, these are forwarded to Sentry; in dev they log to console.
window.addEventListener('unhandledrejection', (event) => {
  const error =
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason ?? 'Unhandled promise rejection'));

  console.error('[UnhandledRejection]', error);

  if (import.meta.env.PROD) {
    import('./lib/monitoring/sentry')
      .then(({ captureError }) => {
        captureError(error, {
          tags: { handler: 'unhandledrejection' },
          level: 'error',
        });
      })
      .catch((loadErr) => {
        // Secondary failure: Sentry module itself failed to load. Swallow to avoid
        // infinite loops, but surface to console for local debugging.
        console.warn('[Sentry] Failed to capture unhandledrejection', loadErr);
      });
  }
});

window.addEventListener('error', (event) => {
  // Skip errors already caught by React error boundaries (they re-throw)
  if (event.error?.__reactErrorBoundary) return;

  const error =
    event.error instanceof Error
      ? event.error
      : new Error(event.message || 'Uncaught error');

  console.error('[UncaughtError]', error);

  if (import.meta.env.PROD) {
    import('./lib/monitoring/sentry')
      .then(({ captureError }) => {
        captureError(error, {
          tags: { handler: 'window.onerror' },
          extra: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
          level: 'error',
        });
      })
      .catch((loadErr) => {
        // Secondary failure: Sentry module itself failed to load. Swallow to avoid
        // infinite loops, but surface to console for local debugging.
        console.warn('[Sentry] Failed to capture window.onerror', loadErr);
      });
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary variant="global">
      <ThemeProvider>
        <AuthProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister,
              maxAge: 1000 * 60 * 60 * 12, // 12 hours - due queue available offline
            }}
          >
            <ShortcutProvider>
              <BrowserRouter>
                <MasteryHeatmapProvider>
                  <App />
                </MasteryHeatmapProvider>
              </BrowserRouter>
            </ShortcutProvider>
          </PersistQueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
