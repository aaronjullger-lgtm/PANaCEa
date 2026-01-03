/**
 * Learning Pattern Engine
 * 
 * A sophisticated deep learning-inspired system that models how each student learns,
 * implementing research-backed algorithms for forgetting curves, interference detection,
 * consolidation windows, and spacing optimization.
 * 
 * Research foundations:
 * - Ebbinghaus (1885) - Original forgetting curve research
 * - Bjork & Bjork (1992) - Desirable difficulties in learning
 * - Rohrer & Taylor (2007) - Spacing and interleaving effects
 * - Dunlosky et al. (2013) - Effective learning strategies meta-analysis
 * - Bahrick (1979) - Long-term retention and spacing
 * 
 * @module learningPatternEngine
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Individual concept retention model - tracks how well a student retains a specific concept
 */
export interface ConceptRetentionModel {
  conceptId: string;
  conditionId: string | null;
  system: string;
  
  // Ebbinghaus forgetting curve parameters (personalized)
  initialStrength: number;      // How well learned initially (0-100)
  decayRate: number;            // Personal decay rate for this concept (0.1-0.5)
  stabilityMultiplier: number;  // How reviews strengthen stability (1.0-3.0)
  
  // Retention state
  currentRetention: number;     // Estimated current retention (0-100)
  lastReviewedAt: Date | null;
  reviewCount: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  
  // Performance metrics
  averageResponseTimeMs: number;
  accuracyHistory: number[];    // Last 10 attempts (1 = correct, 0 = incorrect)
  interferingConcepts: string[]; // Concepts often confused with this one
  
  // Optimal review timing
  optimalIntervalDays: number;
  nextOptimalReview: Date;
  reviewUrgency: 'overdue' | 'due' | 'upcoming' | 'stable';
}

/**
 * Interference pattern - when similar concepts cause confusion
 */
export interface InterferencePattern {
  conceptA: string;
  conceptB: string;
  confusionScore: number;       // 0-100, higher = more confused
  confusionDirection: 'A→B' | 'B→A' | 'bidirectional';
  occurrences: number;
  lastOccurrence: Date;
  differentiatingFactors: string[];
  remediationSuggestions: string[];
}

/**
 * Memory consolidation window - optimal time for reinforcing related content
 */
export interface ConsolidationWindow {
  triggerConceptId: string;
  relatedConcepts: string[];
  windowStartMs: number;        // Time after trigger to start introducing related
  windowEndMs: number;          // Time after trigger when window closes
  reason: string;
  strength: number;             // How strongly related (0-100)
}

/**
 * Spacing effect optimization for individual learning patterns
 */
export interface SpacingOptimization {
  userId: string;
  
  // Personalized spacing parameters
  baseIntervalHours: number;    // Initial review interval
  intervalMultiplier: number;   // How much to increase after success
  minimumIntervalHours: number; // Don't review sooner than this
  maximumIntervalDays: number;  // Cap for very stable items
  
  // Learning speed classification
  learningSpeed: 'deliberate' | 'moderate' | 'rapid';
  forgettingSpeed: 'slow' | 'average' | 'fast';
  
  // System-specific overrides
  systemOverrides: Map<string, Partial<SpacingOptimization>>;
}

/**
 * Comprehensive learning pattern analysis
 */
export interface LearningPatternAnalysis {
  userId: string;
  analyzedAt: Date;
  
  // Pattern metrics
  overallLearningEfficiency: number;   // 0-100
  retentionStrength: number;           // 0-100
  spacingEffectiveness: number;        // 0-100
  interferenceSusceptibility: number;  // 0-100 (lower is better)
  
  // Concept states
  conceptModels: ConceptRetentionModel[];
  totalConceptsTracked: number;
  conceptsNeedingReview: number;
  conceptsOverdue: number;
  
  // Pattern discoveries
  interferencePatterns: InterferencePattern[];
  consolidationWindows: ConsolidationWindow[];
  spacingOptimization: SpacingOptimization;
  
  // Predictions
  predictedRetentionIn7Days: number;
  predictedRetentionIn30Days: number;
  estimatedTimeToMastery: number; // hours
  
  // Recommendations
  recommendations: LearningRecommendation[];
}

export interface LearningRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'review' | 'spacing' | 'interference' | 'consolidation' | 'pacing';
  title: string;
  description: string;
  action: string;
  relatedConcepts?: string[];
  expectedImpact: number; // 0-100
}

/**
 * Error classification for understanding WHY mistakes happen
 */
export interface ErrorClassification {
  questionId: string;
  conceptId: string;
  errorType: ErrorType;
  confidence: number;         // How certain of classification (0-100)
  indicators: string[];       // What led to this classification
  remediation: string;        // Suggested fix
}

export type ErrorType = 
  | 'knowledge_gap'           // Never learned the concept
  | 'incomplete_learning'     // Partially learned
  | 'interference'            // Confused with similar concept
  | 'retrieval_failure'       // Knew but couldn't recall
  | 'application_error'       // Know fact but can't apply
  | 'careless'                // Quick, simple mistake
  | 'time_pressure'           // Rushed due to time
  | 'misread'                 // Misunderstood question
  | 'overthinking'            // Changed correct to incorrect
  | 'guessing';               // Random guess

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  CONCEPT_MODELS: 'panceai_concept_models',
  INTERFERENCE_PATTERNS: 'panceai_interference',
  SPACING_PARAMS: 'panceai_spacing_params',
  LEARNING_PATTERNS: 'panceai_learning_patterns',
  ERROR_HISTORY: 'panceai_error_history',
} as const;

// ============================================================================
// Constants - Research-based defaults
// ============================================================================

// Ebbinghaus forgetting curve: R = e^(-t/S) where S = stability
const DEFAULT_INITIAL_STRENGTH = 70;
const DEFAULT_DECAY_RATE = 0.25;          // ~50% retention after 2.77 days
const DEFAULT_STABILITY_MULTIPLIER = 1.5;  // Each review increases stability 50%

// Spacing effect parameters (from Bahrick 1979)
const BASE_INTERVAL_HOURS = 4;             // First review after 4 hours
const INTERVAL_MULTIPLIER_DEFAULT = 2.0;   // Double each time
const MIN_INTERVAL_HOURS = 1;
const MAX_INTERVAL_DAYS = 180;

// Interference thresholds
const INTERFERENCE_THRESHOLD = 0.3;        // 30% error rate indicates interference
const INTERFERENCE_MIN_SAMPLES = 5;

// ============================================================================
// Core Engine Class
// ============================================================================

class LearningPatternEngine {
  private conceptModels: Map<string, ConceptRetentionModel> = new Map();
  private interferencePatterns: InterferencePattern[] = [];
  private userSpacing: SpacingOptimization | null = null;
  private errorHistory: ErrorClassification[] = [];

  constructor() {
    this.loadFromStorage();
  }

  // ==========================================================================
  // Forgetting Curve Modeling
  // ==========================================================================

  /**
   * Calculate estimated retention using personalized Ebbinghaus curve
   * 
   * Formula: R = S * e^(-t * d)
   * Where:
   *   R = Retention (0-100)
   *   S = Initial strength (0-100)
   *   t = Time since last review (days)
   *   d = Personal decay rate
   */
  calculateRetention(model: ConceptRetentionModel): number {
    if (!model.lastReviewedAt) {
      return model.initialStrength;
    }

    const now = new Date();
    const daysSinceReview = (now.getTime() - model.lastReviewedAt.getTime()) / 86400000;
    
    // Apply Ebbinghaus forgetting curve with personal parameters
    const retention = model.initialStrength * Math.exp(-daysSinceReview * model.decayRate);
    
    return Math.max(0, Math.min(100, retention));
  }

  /**
   * Update concept model after a review attempt
   */
  recordConceptAttempt(
    conceptId: string,
    conditionId: string | null,
    system: string,
    wasCorrect: boolean,
    responseTimeMs: number,
    answerChanged: boolean,
    selectedAnswer: string,
    correctAnswer: string
  ): ConceptRetentionModel {
    let model = this.conceptModels.get(conceptId);
    
    if (!model) {
      model = this.createNewConceptModel(conceptId, conditionId, system);
    }

    const previousRetention = this.calculateRetention(model);
    
    // Update accuracy history
    model.accuracyHistory.push(wasCorrect ? 1 : 0);
    if (model.accuracyHistory.length > 10) {
      model.accuracyHistory.shift();
    }

    // Update consecutive streaks
    if (wasCorrect) {
      model.consecutiveCorrect++;
      model.consecutiveIncorrect = 0;
    } else {
      model.consecutiveIncorrect++;
      model.consecutiveCorrect = 0;
    }

    // Update response time average
    model.averageResponseTimeMs = model.reviewCount === 0
      ? responseTimeMs
      : (model.averageResponseTimeMs * model.reviewCount + responseTimeMs) / (model.reviewCount + 1);

    model.reviewCount++;
    model.lastReviewedAt = new Date();

    // Adjust strength based on performance
    if (wasCorrect) {
      // Successful recall strengthens memory
      const strengthBoost = this.calculateStrengthBoost(model, responseTimeMs);
      model.initialStrength = Math.min(100, model.initialStrength + strengthBoost);
      
      // Decrease decay rate (slower forgetting)
      model.decayRate = Math.max(0.05, model.decayRate * 0.95);
      
      // Increase stability multiplier
      model.stabilityMultiplier = Math.min(3.0, model.stabilityMultiplier * 1.05);
    } else {
      // Failed recall weakens estimates
      model.initialStrength = Math.max(20, model.initialStrength - 15);
      
      // Increase decay rate (faster forgetting)
      model.decayRate = Math.min(0.5, model.decayRate * 1.1);
      
      // Check for interference pattern
      this.checkForInterference(conceptId, selectedAnswer, correctAnswer);
    }

    // Calculate new optimal interval
    model.optimalIntervalDays = this.calculateOptimalInterval(model);
    model.nextOptimalReview = new Date(
      Date.now() + model.optimalIntervalDays * 86400000
    );

    // Update urgency
    model.currentRetention = this.calculateRetention(model);
    model.reviewUrgency = this.calculateReviewUrgency(model);

    // Detect overthinking pattern
    if (answerChanged && !wasCorrect) {
      this.recordErrorPattern({
        questionId: conceptId,
        conceptId,
        errorType: 'overthinking',
        confidence: 80,
        indicators: ['Changed answer', 'Final answer incorrect', 'Original may have been correct'],
        remediation: 'Trust your first instinct more often - your change pattern shows 2nd guessing hurts',
      });
    }

    this.conceptModels.set(conceptId, model);
    this.saveToStorage();

    return model;
  }

  /**
   * Calculate strength boost from successful recall
   * 
   * Higher boost for:
   * - Faster responses (more automatic)
   * - Longer time since last review (desirable difficulty)
   * - Higher difficulty questions
   */
  private calculateStrengthBoost(model: ConceptRetentionModel, responseTimeMs: number): number {
    let boost = 5; // Base boost

    // Speed bonus (but not too fast - that might be lucky)
    const idealTimeMs = 45000; // 45 seconds
    if (responseTimeMs >= 20000 && responseTimeMs <= idealTimeMs) {
      boost += 3; // Fast and confident
    } else if (responseTimeMs > idealTimeMs && responseTimeMs <= 90000) {
      boost += 2; // Deliberate retrieval
    }

    // Desirable difficulty bonus - longer interval means stronger consolidation
    if (model.lastReviewedAt) {
      const daysSinceReview = (Date.now() - model.lastReviewedAt.getTime()) / 86400000;
      if (daysSinceReview >= model.optimalIntervalDays) {
        boost += Math.min(5, daysSinceReview / model.optimalIntervalDays);
      }
    }

    // Streak bonus
    if (model.consecutiveCorrect >= 3) {
      boost += 2;
    }

    return boost;
  }

  /**
   * Calculate optimal review interval using FSRS-inspired algorithm
   */
  private calculateOptimalInterval(model: ConceptRetentionModel): number {
    const spacing = this.getSpacingOptimization();
    const recentAccuracy = this.calculateRecentAccuracy(model);
    
    // Base interval from spacing parameters
    let interval = spacing.baseIntervalHours / 24; // Convert to days

    // Multiply by review count (expanding intervals)
    const reviewFactor = Math.pow(spacing.intervalMultiplier, Math.min(model.reviewCount, 10));
    interval *= reviewFactor;

    // Adjust for accuracy
    if (recentAccuracy >= 0.9) {
      interval *= 1.3; // Can space out more
    } else if (recentAccuracy < 0.6) {
      interval *= 0.5; // Need more frequent review
    }

    // Adjust for strength
    interval *= (model.initialStrength / 70); // Normalize around default strength

    // Adjust for decay rate
    interval *= (DEFAULT_DECAY_RATE / model.decayRate);

    // Apply bounds
    interval = Math.max(spacing.minimumIntervalHours / 24, interval);
    interval = Math.min(spacing.maximumIntervalDays, interval);

    return interval;
  }

  private calculateRecentAccuracy(model: ConceptRetentionModel): number {
    if (model.accuracyHistory.length === 0) return 0.7;
    return model.accuracyHistory.reduce((a, b) => a + b, 0) / model.accuracyHistory.length;
  }

  private calculateReviewUrgency(
    model: ConceptRetentionModel
  ): 'overdue' | 'due' | 'upcoming' | 'stable' {
    if (!model.nextOptimalReview) return 'due';
    
    const now = Date.now();
    const nextReview = model.nextOptimalReview.getTime();
    const daysDiff = (nextReview - now) / 86400000;

    if (daysDiff < -3) return 'overdue';
    if (daysDiff < 0) return 'due';
    if (daysDiff < 2) return 'upcoming';
    return 'stable';
  }

  // ==========================================================================
  // Interference Detection
  // ==========================================================================

  /**
   * Check if an error indicates interference with another concept
   */
  private checkForInterference(
    conceptId: string,
    selectedAnswer: string,
    correctAnswer: string
  ): void {
    // Look for patterns where this concept is confused with others
    const model = this.conceptModels.get(conceptId);
    if (!model) return;

    // Try to identify what concept the selected answer belongs to
    // This is a simplified version - in production, would use concept mapping
    const potentialInterference = this.findConceptFromAnswer(selectedAnswer);
    
    if (potentialInterference && potentialInterference !== conceptId) {
      const existing = this.interferencePatterns.find(
        p => (p.conceptA === conceptId && p.conceptB === potentialInterference) ||
             (p.conceptB === conceptId && p.conceptA === potentialInterference)
      );

      if (existing) {
        existing.occurrences++;
        existing.confusionScore = Math.min(100, existing.confusionScore + 5);
        existing.lastOccurrence = new Date();
        
        // Determine direction
        if (existing.conceptA === conceptId) {
          existing.confusionDirection = existing.confusionDirection === 'B→A' ? 'bidirectional' : 'A→B';
        } else {
          existing.confusionDirection = existing.confusionDirection === 'A→B' ? 'bidirectional' : 'B→A';
        }
      } else {
        // Create new interference pattern
        this.interferencePatterns.push({
          conceptA: conceptId,
          conceptB: potentialInterference,
          confusionScore: 30,
          confusionDirection: 'A→B',
          occurrences: 1,
          lastOccurrence: new Date(),
          differentiatingFactors: [],
          remediationSuggestions: [
            'Review both concepts side by side',
            'Create a comparison chart highlighting differences',
            'Practice distinguishing questions',
          ],
        });
      }

      // Add to interfering concepts list
      if (!model.interferingConcepts.includes(potentialInterference)) {
        model.interferingConcepts.push(potentialInterference);
      }
    }
  }

  /**
   * Find concept ID from an answer (simplified - would use answer→concept mapping)
   */
  private findConceptFromAnswer(answer: string): string | null {
    // This would typically use a database lookup or concept mapping
    // For now, return null - this is a placeholder for the real implementation
    return null;
  }

  /**
   * Get high-priority interference patterns that need addressing
   */
  getActiveInterferencePatterns(minScore = 40): InterferencePattern[] {
    return this.interferencePatterns
      .filter(p => p.confusionScore >= minScore && p.occurrences >= INTERFERENCE_MIN_SAMPLES)
      .sort((a, b) => b.confusionScore - a.confusionScore);
  }

  // ==========================================================================
  // Consolidation Windows
  // ==========================================================================

  /**
   * Get consolidation windows - optimal times to introduce related concepts
   * 
   * Based on memory consolidation research:
   * - Related concepts should be introduced soon after initial learning
   * - But not immediately (need some initial consolidation)
   * - Window closes as memory stabilizes into long-term
   */
  getConsolidationWindows(conceptId: string): ConsolidationWindow[] {
    const model = this.conceptModels.get(conceptId);
    if (!model || !model.lastReviewedAt) return [];

    const windows: ConsolidationWindow[] = [];
    const timeSinceReview = Date.now() - model.lastReviewedAt.getTime();
    
    // Early consolidation window (4-24 hours)
    if (timeSinceReview >= 4 * 3600000 && timeSinceReview <= 24 * 3600000) {
      // Find related concepts from interference patterns
      const relatedConcepts = model.interferingConcepts.map(ic => ic);
      
      if (relatedConcepts.length > 0) {
        windows.push({
          triggerConceptId: conceptId,
          relatedConcepts,
          windowStartMs: 4 * 3600000,
          windowEndMs: 24 * 3600000,
          reason: 'Early consolidation - distinguish from similar concepts while fresh',
          strength: 80,
        });
      }
    }

    // Elaborative encoding window (1-7 days)
    if (timeSinceReview >= 86400000 && timeSinceReview <= 7 * 86400000) {
      // Find concepts in same system for deeper learning
      const sameSysConcepts = Array.from(this.conceptModels.values())
        .filter(m => m.system === model.system && m.conceptId !== conceptId)
        .map(m => m.conceptId)
        .slice(0, 5);
      
      if (sameSysConcepts.length > 0) {
        windows.push({
          triggerConceptId: conceptId,
          relatedConcepts: sameSysConcepts,
          windowStartMs: 86400000,
          windowEndMs: 7 * 86400000,
          reason: 'Elaborative encoding - connect to broader system knowledge',
          strength: 60,
        });
      }
    }

    return windows;
  }

  // ==========================================================================
  // Spacing Optimization
  // ==========================================================================

  /**
   * Get or calculate personalized spacing parameters
   */
  getSpacingOptimization(): SpacingOptimization {
    if (this.userSpacing) return this.userSpacing;

    // Calculate from user's learning patterns
    const models = Array.from(this.conceptModels.values());
    if (models.length < 10) {
      return this.getDefaultSpacingOptimization();
    }

    // Analyze learning speed from accuracy improvement rate
    const earlyAccuracies = models
      .filter(m => m.reviewCount >= 3)
      .map(m => m.accuracyHistory.slice(0, 3).reduce((a, b) => a + b, 0) / 3);
    const avgEarlyAccuracy = earlyAccuracies.length > 0
      ? earlyAccuracies.reduce((a, b) => a + b, 0) / earlyAccuracies.length
      : 0.7;

    // Analyze forgetting speed from decay rates
    const avgDecayRate = models.reduce((sum, m) => sum + m.decayRate, 0) / models.length;

    // Classify learning speed
    let learningSpeed: 'deliberate' | 'moderate' | 'rapid' = 'moderate';
    if (avgEarlyAccuracy > 0.85) learningSpeed = 'rapid';
    else if (avgEarlyAccuracy < 0.6) learningSpeed = 'deliberate';

    // Classify forgetting speed
    let forgettingSpeed: 'slow' | 'average' | 'fast' = 'average';
    if (avgDecayRate < 0.15) forgettingSpeed = 'slow';
    else if (avgDecayRate > 0.35) forgettingSpeed = 'fast';

    // Calculate personalized intervals
    let baseInterval = BASE_INTERVAL_HOURS;
    let intervalMultiplier = INTERVAL_MULTIPLIER_DEFAULT;

    if (learningSpeed === 'rapid' && forgettingSpeed === 'slow') {
      baseInterval = 8;
      intervalMultiplier = 2.5;
    } else if (learningSpeed === 'deliberate' || forgettingSpeed === 'fast') {
      baseInterval = 2;
      intervalMultiplier = 1.5;
    }

    this.userSpacing = {
      userId: 'current',
      baseIntervalHours: baseInterval,
      intervalMultiplier,
      minimumIntervalHours: MIN_INTERVAL_HOURS,
      maximumIntervalDays: MAX_INTERVAL_DAYS,
      learningSpeed,
      forgettingSpeed,
      systemOverrides: new Map(),
    };

    return this.userSpacing;
  }

  private getDefaultSpacingOptimization(): SpacingOptimization {
    return {
      userId: 'current',
      baseIntervalHours: BASE_INTERVAL_HOURS,
      intervalMultiplier: INTERVAL_MULTIPLIER_DEFAULT,
      minimumIntervalHours: MIN_INTERVAL_HOURS,
      maximumIntervalDays: MAX_INTERVAL_DAYS,
      learningSpeed: 'moderate',
      forgettingSpeed: 'average',
      systemOverrides: new Map(),
    };
  }

  // ==========================================================================
  // Error Pattern Classification
  // ==========================================================================

  /**
   * Classify an error to understand WHY it happened
   */
  classifyError(
    conceptId: string,
    responseTimeMs: number,
    answerChanged: boolean,
    timePressure: boolean,
    cognitiveLoad: number,
    previouslySeenCorrect: boolean
  ): ErrorClassification {
    const indicators: string[] = [];
    let errorType: ErrorType = 'knowledge_gap';
    let confidence = 50;

    // Check if this is a known interfering concept
    const model = this.conceptModels.get(conceptId);
    const hasInterference = model && model.interferingConcepts.length > 0;

    // Fast + wrong = careless or time pressure
    if (responseTimeMs < 15000) {
      indicators.push('Very fast response');
      if (timePressure) {
        errorType = 'time_pressure';
        confidence = 75;
      } else {
        errorType = 'careless';
        confidence = 60;
      }
    }

    // Changed answer and got wrong = overthinking
    if (answerChanged) {
      indicators.push('Changed answer before submission');
      errorType = 'overthinking';
      confidence = 80;
    }

    // High cognitive load + wrong = overload
    if (cognitiveLoad > 75 && !answerChanged) {
      indicators.push('High cognitive load detected');
      errorType = 'retrieval_failure';
      confidence = 65;
    }

    // Previously got it right + now wrong = interference or retrieval failure
    if (previouslySeenCorrect) {
      indicators.push('Previously answered correctly');
      if (hasInterference) {
        errorType = 'interference';
        confidence = 75;
        indicators.push('Has interfering concepts');
      } else {
        errorType = 'retrieval_failure';
        confidence = 70;
      }
    }

    // Never seen + slow response = knowledge gap
    if (!model || model.reviewCount === 0) {
      if (responseTimeMs > 60000) {
        indicators.push('First encounter with concept');
        indicators.push('Long deliberation time');
        errorType = 'knowledge_gap';
        confidence = 85;
      }
    }

    // Low accuracy history = incomplete learning
    if (model && model.accuracyHistory.length >= 5) {
      const recentAccuracy = this.calculateRecentAccuracy(model);
      if (recentAccuracy < 0.5) {
        indicators.push('Consistently struggles with this concept');
        errorType = 'incomplete_learning';
        confidence = 80;
      }
    }

    const classification: ErrorClassification = {
      questionId: conceptId,
      conceptId,
      errorType,
      confidence,
      indicators,
      remediation: this.getRemediationForError(errorType, conceptId),
    };

    this.errorHistory.push(classification);
    if (this.errorHistory.length > 500) {
      this.errorHistory = this.errorHistory.slice(-500);
    }

    return classification;
  }

  private getRemediationForError(errorType: ErrorType, conceptId: string): string {
    const remediations: Record<ErrorType, string> = {
      knowledge_gap: 'Study this concept from the beginning - focus on core facts and relationships',
      incomplete_learning: 'Review explanations and practice active recall - you have partial knowledge',
      interference: 'Compare and contrast with similar concepts - create a distinction chart',
      retrieval_failure: 'Practice retrieval without hints - strengthen the recall pathway',
      application_error: 'Work through case-based scenarios - practice applying the concept',
      careless: 'Slow down slightly and read questions more carefully',
      time_pressure: 'Practice under timed conditions to build speed without sacrificing accuracy',
      misread: 'Highlight key terms in questions - train careful reading habits',
      overthinking: 'Trust your first instinct more - your changes often hurt accuracy',
      guessing: 'Mark for review and return with fresh eyes - guessing rarely helps',
    };

    return remediations[errorType];
  }

  /**
   * Get error pattern summary for user
   */
  getErrorPatternSummary(): {
    dominant: ErrorType;
    distribution: Record<ErrorType, number>;
    recommendations: string[];
  } {
    const distribution: Record<ErrorType, number> = {
      knowledge_gap: 0,
      incomplete_learning: 0,
      interference: 0,
      retrieval_failure: 0,
      application_error: 0,
      careless: 0,
      time_pressure: 0,
      misread: 0,
      overthinking: 0,
      guessing: 0,
    };

    for (const error of this.errorHistory) {
      distribution[error.errorType]++;
    }

    // Find dominant error type
    let dominant: ErrorType = 'knowledge_gap';
    let maxCount = 0;
    for (const [type, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = type as ErrorType;
      }
    }

    // Generate recommendations based on patterns
    const recommendations: string[] = [];
    const total = this.errorHistory.length || 1;

    if (distribution.overthinking / total > 0.2) {
      recommendations.push('You change answers frequently and it often hurts - trust your gut more');
    }
    if (distribution.interference / total > 0.15) {
      recommendations.push('You confuse similar concepts - practice distinguishing drills');
    }
    if (distribution.time_pressure / total > 0.15) {
      recommendations.push('Practice timed sessions to build speed while maintaining accuracy');
    }
    if (distribution.retrieval_failure / total > 0.2) {
      recommendations.push('Use active recall practice - testing yourself strengthens memory');
    }
    if (distribution.careless / total > 0.15) {
      recommendations.push('Slow down on easy questions - careless errors are costing points');
    }

    return { dominant, distribution, recommendations };
  }

  private recordErrorPattern(classification: ErrorClassification): void {
    this.errorHistory.push(classification);
  }

  // ==========================================================================
  // Comprehensive Analysis
  // ==========================================================================

  /**
   * Generate comprehensive learning pattern analysis
   */
  generateAnalysis(): LearningPatternAnalysis {
    const models = Array.from(this.conceptModels.values());
    const spacing = this.getSpacingOptimization();
    
    // Calculate metrics
    const avgRetention = models.length > 0
      ? models.reduce((sum, m) => sum + this.calculateRetention(m), 0) / models.length
      : 70;
    
    const avgStrength = models.length > 0
      ? models.reduce((sum, m) => sum + m.initialStrength, 0) / models.length
      : 70;

    const conceptsNeedingReview = models.filter(
      m => m.reviewUrgency === 'due' || m.reviewUrgency === 'overdue'
    ).length;

    const conceptsOverdue = models.filter(m => m.reviewUrgency === 'overdue').length;

    // Calculate interference susceptibility
    const totalInterferenceScore = this.interferencePatterns.reduce(
      (sum, p) => sum + p.confusionScore, 0
    );
    const interferenceSusceptibility = Math.min(
      100,
      (totalInterferenceScore / Math.max(1, this.interferencePatterns.length))
    );

    // Predict future retention
    const predictedRetentionIn7Days = avgRetention * Math.exp(-7 * DEFAULT_DECAY_RATE);
    const predictedRetentionIn30Days = avgRetention * Math.exp(-30 * DEFAULT_DECAY_RATE);

    // Calculate estimated time to mastery
    const lowMasteryCount = models.filter(m => m.initialStrength < 70).length;
    const estimatedTimeToMastery = lowMasteryCount * 3; // ~3 hours per concept

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      models,
      spacing,
      this.interferencePatterns
    );

    return {
      userId: 'current',
      analyzedAt: new Date(),
      overallLearningEfficiency: Math.round(avgStrength * 0.6 + avgRetention * 0.4),
      retentionStrength: Math.round(avgRetention),
      spacingEffectiveness: this.calculateSpacingEffectiveness(),
      interferenceSusceptibility: Math.round(interferenceSusceptibility),
      conceptModels: models,
      totalConceptsTracked: models.length,
      conceptsNeedingReview,
      conceptsOverdue,
      interferencePatterns: this.interferencePatterns,
      consolidationWindows: models.flatMap(m => this.getConsolidationWindows(m.conceptId)),
      spacingOptimization: spacing,
      predictedRetentionIn7Days: Math.round(predictedRetentionIn7Days),
      predictedRetentionIn30Days: Math.round(predictedRetentionIn30Days),
      estimatedTimeToMastery,
      recommendations,
    };
  }

  private calculateSpacingEffectiveness(): number {
    const models = Array.from(this.conceptModels.values());
    if (models.length < 5) return 70; // Default

    // Count how many reviews happened at optimal times
    let optimalReviews = 0;
    let totalReviews = 0;

    for (const model of models) {
      totalReviews += model.reviewCount;
      // Estimate optimal reviews (simplified)
      optimalReviews += Math.floor(model.reviewCount * this.calculateRecentAccuracy(model));
    }

    return totalReviews > 0
      ? Math.round((optimalReviews / totalReviews) * 100)
      : 70;
  }

  private generateRecommendations(
    models: ConceptRetentionModel[],
    spacing: SpacingOptimization,
    interference: InterferencePattern[]
  ): LearningRecommendation[] {
    const recommendations: LearningRecommendation[] = [];

    // Critical: Overdue reviews
    const overdue = models.filter(m => m.reviewUrgency === 'overdue');
    if (overdue.length > 0) {
      recommendations.push({
        priority: 'critical',
        type: 'review',
        title: `${overdue.length} concepts overdue for review`,
        description: 'These concepts are at high risk of forgetting - review immediately',
        action: 'Start overdue review session',
        relatedConcepts: overdue.slice(0, 5).map(m => m.conceptId),
        expectedImpact: 90,
      });
    }

    // High: Active interference patterns
    const activeInterference = interference.filter(p => p.confusionScore >= 50);
    if (activeInterference.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'interference',
        title: 'Confusion detected between similar concepts',
        description: 'You frequently confuse these concepts - targeted practice will help',
        action: 'Start comparison drill',
        relatedConcepts: [activeInterference[0].conceptA, activeInterference[0].conceptB],
        expectedImpact: 75,
      });
    }

    // Medium: Spacing optimization
    if (spacing.forgettingSpeed === 'fast') {
      recommendations.push({
        priority: 'medium',
        type: 'spacing',
        title: 'Adjust review frequency',
        description: 'Your forgetting rate is faster than average - more frequent short reviews will help',
        action: 'Enable frequent mini-reviews',
        expectedImpact: 60,
      });
    }

    // Low: Consolidation opportunities
    const consolidationWindows = models
      .flatMap(m => this.getConsolidationWindows(m.conceptId))
      .filter(w => w.strength > 70);
    
    if (consolidationWindows.length > 0) {
      recommendations.push({
        priority: 'low',
        type: 'consolidation',
        title: 'Strengthen related concepts together',
        description: 'Optimal window to build connections between related concepts',
        action: 'Start consolidation session',
        relatedConcepts: consolidationWindows[0].relatedConcepts.slice(0, 3),
        expectedImpact: 50,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ==========================================================================
  // Helper: Create new concept model
  // ==========================================================================

  private createNewConceptModel(
    conceptId: string,
    conditionId: string | null,
    system: string
  ): ConceptRetentionModel {
    return {
      conceptId,
      conditionId,
      system,
      initialStrength: DEFAULT_INITIAL_STRENGTH,
      decayRate: DEFAULT_DECAY_RATE,
      stabilityMultiplier: DEFAULT_STABILITY_MULTIPLIER,
      currentRetention: DEFAULT_INITIAL_STRENGTH,
      lastReviewedAt: null,
      reviewCount: 0,
      consecutiveCorrect: 0,
      consecutiveIncorrect: 0,
      averageResponseTimeMs: 0,
      accuracyHistory: [],
      interferingConcepts: [],
      optimalIntervalDays: BASE_INTERVAL_HOURS / 24,
      nextOptimalReview: new Date(Date.now() + BASE_INTERVAL_HOURS * 3600000),
      reviewUrgency: 'due',
    };
  }

  // ==========================================================================
  // Storage Management
  // ==========================================================================

  private loadFromStorage(): void {
    try {
      // Load concept models
      const conceptsStr = localStorage.getItem(STORAGE_KEYS.CONCEPT_MODELS);
      if (conceptsStr) {
        const concepts: ConceptRetentionModel[] = JSON.parse(conceptsStr);
        for (const c of concepts) {
          // Restore Date objects
          c.lastReviewedAt = c.lastReviewedAt ? new Date(c.lastReviewedAt) : null;
          c.nextOptimalReview = new Date(c.nextOptimalReview);
          this.conceptModels.set(c.conceptId, c);
        }
      }

      // Load interference patterns
      const interferenceStr = localStorage.getItem(STORAGE_KEYS.INTERFERENCE_PATTERNS);
      if (interferenceStr) {
        this.interferencePatterns = JSON.parse(interferenceStr).map((p: InterferencePattern) => ({
          ...p,
          lastOccurrence: new Date(p.lastOccurrence),
        }));
      }

      // Load spacing params
      const spacingStr = localStorage.getItem(STORAGE_KEYS.SPACING_PARAMS);
      if (spacingStr) {
        const spacing = JSON.parse(spacingStr);
        spacing.systemOverrides = new Map(Object.entries(spacing.systemOverrides || {}));
        this.userSpacing = spacing;
      }

      // Load error history
      const errorStr = localStorage.getItem(STORAGE_KEYS.ERROR_HISTORY);
      if (errorStr) {
        this.errorHistory = JSON.parse(errorStr);
      }
    } catch (e) {
      console.warn('[LearningPatternEngine] Failed to load from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      // Save concept models
      const concepts = Array.from(this.conceptModels.values());
      localStorage.setItem(STORAGE_KEYS.CONCEPT_MODELS, JSON.stringify(concepts));

      // Save interference patterns
      localStorage.setItem(STORAGE_KEYS.INTERFERENCE_PATTERNS, JSON.stringify(this.interferencePatterns));

      // Save spacing params
      if (this.userSpacing) {
        const spacingToSave = {
          ...this.userSpacing,
          systemOverrides: Object.fromEntries(this.userSpacing.systemOverrides),
        };
        localStorage.setItem(STORAGE_KEYS.SPACING_PARAMS, JSON.stringify(spacingToSave));
      }

      // Save error history
      localStorage.setItem(STORAGE_KEYS.ERROR_HISTORY, JSON.stringify(this.errorHistory));
    } catch (e) {
      console.warn('[LearningPatternEngine] Failed to save to storage:', e);
    }
  }

  /**
   * Clear all stored data (for testing or reset)
   */
  clearAllData(): void {
    this.conceptModels.clear();
    this.interferencePatterns = [];
    this.userSpacing = null;
    this.errorHistory = [];
    
    localStorage.removeItem(STORAGE_KEYS.CONCEPT_MODELS);
    localStorage.removeItem(STORAGE_KEYS.INTERFERENCE_PATTERNS);
    localStorage.removeItem(STORAGE_KEYS.SPACING_PARAMS);
    localStorage.removeItem(STORAGE_KEYS.ERROR_HISTORY);
  }

  // ==========================================================================
  // Public API Getters
  // ==========================================================================

  getConceptModel(conceptId: string): ConceptRetentionModel | undefined {
    return this.conceptModels.get(conceptId);
  }

  getAllConceptModels(): ConceptRetentionModel[] {
    return Array.from(this.conceptModels.values());
  }

  getConceptsDueForReview(): ConceptRetentionModel[] {
    return Array.from(this.conceptModels.values())
      .filter(m => m.reviewUrgency === 'due' || m.reviewUrgency === 'overdue')
      .sort((a, b) => {
        // Sort overdue first, then by urgency
        const urgencyOrder = { overdue: 0, due: 1, upcoming: 2, stable: 3 };
        return urgencyOrder[a.reviewUrgency] - urgencyOrder[b.reviewUrgency];
      });
  }

  getInterferenceForConcept(conceptId: string): InterferencePattern[] {
    return this.interferencePatterns.filter(
      p => p.conceptA === conceptId || p.conceptB === conceptId
    );
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const learningPatternEngine = new LearningPatternEngine();

// Export class for testing
export { LearningPatternEngine };
