/**
 * useUserContext Hook
 *
 * React hook for user context awareness (PANCE vs PANRE user)
 * Provides career-stage-aware functionality throughout the app
 * Reactively updates when context changes (including from Settings)
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  getUserContext,
  setUserContext,
  type UserContext,
  type CareerStage,
} from '@/services/analytics';

// Create a simple pub/sub for context changes
const listeners = new Set<() => void>();
let currentContext = getUserContext();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return currentContext;
}

function notifyListeners() {
  currentContext = getUserContext();
  listeners.forEach((listener) => listener());
}

// Listen to storage events for cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'panceai_career_stage' || e.key === 'panceai_user_context') {
      notifyListeners();
    }
  });
}

export function useUserContext() {
  const { user, isLoaded } = useUser();

  // Use useSyncExternalStore for reactive updates
  const context = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Sync context when user loads
  useEffect(() => {
    if (isLoaded) {
      notifyListeners();
    }
  }, [isLoaded, user]);

  const updateCareerStage = useCallback(
    (stage: CareerStage) => {
      const newContext = {
        ...context,
        careerStage: stage,
        isPANCEUser: stage === 'student',
        isPANREUser: stage === 'practicing',
      };
      setUserContext(newContext);
      notifyListeners(); // Immediately notify all listeners
    },
    [context]
  );

  return {
    ...context,
    isLoaded,
    updateCareerStage,
    // Convenience getters
    examLabel: context.isPANREUser ? 'PANRE' : 'PANCE',
    showPANREContent: context.isPANREUser,
    showPANCEContent: context.isPANCEUser,
  };
}

// Export notifyListeners for use when settings change
export { notifyListeners as refreshUserContext };
