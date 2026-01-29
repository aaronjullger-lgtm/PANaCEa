// Must be first import - polyfills for browser compatibility
import './polyfills/cjs-shim';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './components/auth/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShortcutProvider } from './src/context/ShortcutContext';

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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ShortcutProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ShortcutProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
