/**
 * useUserProfile Hook & API
 *
 * Type-safe fetch and hook for User Profile API:
 * - GET /api/user/profile - Fetch profile
 * - PUT /api/user/profile - Update profile (partial)
 *
 * Usage:
 * ```tsx
 * const { profile, isLoading, error, refetch, updateProfile } = useUserProfile();
 * await updateProfile({ firstName: 'Jane', examDate: '2025-06-15T00:00:00Z' });
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

// =============================================================================
// Types (match API contract)
// =============================================================================

/** Profile shape returned by GET /api/user/profile */
export interface UserProfileData {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  examDate: string | null;
  graduationDate: string | null;
  school: string | null;
  currentRotation: string | null;
  yearInProgram: string | null;
  hasCompletedBaseline: boolean;
  hasCompletedOnboarding: boolean;
  updatedAt: string;
}

/** Partial update payload for PUT /api/user/profile */
export interface UserProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  examDate?: string | null;
  graduationDate?: string | null;
  school?: string | null;
  currentRotation?: string | null;
  yearInProgram?: string | null;
  hasCompletedBaseline?: boolean;
  hasCompletedOnboarding?: boolean;
}

/** API success response (GET) */
export interface ProfileGetResponse {
  success: true;
  profile: UserProfileData;
}

/** API success response (PUT) */
export interface ProfilePutResponse {
  success: true;
  profile: UserProfileData;
  message: string;
}

/** API error response */
export interface ProfileErrorResponse {
  success?: false;
  error: string;
}

// =============================================================================
// Standalone fetch functions (for use outside React)
// =============================================================================

/**
 * Fetch user profile
 * @throws {Error} On non-2xx response
 */
export async function fetchUserProfile(
  getToken: () => Promise<string | null>
): Promise<UserProfileData> {
  const token = await getToken();
  const res = await fetch('/api/user/profile', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as ProfileErrorResponse;
    throw new Error(body.error || `Profile fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as ProfileGetResponse;
  if (!data.success || !data.profile) {
    throw new Error('Invalid profile response');
  }
  return data.profile;
}

/**
 * Update user profile (partial)
 * @throws {Error} On non-2xx response
 */
export async function updateUserProfile(
  getToken: () => Promise<string | null>,
  updates: UserProfileUpdateInput
): Promise<UserProfileData> {
  if (Object.keys(updates).length === 0) {
    throw new Error('At least one field must be provided for update');
  }

  const token = await getToken();
  const res = await fetch('/api/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as ProfileErrorResponse;
    throw new Error(body.error || `Profile update failed: ${res.status}`);
  }

  const data = (await res.json()) as ProfilePutResponse;
  if (!data.success || !data.profile) {
    throw new Error('Invalid profile response');
  }
  return data.profile;
}

// =============================================================================
// React Hook
// =============================================================================

interface UseUserProfileReturn {
  /** Current profile data (null while loading or on error) */
  profile: UserProfileData | null;
  /** Whether initial fetch is in progress */
  isLoading: boolean;
  /** Whether update mutation is in progress */
  isUpdating: boolean;
  /** Last error message */
  error: string | null;
  /** Refetch profile from API */
  refetch: () => Promise<void>;
  /** Update profile (partial) */
  updateProfile: (updates: UserProfileUpdateInput) => Promise<UserProfileData>;
}

export function useUserProfile(): UseUserProfileReturn {
  const { getToken, isSignedIn } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!isSignedIn) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserProfile(getToken);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isSignedIn]);

  const updateProfile = useCallback(
    async (updates: UserProfileUpdateInput): Promise<UserProfileData> => {
      if (!isSignedIn) {
        throw new Error('Must be signed in to update profile');
      }
      setIsUpdating(true);
      setError(null);
      try {
        const updated = await updateUserProfile(getToken, updates);
        setProfile(updated);
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update profile';
        setError(msg);
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [getToken, isSignedIn]
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    profile,
    isLoading,
    isUpdating,
    error,
    refetch,
    updateProfile,
  };
}

export default useUserProfile;
