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

/**
 * Provides authentication context to the entire app
 */
export function AuthProvider({ children }: AuthProviderProps) {
  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Publishable Key for Clerk!\n\n" +
      "To fix this issue:\n" +
      "1. Copy .env.example to .env: cp .env.example .env\n" +
      "2. Get your Clerk publishable key from https://dashboard.clerk.com\n" +
      "3. Add it to .env as: VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here\n" +
      "4. Restart the development server\n\n" +
      "See AUTHENTICATION_SETUP.md for detailed setup instructions."
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      {children}
    </ClerkProvider>
  );
}
