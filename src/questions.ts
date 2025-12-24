/**
 * Question Service - Database-First Architecture
 * 
 * Fetches questions from the live database via API endpoints.
 * Replaces static QUESTION_BANK with dynamic data loading.
 * 
 * Usage:
 *   const questions = await getQuestions({ system: 'CV', limit: 10 });
 */

import type { Question, SystemCode } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface QuestionFilters {
  /** User ID for personalized question selection (avoids repeats) */
  userId?: string;
  /** Filter by PANCE system (CV, PULM, etc.) */
  system?: SystemCode;
  /** Filter by specific condition ID */
  conditionId?: string;
  /** Filter by difficulty level */
  difficulty?: 'easier' | 'same' | 'harder';
  /** Filter by question type (e.g., 'clinical-vignette', 'diagnostic') */
  questionType?: string;
  /** Maximum number of questions to fetch */
  limit?: number;
}

export interface QuestionResponse {
  questions: Question[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// API CLIENT
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Fetch questions from the database via API
 * 
 * @param filters - Query filters for selecting questions
 * @returns Array of questions matching the filters
 * 
 * @example
 * ```typescript
 * // Get 10 cardiovascular questions for a user
 * const questions = await getQuestions({
 *   userId: 'user_123',
 *   system: 'CV',
 *   limit: 10
 * });
 * ```
 */
export async function getQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
  try {
    const { limit = 10, ...otherFilters } = filters;

    const response = await fetch(`${API_BASE_URL}/api/questions/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include auth cookies
      body: JSON.stringify({
        ...otherFilters,
        limit,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Failed to fetch questions: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    
    // API returns { questions: [...] }
    return data.questions || [];
  } catch (error) {
    console.error('[QuestionService] Failed to fetch questions:', error);
    
    // Decide whether to throw or return empty array
    // Throwing allows caller to handle errors explicitly
    if (error instanceof Error) {
      throw new Error(`Question fetch failed: ${error.message}`);
    }
    
    throw new Error('Question fetch failed: Unknown error');
  }
}

/**
 * Get questions for a specific condition
 * 
 * @param conditionId - The condition ID to fetch questions for
 * @param userId - User ID for personalized selection (optional)
 * @param limit - Maximum number of questions (default: 5)
 * @returns Array of questions for the condition
 */
export async function getQuestionsByCondition(
  conditionId: string,
  userId?: string,
  limit: number = 5
): Promise<Question[]> {
  return getQuestions({ conditionId, userId, limit });
}

/**
 * Get questions for a specific system
 * 
 * @param system - PANCE system code (CV, PULM, etc.)
 * @param userId - User ID for personalized selection (optional)
 * @param limit - Maximum number of questions (default: 10)
 * @returns Array of questions for the system
 */
export async function getQuestionsBySystem(
  system: SystemCode,
  userId?: string,
  limit: number = 10
): Promise<Question[]> {
  return getQuestions({ system, userId, limit });
}

/**
 * Get a random sample of questions (for mixed practice)
 * 
 * @param userId - User ID for personalized selection (optional)
 * @param limit - Maximum number of questions (default: 20)
 * @returns Array of random questions
 */
export async function getRandomQuestions(
  userId?: string,
  limit: number = 20
): Promise<Question[]> {
  return getQuestions({ userId, limit });
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use getQuestions() instead
 * 
 * Legacy export for backward compatibility.
 * This will be removed in a future version.
 * 
 * Migration guide:
 * - Replace: `import { QUESTION_BANK } from './questions'`
 * - With: `import { getQuestions } from './questions'`
 * - Then: `const questions = await getQuestions({ limit: 50 })`
 */
export const QUESTION_BANK: Question[] = [];

// Add deprecation warning in development
if (import.meta.env.DEV) {
  console.warn(
    '[DEPRECATION] QUESTION_BANK is deprecated and will be removed. ' +
    'Use getQuestions() instead to fetch questions from the database.'
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Prefetch questions to warm up the cache
 * Useful for preloading questions before a quiz session starts
 */
export async function prefetchQuestions(filters: QuestionFilters): Promise<void> {
  try {
    await getQuestions(filters);
  } catch (error) {
    // Silent fail for prefetch - don't block the UI
    console.warn('[QuestionService] Prefetch failed:', error);
  }
}

/**
 * Check if questions are available for given filters
 * Useful for showing/hiding UI elements based on data availability
 */
export async function hasQuestions(filters: QuestionFilters): Promise<boolean> {
  try {
    const questions = await getQuestions({ ...filters, limit: 1 });
    return questions.length > 0;
  } catch (error) {
    console.error('[QuestionService] hasQuestions check failed:', error);
    return false;
  }
}
