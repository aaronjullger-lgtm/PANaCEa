/**
 * Cognitive Science Learning Engine
 * 
 * A comprehensive suite of research-backed learning optimization tools.
 * This module brings together proven cognitive science research to maximize
 * learning efficiency, reduce study time, and improve exam scores.
 * 
 * ## Research Foundation
 * 
 * ### Desirable Difficulties (Bjork, 1994, 2011)
 * Conditions that appear to slow learning but actually enhance retention:
 * - Spacing Effect: 200% better retention than massed practice
 * - Interleaving: 43% better transfer to new problems
 * - Testing Effect: 50-150% better retention than re-reading
 * - Generation Effect: 20-40% better retention than passive reading
 * 
 * ### Cognitive Load Theory (Sweller, 1988, 2011)
 * Managing the three types of cognitive load:
 * - Intrinsic Load: Inherent complexity (manage with chunking)
 * - Extraneous Load: Poor design (eliminate ruthlessly)
 * - Germane Load: Schema construction (optimize this!)
 * 
 * ### Circadian Optimization (Wright, Schmidt, Walker)
 * Timing study for peak performance:
 * - Chronotype matching: 15-30% efficiency gain
 * - Sleep consolidation: Critical for memory formation
 * - Fatigue management: Prevents overtraining
 * 
 * ## Expected Benefits
 * 
 * Studies suggest proper application of these principles can:
 * - Reduce total study time by 30-50%
 * - Improve long-term retention by 40-60%
 * - Increase transfer to new situations by 30-40%
 * - Reduce exam anxiety through better preparation
 * 
 * @module lib/services/cognitiveScience
 */

// Desirable Difficulties Engine
export {
  calculateOptimalSpacing,
  calculateInterleavingSchedule,
  calculateRetrievalPracticeIntensity,
  createGenerationPrompt,
  calculateVariationSchedule,
  calculateOptimalDifficulty,
  createOptimizedStudyPlan,
  type LearnerProfile,
  type DifficultyAdjustment,
  type StudySessionPlan,
  type StudyBlock,
} from './desirableDifficulties';

// Cognitive Load Optimizer
export {
  calculateIntrinsicLoad,
  identifyExtraneousLoad,
  optimizeGermaneLoad,
  detectExpertiseReversal,
  calculateTotalLoad,
  optimizeContentPresentation,
  generateLoadBasedRecommendations,
  type CognitiveLoadProfile,
  type ContentComplexityAnalysis,
  type LoadReduction,
  type OptimizedPresentation,
} from './cognitiveLoadOptimizer';

// Personalized Study Scheduler
export {
  determineChronotype,
  assessSleepImpact,
  generateExamCountdownPlan,
  generateDailySchedule,
  calculateExamOptimizedSpacing,
  generatePersonalizedTips,
  type ChronotypeProfile,
  type StudySchedule,
  type ScheduledStudyBlock,
  type ExamCountdownPlan,
  type SleepImpactAssessment,
} from './personalizedScheduler';

// Implicit Confidence Inference (Automatic FSRS Ratings)
export {
  inferRating,
  buildPerformanceProfile,
  inferBatchRatings,
  type BehavioralSignals,
  type InferredRating,
  type PerformanceProfile,
} from './implicitConfidenceInference';

// Automatic Rating Service (Session Management)
export {
  initializeSession,
  startQuestion,
  recordInteraction,
  recordAnswerSelection,
  completeQuestion,
  applyAutoFSRS,
  endSession,
  getSessionState,
  createInteractionTracker,
  type InteractionEvent,
  type QuestionSession,
  type SessionState,
} from './automaticRatingService';

/**
 * Quick Start Guide
 * 
 * @example
 * ```typescript
 * import { 
 *   determineChronotype, 
 *   assessSleepImpact,
 *   createOptimizedStudyPlan,
 *   calculateTotalLoad,
 *   generateLoadBasedRecommendations 
 * } from '@/lib/services/cognitiveScience';
 * 
 * // 1. Profile the learner
 * const chronotype = determineChronotype(7, 23, 'morning', false);
 * const sleepImpact = assessSleepImpact(7, 'good', 1);
 * 
 * // 2. Create optimized study plan
 * const plan = createOptimizedStudyPlan(
 *   ['Cardiology', 'Pulmonology', 'GI'],
 *   60, // minutes
 *   learnerProfile
 * );
 * 
 * // 3. Monitor cognitive load during session
 * const load = calculateTotalLoad(35, 15, 40, sessionMinutes, lastBreak);
 * const recommendations = generateLoadBasedRecommendations(load);
 * 
 * // 4. Adjust in real-time based on performance
 * if (load.isOverloaded) {
 *   // Suggest break
 * }
 * ```
 */

// Version and metadata
export const COGNITIVE_SCIENCE_VERSION = '1.0.0';

export const RESEARCH_CITATIONS = {
  desirableDifficulties: [
    'Bjork, R.A. (1994). Memory and metamemory considerations in training.',
    'Bjork, E.L., & Bjork, R.A. (2011). Making things hard on yourself.',
    'Roediger, H.L., & Karpicke, J.D. (2006). Test-enhanced learning.',
    'Slamecka, N.J., & Graf, P. (1978). The generation effect.',
  ],
  cognitiveLoad: [
    'Sweller, J. (1988). Cognitive load during problem solving.',
    'Sweller, J. (2011). Cognitive Load Theory.',
    'Kalyuga, S. (2007). Expertise reversal effect.',
    'Paas, F., & van Merriënboer, J. (1994). Instructional control.',
  ],
  circadian: [
    'Wright, K.P. et al. (2006). Circadian modulation of cognition.',
    'Schmidt, C. et al. (2007). Circadian preference modulates cognition.',
    'Walker, M.P. (2008). Sleep, memory, and plasticity.',
    'Hasher, L. et al. (1999). Circadian rhythms and memory.',
  ],
};
