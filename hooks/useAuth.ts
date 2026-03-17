/**
 * Authentication hook wrapper
 * Provides authentication state and user information
 */

import { useCallback } from 'react';
import { useUser, useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';

export interface AuthUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface UseAuthResult {
  isSignedIn: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

/**
 * Hook for accessing authentication state
 */
export function useAuth(): UseAuthResult {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken: clerkGetToken } = useClerkAuth();
  const { signOut: clerkSignOut } = useClerk();

  const isSignedIn = !!user && userLoaded;
  const isLoading = !userLoaded;

  const authUser: AuthUser | null = user
    ? {
        id: user.id,
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress || '',
        firstName: user.firstName,
        lastName: user.lastName,
      }
    : null;

  // Stable references — useCallback with no deps so the function identity
  // doesn't change on every render (prevents infinite loops in useEffect deps).
  const getToken = useCallback(() => clerkGetToken(), [clerkGetToken]);
  const signOut = useCallback(() => clerkSignOut(), [clerkSignOut]);

  return {
    isSignedIn,
    isLoading,
    user: authUser,
    signOut,
    getToken,
  };
}
