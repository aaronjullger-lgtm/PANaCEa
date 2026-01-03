import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './components/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';

// Global handler for chunk/module loading errors (catches errors before React)
window.addEventListener('error', (event) => {
  const error = event.error || event.message;
  const errorString = String(error);
  
  // Check if this is a chunk loading error
  if (
    errorString.includes('Loading chunk') ||
    errorString.includes('Failed to fetch dynamically imported module') ||
    errorString.includes('Unable to preload CSS') ||
    (errorString.includes('vendor-') && errorString.includes('.js'))
  ) {
    console.warn('[Global] Chunk load error detected - clearing cache and reloading');
    event.preventDefault();
    
    // Clear caches and reload
    (async () => {
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
        }
      } catch (e) {
        console.error('Error clearing caches:', e);
      }
      window.location.reload();
    })();
  }
});

// Handle unhandled promise rejections for dynamic imports
window.addEventListener('unhandledrejection', (event) => {
  const errorString = String(event.reason);
  
  if (
    errorString.includes('Loading chunk') ||
    errorString.includes('Failed to fetch dynamically imported module') ||
    errorString.includes('Unable to preload CSS')
  ) {
    console.warn('[Global] Async chunk load error detected - clearing cache and reloading');
    event.preventDefault();
    
    (async () => {
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
        }
      } catch (e) {
        console.error('Error clearing caches:', e);
      }
      window.location.reload();
    })();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
