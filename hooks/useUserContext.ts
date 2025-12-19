/**
 * useUserContext Hook
 * 
 * React hook for user context awareness (PANCE vs PANRE user)
 * Provides career-stage-aware functionality throughout the app
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  getUserContext,
  setUserContext,
  type UserContext,
  type CareerStage,
} from '@/services/userContextService';

export function useUserContext() {
  const { user, isLoaded } = useUser();
  const [context, setContext] = useState<UserContext>(getUserContext());

  // Sync context when user loads
  useEffect(() => {
    if (isLoaded) {
      setContext(getUserContext());
    }
  }, [isLoaded, user]);

  const updateCareerStage = useCallback((stage: CareerStage) => {
    const newContext = {
      ...context,
      careerStage: stage,
      isPANCEUser: stage === 'student' || stage === 'unknown',
      isPANREUser: stage === 'practicing',
    };
    setUserContext(newContext);
    setContext(newContext);
  }, [context]);

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
