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

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      {children}
    </ClerkProvider>
  );
}
