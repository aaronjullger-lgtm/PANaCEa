/**
 * Enhanced Authentication Hook with Timeout & Error Handling
 * Provides graceful degradation when Clerk authentication fails or times out
 */

import { useEffect, useState, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import {
  isGuestModeActive,
  enableGuestMode,
  exitGuestMode as exitGuestModeService,
  shouldOfferGuestMode as checkShouldOfferGuestMode,
  recordAuthFailure,
  clearAuthFailures,
  getGuestModeTimeRemaining,
} from '@/services/auth/guestAuth';

interface EnhancedAuthResult {
  /** Clerk's authentication loaded state */
  authLoaded: boolean;
  /** Clerk's signed in state */
  isSignedIn: boolean;
  /** Enhanced loading state with timeout detection */
  isLoading: boolean;
  /** Error message if authentication failed */
  error: string | null;
  /** Time elapsed since authentication started (ms) */
  elapsedTime: number;
  /** Whether authentication has timed out */
  hasTimedOut: boolean;
  /** Function to retry authentication */
  retryAuth: () => void;
  /** Function to enter guest/demo mode */
  enterGuestMode: () => void;
  /** Whether guest mode is active */
  isGuestMode: boolean;
  /** Time remaining in guest mode (minutes) */
  guestTimeRemaining: number;
  /** Whether guest mode should be offered */
  shouldOfferGuestMode: boolean;
}

const AUTH_TIMEOUT_MS = 8000; // 8 seconds — Clerk should load in <3s; 8s gives headroom on slow connections
const AUTH_RETRY_COUNT_KEY = 'pance-auth-retry-count';
const MAX_RETRIES = 3;

/**
 * Enhanced authentication hook with timeout, error handling, and guest mode fallback
 */
export function useEnhancedAuth(): EnhancedAuthResult {
  const { isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestTimeRemaining, setGuestTimeRemaining] = useState(0);
  const [retryCount, setRetryCount] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTH_RETRY_COUNT_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch (err) {
      console.debug('[useEnhancedAuth] failed to read auth retry count from localStorage', err);
      return 0;
    }
  });

  // Check for existing guest mode on mount
  useEffect(() => {
    const guestActive = isGuestModeActive();
    setIsGuestMode(guestActive);
    if (guestActive) {
      setGuestTimeRemaining(getGuestModeTimeRemaining());
      if (import.meta.env.DEV) console.debug('[Auth] Guest mode restored, time remaining:', getGuestModeTimeRemaining(), 'minutes');
    }
  }, []);

  // Timer for authentication timeout
  useEffect(() => {
    if (clerkLoaded || isGuestMode) {
      setElapsedTime(0);
      setHasTimedOut(false);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const currentElapsed = Date.now() - startTime;
      setElapsedTime(currentElapsed);

      if (currentElapsed > AUTH_TIMEOUT_MS) {
        setHasTimedOut(true);
        setError(
          'Authentication is taking longer than expected. You can try guest mode or check your connection.'
        );
        recordAuthFailure(); // Record this as an auth failure
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [clerkLoaded, isGuestMode]);

  // Update guest mode time remaining
  useEffect(() => {
    if (!isGuestMode) return;

    const interval = setInterval(() => {
      setGuestTimeRemaining(getGuestModeTimeRemaining());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isGuestMode]);

  // Monitor for authentication errors
  useEffect(() => {
    if (!clerkLoaded && elapsedTime > 5000) {
      // Check for common Clerk errors
      const checkClerkErrors = () => {
        // Check if Clerk script loaded
        const clerkScript = document.querySelector('script[src*="clerk"]');
        if (!clerkScript) {
          setError('Authentication service not loaded. Please check your internet connection.');
          recordAuthFailure();
          return undefined;
        }

        // Use error event listener instead of monkey-patching console.error
        const handleError = (event: ErrorEvent) => {
          const errorStr = event.message || String(event.error || '');
          if (
            errorStr.includes('Clerk') ||
            errorStr.includes('authentication') ||
            errorStr.includes('token')
          ) {
            setError(`Authentication error: ${errorStr.substring(0, 100)}...`);
            recordAuthFailure();
          }
        };

        window.addEventListener('error', handleError);
        return () => {
          window.removeEventListener('error', handleError);
        };
      };

      const cleanup = checkClerkErrors();
      return cleanup;
    }
    return undefined;
  }, [clerkLoaded, elapsedTime]);

  const retryAuth = useCallback(() => {
    setError(null);
    setElapsedTime(0);
    setHasTimedOut(false);

    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    localStorage.setItem(AUTH_RETRY_COUNT_KEY, newRetryCount.toString());

    if (newRetryCount >= MAX_RETRIES) {
      setError(
        `Authentication failed after ${MAX_RETRIES} attempts. Try guest mode or check your Clerk configuration.`
      );
    } else {
      // Force Clerk to retry by reloading the page (simplest approach)
      if (import.meta.env.DEV) console.debug(`[Auth] Retry attempt ${newRetryCount}/${MAX_RETRIES}`);
      window.location.reload();
    }
  }, [retryCount]);

  const enterGuestMode = useCallback(() => {
    enableGuestMode();
    setIsGuestMode(true);
    setError(null);
    setHasTimedOut(false);
    setGuestTimeRemaining(getGuestModeTimeRemaining());
    clearAuthFailures(); // Clear failures since user chose guest mode
    if (import.meta.env.DEV) console.debug('[Auth] Entered guest mode');
  }, []);

  // Combined loading state
  const isLoading = !clerkLoaded && !isGuestMode && !hasTimedOut;
  const shouldOfferGuestMode = checkShouldOfferGuestMode() || hasTimedOut || retryCount >= 1;

  return {
    authLoaded: clerkLoaded,
    isSignedIn: isGuestMode ? false : !!isSignedIn, // Guest mode is not signed in
    isLoading,
    error,
    elapsedTime,
    hasTimedOut,
    retryAuth,
    enterGuestMode,
    isGuestMode,
    guestTimeRemaining,
    shouldOfferGuestMode,
  };
}

/**
 * Utility function to check if guest mode should be offered
 */
export function shouldOfferGuestMode(): boolean {
  return checkShouldOfferGuestMode();
}

/**
 * Utility function to exit guest mode
 */
export function exitGuestMode(): void {
  // The static import is aliased as exitGuestModeService to avoid shadowing
  // this export — and to eliminate the Rollup warning about guestAuth being
  // both statically and dynamically imported in the same chunk.
  exitGuestModeService();
  window.location.reload();
}

/**
 * Hook to get authentication token with fallback for guest mode
 */
export function useAuthToken(): string | null {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const { isGuestMode } = useEnhancedAuth();

  useEffect(() => {
    if (isGuestMode) {
      // Generate a unique guest session token instead of hardcoded string
      // This prevents authentication bypass if any endpoint accepts the hardcoded token
      const guestSessionId = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      setToken(guestSessionId);
      return;
    }

    const fetchToken = async () => {
      try {
        const clerkToken = await getToken?.();
        setToken(clerkToken || null);
      } catch (error) {
        console.error('[Auth] Failed to get token:', error);
        setToken(null);
      }
    };

    fetchToken();
  }, [getToken, isGuestMode]);

  return token;
}
