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
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShortcutProvider } from './src/context/ShortcutContext';
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
} else {
  console.log('[Sentry] Skipped in non-production mode');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

// #region agent log
const DEBUG_INGEST = 'http://127.0.0.1:7242/ingest/cc925588-f854-48c4-bfb9-7695098805ff';
function debugLog(payload: Record<string, unknown>) {
  fetch(DEBUG_INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, timestamp: Date.now() }),
  }).catch(() => {});
}
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    debugLog({
      hypothesisId: 'H5',
      location: 'global',
      message: 'window.onerror',
      data: { message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    debugLog({
      hypothesisId: 'H5',
      location: 'global',
      message: 'unhandledrejection',
      data: { reason: String(e.reason) },
    });
  });
}
// #endregion

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
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
              <ThemeProvider>
                <MasteryHeatmapProvider>
                  <App />
                </MasteryHeatmapProvider>
              </ThemeProvider>
            </BrowserRouter>
          </ShortcutProvider>
        </PersistQueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
