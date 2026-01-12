/**
 * Metacognition Trigger System
 * 
 * Implements pattern-based triggers for knowledge gap reflection prompts.
 * Prompts appear for ~20-30% of incorrect answers based on:
 * - Consecutive misses on same subcategory
 * - Known confusion pairs (e.g., AFib vs AFlutter)
 * - Random sampling (10%) for other cases
 * 
 * Research: Metacognitive monitoring improves learning (Dunlosky et al., 2013)
 */

/**
 * Known confusion pairs - conditions commonly mixed up
 * Format: [condition1, condition2, commonError]
 */
export const CONFUSION_PAIRS: Array<{
  condition1: string;
  condition2: string;
  distinguishingFeature: string;
  clinicalPearl: string;
}> = [
  {
    condition1: 'Atrial Fibrillation',
    condition2: 'Atrial Flutter',
    distinguishingFeature: 'Flutter has regular "sawtooth" P waves at ~300 bpm; AFib is irregularly irregular',
    clinicalPearl: 'Remember: Flutter = Fixed rate (usually 2:1 or 4:1 block), Fib = Fibrillating (chaotic)',
  },
  {
    condition1: 'Crohn\'s Disease',
    condition2: 'Ulcerative Colitis',
    distinguishingFeature: 'Crohn\'s: transmural, skip lesions, any GI tract. UC: mucosal, continuous, colon only',
    clinicalPearl: 'Crohn\'s = "creeping" fat, granulomas. UC = "bloody" diarrhea, pseudopolyps',
  },
  {
    condition1: 'Hyperthyroidism',
    condition2: 'Hypothyroidism',
    distinguishingFeature: 'Hyper: weight loss, tachycardia, heat intolerance. Hypo: weight gain, bradycardia, cold intolerance',
    clinicalPearl: 'Think temperature: Hyper = HOT and fast, Hypo = COLD and slow',
  },
  {
    condition1: 'Type 1 Diabetes',
    condition2: 'Type 2 Diabetes',
    distinguishingFeature: 'T1: autoimmune, absolute insulin deficiency. T2: insulin resistance, relative deficiency',
    clinicalPearl: 'T1 = young, lean, ketosis-prone, needs insulin. T2 = older, obese, starts with metformin',
  },
  {
    condition1: 'DVT',
    condition2: 'Superficial Thrombophlebitis',
    distinguishingFeature: 'DVT: deep veins, high PE risk. Superficial: visible, palpable cord, low PE risk',
    clinicalPearl: 'Deep = D-dimer + ultrasound. Superficial = clinical diagnosis, warm compresses',
  },
  {
    condition1: 'STEMI',
    condition2: 'NSTEMI',
    distinguishingFeature: 'STEMI: ST elevation, complete occlusion, emergent cath. NSTEMI: no elevation, partial occlusion',
    clinicalPearl: 'STEMI = "Door to Balloon" <90 min. NSTEMI = medical management first, cath within 24-72h',
  },
  {
    condition1: 'Pneumonia',
    condition2: 'Bronchitis',
    distinguishingFeature: 'Pneumonia: alveolar, fever, consolidation on CXR. Bronchitis: airways, no infiltrate, productive cough',
    clinicalPearl: 'Pneumonia = PNA = Parenchymal. Bronchitis = airways only, usually viral',
  },
  {
    condition1: 'Prerenal AKI',
    condition2: 'Intrinsic AKI',
    distinguishingFeature: 'Prerenal: FENa <1%, BUN/Cr >20. Intrinsic: FENa >2%, BUN/Cr <15, muddy brown casts',
    clinicalPearl: 'Prerenal = "plumbing problem before kidney". Intrinsic = "kidney itself is damaged"',
  },
  {
    condition1: 'Tension Headache',
    condition2: 'Migraine',
    distinguishingFeature: 'Tension: bilateral, band-like. Migraine: unilateral, pulsating, nausea, photo/phonophobia',
    clinicalPearl: 'Migraine = "Miserable" with aura/nausea. Tension = "Tight band" without',
  },
  {
    condition1: 'Osteoarthritis',
    condition2: 'Rheumatoid Arthritis',
    distinguishingFeature: 'OA: DIP joints, no systemic, mechanical pain. RA: MCP/PIP, systemic, morning stiffness >1hr',
    clinicalPearl: 'OA = Old age, Degeneration. RA = RF positive, Rheumatoid factor',
  },
];

/**
 * Session tracking for metacognition triggers
 */
export interface SessionMissTracker {
  /** Map of subcategory -> number of consecutive misses */
  consecutiveMissesBySubcategory: Map<string, number>;
  /** Map of system -> number of misses this session */
  totalMissesBySystem: Map<string, number>;
  /** Set of condition IDs already shown metacognition for */
  metacognitionShown: Set<string>;
  /** Total questions answered this session */
  totalAnswered: number;
  /** Total metacognition prompts shown this session */
  metacognitionCount: number;
}

/**
 * Initialize a new session tracker
 */
export function initSessionTracker(): SessionMissTracker {
  return {
    consecutiveMissesBySubcategory: new Map(),
    totalMissesBySystem: new Map(),
    metacognitionShown: new Set(),
    totalAnswered: 0,
    metacognitionCount: 0,
  };
}

/**
 * Metacognition prompt content
 */
export interface MetacognitionPrompt {
  /** Whether to show the prompt */
  shouldShow: boolean;
  /** Reason for showing (for analytics) */
  triggerReason?: 'consecutive_misses' | 'confusion_pair' | 'random_sample' | 'high_yield_miss';
  /** Reflection questions to ask */
  reflectionQuestions: string[];
  /** Related confusion pair info if applicable */
  confusionPairInfo?: {
    pairedCondition: string;
    distinguishingFeature: string;
    clinicalPearl: string;
  };
}

/**
 * Determine if metacognition prompt should be shown
 */
export function shouldShowMetacognition(params: {
  isCorrect: boolean;
  conditionId: string;
  conditionName: string;
  subcategory: string;
  system: string;
  panaceYield?: number;
  tracker: SessionMissTracker;
}): MetacognitionPrompt {
  const {
    isCorrect,
    conditionId,
    conditionName,
    subcategory,
    system,
    panaceYield = 2,
    tracker,
  } = params;

  tracker.totalAnswered++;

  // Correct answers: update tracker and skip
  if (isCorrect) {
    // Reset consecutive misses for this subcategory
    tracker.consecutiveMissesBySubcategory.set(subcategory, 0);
    return {
      shouldShow: false,
      reflectionQuestions: [],
    };
  }

  // --- Incorrect answer logic ---

  // Update miss counts
  const currentMisses = (tracker.consecutiveMissesBySubcategory.get(subcategory) || 0) + 1;
  tracker.consecutiveMissesBySubcategory.set(subcategory, currentMisses);
  
  const systemMisses = (tracker.totalMissesBySystem.get(system) || 0) + 1;
  tracker.totalMissesBySystem.set(system, systemMisses);

  // Skip if already shown metacognition for this condition
  if (tracker.metacognitionShown.has(conditionId)) {
    return {
      shouldShow: false,
      reflectionQuestions: [],
    };
  }

  // Limit total metacognition prompts per session (max 30%)
  const metacognitionRate = tracker.metacognitionCount / tracker.totalAnswered;
  if (metacognitionRate > 0.3) {
    return {
      shouldShow: false,
      reflectionQuestions: [],
    };
  }

  // --- Trigger conditions ---

  // Trigger 1: Consecutive misses in same subcategory (≥2)
  if (currentMisses >= 2) {
    tracker.metacognitionShown.add(conditionId);
    tracker.metacognitionCount++;
    return {
      shouldShow: true,
      triggerReason: 'consecutive_misses',
      reflectionQuestions: [
        `You've missed ${currentMisses} questions in ${subcategory}. What common theme connects these topics?`,
        'What specific aspect of this topic is causing confusion?',
        'What would help you distinguish between similar conditions?',
      ],
    };
  }

  // Trigger 2: Known confusion pair
  const confusionPair = findConfusionPair(conditionName);
  if (confusionPair) {
    tracker.metacognitionShown.add(conditionId);
    tracker.metacognitionCount++;
    return {
      shouldShow: true,
      triggerReason: 'confusion_pair',
      reflectionQuestions: [
        `This condition is commonly confused with ${confusionPair.pairedCondition}. What's the key differentiator?`,
        'How would you quickly distinguish these two on an exam?',
      ],
      confusionPairInfo: confusionPair,
    };
  }

  // Trigger 3: High yield miss (yield ≥ 3)
  if (panaceYield >= 3) {
    tracker.metacognitionShown.add(conditionId);
    tracker.metacognitionCount++;
    return {
      shouldShow: true,
      triggerReason: 'high_yield_miss',
      reflectionQuestions: [
        'This is a high-yield topic for the PANCE. What\'s the most important fact to remember?',
        'What classic presentation should trigger you to think of this diagnosis?',
      ],
    };
  }

  // Trigger 4: Random sampling (10% of other misses)
  if (Math.random() < 0.1) {
    tracker.metacognitionShown.add(conditionId);
    tracker.metacognitionCount++;
    return {
      shouldShow: true,
      triggerReason: 'random_sample',
      reflectionQuestions: [
        'What aspect of this question tripped you up?',
        'What would you review to prevent this mistake next time?',
      ],
    };
  }

  return {
    shouldShow: false,
    reflectionQuestions: [],
  };
}

/**
 * Find confusion pair for a given condition
 */
function findConfusionPair(conditionName: string): {
  pairedCondition: string;
  distinguishingFeature: string;
  clinicalPearl: string;
} | null {
  const lowerName = conditionName.toLowerCase();
  
  for (const pair of CONFUSION_PAIRS) {
    if (pair.condition1.toLowerCase().includes(lowerName) ||
        lowerName.includes(pair.condition1.toLowerCase())) {
      return {
        pairedCondition: pair.condition2,
        distinguishingFeature: pair.distinguishingFeature,
        clinicalPearl: pair.clinicalPearl,
      };
    }
    if (pair.condition2.toLowerCase().includes(lowerName) ||
        lowerName.includes(pair.condition2.toLowerCase())) {
      return {
        pairedCondition: pair.condition1,
        distinguishingFeature: pair.distinguishingFeature,
        clinicalPearl: pair.clinicalPearl,
      };
    }
  }
  
  return null;
}

/**
 * Get session summary for metacognition analytics
 */
export function getSessionMetacognitionSummary(tracker: SessionMissTracker): {
  totalAnswered: number;
  metacognitionRate: number;
  topMissedSubcategories: string[];
  topMissedSystems: string[];
} {
  const subcatMisses = Array.from(tracker.consecutiveMissesBySubcategory.entries())
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([subcat]) => subcat);

  const systemMisses = Array.from(tracker.totalMissesBySystem.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([system]) => system);

  return {
    totalAnswered: tracker.totalAnswered,
    metacognitionRate: tracker.totalAnswered > 0 
      ? tracker.metacognitionCount / tracker.totalAnswered 
      : 0,
    topMissedSubcategories: subcatMisses,
    topMissedSystems: systemMisses,
  };
}

/**
 * Generate post-session reflection prompt based on tracker data
 */
export function generatePostSessionReflection(tracker: SessionMissTracker): string[] {
  const summary = getSessionMetacognitionSummary(tracker);
  const reflections: string[] = [];
  
  if (summary.topMissedSubcategories.length > 0) {
    reflections.push(
      `You had the most difficulty with: ${summary.topMissedSubcategories.join(', ')}. Consider focused review.`
    );
  }
  
  if (summary.topMissedSystems.length > 0) {
    reflections.push(
      `Your weakest systems this session: ${summary.topMissedSystems.join(', ')}`
    );
  }
  
  reflections.push('What patterns did you notice in the questions you missed?');
  reflections.push('What specific topics need more review before your next session?');
  
  return reflections;
}

export default {
  CONFUSION_PAIRS,
  initSessionTracker,
  shouldShowMetacognition,
  getSessionMetacognitionSummary,
  generatePostSessionReflection,
};
