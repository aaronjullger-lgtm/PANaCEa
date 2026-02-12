/**
 * Guest Authentication Service
 * Provides limited functionality for users when Clerk authentication fails
 */

const GUEST_MODE_STORAGE_KEY = 'pance-guest-mode';
const GUEST_MODE_EXPIRY_KEY = 'pance-guest-expiry';
const GUEST_MODE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if guest mode is active and valid
 */
export function isGuestModeActive(): boolean {
  const guestMode = localStorage.getItem(GUEST_MODE_STORAGE_KEY);
  const expiry = localStorage.getItem(GUEST_MODE_EXPIRY_KEY);
  
  if (guestMode !== 'true') {
    return false;
  }
  
  if (expiry) {
    const expiryTime = parseInt(expiry, 10);
    if (Date.now() > expiryTime) {
      // Guest mode expired
      exitGuestMode();
      return false;
    }
  }
  
  return true;
}

/**
 * Enable guest mode
 */
export function enableGuestMode(): void {
  localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
  const expiryTime = Date.now() + GUEST_MODE_DURATION_MS;
  localStorage.setItem(GUEST_MODE_EXPIRY_KEY, expiryTime.toString());
  
  console.log('[GuestAuth] Guest mode enabled, expires at:', new Date(expiryTime).toISOString());
}

/**
 * Exit guest mode
 */
export function exitGuestMode(): void {
  localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
  localStorage.removeItem(GUEST_MODE_EXPIRY_KEY);
  console.log('[GuestAuth] Guest mode exited');
}

/**
 * Get guest mode expiry time
 */
export function getGuestModeExpiry(): Date | null {
  const expiry = localStorage.getItem(GUEST_MODE_EXPIRY_KEY);
  if (!expiry) return null;
  
  return new Date(parseInt(expiry, 10));
}

/**
 * Get time remaining in guest mode (in minutes)
 */
export function getGuestModeTimeRemaining(): number {
  if (!isGuestModeActive()) return 0;
  
  const expiry = localStorage.getItem(GUEST_MODE_EXPIRY_KEY);
  if (!expiry) return 0;
  
  const remaining = parseInt(expiry, 10) - Date.now();
  return Math.max(0, Math.floor(remaining / (60 * 1000))); // Convert to minutes
}

/**
 * Check if a feature is available in guest mode
 */
export function isFeatureAvailableInGuestMode(feature: string): boolean {
  const guestFeatures = [
    'view-content',
    'study-modes',
    'flashcards',
    'reference-library',
    'analytics-view',
    'settings-view'
  ];
  
  const restrictedFeatures = [
    'save-progress',
    'sync-data',
    'premium-content',
    'community-features',
    'export-data',
    'admin-features'
  ];
  
  if (guestFeatures.includes(feature)) {
    return true;
  }
  
  if (restrictedFeatures.includes(feature)) {
    return false;
  }
  
  // Default to allowing features with a warning
  return true;
}

/**
 * Get a mock user object for guest mode
 */
export function getGuestUser(): {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isGuest: boolean;
} {
  return {
    id: 'guest-' + Math.random().toString(36).substring(2, 9),
    email: 'guest@panacea.app',
    firstName: 'Guest',
    lastName: 'User',
    isGuest: true
  };
}

/**
 * Get a mock authentication token for guest mode
 */
export function getGuestToken(): string {
  return 'guest-mode-token-' + Date.now();
}

/**
 * Initialize guest mode services
 */
export function initializeGuestMode(): void {
  if (isGuestModeActive()) {
    console.log('[GuestAuth] Guest mode is active, time remaining:', getGuestModeTimeRemaining(), 'minutes');
    
    // Show guest mode notification
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const event = new CustomEvent('guest-mode-active', {
          detail: { timeRemaining: getGuestModeTimeRemaining() }
        });
        window.dispatchEvent(event);
      }, 1000);
    }
  }
}

/**
 * Hook to check if guest mode should be offered based on authentication failures
 */
export function shouldOfferGuestMode(): boolean {
  const authFailureCount = parseInt(localStorage.getItem('pance-auth-failure-count') || '0', 10);
  const lastFailureTime = parseInt(localStorage.getItem('pance-auth-last-failure') || '0', 10);
  
  // Reset failure count if it's been more than 1 hour
  if (Date.now() - lastFailureTime > 60 * 60 * 1000) {
    localStorage.setItem('pance-auth-failure-count', '0');
    return false;
  }
  
  return authFailureCount >= 2;
}

/**
 * Record an authentication failure
 */
export function recordAuthFailure(): void {
  const currentCount = parseInt(localStorage.getItem('pance-auth-failure-count') || '0', 10);
  localStorage.setItem('pance-auth-failure-count', (currentCount + 1).toString());
  localStorage.setItem('pance-auth-last-failure', Date.now().toString());
}

/**
 * Clear authentication failure records
 */
export function clearAuthFailures(): void {
  localStorage.removeItem('pance-auth-failure-count');
  localStorage.removeItem('pance-auth-last-failure');
}