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
  isPANCEUser: boolean; // Student preparing for initial certification
  isPANREUser: boolean; // Practicing PA doing recertification
  graduationYear?: number;
  isCertifiedPA?: boolean;
}

const USER_CONTEXT_KEY = 'panceai_user_context';
const CAREER_STAGE_KEY = 'panceai_career_stage'; // Dedicated key for career stage

/**
 * Get user context from localStorage and user profile
 * Priority: 1) Explicit career stage setting, 2) User profile inference
 */
export function getUserContext(): UserContext {
  const profile = loadUserProfile();

  // PRIORITY 1: Check for explicit career stage setting (this persists user's choice)
  let careerStage: CareerStage = 'unknown';

  try {
    const explicitStage = localStorage.getItem(CAREER_STAGE_KEY);
    if (explicitStage && (explicitStage === 'student' || explicitStage === 'practicing')) {
      careerStage = explicitStage as CareerStage;
    } else {
      // PRIORITY 2: Try stored context object
      const stored = localStorage.getItem(USER_CONTEXT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.careerStage && parsed.careerStage !== 'unknown') {
          careerStage = parsed.careerStage;
        }
      }
    }
  } catch (e) {
    console.error('[UserContext] Failed to parse stored context:', e);
  }

  // PRIORITY 3: Infer from profile only if no explicit setting exists
  if (careerStage === 'unknown' && profile) {
    if (profile.isCertifiedPA) {
      careerStage = 'practicing';
    } else if (profile.yearInProgram === 'Graduated' || profile.yearInProgram === 'Post-Graduate') {
      careerStage = 'practicing';
    } else if (profile.yearInProgram) {
      careerStage = 'student';
    }
  }

  // Default to student if still unknown (PANCE is the most common use case)
  if (careerStage === 'unknown') {
    careerStage = 'student';
  }

  return {
    careerStage,
    isPANCEUser: careerStage === 'student',
    isPANREUser: careerStage === 'practicing',
    isCertifiedPA: profile?.isCertifiedPA,
  };
}

/**
 * Update user context - persists to both dedicated key and full context
 */
export function setUserContext(context: Partial<UserContext>): void {
  const current = getUserContext();
  const newCareerStage = context.careerStage ?? current.careerStage;

  const updated = {
    ...current,
    ...context,
    careerStage: newCareerStage,
    isPANCEUser: newCareerStage === 'student',
    isPANREUser: newCareerStage === 'practicing',
  };

  // Save to both keys for maximum reliability
  localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(updated));

  // Also save career stage to dedicated key (most important for persistence)
  if (context.careerStage) {
    localStorage.setItem('panceai_career_stage', context.careerStage);
  }

  console.log('[UserContext] Saved context:', {
    careerStage: updated.careerStage,
    isPANREUser: updated.isPANREUser,
  });
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
