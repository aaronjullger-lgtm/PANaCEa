/**
 * Intelligent Question Generation Service
 *
 * Uses user analytics to generate perfectly targeted questions:
 * - Adapts difficulty based on cognitive state
 * - Targets weak areas identified by analytics
 * - Balances spaced repetition with new content
 * - Optimizes for flow state and learning velocity
 */

import type { Question, SessionSettings } from '@/types';
import {
  getCognitiveState,
  getLearningVelocity,
  generateQuestionTargeting,
  type CognitiveState,
  type LearningVelocity,
  type QuestionTargeting,
  type SystemMasteryProfile,
} from './advancedUserAnalyticsEngine';
import { getAdaptiveFSRS, generateAdaptiveStudyPlan } from './adaptiveFSRSService';

// ============================================================================
// Types
// ============================================================================

export interface IntelligentQuestionRequest {
  /** Available study time in minutes */
  availableTime?: number;
  /** Specific systems to focus on (overrides analytics) */
  forceSystems?: string[];
  /** Force a specific difficulty */
  forceDifficulty?: 'easy' | 'medium' | 'hard';
  /** Include questions from weak areas */
  includeWeakAreas?: boolean;
  /** Include spaced repetition review items */
  includeReviews?: boolean;
  /** Maximum questions to fetch */
  maxQuestions?: number;
}

export interface IntelligentQuestionResult {
  questions: Question[];
  targeting: QuestionTargeting;
  sessionPlan: {
    recommendedCount: number;
    difficultyMix: { easy: number; medium: number; hard: number };
    systemFocus: string[];
    estimatedTime: number;
    breakAfter?: number;
  };
  adaptations: QuestionAdaptation[];
}

export interface QuestionAdaptation {
  type: 'difficulty' | 'system' | 'format' | 'timing';
  reason: string;
  original: string;
  adapted: string;
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

// ============================================================================
// Constants
// ============================================================================

const SYSTEM_CODE_MAP: Record<string, string> = {
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

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get intelligently targeted questions based on user analytics
 */
export async function getIntelligentQuestions(
  request: IntelligentQuestionRequest,
  systemMastery: SystemMasteryProfile[],
  previousQuestionIds: string[] = [],
  getToken?: () => Promise<string | null>
): Promise<IntelligentQuestionResult> {
  // Get current user state
  const cognitiveState = getCognitiveState();
  const learningVelocity = getLearningVelocity();

  // Generate targeting from analytics
  const recentPerformance = systemMastery.map((s) => ({
    system: s.system,
    accuracy: s.masteryLevel,
  }));

  const targeting = generateQuestionTargeting(
    systemMastery,
    cognitiveState,
    learningVelocity,
    recentPerformance
  );

  // Override with forced systems if specified
  if (request.forceSystems && request.forceSystems.length > 0) {
    targeting.targetSystems = request.forceSystems.map((s) => ({
      system: s,
      priority: 100,
      reason: 'User selected focus',
    }));
  }

  // Calculate adaptive difficulty
  const adaptedDifficulty = adaptDifficulty(
    request.forceDifficulty || targeting.recommendedDifficulty,
    cognitiveState,
    learningVelocity
  );

  // Generate session plan
  const availableMinutes = request.availableTime || 30;
  const studyPlan = generateAdaptiveStudyPlan(
    availableMinutes,
    20, // new cards available estimate
    10, // review cards due estimate
    systemMastery
  );

  // Calculate question distribution
  const maxQuestions = request.maxQuestions || studyPlan.recommendedQuestions;
  const difficultyMix = calculateDifficultyMix(maxQuestions, adaptedDifficulty, cognitiveState);

  // Build selection criteria
  const criteria = buildSelectionCriteria(targeting, difficultyMix, previousQuestionIds, request);

  // Fetch questions based on criteria
  const token = getToken ? await getToken() : null;
  const questions = await fetchQuestionsFromPool(criteria, maxQuestions, token);

  // Track adaptations made
  const adaptations: QuestionAdaptation[] = [];

  if (request.forceDifficulty !== adaptedDifficulty) {
    adaptations.push({
      type: 'difficulty',
      reason:
        cognitiveState.fatigueLevel > 60
          ? 'Reduced difficulty due to fatigue'
          : cognitiveState.flowState > 70
            ? 'Increased difficulty - optimal state detected'
            : 'Adjusted based on learning velocity',
      original: request.forceDifficulty || 'medium',
      adapted: adaptedDifficulty,
    });
  }

  if (targeting.targetSystems.length > 0) {
    adaptations.push({
      type: 'system',
      reason: targeting.targetSystems[0].reason,
      original: 'all systems',
      adapted: targeting.targetSystems.map((t) => t.system).join(', '),
    });
  }

  return {
    questions,
    targeting,
    sessionPlan: {
      recommendedCount: maxQuestions,
      difficultyMix,
      systemFocus: studyPlan.focusSystems,
      estimatedTime: studyPlan.estimatedTimeMinutes,
      breakAfter: studyPlan.breakSuggestions[0]?.afterQuestion,
    },
    adaptations,
  };
}

/**
 * Adapt difficulty based on cognitive state and velocity
 */
function adaptDifficulty(
  baseDifficulty: 'easy' | 'medium' | 'hard',
  cognitive: CognitiveState,
  velocity: LearningVelocity
): 'easy' | 'medium' | 'hard' {
  // High fatigue -> reduce difficulty
  if (cognitive.fatigueLevel > 70) {
    if (baseDifficulty === 'hard') return 'medium';
    if (baseDifficulty === 'medium') return 'easy';
    return 'easy';
  }

  // High cognitive load -> reduce difficulty
  if (cognitive.cognitiveLoad > 80) {
    if (baseDifficulty === 'hard') return 'medium';
    return baseDifficulty;
  }

  // In flow state with good velocity -> can increase
  if (cognitive.flowState > 70 && velocity.trend === 'accelerating') {
    if (baseDifficulty === 'easy') return 'medium';
    if (baseDifficulty === 'medium') return 'hard';
    return 'hard';
  }

  // Low attention -> reduce difficulty
  if (cognitive.attentionLevel < 40) {
    if (baseDifficulty === 'hard') return 'medium';
    return baseDifficulty;
  }

  return baseDifficulty;
}

/**
 * Calculate difficulty distribution for questions
 */
function calculateDifficultyMix(
  totalQuestions: number,
  targetDifficulty: 'easy' | 'medium' | 'hard',
  cognitive: CognitiveState
): { easy: number; medium: number; hard: number } {
  let easy: number, medium: number, hard: number;

  // Base distribution based on target
  switch (targetDifficulty) {
    case 'easy':
      easy = 0.6;
      medium = 0.3;
      hard = 0.1;
      break;
    case 'hard':
      easy = 0.1;
      medium = 0.4;
      hard = 0.5;
      break;
    default: // medium
      easy = 0.25;
      medium = 0.5;
      hard = 0.25;
  }

  // Adjust for cognitive state
  if (cognitive.fatigueLevel > 50) {
    // Shift toward easier
    easy += 0.15;
    hard -= 0.15;
  } else if (cognitive.flowState > 60) {
    // Shift toward harder
    easy -= 0.1;
    hard += 0.1;
  }

  // Normalize and calculate counts
  const total = easy + medium + hard;
  easy = easy / total;
  medium = medium / total;
  hard = hard / total;

  return {
    easy: Math.round(totalQuestions * easy),
    medium: Math.round(totalQuestions * medium),
    hard: Math.round(totalQuestions * hard),
  };
}

/**
 * Build selection criteria for question fetching
 */
function buildSelectionCriteria(
  targeting: QuestionTargeting,
  difficultyMix: { easy: number; medium: number; hard: number },
  excludeIds: string[],
  request: IntelligentQuestionRequest
): QuestionSelectionCriteria[] {
  const criteria: QuestionSelectionCriteria[] = [];

  // Priority systems with appropriate difficulties
  for (const target of targeting.targetSystems) {
    // Easy questions for priority system
    if (difficultyMix.easy > 0) {
      criteria.push({
        system: target.system,
        difficulty: 'easy',
        excludeIds,
        preferVignettes: targeting.formatPreferences.preferVignettes,
        preferImages: targeting.formatPreferences.includeImages,
      });
    }

    // Medium questions
    if (difficultyMix.medium > 0) {
      criteria.push({
        system: target.system,
        difficulty: 'medium',
        excludeIds,
        preferVignettes: targeting.formatPreferences.preferVignettes,
        preferImages: targeting.formatPreferences.includeImages,
      });
    }

    // Hard questions only if not targeting weak areas heavily
    if (difficultyMix.hard > 0 && target.priority < 80) {
      criteria.push({
        system: target.system,
        difficulty: 'hard',
        excludeIds,
        preferVignettes: targeting.formatPreferences.preferVignettes,
        preferImages: targeting.formatPreferences.includeImages,
      });
    }
  }

  // Add priority conditions
  for (const conditionId of targeting.priorityConditions.slice(0, 5)) {
    criteria.push({
      system: '', // Any system
      difficulty: 'medium',
      conditionId,
      excludeIds,
    });
  }

  return criteria;
}

/**
 * Fetch questions from the pool/database based on criteria
 */
async function fetchQuestionsFromPool(
  criteria: QuestionSelectionCriteria[],
  maxTotal: number,
  token?: string | null
): Promise<Question[]> {
  const questions: Question[] = [];
  const seenIds = new Set<string>();

  // Pool endpoint is protected in production; without a token, return empty so callers can fall back.
  if (!token) return [];

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  // Try to fetch from each criteria set
  for (const criterion of criteria) {
    if (questions.length >= maxTotal) break;

    try {
      const params = new URLSearchParams();
      params.set('count', Math.min(5, maxTotal - questions.length).toString());
      if (criterion.system) params.set('system', criterion.system);
      params.set('difficulty', criterion.difficulty);
      if (criterion.conditionId) params.set('conditionId', criterion.conditionId);
      if (criterion.excludeIds && criterion.excludeIds.length > 0) {
        params.set('excludeIds', criterion.excludeIds.join(','));
      }

      const response = await fetch(`/api/questions/pool?${params}`, { headers });

      if (response.ok) {
        const data = await response.json();
        for (const q of data.questions || []) {
          if (!seenIds.has(q.id)) {
            seenIds.add(q.id);
            questions.push(convertPoolQuestion(q));
          }
        }
      }
    } catch (error) {
      console.warn('[IntelligentQuestionService] Pool fetch failed:', error);
    }
  }

  // If we don't have enough, fill with general questions
  if (questions.length < maxTotal) {
    try {
      const needed = maxTotal - questions.length;
      const response = await fetch(`/api/questions/pool?count=${needed}`, { headers });

      if (response.ok) {
        const data = await response.json();
        for (const q of data.questions || []) {
          if (!seenIds.has(q.id)) {
            seenIds.add(q.id);
            questions.push(convertPoolQuestion(q));
          }
        }
      }
    } catch (error) {
      console.warn('[IntelligentQuestionService] Fallback fetch failed:', error);
    }
  }

  return questions;
}

/**
 * Convert pool question format to app Question format
 */
function convertPoolQuestion(poolQ: any): Question {
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  const correctIndex = letterToIndex[poolQ.correctAnswer?.charAt(0)?.toUpperCase()] ?? 0;

  const condition = poolQ.tags?.[0] || poolQ.system;
  const conditionId =
    poolQ.conditionId || condition?.toLowerCase().replace(/\s+/g, '-') || 'unknown';

  return {
    id: poolQ.id,
    question: poolQ.vignette ? `${poolQ.vignette}\n\n${poolQ.question}` : poolQ.question,
    options: (poolQ.options || []).map((opt: string) => opt.replace(/^[A-D]\.\s*/, '')),
    correctAnswerIndex: correctIndex,
    rationale: poolQ.explanation || '',
    topic: poolQ.system || 'General',
    conditionId,
    condition,
    pearls: [],
    source: poolQ.source === 'pool' ? 'database-pool' : 'database-main',
  } as Question;
}

// ============================================================================
// Specialized Question Generators
// ============================================================================

/**
 * Get questions specifically for weak areas
 */
export async function getWeakAreaQuestions(
  systemMastery: SystemMasteryProfile[],
  maxQuestions: number = 10,
  getToken?: () => Promise<string | null>
): Promise<Question[]> {
  // Find weakest systems
  const weakSystems = systemMastery
    .filter((s) => s.masteryLevel < 60 && s.questionsSeen >= 5)
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
    .slice(0, 3);

  if (weakSystems.length === 0) {
    return [];
  }

  const questions: Question[] = [];
  const perSystem = Math.ceil(maxQuestions / weakSystems.length);

  const token = getToken ? await getToken() : null;
  if (!token) return [];
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  for (const system of weakSystems) {
    try {
      const params = new URLSearchParams({
        count: perSystem.toString(),
        system: system.system,
        difficulty: 'medium', // Start medium for weak areas
      });

      // Add weak subtopics if available
      if (system.weakSubtopics.length > 0) {
        params.set('tags', system.weakSubtopics.slice(0, 2).join(','));
      }

      const response = await fetch(`/api/questions/pool?${params}`, { headers });

      if (response.ok) {
        const data = await response.json();
        for (const q of data.questions || []) {
          questions.push(convertPoolQuestion(q));
        }
      }
    } catch (error) {
      console.warn('[IntelligentQuestionService] Weak area fetch failed:', error);
    }
  }

  return questions.slice(0, maxQuestions);
}

/**
 * Get review questions for spaced repetition
 */
export async function getReviewQuestions(
  dueConditionIds: string[],
  maxQuestions: number = 15,
  getToken?: () => Promise<string | null>
): Promise<Question[]> {
  if (dueConditionIds.length === 0) {
    return [];
  }

  const questions: Question[] = [];

  const token = getToken ? await getToken() : null;
  if (!token) return [];
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  for (const conditionId of dueConditionIds.slice(0, maxQuestions)) {
    try {
      const params = new URLSearchParams({
        count: '1',
        conditionId,
      });

      const response = await fetch(`/api/questions/pool?${params}`, { headers });

      if (response.ok) {
        const data = await response.json();
        if (data.questions?.[0]) {
          questions.push(convertPoolQuestion(data.questions[0]));
        }
      }
    } catch (error) {
      console.warn('[IntelligentQuestionService] Review fetch failed:', error);
    }
  }

  return questions;
}

/**
 * Get flow-optimized questions (right level of challenge)
 */
export async function getFlowStateQuestions(
  systemMastery: SystemMasteryProfile[],
  maxQuestions: number = 10,
  getToken?: () => Promise<string | null>
): Promise<Question[]> {
  const cognitive = getCognitiveState();

  // Find systems where user is competent but not mastered (sweet spot)
  const flowSystems = systemMastery
    .filter((s) => s.masteryLevel >= 60 && s.masteryLevel <= 85)
    .sort((a, b) => {
      // Prefer systems closer to 75% (optimal challenge)
      return Math.abs(a.masteryLevel - 75) - Math.abs(b.masteryLevel - 75);
    })
    .slice(0, 3);

  if (flowSystems.length === 0) {
    return [];
  }

  // Determine difficulty based on current state
  const difficulty = cognitive.flowState > 60 ? 'hard' : 'medium';

  const questions: Question[] = [];
  const perSystem = Math.ceil(maxQuestions / flowSystems.length);

  const token = getToken ? await getToken() : null;
  if (!token) return [];
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  for (const system of flowSystems) {
    try {
      const response = await fetch(
        `/api/questions/pool?count=${perSystem}&system=${system.system}&difficulty=${difficulty}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        for (const q of data.questions || []) {
          questions.push(convertPoolQuestion(q));
        }
      }
    } catch (error) {
      console.warn('[IntelligentQuestionService] Flow fetch failed:', error);
    }
  }

  return questions.slice(0, maxQuestions);
}

// ============================================================================
// Integration with Session Settings
// ============================================================================

/**
 * Enhance session settings with analytics intelligence
 */
export function enhanceSessionSettings(
  baseSettings: SessionSettings,
  systemMastery: SystemMasteryProfile[]
): SessionSettings & { intelligentEnhancements: string[] } {
  const cognitive = getCognitiveState();
  const velocity = getLearningVelocity();
  const enhancements: string[] = [];

  const enhanced = { ...baseSettings, intelligentEnhancements: enhancements };

  // Adapt difficulty based on fatigue
  // Note: SessionSettings.difficulty uses 'easier' | 'same' | 'harder' (relative difficulty)
  if (cognitive.fatigueLevel > 60 && baseSettings.difficulty !== 'easier') {
    enhanced.difficulty = baseSettings.difficulty === 'harder' ? 'same' : 'easier';
    enhancements.push(`Reduced difficulty due to fatigue (${Math.round(cognitive.fatigueLevel)}%)`);
  }

  // Suggest focus area
  if (baseSettings.focus === 'all' && systemMastery.length > 0) {
    const weakest = systemMastery
      .filter((s) => s.questionsSeen >= 10)
      .reduce((a, b) => (a.masteryLevel < b.masteryLevel ? a : b), systemMastery[0]);

    if (weakest && weakest.masteryLevel < 60) {
      // Don't override, but note recommendation
      enhancements.push(`Recommended focus: ${weakest.system} (${weakest.masteryLevel}% mastery)`);
    }
  }

  // Session length recommendation
  if (cognitive.fatigueLevel > 50) {
    enhancements.push('Consider a shorter session due to detected fatigue');
  }

  // Velocity-based suggestions
  if (velocity.trend === 'decelerating') {
    enhancements.push('Learning velocity decreasing - consider a break or easier content');
  } else if (velocity.trend === 'accelerating') {
    enhancements.push('Great momentum! Good time for challenging content');
  }

  return enhanced;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  getIntelligentQuestions,
  getWeakAreaQuestions,
  getReviewQuestions,
  getFlowStateQuestions,
  enhanceSessionSettings,
};
