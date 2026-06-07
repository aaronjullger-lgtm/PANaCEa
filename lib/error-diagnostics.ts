/**
 * Error Diagnostics System
 *
 * Classifies incorrect answers into diagnostic categories to enable
 * targeted remediation strategies.
 *
 * Categories:
 * - Memory Slip: High latency + correct OR incorrect after initial correct selection
 *   → Weak memory trace, schedule for shorter interval review
 * - Knowledge Gap: Fast response to wrong answer OR "Don't Know"
 *   → Encoding failure, requires re-learning with elaboration
 * - Misconception: High confidence wrong answer with consistent pattern
 *   → Active interference from incorrect schema
 * - Careless Error: Fast correct-to-wrong switch at last moment
 *   → Attention lapse, not a memory issue
 *
 * Research basis:
 * - Koriat & Goldsmith (1996): Monitoring and control in memory
 * - Metcalfe (2017): Error correction and hypercorrection
 */
import { safeDivide } from './math/safeNumeric';

/**
 * Error diagnostic classification
 */
export type ErrorCategory =
  | 'memory_slip' // Weak trace - knew it but couldn't retrieve
  | 'knowledge_gap' // Never encoded properly
  | 'misconception' // Active incorrect knowledge
  | 'careless_error' // Attention/execution failure
  | 'unknown'; // Insufficient data to classify

/**
 * Full error diagnostic result
 */
export interface ErrorDiagnostic {
  /** Primary error classification */
  category: ErrorCategory;
  /** Confidence in classification (0-1) */
  confidence: number;
  /** Human-readable explanation */
  explanation: string;
  /** Recommended remediation strategy */
  remediation: RemediationStrategy;
  /** Supporting evidence for classification */
  evidence: ErrorEvidence;
}

/**
 * Evidence supporting the diagnostic classification
 */
export interface ErrorEvidence {
  /** Response latency in ms */
  latencyMs: number;
  /** Number of answer switches */
  answerSwitches: number;
  /** Whether user initially selected correct answer then changed */
  initiallyCorrect: boolean;
  /** Trajectory confidence if available */
  trajectoryConfidence?: number;
  /** Whether this distractor has been selected before */
  repeatDistractor: boolean;
  /** Time spent on question relative to par */
  latencyRatio: number;
}

/**
 * Remediation strategy based on error type
 */
export interface RemediationStrategy {
  /** Strategy type */
  type: 'short_interval' | 'elaboration' | 'contrast' | 'attention_cue';
  /** Recommended next review interval multiplier */
  intervalMultiplier: number;
  /** Whether to show elaborated explanation */
  showElaboration: boolean;
  /** Whether to include in confusion pair drill */
  addToConfusionPairs: boolean;
  /** Suggested intervention text */
  interventionText: string;
}

/**
 * Input data for error classification
 */
export interface ErrorClassificationInput {
  /** Was the answer correct? */
  isCorrect: boolean;
  /** Response latency in ms */
  latencyMs: number;
  /** Number of answer switches during selection */
  answerSwitches: number;
  /** Par time for this question type (ms) */
  parTimeMs: number;
  /** Answer selection history (ordered) */
  selectionHistory?: string[];
  /** Correct answer ID */
  correctAnswerId: string;
  /** Trajectory confidence (0-1) if available */
  trajectoryConfidence?: number;
  /** Historical data: has user selected this wrong answer before? */
  repeatDistractor?: boolean;
  /** Did user use "Don't Know" option? */
  usedDontKnow?: boolean;
}

/**
 * Thresholds for classification (configurable)
 */
const THRESHOLDS = {
  /** Latency ratio above which suggests retrieval difficulty */
  HIGH_LATENCY_RATIO: 1.5,
  /** Latency ratio below which suggests no retrieval attempt */
  LOW_LATENCY_RATIO: 0.3,
  /** Minimum switches to indicate significant uncertainty */
  MIN_SWITCHES_FOR_UNCERTAINTY: 2,
  /** Trajectory confidence below which suggests guessing */
  LOW_TRAJECTORY_CONFIDENCE: 0.4,
  /** Trajectory confidence above which suggests overconfidence */
  HIGH_TRAJECTORY_CONFIDENCE: 0.75,
};

/**
 * Classify an incorrect answer into a diagnostic category
 */
export function classifyError(input: ErrorClassificationInput): ErrorDiagnostic {
  // Correct answers don't need error classification
  if (input.isCorrect) {
    return {
      category: 'unknown',
      confidence: 0,
      explanation: 'Answer was correct - no error to classify',
      remediation: createRemediation('short_interval', 1.0),
      evidence: buildEvidence(input),
    };
  }

  const evidence = buildEvidence(input);
  const latencyRatio = safeDivide(input.latencyMs, input.parTimeMs, 1);

  // Priority 1: Check for "Don't Know" usage
  if (input.usedDontKnow) {
    return {
      category: 'knowledge_gap',
      confidence: 0.95,
      explanation: 'User indicated they do not know the answer - encoding failure detected',
      remediation: createRemediation('elaboration', 0.5),
      evidence,
    };
  }

  // Priority 2: Check if initially selected correct then switched (Careless Error)
  if (evidence.initiallyCorrect) {
    return {
      category: 'careless_error',
      confidence: 0.85,
      explanation: 'Initially selected correct answer but changed - attention lapse',
      remediation: createRemediation('attention_cue', 0.8),
      evidence,
    };
  }

  // Priority 3: Memory Slip - high latency indicates retrieval difficulty
  if (latencyRatio > THRESHOLDS.HIGH_LATENCY_RATIO) {
    // High latency + uncertainty = tried to remember but failed
    if (input.answerSwitches >= THRESHOLDS.MIN_SWITCHES_FOR_UNCERTAINTY) {
      return {
        category: 'memory_slip',
        confidence: 0.8,
        explanation: 'Extended retrieval attempt with multiple considerations - weak memory trace',
        remediation: createRemediation('short_interval', 0.6),
        evidence,
      };
    }
    // High latency + hesitant trajectory = retrieval failure
    if (
      input.trajectoryConfidence !== undefined &&
      input.trajectoryConfidence < THRESHOLDS.LOW_TRAJECTORY_CONFIDENCE
    ) {
      return {
        category: 'memory_slip',
        confidence: 0.75,
        explanation: 'Slow response with low trajectory confidence - retrieval difficulty',
        remediation: createRemediation('short_interval', 0.6),
        evidence,
      };
    }
  }

  // Priority 4: Misconception - confident but wrong (repeat pattern)
  if (evidence.repeatDistractor) {
    // Same wrong answer selected multiple times = active misconception
    return {
      category: 'misconception',
      confidence: 0.85,
      explanation: 'Repeatedly selected same incorrect answer - active misconception schema',
      remediation: createRemediation('contrast', 0.4),
      evidence,
    };
  }

  // Priority 5: Misconception - confident wrong answer
  if (
    input.trajectoryConfidence !== undefined &&
    input.trajectoryConfidence > THRESHOLDS.HIGH_TRAJECTORY_CONFIDENCE &&
    latencyRatio < 1.0
  ) {
    return {
      category: 'misconception',
      confidence: 0.7,
      explanation: 'Fast, confident wrong answer - possible misconception',
      remediation: createRemediation('contrast', 0.5),
      evidence,
    };
  }

  // Priority 6: Knowledge Gap - fast wrong answer with no hesitation
  if (latencyRatio < THRESHOLDS.LOW_LATENCY_RATIO && input.answerSwitches === 0) {
    return {
      category: 'knowledge_gap',
      confidence: 0.7,
      explanation: 'Immediate wrong answer without consideration - encoding failure',
      remediation: createRemediation('elaboration', 0.5),
      evidence,
    };
  }

  // Default: Memory Slip (most common for medical education)
  return {
    category: 'memory_slip',
    confidence: 0.5,
    explanation: 'Unable to determine specific error type - treating as retrieval failure',
    remediation: createRemediation('short_interval', 0.7),
    evidence,
  };
}

/**
 * Build evidence object from input
 */
function buildEvidence(input: ErrorClassificationInput): ErrorEvidence {
  const initiallyCorrect = input.selectionHistory
    ? input.selectionHistory[0] === input.correctAnswerId &&
      input.selectionHistory[input.selectionHistory.length - 1] !== input.correctAnswerId
    : false;

  return {
    latencyMs: input.latencyMs,
    answerSwitches: input.answerSwitches,
    initiallyCorrect,
    trajectoryConfidence: input.trajectoryConfidence,
    repeatDistractor: input.repeatDistractor || false,
    latencyRatio: safeDivide(input.latencyMs, input.parTimeMs, 1),
  };
}

/**
 * Create remediation strategy
 */
function createRemediation(
  type: RemediationStrategy['type'],
  intervalMultiplier: number
): RemediationStrategy {
  const strategies: Record<
    RemediationStrategy['type'],
    Omit<RemediationStrategy, 'intervalMultiplier'>
  > = {
    short_interval: {
      type: 'short_interval',
      showElaboration: true,
      addToConfusionPairs: false,
      interventionText: 'This fact is on the tip of your tongue! Review again soon.',
    },
    elaboration: {
      type: 'elaboration',
      showElaboration: true,
      addToConfusionPairs: false,
      interventionText: "Let's build a stronger foundation. Study the pathophysiology.",
    },
    contrast: {
      type: 'contrast',
      showElaboration: true,
      addToConfusionPairs: true,
      interventionText: 'Compare this with similar conditions to strengthen discrimination.',
    },
    attention_cue: {
      type: 'attention_cue',
      showElaboration: false,
      addToConfusionPairs: false,
      interventionText: 'Trust your first instinct! You knew this one.',
    },
  };

  return {
    ...strategies[type],
    intervalMultiplier,
  };
}

/**
 * Get FSRS stability multiplier based on error category
 */
export function getStabilityMultiplierForError(category: ErrorCategory): number {
  const multipliers: Record<ErrorCategory, number> = {
    memory_slip: 0.7, // Reduce stability but not severely
    knowledge_gap: 0.4, // Major stability reduction - needs re-encoding
    misconception: 0.3, // Severe reduction - needs unlearning + relearning
    careless_error: 0.9, // Minimal reduction - not a memory issue
    unknown: 0.6, // Default moderate reduction
  };
  return multipliers[category];
}

/**
 * Serialize error diagnostic for storage
 */
export function serializeErrorDiagnostic(diagnostic: ErrorDiagnostic): Record<string, unknown> {
  return {
    category: diagnostic.category,
    confidence: Math.round(diagnostic.confidence * 100) / 100,
    remediationType: diagnostic.remediation.type,
    intervalMultiplier: diagnostic.remediation.intervalMultiplier,
    evidence: {
      latencyRatio: Math.round(diagnostic.evidence.latencyRatio * 100) / 100,
      switches: diagnostic.evidence.answerSwitches,
      initiallyCorrect: diagnostic.evidence.initiallyCorrect,
      repeatDistractor: diagnostic.evidence.repeatDistractor,
    },
  };
}

export default {
  classifyError,
  getStabilityMultiplierForError,
  serializeErrorDiagnostic,
};
