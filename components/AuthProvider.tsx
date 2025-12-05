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

// Use official Clerk CDN to bypass custom domain configuration issues
const CLERK_JS_URL = 'https://cdn.clerk.io/npm/@clerk/clerk-js@5/dist/clerk.browser.js';

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

  return (
    <ClerkProvider 
      publishableKey={CLERK_PUBLISHABLE_KEY}
      clerkJSUrl={CLERK_JS_URL}
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
