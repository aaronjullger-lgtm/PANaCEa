/**
 * Authentication hook wrapper
 * Provides authentication state and user information
 */

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
  const { getToken } = useClerkAuth();
  const { signOut } = useClerk();

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

  return {
    isSignedIn,
    isLoading,
    user: authUser,
    signOut: async () => {
      await signOut();
    },
    getToken: async () => {
      return await getToken();
    },
  };
}
