/**
 * Adaptive FSRS Service
 *
 * Integrates user analytics with FSRS scheduling to provide:
 * - Personalized retention targets based on cognitive state
 * - Dynamic interval adjustments based on user performance patterns
 * - System-specific scheduling optimizations
 * - Real-time adaptation to user fatigue and learning velocity
 */

import { FSRS, FSRSCard, FSRSParameters, FSRSState, Rating, defaultParameters } from '@/lib/fsrs';
import {
  getCognitiveState,
  getLearningVelocity,
  calculatePersonalizedFSRS,
  getSystemFSRSAdjustments,
  getOptimalStudyTime,
  type CognitiveState,
  type LearningVelocity,
  type SystemMasteryProfile,
} from '@/services/analytics';

// ============================================================================
// Types
// ============================================================================

export interface AdaptiveSchedulingResult {
  card: FSRSCard;
  due: Date;
  adjustments: SchedulingAdjustment[];
  cognitiveBonus: number;
  systemModifier: number;
  confidenceLevel: 'low' | 'medium' | 'high';
}

export interface SchedulingAdjustment {
  type: 'cognitive' | 'velocity' | 'system' | 'time_of_day' | 'fatigue';
  description: string;
  impact: number; // Percentage change to interval
}

export interface AdaptiveReviewPriority {
  conditionId: string;
  card: FSRSCard;
  priority: number;
  reason: string;
  optimalReviewTime: Date;
  system: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export interface StudySessionPlan {
  recommendedQuestions: number;
  newCardsLimit: number;
  reviewCardsLimit: number;
  focusSystems: string[];
  estimatedTimeMinutes: number;
  breakSuggestions: { afterQuestion: number; durationMinutes: number }[];
  difficultyProgression: ('easy' | 'medium' | 'hard')[];
}

// ============================================================================
// Adaptive FSRS Engine
// ============================================================================

export class AdaptiveFSRS {
  private baseFsrs: FSRS;
  private personalizedParams: FSRSParameters;
  private systemOverrides: Map<string, FSRSParameters>;
  private cognitiveState: CognitiveState | null = null;
  private learningVelocity: LearningVelocity | null = null;

  constructor(systemMastery: SystemMasteryProfile[] = []) {
    // Initialize with default parameters
    this.baseFsrs = new FSRS(defaultParameters);
    this.personalizedParams = { ...defaultParameters };
    this.systemOverrides = new Map();

    // Calculate personalized parameters if we have mastery data
    if (systemMastery.length > 0) {
      this.calibrateFromMastery(systemMastery);
    }
  }

  /**
   * Calibrate FSRS parameters from system mastery data
   */
  calibrateFromMastery(systemMastery: SystemMasteryProfile[]): void {
    const velocity = getLearningVelocity();
    const avgMastery =
      systemMastery.reduce((sum, s) => sum + s.masteryLevel, 0) / systemMastery.length;

    // Determine learning speed
    const learningSpeed: 'slow' | 'normal' | 'fast' =
      velocity.trend === 'accelerating'
        ? 'fast'
        : velocity.trend === 'decelerating'
          ? 'slow'
          : 'normal';

    // Calculate forgetting rate from mastery decay
    const avgForgettingCurve =
      systemMastery.reduce((sum, s) => sum + (s.forgettingCurve || 14), 0) / systemMastery.length;
    const forgettingRate = Math.max(10, (100 / avgForgettingCurve) * 7);

    const personalized = calculatePersonalizedFSRS(
      avgMastery,
      5, // Default difficulty
      learningSpeed,
      forgettingRate
    );

    this.personalizedParams = personalized.parameters;
    this.baseFsrs = new FSRS(this.personalizedParams);

    // Get system-specific overrides
    const overrides = getSystemFSRSAdjustments(systemMastery);
    for (const [system, params] of overrides) {
      this.systemOverrides.set(system, { ...this.personalizedParams, ...params });
    }
  }

  /**
   * Update cognitive state for real-time adaptation
   */
  updateCognitiveState(): void {
    this.cognitiveState = getCognitiveState();
    this.learningVelocity = getLearningVelocity();
  }

  /**
   * Schedule a card with adaptive adjustments
   */
  scheduleAdaptive(
    card: FSRSCard,
    rating: Rating,
    system?: string,
    now: Date = new Date()
  ): AdaptiveSchedulingResult {
    this.updateCognitiveState();

    const adjustments: SchedulingAdjustment[] = [];
    let intervalModifier = 1.0;

    // Get appropriate FSRS instance for this system
    const fsrs =
      system && this.systemOverrides.has(system)
        ? new FSRS(this.systemOverrides.get(system)!)
        : this.baseFsrs;

    // Base scheduling
    const baseResult = fsrs.next(card, now, rating);
    let adjustedInterval = baseResult.card.scheduled_days;

    // 1. Cognitive State Adjustments
    if (this.cognitiveState) {
      const cognitiveAdjustment = this.calculateCognitiveAdjustment(rating);
      intervalModifier *= cognitiveAdjustment.modifier;
      if (cognitiveAdjustment.adjustment) {
        adjustments.push(cognitiveAdjustment.adjustment);
      }
    }

    // 2. Learning Velocity Adjustments
    if (this.learningVelocity) {
      const velocityAdjustment = this.calculateVelocityAdjustment();
      intervalModifier *= velocityAdjustment.modifier;
      if (velocityAdjustment.adjustment) {
        adjustments.push(velocityAdjustment.adjustment);
      }
    }

    // 3. Time of Day Optimization
    const todAdjustment = this.calculateTimeOfDayAdjustment(now);
    intervalModifier *= todAdjustment.modifier;
    if (todAdjustment.adjustment) {
      adjustments.push(todAdjustment.adjustment);
    }

    // 4. System-Specific Modifiers
    if (system) {
      const systemAdjustment = this.calculateSystemAdjustment(system);
      intervalModifier *= systemAdjustment.modifier;
      if (systemAdjustment.adjustment) {
        adjustments.push(systemAdjustment.adjustment);
      }
    }

    // Apply all modifications
    adjustedInterval = Math.max(0.0035, adjustedInterval * intervalModifier); // Min 5 minutes

    // Create adjusted card
    const adjustedCard: FSRSCard = {
      ...baseResult.card,
      scheduled_days: adjustedInterval,
    };

    const adjustedDue = new Date(now.getTime() + adjustedInterval * 86400000);

    // Calculate confidence level
    let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
    if (card.reps >= 5 && this.learningVelocity && this.learningVelocity.retentionEfficiency > 80) {
      confidenceLevel = 'high';
    } else if (card.reps < 2) {
      confidenceLevel = 'low';
    }

    return {
      card: adjustedCard,
      due: adjustedDue,
      adjustments,
      cognitiveBonus: this.cognitiveState ? (100 - this.cognitiveState.fatigueLevel) / 100 : 1,
      systemModifier: system ? (this.systemOverrides.has(system) ? 1.1 : 1) : 1,
      confidenceLevel,
    };
  }

  /**
   * Calculate cognitive-based interval adjustment
   */
  private calculateCognitiveAdjustment(rating: Rating): {
    modifier: number;
    adjustment: SchedulingAdjustment | null;
  } {
    if (!this.cognitiveState) return { modifier: 1, adjustment: null };

    const { fatigueLevel, flowState, cognitiveLoad } = this.cognitiveState;
    let modifier = 1;
    let adjustment: SchedulingAdjustment | null = null;

    // High fatigue = shorter intervals (need more reinforcement)
    if (fatigueLevel > 60) {
      modifier = 0.85;
      adjustment = {
        type: 'fatigue',
        description: 'Shortened interval due to high fatigue - review sooner',
        impact: -15,
      };
    }
    // In flow state with correct answer = can extend interval
    else if (flowState > 70 && rating >= Rating.Good) {
      modifier = 1.15;
      adjustment = {
        type: 'cognitive',
        description: 'Extended interval - optimal learning state detected',
        impact: 15,
      };
    }
    // High cognitive load but correct = borderline, keep standard
    else if (cognitiveLoad > 70 && rating >= Rating.Good) {
      modifier = 0.95;
      adjustment = {
        type: 'cognitive',
        description: 'Slightly shortened - high effort correct answer',
        impact: -5,
      };
    }

    return { modifier, adjustment };
  }

  /**
   * Calculate learning velocity adjustment
   */
  private calculateVelocityAdjustment(): {
    modifier: number;
    adjustment: SchedulingAdjustment | null;
  } {
    if (!this.learningVelocity) return { modifier: 1, adjustment: null };

    const { trend, retentionEfficiency, personalBestRatio } = this.learningVelocity;
    let modifier = 1;
    let adjustment: SchedulingAdjustment | null = null;

    if (trend === 'accelerating' && retentionEfficiency > 85) {
      modifier = 1.1;
      adjustment = {
        type: 'velocity',
        description: 'Learning velocity increasing - extending intervals',
        impact: 10,
      };
    } else if (trend === 'decelerating' || retentionEfficiency < 70) {
      modifier = 0.9;
      adjustment = {
        type: 'velocity',
        description: 'Learning velocity decreased - more frequent review',
        impact: -10,
      };
    }

    // Personal best bonus
    if (personalBestRatio > 1.2) {
      modifier *= 1.05;
    }

    return { modifier, adjustment };
  }

  /**
   * Calculate time of day adjustment
   */
  private calculateTimeOfDayAdjustment(now: Date): {
    modifier: number;
    adjustment: SchedulingAdjustment | null;
  } {
    const optimalTime = getOptimalStudyTime();
    const currentHour = now.getHours();
    const hourDiff = Math.abs(currentHour - optimalTime.hour);

    // If studying during optimal time, slight bonus
    if (hourDiff <= 1 && optimalTime.confidence > 0.6) {
      return {
        modifier: 1.05,
        adjustment: {
          type: 'time_of_day',
          description: 'Studying during your optimal time - retention bonus',
          impact: 5,
        },
      };
    }

    // If far from optimal time with high confidence
    if (hourDiff >= 6 && optimalTime.confidence > 0.7) {
      return {
        modifier: 0.95,
        adjustment: {
          type: 'time_of_day',
          description: 'Sub-optimal study time - shorter interval recommended',
          impact: -5,
        },
      };
    }

    return { modifier: 1, adjustment: null };
  }

  /**
   * Calculate system-specific adjustment
   */
  private calculateSystemAdjustment(system: string): {
    modifier: number;
    adjustment: SchedulingAdjustment | null;
  } {
    if (!this.systemOverrides.has(system)) {
      return { modifier: 1, adjustment: null };
    }

    const override = this.systemOverrides.get(system)!;

    // If this system has a higher retention target, intervals are naturally shorter
    if (
      override.request_retention &&
      override.request_retention > this.personalizedParams.request_retention
    ) {
      return {
        modifier: 0.9,
        adjustment: {
          type: 'system',
          description: `${system} requires more frequent review`,
          impact: -10,
        },
      };
    }

    return { modifier: 1, adjustment: null };
  }

  /**
   * Get prioritized review queue
   */
  getPriorityReviewQueue(
    cards: Array<{ conditionId: string; card: FSRSCard; system: string }>,
    maxItems: number = 20
  ): AdaptiveReviewPriority[] {
    const now = new Date();
    this.updateCognitiveState();

    const priorities: AdaptiveReviewPriority[] = cards.map((item) => {
      const lastReviewDate = item.card.last_review instanceof Date 
        ? item.card.last_review 
        : new Date(item.card.last_review);
      const dueDate = new Date(
        lastReviewDate.getTime() + item.card.scheduled_days * 86400000
      );
      const daysOverdue = (now.getTime() - dueDate.getTime()) / 86400000;

      // Calculate priority score
      let priority = 50;
      let reason = 'Scheduled review';
      let urgency: 'critical' | 'high' | 'medium' | 'low' = 'medium';

      // Overdue items get highest priority
      if (daysOverdue > 7) {
        priority = 100;
        reason = `Critically overdue by ${Math.round(daysOverdue)} days`;
        urgency = 'critical';
      } else if (daysOverdue > 3) {
        priority = 90;
        reason = `Overdue by ${Math.round(daysOverdue)} days`;
        urgency = 'high';
      } else if (daysOverdue > 0) {
        priority = 70 + daysOverdue * 5;
        reason = 'Due for review';
        urgency = 'medium';
      } else if (daysOverdue > -1) {
        priority = 60;
        reason = 'Coming due soon';
        urgency = 'low';
      } else {
        priority = 30;
        reason = 'Future review';
        urgency = 'low';
      }

      // Cards with high lapse count need attention
      if (item.card.lapses >= 3) {
        priority += 15;
        reason += ' - high lapse count';
        if (urgency !== 'critical') urgency = 'high';
      }

      // Learning cards need more frequent attention
      if (item.card.state === FSRSState.Learning || item.card.state === FSRSState.Relearning) {
        priority += 10;
      }

      // Adjust for cognitive state
      if (this.cognitiveState && this.cognitiveState.fatigueLevel > 60 && priority < 70) {
        // If fatigued, deprioritize non-urgent items
        priority -= 10;
      }

      return {
        conditionId: item.conditionId,
        card: item.card,
        priority: Math.min(100, priority),
        reason,
        optimalReviewTime: dueDate,
        system: item.system,
        urgency,
      };
    });

    // Sort by priority (descending) and return top items
    return priorities.sort((a, b) => b.priority - a.priority).slice(0, maxItems);
  }

  /**
   * Generate an optimal study session plan
   */
  generateStudyPlan(
    availableMinutes: number,
    newCardsAvailable: number,
    reviewCardsDue: number,
    systemMastery: SystemMasteryProfile[]
  ): StudySessionPlan {
    this.updateCognitiveState();

    const cognitive = this.cognitiveState;
    const velocity = this.learningVelocity;

    // Base calculations
    const avgTimePerQuestion = 75; // seconds
    const totalPossibleQuestions = Math.floor((availableMinutes * 60) / avgTimePerQuestion);

    // Adjust based on cognitive state
    let adjustedQuestions = totalPossibleQuestions;
    if (cognitive && cognitive.fatigueLevel > 50) {
      adjustedQuestions = Math.floor(totalPossibleQuestions * 0.8);
    }

    // Split between new and review cards
    // Reviews are generally faster, prioritize them
    const reviewWeight = 0.7;
    const reviewCardsLimit = Math.min(reviewCardsDue, Math.floor(adjustedQuestions * reviewWeight));
    let newCardsLimit = Math.min(
      newCardsAvailable,
      adjustedQuestions - reviewCardsLimit,
      Math.floor(adjustedQuestions * 0.3) // Cap new cards at 30%
    );

    // If fatigued, reduce new cards significantly
    if (cognitive && cognitive.fatigueLevel > 60) {
      newCardsLimit = Math.floor(newCardsLimit * 0.5);
    }

    // Focus systems based on mastery
    const focusSystems = systemMastery
      .filter((s) => s.masteryLevel < 70)
      .sort((a, b) => a.masteryLevel - b.masteryLevel)
      .slice(0, 3)
      .map((s) => s.system);

    // Break suggestions
    const breakSuggestions: { afterQuestion: number; durationMinutes: number }[] = [];
    const totalQuestions = reviewCardsLimit + newCardsLimit;

    if (totalQuestions > 25) {
      breakSuggestions.push({ afterQuestion: 25, durationMinutes: 5 });
    }
    if (totalQuestions > 50) {
      breakSuggestions.push({ afterQuestion: 50, durationMinutes: 10 });
    }

    // Difficulty progression
    const difficultyProgression: ('easy' | 'medium' | 'hard')[] = [];

    if (cognitive && cognitive.fatigueLevel < 30) {
      // Fresh - start medium, progress to hard
      difficultyProgression.push('medium', 'hard', 'medium');
    } else if (cognitive && cognitive.fatigueLevel > 50) {
      // Tired - start easy, stay easy/medium
      difficultyProgression.push('easy', 'medium', 'easy');
    } else {
      // Normal - balanced
      difficultyProgression.push('easy', 'medium', 'hard', 'medium');
    }

    return {
      recommendedQuestions: adjustedQuestions,
      newCardsLimit,
      reviewCardsLimit,
      focusSystems,
      estimatedTimeMinutes: Math.ceil((adjustedQuestions * avgTimePerQuestion) / 60),
      breakSuggestions,
      difficultyProgression,
    };
  }

  /**
   * Get current parameters being used
   */
  getCurrentParameters(): FSRSParameters {
    return { ...this.personalizedParams };
  }

  /**
   * Get system-specific parameters
   */
  getSystemParameters(system: string): FSRSParameters | null {
    return this.systemOverrides.get(system) || null;
  }
}

// ============================================================================
// Singleton Instance & Export Functions
// ============================================================================

let adaptiveFSRSInstance: AdaptiveFSRS | null = null;

/**
 * Get or create the adaptive FSRS instance
 */
export function getAdaptiveFSRS(systemMastery?: SystemMasteryProfile[]): AdaptiveFSRS {
  if (!adaptiveFSRSInstance) {
    adaptiveFSRSInstance = new AdaptiveFSRS(systemMastery);
  } else if (systemMastery && systemMastery.length > 0) {
    adaptiveFSRSInstance.calibrateFromMastery(systemMastery);
  }
  return adaptiveFSRSInstance;
}

/**
 * Schedule a card with adaptive intelligence
 */
export function scheduleCardAdaptive(
  card: FSRSCard,
  rating: Rating,
  system?: string
): AdaptiveSchedulingResult {
  const fsrs = getAdaptiveFSRS();
  return fsrs.scheduleAdaptive(card, rating, system);
}

/**
 * Get prioritized review queue
 */
export function getAdaptiveReviewQueue(
  cards: Array<{ conditionId: string; card: FSRSCard; system: string }>,
  maxItems?: number
): AdaptiveReviewPriority[] {
  const fsrs = getAdaptiveFSRS();
  return fsrs.getPriorityReviewQueue(cards, maxItems);
}

/**
 * Generate a study session plan
 */
export function generateAdaptiveStudyPlan(
  availableMinutes: number,
  newCardsAvailable: number,
  reviewCardsDue: number,
  systemMastery: SystemMasteryProfile[]
): StudySessionPlan {
  const fsrs = getAdaptiveFSRS(systemMastery);
  return fsrs.generateStudyPlan(availableMinutes, newCardsAvailable, reviewCardsDue, systemMastery);
}

export default {
  AdaptiveFSRS,
  getAdaptiveFSRS,
  scheduleCardAdaptive,
  getAdaptiveReviewQueue,
  generateAdaptiveStudyPlan,
};
