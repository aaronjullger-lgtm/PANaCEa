/**
 * User Profile Service
 * Manages user profile data in localStorage
 */

import type { UserProfile } from '@/types';

const PROFILE_KEY = 'panacea_user_profile';

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
