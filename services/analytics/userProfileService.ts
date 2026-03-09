/**
 * User Profile Service
 * Manages user profile data in localStorage
 */

import type { UserProfile } from '@/types';
import { StorageKeys } from '@/lib/storage/storageRegistry';

const PROFILE_KEY = StorageKeys.USER_PROFILE;

/**
 * Load user profile from localStorage
 */
export function loadUserProfile(): UserProfile | null {
  try {
    const stored = localStorage.getItem(PROFILE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as UserProfile;
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
}

/**
 * Save user profile to localStorage
 */
export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Error saving user profile:', error);
  }
}

/**
 * Merge EOR and rotation date fields from API profile into localStorage.
 * Call after fetching or updating profile via API so loadUserProfile() stays in sync.
 */
export function mergeEorFieldsFromApi(apiProfile: {
  eorTestDate?: string | null;
  rotationStartDate?: string | null;
  rotationEndDate?: string | null;
  currentRotation?: string | null;
  yearInProgram?: string | null;
}): void {
  const current = loadUserProfile() || { hasCompletedOnboarding: false };
  const updated: UserProfile = {
    ...current,
    ...(apiProfile.eorTestDate !== undefined && { eorTestDate: apiProfile.eorTestDate ?? undefined }),
    ...(apiProfile.rotationStartDate !== undefined && {
      rotationStartDate: apiProfile.rotationStartDate ?? undefined,
    }),
    ...(apiProfile.rotationEndDate !== undefined && {
      rotationEndDate: apiProfile.rotationEndDate ?? undefined,
    }),
    ...(apiProfile.currentRotation !== undefined && {
      currentRotation: apiProfile.currentRotation ?? undefined,
    }),
    ...(apiProfile.yearInProgram !== undefined && {
      yearInProgram: apiProfile.yearInProgram ?? undefined,
    }),
  };
  saveUserProfile(updated);
}

/**
 * Update specific fields in user profile
 */
export function updateUserProfile(updates: Partial<UserProfile>): UserProfile {
  const current = loadUserProfile() || { hasCompletedOnboarding: false };
  const updated = { ...current, ...updates };
  saveUserProfile(updated);
  return updated;
}

/**
 * Clear user profile from localStorage
 */
export function clearUserProfile(): void {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (error) {
    console.error('Error clearing user profile:', error);
  }
}

/**
 * Check if user has completed onboarding
 */
export function hasCompletedOnboarding(): boolean {
  const profile = loadUserProfile();
  return profile?.hasCompletedOnboarding ?? false;
}
