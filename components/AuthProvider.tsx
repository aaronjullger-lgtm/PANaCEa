/**
 * Authentication Provider Component
 * Wraps the application with Clerk authentication
 */

import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';

interface AuthProviderProps {
  children: React.ReactNode;
}

// Get publishable key from environment variable
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

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
  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error(MISSING_KEY_ERROR);
  }

  // Enable debug mode in development or when explicitly enabled
  const isDevelopment = import.meta.env.DEV;
  const debugEnabled = isDevelopment || import.meta.env.VITE_CLERK_DEBUG === 'true';

  if (debugEnabled) {
    console.log('[Clerk] Debug mode enabled');
    console.log('[Clerk] Publishable key:', CLERK_PUBLISHABLE_KEY.substring(0, 20) + '...');
    console.log('[Clerk] Client time:', new Date().toISOString());
    console.log('[Clerk] Client timezone offset:', new Date().getTimezoneOffset());
  }

  return (
    <ClerkProvider 
      publishableKey={CLERK_PUBLISHABLE_KEY}
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
      {children}
    </ClerkProvider>
  );
}
