/**
 * Desirable Difficulties Engine
 *
 * Implementation of Bjork's "Desirable Difficulties" research framework.
 * These are learning conditions that appear to slow learning but actually
 * enhance long-term retention and transfer.
 *
 * Key Research:
 * - Bjork, R.A. (1994). Memory and metamemory considerations in training
 * - Bjork, E.L., & Bjork, R.A. (2011). Making things hard on yourself
 * - Roediger & Karpicke (2006). Testing effect research
 *
 * Features:
 * 1. Spacing Effect - Optimal inter-study intervals
 * 2. Interleaving - Mix topics for discrimination learning
 * 3. Retrieval Practice - Testing as learning, not just assessment
 * 4. Variation - Variable practice conditions
 * 5. Generation Effect - Producing vs. reading information
 *
 * @module lib/services/cognitiveScience/desirableDifficulties
 */

export interface LearnerProfile {
  userId: string;
  totalQuestionsAnswered: number;
  averageAccuracy: number;
  averageResponseTimeMs: number;
  retentionRate: number;
  learningVelocity: number; // items mastered per day
  cognitiveLoadCapacity: 'low' | 'medium' | 'high';
  optimalStudyDurationMinutes: number;
  preferredDifficultyLevel: number; // 1-10 scale
}

export interface DifficultyAdjustment {
  type: 'spacing' | 'interleaving' | 'retrieval' | 'variation' | 'generation';
  intensity: number; // 0-1 scale
  rationale: string;
  expectedBenefit: string;
  researchCitation: string;
}

export interface StudySessionPlan {
  totalDurationMinutes: number;
  blocks: StudyBlock[];
  interleavingRatio: number;
  spacingMultiplier: number;
  generationPromptRate: number;
  estimatedRetentionGain: number;
  difficultyAdjustments: DifficultyAdjustment[];
}

export interface StudyBlock {
  blockNumber: number;
  durationMinutes: number;
  topicMix: { topic: string; weight: number }[];
  questionTypes: { type: string; count: number }[];
  includeGenerationPrompts: boolean;
  retrievalCueStrength: 'strong' | 'medium' | 'weak';
  breakAfter: boolean;
  breakDurationMinutes?: number;
}

/**
 * Calculate optimal spacing interval based on retention and desired recall probability
 * Uses Pimsleur's graduated interval recall algorithm enhanced with FSRS principles
 */
export function calculateOptimalSpacing(
  currentStability: number,
  targetRetention: number = 0.9,
  difficultyFactor: number = 1.0
): { intervalDays: number; nextReviewDate: Date } {
  // FSRS-based calculation: I = S * (-1/ln(R))^(1/D)
  // Where S = stability, R = target retention, D = difficulty
  const decay = Math.pow(-1 / Math.log(targetRetention), 1 / difficultyFactor);
  const intervalDays = Math.max(1, Math.round(currentStability * decay));

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  return { intervalDays, nextReviewDate };
}

/**
 * Implement Bjork's interleaving research
 * Mix different topics to force discrimination learning
 * Research shows 43% better long-term retention vs. blocked practice
 */
export function calculateInterleavingSchedule(
  topics: string[],
  sessionLengthMinutes: number,
  learnerProfile: LearnerProfile
): StudyBlock[] {
  const blocks: StudyBlock[] = [];

  // Optimal block duration based on cognitive load capacity
  const baseBlockDuration = {
    low: 8,
    medium: 12,
    high: 18,
  }[learnerProfile.cognitiveLoadCapacity];

  // Calculate interleaving intensity based on learner level
  // Beginners need more blocking, experts benefit more from interleaving
  const interleavingIntensity = Math.min(1, learnerProfile.totalQuestionsAnswered / 500);

  const totalBlocks = Math.ceil(sessionLengthMinutes / baseBlockDuration);

  for (let i = 0; i < totalBlocks; i++) {
    const isInterleavedBlock = Math.random() < interleavingIntensity;

    let topicMix: { topic: string; weight: number }[];

    if (isInterleavedBlock) {
      // Interleaved: Mix 2-4 topics
      const numTopics = Math.min(4, Math.max(2, Math.ceil(interleavingIntensity * 4)));
      const shuffled = [...topics].sort(() => Math.random() - 0.5);
      topicMix = shuffled.slice(0, numTopics).map((topic, idx) => ({
        topic,
        weight: 1 / numTopics,
      }));
    } else {
      // Blocked: Single topic focus
      const topic = topics[i % topics.length];
      topicMix = [{ topic, weight: 1 }];
    }

    // Retrieval cue strength - weaker cues = stronger memories (desirable difficulty)
    const retrievalCueStrength: 'strong' | 'medium' | 'weak' =
      learnerProfile.averageAccuracy > 0.8
        ? 'weak'
        : learnerProfile.averageAccuracy > 0.6
          ? 'medium'
          : 'strong';

    // Include generation prompts for advanced learners
    const includeGenerationPrompts =
      learnerProfile.averageAccuracy > 0.7 && learnerProfile.totalQuestionsAnswered > 100;

    // Add breaks every 2-3 blocks (Pomodoro-inspired)
    const breakAfter = (i + 1) % 3 === 0 && i < totalBlocks - 1;

    blocks.push({
      blockNumber: i + 1,
      durationMinutes: baseBlockDuration,
      topicMix,
      questionTypes: [
        { type: 'multiple-choice', count: 3 },
        { type: 'recall', count: includeGenerationPrompts ? 2 : 1 },
      ],
      includeGenerationPrompts,
      retrievalCueStrength,
      breakAfter,
      breakDurationMinutes: breakAfter ? 5 : undefined,
    });
  }

  return blocks;
}

/**
 * Testing Effect / Retrieval Practice Calculator
 * Research shows testing improves retention by 50-150% over re-reading
 * Roediger & Karpicke (2006), Science
 */
export function calculateRetrievalPracticeIntensity(
  currentRetention: number,
  targetRetention: number,
  timeSinceLastReview: number // hours
): {
  practiceIntensity: number;
  recommendedQuestionCount: number;
  successfulRetrievalBonus: number;
  failedRetrievalBenefit: string;
} {
  // Higher intensity for lower retention
  const retentionGap = targetRetention - currentRetention;
  const baseIntensity = Math.max(0.3, Math.min(1, retentionGap * 2));

  // Time decay increases need for practice
  const timeDecayFactor = 1 + Math.log(1 + timeSinceLastReview / 24) * 0.2;

  const practiceIntensity = Math.min(1, baseIntensity * timeDecayFactor);

  // More questions for lower retention
  const recommendedQuestionCount = Math.ceil(5 + practiceIntensity * 10);

  // Successful retrieval strengthens memory more than restudying
  const successfulRetrievalBonus = 1.3 + practiceIntensity * 0.5;

  return {
    practiceIntensity,
    recommendedQuestionCount,
    successfulRetrievalBonus,
    failedRetrievalBenefit:
      'Failed retrieval attempts still strengthen memory when followed by feedback. ' +
      "The 'hypercorrection effect' means errors that surprise you are especially well-remembered.",
  };
}

/**
 * Generation Effect Implementation
 * Generating information produces 20-40% better retention than reading
 * Slamecka & Graf (1978)
 */
export function createGenerationPrompt(
  topic: string,
  difficulty: number,
  learnerProfile: LearnerProfile
): {
  prompt: string;
  promptType: 'cloze' | 'free-recall' | 'elaborative' | 'self-explanation';
  expectedCognitiveLoad: number;
  scaffoldingLevel: 'none' | 'minimal' | 'moderate' | 'high';
} {
  // Adjust prompt type based on learner level
  const promptTypes = ['cloze', 'free-recall', 'elaborative', 'self-explanation'] as const;

  // Beginners: cloze (fill-in-blank), Advanced: self-explanation
  const typeIndex = Math.min(
    promptTypes.length - 1,
    Math.floor(learnerProfile.averageAccuracy * promptTypes.length * 0.8)
  );
  const promptType = promptTypes[typeIndex];

  // Scaffolding inversely related to expertise
  const scaffoldingLevel: 'none' | 'minimal' | 'moderate' | 'high' =
    learnerProfile.totalQuestionsAnswered > 500
      ? 'none'
      : learnerProfile.totalQuestionsAnswered > 200
        ? 'minimal'
        : learnerProfile.totalQuestionsAnswered > 50
          ? 'moderate'
          : 'high';

  // Cognitive load estimation
  const expectedCognitiveLoad = difficulty * (1 - learnerProfile.averageAccuracy * 0.5);

  const prompts: Record<typeof promptType, string> = {
    cloze: `Complete: The key feature of ${topic} is ______, which leads to ______.`,
    'free-recall': `Without looking at notes, list everything you know about ${topic}.`,
    elaborative: `Explain WHY ${topic} works the way it does. Connect it to underlying principles.`,
    'self-explanation': `A patient presents with symptoms of ${topic}. Explain your reasoning process for diagnosis step-by-step.`,
  };

  return {
    prompt: prompts[promptType],
    promptType,
    expectedCognitiveLoad,
    scaffoldingLevel,
  };
}

/**
 * Variable Practice Calculator
 * Varied conditions during learning improve transfer to new situations
 * Schmidt & Bjork (1992)
 */
export function calculateVariationSchedule(
  baseCondition: {
    questionFormat: string;
    contextType: string;
    presentationMode: string;
  },
  learnerProfile: LearnerProfile
): {
  variations: {
    format: string;
    context: string;
    presentation: string;
    useForPercentage: number;
  }[];
  rationale: string;
} {
  const variations = [];

  // Base condition (60% of practice for beginners, 30% for advanced)
  const basePercentage = Math.max(30, 60 - learnerProfile.totalQuestionsAnswered / 10);

  variations.push({
    format: baseCondition.questionFormat,
    context: baseCondition.contextType,
    presentation: baseCondition.presentationMode,
    useForPercentage: basePercentage,
  });

  // Format variations
  const formats = ['multiple-choice', 'true-false', 'fill-blank', 'short-answer', 'case-based'];
  const otherFormats = formats.filter((f) => f !== baseCondition.questionFormat);

  // Context variations
  const contexts = ['clinical-vignette', 'lab-values', 'imaging', 'patient-quote', 'diagnostic'];
  const otherContexts = contexts.filter((c) => c !== baseCondition.contextType);

  // Add variations
  const remainingPercentage = 100 - basePercentage;
  const numVariations = Math.min(4, Math.ceil(learnerProfile.averageAccuracy * 5));
  const perVariation = remainingPercentage / numVariations;

  for (let i = 0; i < numVariations; i++) {
    variations.push({
      format: otherFormats[i % otherFormats.length],
      context: otherContexts[i % otherContexts.length],
      presentation: i % 2 === 0 ? 'standard' : 'time-pressure',
      useForPercentage: perVariation,
    });
  }

  return {
    variations,
    rationale:
      "Variable practice conditions create 'contextual interference' that makes learning feel harder " +
      'but dramatically improves transfer to new situations - exactly what you need for the PANCE.',
  };
}

/**
 * Optimal Difficulty Calculator
 * The "Goldilocks Zone" - not too easy, not too hard
 * Research suggests optimal difficulty is ~85% accuracy (Bjork & Bjork, 2011)
 */
export function calculateOptimalDifficulty(
  learnerProfile: LearnerProfile,
  recentPerformance: { accuracy: number; responseTimeMs: number }[]
): {
  targetAccuracy: number;
  currentDifficulty: number;
  recommendedAdjustment: 'increase' | 'decrease' | 'maintain';
  adjustmentMagnitude: number;
  explanation: string;
} {
  // Optimal accuracy is around 85% for maximal learning
  const OPTIMAL_ACCURACY = 0.85;
  const TOLERANCE = 0.08; // +/- 8%

  const recentAccuracy =
    recentPerformance.length > 0
      ? recentPerformance.reduce((sum, p) => sum + p.accuracy, 0) / recentPerformance.length
      : learnerProfile.averageAccuracy;

  // Calculate current difficulty (inverse relationship with accuracy)
  const currentDifficulty = 10 * (1 - recentAccuracy);

  let recommendedAdjustment: 'increase' | 'decrease' | 'maintain';
  let adjustmentMagnitude = 0;
  let explanation: string;

  if (recentAccuracy > OPTIMAL_ACCURACY + TOLERANCE) {
    // Too easy - increase difficulty
    recommendedAdjustment = 'increase';
    adjustmentMagnitude = (recentAccuracy - OPTIMAL_ACCURACY) * 2;
    explanation =
      `Your recent accuracy of ${(recentAccuracy * 100).toFixed(0)}% indicates the material is too easy. ` +
      `Research shows learning is maximized at ~85% accuracy. Increasing difficulty will accelerate your progress.`;
  } else if (recentAccuracy < OPTIMAL_ACCURACY - TOLERANCE) {
    // Too hard - decrease difficulty
    recommendedAdjustment = 'decrease';
    adjustmentMagnitude = (OPTIMAL_ACCURACY - recentAccuracy) * 2;
    explanation =
      `Your recent accuracy of ${(recentAccuracy * 100).toFixed(0)}% suggests the material is too challenging. ` +
      `While struggle is beneficial, accuracy below 75% can be frustrating and inefficient.`;
  } else {
    // Goldilocks zone
    recommendedAdjustment = 'maintain';
    adjustmentMagnitude = 0;
    explanation =
      `You're in the optimal learning zone! ${(recentAccuracy * 100).toFixed(0)}% accuracy means you're ` +
      `being challenged just enough to maximize learning without excessive frustration.`;
  }

  return {
    targetAccuracy: OPTIMAL_ACCURACY,
    currentDifficulty,
    recommendedAdjustment,
    adjustmentMagnitude: Math.min(1, adjustmentMagnitude),
    explanation,
  };
}

/**
 * Create a complete study session plan incorporating all desirable difficulties
 */
export function createOptimizedStudyPlan(
  topics: string[],
  sessionDurationMinutes: number,
  learnerProfile: LearnerProfile
): StudySessionPlan {
  // Get interleaving schedule
  const blocks = calculateInterleavingSchedule(topics, sessionDurationMinutes, learnerProfile);

  // Calculate overall interleaving ratio
  const interleavedBlocks = blocks.filter((b) => b.topicMix.length > 1).length;
  const interleavingRatio = interleavedBlocks / blocks.length;

  // Calculate spacing multiplier based on learner level
  const spacingMultiplier = 1 + learnerProfile.averageAccuracy * 0.5;

  // Generation prompt rate
  const generationPromptRate =
    blocks.filter((b) => b.includeGenerationPrompts).length / blocks.length;

  // Estimate retention gain
  // Research shows these techniques can improve retention by 30-60%
  const baseRetentionGain = 0.3;
  const interleavingBonus = interleavingRatio * 0.15;
  const retrievalBonus = 0.1; // Testing effect
  const generationBonus = generationPromptRate * 0.1;
  const estimatedRetentionGain =
    baseRetentionGain + interleavingBonus + retrievalBonus + generationBonus;

  // Collect difficulty adjustments
  const difficultyAdjustments: DifficultyAdjustment[] = [
    {
      type: 'spacing',
      intensity: spacingMultiplier - 1,
      rationale: 'Spaced practice produces 200% better retention than massed practice',
      expectedBenefit: 'Long-term retention significantly improved',
      researchCitation: 'Cepeda et al. (2006). Distributed practice in verbal recall tasks',
    },
    {
      type: 'interleaving',
      intensity: interleavingRatio,
      rationale: 'Mixing topics forces discrimination learning and pattern recognition',
      expectedBenefit: '43% better transfer to new problems',
      researchCitation: 'Rohrer & Taylor (2007). The shuffling of practice problems',
    },
    {
      type: 'retrieval',
      intensity: 0.8,
      rationale: 'Testing is more effective than re-reading',
      expectedBenefit: '50-150% better retention',
      researchCitation: 'Roediger & Karpicke (2006). Science',
    },
    {
      type: 'generation',
      intensity: generationPromptRate,
      rationale: 'Generating information strengthens memory traces',
      expectedBenefit: '20-40% better retention',
      researchCitation: 'Slamecka & Graf (1978). The generation effect',
    },
    {
      type: 'variation',
      intensity: 0.6,
      rationale: 'Variable practice improves transfer',
      expectedBenefit: 'Better performance on novel problems',
      researchCitation: 'Schmidt & Bjork (1992). New conceptualizations of practice',
    },
  ];

  return {
    totalDurationMinutes: sessionDurationMinutes,
    blocks,
    interleavingRatio,
    spacingMultiplier,
    generationPromptRate,
    estimatedRetentionGain,
    difficultyAdjustments,
  };
}

export default {
  calculateOptimalSpacing,
  calculateInterleavingSchedule,
  calculateRetrievalPracticeIntensity,
  createGenerationPrompt,
  calculateVariationSchedule,
  calculateOptimalDifficulty,
  createOptimizedStudyPlan,
};
