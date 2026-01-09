/**
 * Cognitive Load Optimizer
 * 
 * Implementation of Sweller's Cognitive Load Theory (CLT) for optimizing
 * learning efficiency by managing intrinsic, extraneous, and germane load.
 * 
 * Key Research:
 * - Sweller, J. (1988). Cognitive load during problem solving
 * - Sweller, J. (2011). Cognitive Load Theory
 * - Paas, F. & van Merriënboer, J. (1994). Instructional control of cognitive load
 * - Kalyuga, S. (2007). Expertise reversal effect
 * 
 * Three Types of Cognitive Load:
 * 1. Intrinsic Load - Inherent complexity of the material
 * 2. Extraneous Load - Ineffective presentation (should be minimized)
 * 3. Germane Load - Effort devoted to schema construction (should be optimized)
 * 
 * @module lib/services/cognitiveScience/cognitiveLoadOptimizer
 */

export interface CognitiveLoadProfile {
  // Working memory capacity (limited to ~4 chunks)
  workingMemoryCapacity: number; // 1-7 chunks (Miller's magic number)
  
  // Current load levels (0-100%)
  intrinsicLoad: number;
  extraneousLoad: number;
  germaneLoad: number;
  totalLoad: number;
  
  // Capacity remaining
  availableCapacity: number;
  isOverloaded: boolean;
  
  // Fatigue tracking
  sessionDurationMinutes: number;
  mentalFatigueLevel: number; // 0-1
  optimalBreakTime: boolean;
}

export interface ContentComplexityAnalysis {
  elementInteractivity: number; // How many elements must be processed simultaneously
  intrinsicComplexity: number; // 1-10 scale
  priorKnowledgeRequired: string[];
  recommendedChunking: string[][];
  estimatedProcessingTime: number; // seconds
  optimalPresentationOrder: string[];
}

export interface LoadReduction {
  technique: string;
  description: string;
  expectedReduction: number; // percentage
  applicability: 'high' | 'medium' | 'low';
  researchBasis: string;
}

export interface OptimizedPresentation {
  originalContent: string;
  optimizedContent: string;
  chunkedElements: string[];
  scaffoldingLevel: 'none' | 'light' | 'moderate' | 'heavy';
  loadReductions: LoadReduction[];
  estimatedLoadReduction: number;
  expertiseReversal: boolean; // If true, simplification may hurt learning
}

/**
 * Calculate intrinsic cognitive load based on element interactivity
 * Element interactivity = number of elements that must be processed in working memory simultaneously
 */
export function calculateIntrinsicLoad(
  conceptComplexity: number, // 1-10
  numInteractingElements: number,
  learnerExpertise: number // 0-1
): {
  intrinsicLoad: number;
  isHighInteractivity: boolean;
  recommendedApproach: string;
} {
  // High element interactivity = higher intrinsic load
  // Formula: Base complexity × element count × inverse expertise
  const expertiseModifier = 1 - (learnerExpertise * 0.6);
  const rawLoad = (conceptComplexity / 10) * Math.log2(numInteractingElements + 1) * expertiseModifier;
  const intrinsicLoad = Math.min(100, rawLoad * 100);
  
  const isHighInteractivity = numInteractingElements > 4;
  
  let recommendedApproach: string;
  if (isHighInteractivity && learnerExpertise < 0.3) {
    recommendedApproach = 'ISOLATED ELEMENTS: Present elements individually before combining';
  } else if (isHighInteractivity && learnerExpertise < 0.6) {
    recommendedApproach = 'WORKED EXAMPLES: Show complete solutions before practice';
  } else if (isHighInteractivity) {
    recommendedApproach = 'COMPLETION PROBLEMS: Partial solutions for practice';
  } else {
    recommendedApproach = 'STANDARD: Full problem presentation appropriate';
  }
  
  return { intrinsicLoad, isHighInteractivity, recommendedApproach };
}

/**
 * Identify and minimize extraneous cognitive load
 * Extraneous load comes from poor instructional design - always minimize
 */
export function identifyExtraneousLoad(
  presentationFeatures: {
    hasRedundantText: boolean;
    hasSplitAttention: boolean;
    hasModalityMismatch: boolean;
    hasIrrelevantDetails: boolean;
    hasWeaklyGuidedSearch: boolean;
    hasTransientInfo: boolean;
  }
): {
  extraneousLoad: number;
  problems: LoadReduction[];
} {
  const problems: LoadReduction[] = [];
  let extraneousLoad = 0;
  
  if (presentationFeatures.hasRedundantText) {
    extraneousLoad += 15;
    problems.push({
      technique: 'Redundancy Effect Elimination',
      description: 'Remove on-screen text that duplicates narration. Use EITHER text OR audio, not both.',
      expectedReduction: 15,
      applicability: 'high',
      researchBasis: 'Kalyuga et al. (1999). Managing split-attention and redundancy'
    });
  }
  
  if (presentationFeatures.hasSplitAttention) {
    extraneousLoad += 20;
    problems.push({
      technique: 'Split-Attention Integration',
      description: 'Integrate related text and diagrams spatially. Labels should be ON the diagram, not separate.',
      expectedReduction: 20,
      applicability: 'high',
      researchBasis: 'Chandler & Sweller (1992). The split-attention effect'
    });
  }
  
  if (presentationFeatures.hasModalityMismatch) {
    extraneousLoad += 12;
    problems.push({
      technique: 'Modality Optimization',
      description: 'Use visual channel for diagrams + auditory channel for explanations (dual-channel processing)',
      expectedReduction: 12,
      applicability: 'high',
      researchBasis: 'Mousavi, Low & Sweller (1995). Reducing cognitive load by mixing modalities'
    });
  }
  
  if (presentationFeatures.hasIrrelevantDetails) {
    extraneousLoad += 10;
    problems.push({
      technique: 'Coherence Principle',
      description: 'Remove interesting but irrelevant details. "Cool facts" actually hurt learning.',
      expectedReduction: 10,
      applicability: 'medium',
      researchBasis: 'Mayer et al. (2001). Cognitive constraints on multimedia learning'
    });
  }
  
  if (presentationFeatures.hasWeaklyGuidedSearch) {
    extraneousLoad += 18;
    problems.push({
      technique: 'Guided Attention',
      description: 'Use signaling (arrows, highlights, color-coding) to direct attention to key elements.',
      expectedReduction: 18,
      applicability: 'high',
      researchBasis: 'De Koning et al. (2009). Towards a framework for attention cueing'
    });
  }
  
  if (presentationFeatures.hasTransientInfo) {
    extraneousLoad += 15;
    problems.push({
      technique: 'Pacing Control',
      description: 'Give learners control over pace. Allow pausing and replaying of transient info.',
      expectedReduction: 15,
      applicability: 'high',
      researchBasis: 'Schnotz & Rasch (2005). Enabling, facilitating, and inhibiting effects'
    });
  }
  
  return { extraneousLoad, problems };
}

/**
 * Optimize germane cognitive load (effort devoted to learning)
 * This is the "good" cognitive load that builds schemas
 */
export function optimizeGermaneLoad(
  learnerExpertise: number,
  availableCapacity: number,
  contentType: 'conceptual' | 'procedural' | 'factual' | 'meta-cognitive'
): {
  germaneLoadStrategies: {
    strategy: string;
    technique: string;
    intensity: number;
    timing: string;
  }[];
  optimalGermaneLoad: number;
} {
  const strategies: {
    strategy: string;
    technique: string;
    intensity: number;
    timing: string;
  }[] = [];
  
  // Self-explanation prompts - force deep processing
  if (availableCapacity > 30) {
    strategies.push({
      strategy: 'Self-Explanation',
      technique: 'Prompt learner to explain WHY, not just WHAT',
      intensity: learnerExpertise > 0.5 ? 0.8 : 0.5,
      timing: 'After each key concept'
    });
  }
  
  // Elaborative interrogation - ask "why" questions
  if (contentType === 'conceptual' || contentType === 'factual') {
    strategies.push({
      strategy: 'Elaborative Interrogation',
      technique: 'Ask "Why does this make sense?" after facts',
      intensity: 0.6,
      timing: 'After presenting facts or relationships'
    });
  }
  
  // Worked examples with fading
  if (contentType === 'procedural' && learnerExpertise < 0.6) {
    strategies.push({
      strategy: 'Worked Example Effect',
      technique: 'Show complete solutions, then progressively remove steps',
      intensity: 1 - learnerExpertise,
      timing: 'Beginning of skill acquisition'
    });
  }
  
  // Schema construction through comparison
  strategies.push({
    strategy: 'Comparison/Contrast',
    technique: 'Present similar concepts together to highlight differences',
    intensity: 0.7,
    timing: 'After basic understanding established'
  });
  
  // Variability for transfer
  if (learnerExpertise > 0.4) {
    strategies.push({
      strategy: 'Variable Practice',
      technique: 'Vary surface features while maintaining deep structure',
      intensity: learnerExpertise * 0.8,
      timing: 'Mid-to-late learning phase'
    });
  }
  
  // Calculate optimal germane load
  const optimalGermaneLoad = Math.min(
    availableCapacity * 0.8, // Don't exceed 80% of available capacity
    50 + (learnerExpertise * 30) // Higher for experts
  );
  
  return { germaneLoadStrategies: strategies, optimalGermaneLoad };
}

/**
 * Expertise Reversal Effect Detection
 * What helps novices can HURT experts (and vice versa)
 * Kalyuga (2007)
 */
export function detectExpertiseReversal(
  learnerExpertise: number,
  currentSupport: {
    hasDetailedExplanations: boolean;
    hasWorkedExamples: boolean;
    hasScaffolding: boolean;
    hasGuidedPractice: boolean;
    hasSelfDirectedOptions: boolean;
  }
): {
  isReversalLikely: boolean;
  recommendation: string;
  adjustments: { feature: string; action: 'increase' | 'decrease' | 'remove' }[];
} {
  const adjustments: { feature: string; action: 'increase' | 'decrease' | 'remove' }[] = [];
  let isReversalLikely = false;
  let recommendation = '';
  
  // Expert learners are hurt by excessive scaffolding
  if (learnerExpertise > 0.7) {
    if (currentSupport.hasDetailedExplanations) {
      isReversalLikely = true;
      adjustments.push({ feature: 'Detailed explanations', action: 'decrease' });
    }
    if (currentSupport.hasWorkedExamples) {
      isReversalLikely = true;
      adjustments.push({ feature: 'Worked examples', action: 'remove' });
    }
    if (currentSupport.hasScaffolding) {
      isReversalLikely = true;
      adjustments.push({ feature: 'Scaffolding', action: 'remove' });
    }
    if (!currentSupport.hasSelfDirectedOptions) {
      adjustments.push({ feature: 'Self-directed options', action: 'increase' });
    }
    recommendation = 
      'EXPERTISE DETECTED: Reduce support. Detailed guidance may impede your learning. ' +
      'Focus on problem-solving and generation instead of studying examples.';
  }
  
  // Novice learners need MORE support
  else if (learnerExpertise < 0.3) {
    if (!currentSupport.hasDetailedExplanations) {
      adjustments.push({ feature: 'Detailed explanations', action: 'increase' });
    }
    if (!currentSupport.hasWorkedExamples) {
      adjustments.push({ feature: 'Worked examples', action: 'increase' });
    }
    if (!currentSupport.hasScaffolding) {
      adjustments.push({ feature: 'Scaffolding', action: 'increase' });
    }
    if (currentSupport.hasSelfDirectedOptions) {
      // Too much freedom can overwhelm novices
      adjustments.push({ feature: 'Self-directed options', action: 'decrease' });
    }
    recommendation = 
      'NOVICE SUPPORT: More scaffolding recommended. Study worked examples thoroughly ' +
      'before attempting problems independently.';
  }
  
  // Intermediate learners - transition zone
  else {
    if (currentSupport.hasWorkedExamples) {
      adjustments.push({ feature: 'Worked examples', action: 'decrease' });
    }
    adjustments.push({ feature: 'Completion problems', action: 'increase' });
    recommendation = 
      'TRANSITION PHASE: Shift from worked examples to completion problems. ' +
      'Gradually take on more problem-solving responsibility.';
  }
  
  return { isReversalLikely, recommendation, adjustments };
}

/**
 * Calculate total cognitive load and check for overload
 */
export function calculateTotalLoad(
  intrinsicLoad: number,
  extraneousLoad: number,
  germaneLoad: number,
  sessionDurationMinutes: number,
  lastBreakMinutesAgo: number
): CognitiveLoadProfile {
  // Fatigue increases with time (Yerkes-Dodson Law)
  const fatigueFromDuration = Math.min(1, sessionDurationMinutes / 90);
  const fatigueFromNoBreak = Math.min(0.3, (lastBreakMinutesAgo - 25) / 100);
  const mentalFatigueLevel = Math.min(1, fatigueFromDuration + Math.max(0, fatigueFromNoBreak));
  
  // Fatigue reduces effective working memory capacity
  const baseCapacity = 4; // Cowan's 4±1
  const fatigueReduction = mentalFatigueLevel * 1.5;
  const workingMemoryCapacity = Math.max(2, baseCapacity - fatigueReduction);
  
  // Total load (should not exceed 100 for effective learning)
  const totalLoad = intrinsicLoad + extraneousLoad + germaneLoad;
  
  // Available capacity (100 - total load, adjusted for fatigue)
  const maxEffectiveCapacity = 100 * (1 - mentalFatigueLevel * 0.3);
  const availableCapacity = Math.max(0, maxEffectiveCapacity - totalLoad);
  
  // Overload detection
  const isOverloaded = totalLoad > maxEffectiveCapacity;
  
  // Optimal break detection (research suggests every 25-50 minutes)
  const optimalBreakTime = lastBreakMinutesAgo >= 25 && lastBreakMinutesAgo <= 30;
  
  return {
    workingMemoryCapacity,
    intrinsicLoad,
    extraneousLoad,
    germaneLoad,
    totalLoad,
    availableCapacity,
    isOverloaded,
    sessionDurationMinutes,
    mentalFatigueLevel,
    optimalBreakTime,
  };
}

/**
 * Generate load-optimized content presentation
 */
export function optimizeContentPresentation(
  content: string,
  conceptCount: number,
  learnerExpertise: number,
  currentLoad: CognitiveLoadProfile
): OptimizedPresentation {
  const loadReductions: LoadReduction[] = [];
  let optimizedContent = content;
  
  // Chunking strategy based on working memory capacity
  const optimalChunkSize = Math.floor(currentLoad.workingMemoryCapacity);
  const chunks = chunkContent(content, conceptCount, optimalChunkSize);
  
  // Determine scaffolding level
  let scaffoldingLevel: 'none' | 'light' | 'moderate' | 'heavy';
  if (learnerExpertise > 0.7) {
    scaffoldingLevel = 'none';
  } else if (learnerExpertise > 0.5) {
    scaffoldingLevel = 'light';
  } else if (learnerExpertise > 0.3) {
    scaffoldingLevel = 'moderate';
  } else {
    scaffoldingLevel = 'heavy';
  }
  
  // Apply load reduction techniques
  if (currentLoad.isOverloaded) {
    loadReductions.push({
      technique: 'Segmenting',
      description: 'Break content into smaller, digestible segments',
      expectedReduction: 20,
      applicability: 'high',
      researchBasis: 'Mayer & Chandler (2001). When learning is just a click away'
    });
  }
  
  if (currentLoad.extraneousLoad > 20) {
    loadReductions.push({
      technique: 'Weeding',
      description: 'Remove non-essential content and decorative elements',
      expectedReduction: currentLoad.extraneousLoad * 0.5,
      applicability: 'high',
      researchBasis: 'Mayer & Moreno (2003). Nine ways to reduce cognitive load'
    });
  }
  
  if (currentLoad.germaneLoad < 30 && currentLoad.availableCapacity > 30) {
    loadReductions.push({
      technique: 'Generation Prompts',
      description: 'Add prompts that require active processing',
      expectedReduction: -15, // Actually increases load, but germane
      applicability: 'high',
      researchBasis: 'Slamecka & Graf (1978). Generation effect'
    });
  }
  
  // Check for expertise reversal
  const expertiseReversal = learnerExpertise > 0.6 && scaffoldingLevel !== 'none';
  
  // Calculate estimated load reduction
  const estimatedLoadReduction = loadReductions
    .filter(r => r.expectedReduction > 0)
    .reduce((sum, r) => sum + r.expectedReduction, 0);
  
  return {
    originalContent: content,
    optimizedContent,
    chunkedElements: chunks,
    scaffoldingLevel,
    loadReductions,
    estimatedLoadReduction,
    expertiseReversal,
  };
}

/**
 * Helper: Chunk content into working-memory-sized pieces
 */
function chunkContent(content: string, conceptCount: number, chunkSize: number): string[] {
  // This is a simplified chunking - in production, use NLP for semantic chunking
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  const chunks: string[] = [];
  
  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunk = sentences.slice(i, i + chunkSize).join('. ') + '.';
    chunks.push(chunk.trim());
  }
  
  return chunks;
}

/**
 * Generate real-time study recommendations based on cognitive load
 */
export function generateLoadBasedRecommendations(
  loadProfile: CognitiveLoadProfile
): {
  immediateActions: string[];
  sessionAdjustments: string[];
  longTermStrategies: string[];
} {
  const immediateActions: string[] = [];
  const sessionAdjustments: string[] = [];
  const longTermStrategies: string[] = [];
  
  // Immediate actions for overload
  if (loadProfile.isOverloaded) {
    immediateActions.push('🛑 OVERLOADED: Take a 5-minute break immediately');
    immediateActions.push('When you return, start with easier material');
    immediateActions.push('Consider stopping for the day if fatigue persists');
  }
  
  // Break timing
  if (loadProfile.optimalBreakTime) {
    immediateActions.push('✨ Perfect time for a 5-10 minute break');
    immediateActions.push('Walk around, hydrate, look at distant objects');
  }
  
  // High extraneous load
  if (loadProfile.extraneousLoad > 30) {
    sessionAdjustments.push('Simplify your study materials - remove distractions');
    sessionAdjustments.push('Focus on one resource at a time');
    sessionAdjustments.push('Turn off notifications and close unneeded tabs');
  }
  
  // Low germane load - not learning efficiently
  if (loadProfile.germaneLoad < 20 && !loadProfile.isOverloaded) {
    sessionAdjustments.push('Increase active processing: explain concepts aloud');
    sessionAdjustments.push('Draw diagrams or create summaries');
    sessionAdjustments.push('Test yourself instead of re-reading');
  }
  
  // High fatigue
  if (loadProfile.mentalFatigueLevel > 0.7) {
    immediateActions.push('⚠️ High fatigue detected - learning efficiency is reduced');
    sessionAdjustments.push('Switch to easier topics or review');
    sessionAdjustments.push('Consider ending the session');
    longTermStrategies.push('Try studying earlier in the day when fresher');
  }
  
  // Long-term strategies
  longTermStrategies.push('Distribute study sessions (spaced practice) instead of cramming');
  longTermStrategies.push('Build expertise gradually - schemas reduce intrinsic load');
  longTermStrategies.push('Practice retrieval, not just recognition');
  
  return { immediateActions, sessionAdjustments, longTermStrategies };
}

export default {
  calculateIntrinsicLoad,
  identifyExtraneousLoad,
  optimizeGermaneLoad,
  detectExpertiseReversal,
  calculateTotalLoad,
  optimizeContentPresentation,
  generateLoadBasedRecommendations,
};
