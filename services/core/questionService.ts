/**
 * Core Question Service (Consolidated)
 *
 * Single entry point for all question-related operations.
 * Consolidates: questionService, enhancedQuestionService,
 * intelligentQuestionService, adaptiveQuestionEngine
 *
 * ENHANCED: Now includes Sprint A & B utilities integration
 * - Condition resolver with fuzzy matching
 * - NCCPA blueprint weighting
 * - Question deduplication
 * - Adaptive difficulty
 * - Session interleaving
 *
 * @module services/core/questionService
 */

import type { Question, SessionSettings } from '../../types';

// ============================================================================
// Re-exports from legacy services (will be inlined in Phase 6.2)
// ============================================================================

// Original question service (pool management)
export {
  getQuestion,
  getQuestionBatch,
  getEnhancedQuestion,
  getPoolStatus,
  refreshPoolStatus,
  fetchPearlsForQuestion,
} from '../questionService';

// Enhanced generation (DB context)
export {
  generateEnhancedQuestion,
  getSystemConditionStats,
  systemHasSufficientContent,
} from '../ai/enhancedQuestionService';

// Intelligent selection (analytics-driven)
export {
  getIntelligentQuestions,
  getWeakAreaQuestions,
  getReviewQuestions,
  getFlowStateQuestions,
  enhanceSessionSettings,
} from '../ai/intelligentQuestionService';

// Adaptive algorithms
export {
  calculateAdaptiveState,
  selectOptimalQuestions,
  generateSessionPlan,
} from '../ai/adaptiveQuestionEngine';

// Enhanced question pool (Sprint A & B integration)
export {
  getEnhancedQuestionBatch,
  getEnhancedQuestion as getEnhancedQuestionV2,
  getEnhancedPoolStatus,
} from './enhancedQuestionPool';

// ============================================================================
// Shared Types
// ============================================================================

export interface PoolStatus {
  available: number;
  needsGeneration: boolean;
  threshold: number;
}

export interface QuestionSelectionCriteria {
  system: string;
  difficulty: 'easy' | 'medium' | 'hard';
  conditionId?: string;
  tags?: string[];
  excludeIds?: string[];
  preferVignettes?: boolean;
  preferImages?: boolean;
}

export interface AdaptiveState {
  currentDifficulty: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  recentAccuracy: number;
  cognitiveLoad: number;
  shouldAdjust: 'easier' | 'harder' | 'maintain';
}

export interface SelectedQuestion {
  questionId: string;
  conditionId: string;
  system: string;
  difficulty: string;
  selectionReason: string;
  predictedAccuracy: number;
  learningValue: number;
}

export interface IntelligentQuestionRequest {
  availableTime?: number;
  forceSystems?: string[];
  forceDifficulty?: 'easy' | 'medium' | 'hard';
  includeWeakAreas?: boolean;
  includeReviews?: boolean;
  maxQuestions?: number;
}

// ============================================================================
// Shared Constants
// ============================================================================

/**
 * System code mapping - single source of truth
 */
export const SYSTEM_CODE_MAP: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  NEURO: 'Neurology',
  MSK: 'Musculoskeletal',
  DERM: 'Dermatology',
  HEME: 'Hematology',
  ENDO: 'Endocrine',
  HEENT: 'Head & Neck',
  RENAL: 'Renal',
  REPRO: 'Reproductive',
  PSYCH: 'Psychiatry',
  ID: 'Infectious Disease',
};

/**
 * Reverse mapping: full name to code
 */
export const SYSTEM_NAME_TO_CODE: Record<string, string> = {
  cardiovascular: 'CV',
  pulmonary: 'PULM',
  gastrointestinal: 'GI',
  neurology: 'NEURO',
  musculoskeletal: 'MSK',
  dermatology: 'DERM',
  hematology: 'HEME',
  endocrine: 'ENDO',
  'head & neck': 'HEENT',
  heent: 'HEENT',
  renal: 'RENAL',
  reproductive: 'REPRO',
  psychiatry: 'PSYCH',
  'infectious disease': 'ID',
  infectious: 'ID',
};

// ============================================================================
// Shared Utilities (consolidated from duplicates)
// ============================================================================

/**
 * Convert pool question format to app Question format
 * Previously duplicated in questionService.ts and intelligentQuestionService.ts
 */
export function convertPoolQuestion(poolQ: {
  id: string;
  vignette?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  system: string;
  difficulty: string;
  tags?: string[];
  source?: 'pool' | 'main';
  conditionId?: string;
}): Question {
  // Convert correctAnswer letter (A, B, C, D) to index
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  let correctIndex = letterToIndex[poolQ.correctAnswer?.charAt(0)?.toUpperCase()] ?? 0;

  // If correctAnswer is not a letter, try to find it in options
  if (correctIndex === undefined || isNaN(correctIndex)) {
    correctIndex = poolQ.options.findIndex(
      (opt) => opt === poolQ.correctAnswer || opt.includes(poolQ.correctAnswer)
    );
    if (correctIndex === -1) correctIndex = 0;
  }

  // Derive condition name from tags or system
  const condition = poolQ.tags?.[0] || poolQ.system;

  // Use conditionId if available, otherwise generate from condition name
  // TODO: Integrate resolveConditionId here once we refactor to async pipeline
  const conditionId =
    poolQ.conditionId || condition?.toLowerCase().replace(/\s+/g, '-') || 'unknown';

  return {
    id: poolQ.id,
    question: poolQ.vignette ? `${poolQ.vignette}\n\n${poolQ.question}` : poolQ.question,
    options: poolQ.options.map((opt) =>
      // Remove letter prefix if present (e.g., "A. Option" -> "Option")
      opt.replace(/^[A-D].\s*/, '')
    ),
    correctAnswerIndex: correctIndex,
    rationale: poolQ.explanation || '',
    topic: poolQ.system || 'General',
    conditionId,
    condition,
    pearls: undefined, // Will be loaded on-demand from medicalContent
    source: poolQ.source === 'pool' ? 'database-pool' : 'database-main',
  } as Question;
}

/**
 * Normalize a system name to its code
 */
export function normalizeToSystemCode(systemInput: string): string {
  const lower = systemInput.toLowerCase().trim();
  return SYSTEM_NAME_TO_CODE[lower] || systemInput;
}

/**
 * Get display name for a system code
 */
export function getSystemDisplayName(code: string): string {
  return SYSTEM_CODE_MAP[code.toUpperCase()] || code;
}

/**
 * Extract clinical pearls from a question's rationale
 */
export function extractPearlsFromRationale(rationale: string): string[] {
  const pearls: string[] = [];

  // Pattern 1: "Key Takeaway:" or "Clinical Pearl:" followed by content
  const keyTakeawayPattern =
    /(?:Key Takeaway|Clinical Pearl|Remember|Important|High-Yield Fact):\s*(.+?)(?:\n\n|$)/gi;
  let match;
  while ((match = keyTakeawayPattern.exec(rationale)) !== null) {
    const pearl = match[1].trim();
    if (pearl.length > 10 && pearl.length < 500) {
      pearls.push(pearl);
    }
  }

  // Pattern 2: Bullet points that look like pearls
  const bulletPattern = /^[•-]\s*(.{10,300})$/gm;
  while ((match = bulletPattern.exec(rationale)) !== null) {
    const pearl = match[1].trim();
    if (pearl.length > 20 && !pearl.toLowerCase().startsWith('the correct answer')) {
      pearls.push(pearl);
    }
  }

  // Pattern 3: Sentences with clinical keywords
  const clinicalKeywords = [
    'classic presentation',
    'gold standard',
    'first-line',
    'diagnostic criteria',
    'pathognomonic',
  ];
  const sentences = rationale.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();
    if (clinicalKeywords.some((kw) => normalized.includes(kw))) {
      const pearl = sentence.trim();
      if (pearl.length > 20 && pearl.length < 300) {
        pearls.push(pearl);
      }
    }
  }

  // Deduplicate and limit to top 5 pearls
  return Array.from(new Set(pearls)).slice(0, 5);
}

/**
 * Calculate difficulty score from string
 */
export function difficultyToNumber(difficulty: string): number {
  const map: Record<string, number> = {
    easy: 25,
    easier: 25,
    medium: 50,
    same: 50,
    hard: 75,
    harder: 75,
  };
  return map[difficulty.toLowerCase()] ?? 50;
}

/**
 * Determine optimal difficulty based on adaptive state
 */
export function getOptimalDifficulty(
  baseDifficulty: 'easy' | 'medium' | 'hard',
  adaptiveState: AdaptiveState
): 'easy' | 'medium' | 'hard' {
  if (adaptiveState.shouldAdjust === 'easier') {
    if (baseDifficulty === 'hard') return 'medium';
    if (baseDifficulty === 'medium') return 'easy';
    return 'easy';
  }

  if (adaptiveState.shouldAdjust === 'harder') {
    if (baseDifficulty === 'easy') return 'medium';
    if (baseDifficulty === 'medium') return 'hard';
    return 'hard';
  }

  return baseDifficulty;
}

// ============================================================================
// Unified Entry Points
// ============================================================================

/**
 * Get questions with the optimal strategy based on user context
 *
 * This is the recommended unified entry point that automatically
 * chooses between pool, enhanced, or intelligent question fetching.
 *
 * NEW: Now uses Sprint A & B enhancements when prisma + userId provided
 */
export async function getOptimalQuestions(
  settings: SessionSettings,
  options: {
    count?: number;
    getToken?: () => Promise<string | null>;
    systemMastery?: any[];
    previousQuestionIds?: string[];
    useIntelligent?: boolean;
    // NEW: Sprint A & B integration options
    prisma?: any;
    userId?: string;
    useEnhanced?: boolean;
  } = {}
): Promise<Question[]> {
  const {
    count = 10,
    getToken,
    systemMastery = [],
    previousQuestionIds = [],
    useIntelligent = false,
    prisma,
    userId,
    useEnhanced = true,
  } = options;

  // NEW: If prisma + userId provided, use enhanced pool with Sprint A & B utilities
  if (useEnhanced && prisma && userId) {
    try {
      const { getEnhancedQuestionBatch } = await import('./enhancedQuestionPool');
      const result = await getEnhancedQuestionBatch(prisma, userId, settings, count);

      if (result.questions.length >= count * 0.8) {
        console.log(
          '[Core QuestionService] Using enhanced pool with Sprint A & B:',
          result.metadata
        );
        return result.questions;
      }
    } catch (error) {
      console.warn('[Core QuestionService] Enhanced pool failed, falling back:', error);
    }
  }

  // If we have system mastery data and intelligent mode is enabled, use intelligent selection
  if (useIntelligent && systemMastery.length > 0) {
    try {
      const { getIntelligentQuestions } = await import('../ai/intelligentQuestionService');
      const result = await getIntelligentQuestions(
        { maxQuestions: count },
        systemMastery,
        previousQuestionIds,
        getToken
      );

      if (result.questions.length >= count * 0.8) {
        console.log('[Core QuestionService] Using intelligent selection');
        return result.questions;
      }
    } catch (error) {
      console.warn('[Core QuestionService] Intelligent selection failed, falling back:', error);
    }
  }

  // Default: use pool-based question service
  const { getQuestionBatch } = await import('../questionService');
  return getQuestionBatch(settings, [], count, getToken);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Pool management
  getQuestion: async (...args: Parameters<typeof import('../questionService').getQuestion>) =>
    (await import('../questionService')).getQuestion(...args),
  getQuestionBatch: async (
    ...args: Parameters<typeof import('../questionService').getQuestionBatch>
  ) => (await import('../questionService')).getQuestionBatch(...args),
  getPoolStatus: () => import('../questionService').then((m) => m.getPoolStatus()),
  refreshPoolStatus: async (
    ...args: Parameters<typeof import('../questionService').refreshPoolStatus>
  ) => (await import('../questionService')).refreshPoolStatus(...args),

  // Enhanced generation
  generateEnhancedQuestion: async (
    ...args: Parameters<typeof import('../ai/enhancedQuestionService').generateEnhancedQuestion>
  ) => (await import('../ai/enhancedQuestionService')).generateEnhancedQuestion(...args),

  // Intelligent selection
  getIntelligentQuestions: async (
    ...args: Parameters<typeof import('../ai/intelligentQuestionService').getIntelligentQuestions>
  ) => (await import('../ai/intelligentQuestionService')).getIntelligentQuestions(...args),

  // Adaptive algorithms
  calculateAdaptiveState: (await import('../ai/adaptiveQuestionEngine')).calculateAdaptiveState,
  selectOptimalQuestions: (await import('../ai/adaptiveQuestionEngine')).selectOptimalQuestions,

  // Unified
  getOptimalQuestions,

  // Utilities
  convertPoolQuestion,
  normalizeToSystemCode,
  getSystemDisplayName,
  extractPearlsFromRationale,
  difficultyToNumber,
  getOptimalDifficulty,

  // Constants
  SYSTEM_CODE_MAP,
  SYSTEM_NAME_TO_CODE,
};
