/**
 * Authentication Provider Component
 * Wraps the application with Clerk authentication
 */

import React, { useEffect } from 'react';
import { ClerkProvider, useUser } from '@clerk/clerk-react';

// Lazy import Sentry functions to avoid initialization conflicts
let setUserContext: ((user: { id: string; email?: string; username?: string }) => void) | null =
  null;
let clearUserContext: (() => void) | null = null;

// Load Sentry functions asynchronously (production only)
if (import.meta.env.PROD) {
  import('../lib/monitoring/sentry')
    .then((sentry) => {
      setUserContext = sentry.setUserContext;
      clearUserContext = sentry.clearUserContext;
    })
    .catch(() => {
      // Sentry not available, ignore
    });
}

interface AuthProviderProps {
  children: React.ReactNode;
}

// Get publishable key from environment variable
// @ts-ignore - import.meta.env is available in Vite but may not be typed
const BASE_CLERK_PUBLISHABLE_KEY = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY || '';

// Optional dev override for localhost (avoids pk_live domain restrictions during local development)
// @ts-ignore
const DEV_CLERK_PUBLISHABLE_KEY =
  (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY_DEV ||
  (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY_LOCAL ||
  '';

// Error message when Clerk publishable key is missing
const MISSING_KEY_ERROR = `Missing Publishable Key for Clerk!

To fix this issue:
1. Copy .env.example to .env: cp .env.example .env
2. Get your Clerk publishable key from https://dashboard.clerk.com
3. Add it to .env as: VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
4. Restart the development server

See AUTHENTICATION_SETUP.md for detailed setup instructions.`;

/**
 * Provides authentication context to the entire app
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // @ts-ignore
  const isDevelopment = import.meta.env?.DEV;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

  const publishableKey =
    isDevelopment &&
    isLocalhost &&
    BASE_CLERK_PUBLISHABLE_KEY.startsWith('pk_live_') &&
    DEV_CLERK_PUBLISHABLE_KEY
      ? DEV_CLERK_PUBLISHABLE_KEY
      : BASE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(MISSING_KEY_ERROR);
  }

  if (isDevelopment && isLocalhost && publishableKey.startsWith('pk_live_')) {
    throw new Error(
      `Clerk is configured with a production publishable key (pk_live_...) on localhost.\n\n` +
        `Fix options:\n` +
        `1) Use a test key locally: set VITE_CLERK_PUBLISHABLE_KEY=pk_test_... in .env\n` +
        `2) Or set VITE_CLERK_PUBLISHABLE_KEY_DEV=pk_test_... (recommended)\n` +
        `3) Or configure Clerk allowed origins for your local domain in the Clerk dashboard\n\n` +
        `Then restart: npm run dev:all`
    );
  }

  // Enable debug mode only when explicitly enabled (not auto-enabled in dev to reduce console noise)
  // @ts-ignore - import.meta.env is available in Vite but may not be typed
  const debugEnabled = import.meta.env?.VITE_CLERK_DEBUG === 'true';

  if (debugEnabled) {
    console.log('[Clerk] Debug mode enabled');
    console.log('[Clerk] Publishable key:', publishableKey.substring(0, 20) + '...');
    console.log('[Clerk] Client time:', new Date().toISOString());
    console.log('[Clerk] Client timezone offset:', new Date().getTimezoneOffset());
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      telemetry={debugEnabled ? { disabled: false, debug: true } : undefined}
      appearance={{
        elements: {
          // Hide Clerk branding and development mode indicators
          footer: 'hidden',
          footerAction: 'hidden',
          footerActionText: 'hidden',
          // Customize the overall styling to match app theme
          card: 'shadow-xl border border-[var(--color-border)]',
          headerTitle: 'text-[var(--color-text-primary)] font-semibold',
          headerSubtitle: 'text-[var(--color-text-muted)]',
          formButtonPrimary: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90',
          formFieldInput: 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
          footerActionLink: 'text-[var(--color-accent)] hover:text-[var(--color-accent)]/90',
        },
      }}
    >
      <SentryUserSync />
      {children}
    </ClerkProvider>
  );
}

/**
 * Sync Clerk user context with Sentry for error tracking
 */
function SentryUserSync() {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    if (isSignedIn && user && setUserContext) {
      setUserContext({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username || undefined,
      });
    } else if (clearUserContext) {
      clearUserContext();
    }
  }, [isSignedIn, user]);

  return null;
}