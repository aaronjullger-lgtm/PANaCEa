/**
 * Authentication Provider Component
 * Wraps the application with Clerk authentication.
 * Must be rendered inside ThemeProvider so Clerk appearance uses app theme (light/dark).
 */

import React, { useEffect } from 'react';
import { ClerkProvider, useUser } from '@clerk/clerk-react';
import { DevAutoLogin } from './DevAutoLogin';
import { useThemeContext } from '@/contexts/ThemeContext';
import { SetupRequiredPage } from './SetupRequiredPage';

// Lazy import Sentry functions to avoid initialization conflicts
let setUserContext: ((user: { id: string; email?: string; username?: string }) => void) | null =
  null;
let clearUserContext: (() => void) | null = null;

// Load Sentry functions asynchronously (production only)
if (import.meta.env.PROD) {
  import('@/lib/monitoring/sentry')
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
const BASE_CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

// Optional dev override for localhost (avoids pk_live domain restrictions during local development)
const DEV_CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY_DEV ||
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY_LOCAL ||
  '';

// Error message when Clerk publishable key is missing
const MISSING_KEY_ERROR = `Missing Publishable Key for Clerk!

To fix this issue:
1. Copy env.example to .env: cp env.example .env
2. Get your Clerk publishable key from https://dashboard.clerk.com
3. Add it to .env as: VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
4. Restart the development server

See AUTHENTICATION_SETUP.md for detailed setup instructions.`;

/** Production hosts: use pk_live_ keys; if build baked in pk_test_, show setup page */
function isProductionHost(hostname: string): boolean {
  return (
    hostname === 'studypanacea.com' ||
    hostname.endsWith('.studypanacea.com') ||
    hostname.endsWith('.pages.dev')
  );
}

/** Message when deployed to production but build used dev keys (e.g. missing Cloudflare build env) */
const PRODUCTION_DEV_KEYS_ERROR = `Production is using development keys

This site is running on a production host but the build was made with development keys (pk_test_...). Clerk will show "development" and auth may not work correctly.

Fix (choose one):

1. Cloudflare Pages (recommended)
   • Dashboard → Workers & Pages → panacea → Settings → Environment variables
   • For "Production" (and Preview if needed), add:
     VITE_CLERK_PUBLISHABLE_KEY = pk_live_... (from Clerk Dashboard → API Keys)
   • Redeploy so the build runs with production keys (VITE_* are baked in at build time).

2. Wrangler / single source of truth
   • Ensure production build runs: npm run build (which runs scripts/inject-wrangler-env.js first).
   • wrangler.toml [vars] are then used when building so production keys from there are used.

Never commit .env with production secrets. Use Cloudflare Dashboard or wrangler.toml [vars] for production.`;

/**
 * Provides authentication context to the entire app
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // CRITICAL: Call all hooks BEFORE any conditional returns
  const themeContext = useThemeContext();
  
  const isLocalDevServer = import.meta.env.DEV && import.meta.env.MODE !== 'production';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

  const publishableKey =
    isLocalDevServer &&
    isLocalhost &&
    BASE_CLERK_PUBLISHABLE_KEY.startsWith('pk_live_') &&
    DEV_CLERK_PUBLISHABLE_KEY
      ? DEV_CLERK_PUBLISHABLE_KEY
      : BASE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <SetupRequiredPage message={MISSING_KEY_ERROR} />;
  }

  if (isProductionHost(hostname) && publishableKey.startsWith('pk_test_')) {
    return <SetupRequiredPage message={PRODUCTION_DEV_KEYS_ERROR} />;
  }

  if (isLocalDevServer && isLocalhost && publishableKey.startsWith('pk_live_')) {
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
  const debugEnabled = import.meta.env.VITE_CLERK_DEBUG === 'true';

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
        variables: {
          colorBackground: 'var(--color-bg-primary)',
          colorForeground: 'var(--color-text-primary)',
          colorPrimary: 'var(--color-accent)',
          colorPrimaryForeground: 'var(--color-text-inverse)',
          colorMuted: 'var(--color-bg-secondary)',
          colorMutedForeground: 'var(--color-text-muted)',
          colorInput: 'var(--color-bg-secondary)',
          colorInputForeground: 'var(--color-text-primary)',
          colorBorder: 'var(--color-border)',
          colorRing: 'var(--color-accent)',
          colorDanger: 'var(--color-data-fail)',
          colorSuccess: 'var(--color-data-pass)',
          borderRadius: '0.75rem',
        },
        elements: {
          footer: 'hidden',
          footerAction: 'hidden',
          footerActionText: 'hidden',
          card: 'shadow-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]',
          headerTitle: 'text-[var(--color-text-primary)] font-semibold',
          headerSubtitle: 'text-[var(--color-text-muted)]',
          formButtonPrimary:
            'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)]',
          formFieldInput:
            'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
          formFieldLabel: 'text-[var(--color-text-primary)]',
          formFieldInputShowPasswordButton:
            'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
          footerActionLink: 'text-[var(--color-accent)] hover:text-[var(--color-accent)]/90',
          socialButtonsBlockButton:
            'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]',
          socialButtonsBlockButtonText: 'text-[var(--color-text-primary)]',
          dividerLine: 'bg-[var(--color-border)]',
          dividerText: 'text-[var(--color-text-muted)]',
          identityPreviewEditButton:
            'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
        },
      }}
    >
      <SentryUserSync />
      <DevAutoLogin />
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
