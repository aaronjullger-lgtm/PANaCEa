/**
 * User Context Service
 * 
 * Provides context-aware functionality based on user's career stage
 * (student preparing for PANCE vs practicing PA maintaining certification via PANRE-LA)
 */

import { loadUserProfile } from './userProfileService';

export type CareerStage = 'student' | 'practicing' | 'unknown';

export interface UserContext {
  careerStage: CareerStage;
  isPANCEUser: boolean;      // Student preparing for initial certification
  isPANREUser: boolean;      // Practicing PA doing recertification
  graduationYear?: number;
  isCertifiedPA?: boolean;
}

const USER_CONTEXT_KEY = 'panceai_user_context';

/**
 * Get user context from localStorage and user profile
 */
export function getUserContext(): UserContext {
  // First check user profile for career stage info
  const profile = loadUserProfile();
  
  // Determine career stage from profile
  let careerStage: CareerStage = 'unknown';
  
  if (profile) {
    if (profile.isCertifiedPA) {
      careerStage = 'practicing';
    } else if (profile.yearInProgram === 'Graduated' || profile.yearInProgram === 'Post-Graduate') {
      careerStage = 'practicing';
    } else if (profile.yearInProgram) {
      careerStage = 'student';
    }
  }

  // Also check localStorage for explicit setting
  try {
    const stored = localStorage.getItem(USER_CONTEXT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.careerStage && parsed.careerStage !== 'unknown') {
        careerStage = parsed.careerStage;
      }
    }
  } catch (e) {
    console.error('[UserContext] Failed to parse stored context:', e);
  }
  
  return {
    careerStage,
    isPANCEUser: careerStage === 'student' || careerStage === 'unknown',
    isPANREUser: careerStage === 'practicing',
    isCertifiedPA: profile?.isCertifiedPA,
  };
}

/**
 * Update user context
 */
export function setUserContext(context: Partial<UserContext>): void {
  const current = getUserContext();
  const updated = {
    ...current,
    ...context,
    isPANCEUser: (context.careerStage ?? current.careerStage) === 'student' || (context.careerStage ?? current.careerStage) === 'unknown',
    isPANREUser: (context.careerStage ?? current.careerStage) === 'practicing',
  };
  localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(updated));
}

/**
 * Check if user should see PANRE-LA content
 */
export function shouldShowPANREContent(): boolean {
  const context = getUserContext();
  return context.isPANREUser;
}

/**
 * Check if user should see PANCE content
 */
export function shouldShowPANCEContent(): boolean {
  const context = getUserContext();
  return context.isPANCEUser;
}

/**
 * Get appropriate exam label based on user context
 */
export function getExamLabel(): string {
  return shouldShowPANREContent() ? 'PANRE' : 'PANCE';
}
