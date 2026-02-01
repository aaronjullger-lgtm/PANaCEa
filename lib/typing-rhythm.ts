/**
 * Typing Rhythm Analysis (CRPL - Cognitive Rhythm Perception Layer)
 *
 * Analyzes keystroke dynamics to distinguish between:
 * - Physical rhythm: Mechanical typing patterns (motor execution)
 * - Cognitive rhythm: Decision-making and retrieval timing
 *
 * Applications:
 * - Free-text answer analysis
 * - Study note quality assessment
 * - Cognitive load inference during typing tasks
 *
 * Key Metrics:
 * - Inter-Key Interval (IKI): Time between consecutive keystrokes
 * - Pause Threshold: Distinguishes physical from cognitive pauses
 * - Burst Analysis: Consecutive fast keystrokes (automaticity)
 * - Word-Level Pauses: Hesitation at word boundaries (lexical access)
 *
 * Research basis:
 * - Leijten & Van Waes (2013): Keystroke logging in writing research
 * - Medimorec et al. (2015): Pauses and cognitive processes
 * - Van Waes et al. (2012): Temporal patterns in writing
 */

/**
 * Single keystroke event
 */
export interface KeystrokeEvent {
  /** Key pressed (single character or key code) */
  key: string;
  /** Timestamp (ms since epoch or session start) */
  timestamp: number;
  /** Event type */
  type: 'keydown' | 'keyup';
  /** Is this a deletion key (backspace/delete) */
  isDeletion: boolean;
  /** Position in text (character index) */
  position: number;
}

/**
 * Typing rhythm classification
 */
export type TypingRhythm =
  | 'fluent' // Consistent, fast, few pauses
  | 'deliberate' // Measured pacing, thoughtful
  | 'hesitant' // Frequent pauses, uncertain
  | 'fragmented' // Erratic, many deletions
  | 'rushed'; // Too fast, likely copying

/**
 * Pause classification by duration and context
 */
export type PauseType =
  | 'physical' // < 200ms - motor execution
  | 'lexical' // 200-500ms - word retrieval
  | 'cognitive' // 500-2000ms - sentence planning
  | 'reflective' // 2000-5000ms - deep thinking
  | 'stuck'; // > 5000ms - blocked/distracted

/**
 * Pause event with classification
 */
export interface PauseEvent {
  /** Duration in milliseconds */
  durationMs: number;
  /** Classified pause type */
  type: PauseType;
  /** Position in text where pause occurred */
  position: number;
  /** Context: did pause occur at word boundary? */
  atWordBoundary: boolean;
  /** Context: did pause occur at sentence boundary? */
  atSentenceBoundary: boolean;
  /** Previous key (context) */
  prevKey: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Burst analysis - consecutive fast keystrokes
 */
export interface BurstSegment {
  /** Start position in text */
  startPosition: number;
  /** End position in text */
  endPosition: number;
  /** Number of keystrokes in burst */
  length: number;
  /** Average IKI within burst (ms) */
  avgIKI: number;
  /** Characters typed in burst */
  content: string;
  /** Timestamp of burst start */
  startTimestamp: number;
}

/**
 * Full typing session analysis
 */
export interface TypingAnalysis {
  /** Overall rhythm classification */
  rhythm: TypingRhythm;
  /** Confidence in classification (0-1) */
  confidence: number;
  /** Total keystrokes analyzed */
  totalKeystrokes: number;
  /** Total characters produced (after deletions) */
  finalLength: number;
  /** Deletion ratio (deletions / total keystrokes) */
  deletionRatio: number;
  /** Average inter-key interval (ms) */
  avgIKI: number;
  /** IKI standard deviation */
  ikiStdDev: number;
  /** Coefficient of variation (consistency measure) */
  ikiCV: number;
  /** Characters per minute */
  cpm: number;
  /** Pause analysis */
  pauses: PauseAnalysis;
  /** Burst analysis */
  bursts: BurstAnalysis;
  /** Cognitive load indicator (0-1, higher = more load) */
  cognitiveLoad: number;
  /** Fluency score (0-1, higher = more fluent) */
  fluencyScore: number;
}

/**
 * Aggregated pause statistics
 */
export interface PauseAnalysis {
  /** Total number of pauses */
  totalPauses: number;
  /** Distribution by pause type */
  distribution: Record<PauseType, number>;
  /** Average pause duration */
  avgPauseDuration: number;
  /** Longest pause duration */
  maxPause: number;
  /** Pauses at word boundaries */
  wordBoundaryPauses: number;
  /** Pauses at sentence boundaries */
  sentenceBoundaryPauses: number;
}

/**
 * Aggregated burst statistics
 */
export interface BurstAnalysis {
  /** Total number of bursts */
  totalBursts: number;
  /** Average burst length (characters) */
  avgBurstLength: number;
  /** Percentage of text written in bursts */
  burstCoverage: number;
  /** Average IKI within bursts */
  avgBurstIKI: number;
}

/**
 * Pause threshold constants (ms)
 */
const PAUSE_THRESHOLDS = {
  PHYSICAL: 200, // Below this = motor execution
  LEXICAL: 500, // Word-level retrieval
  COGNITIVE: 2000, // Sentence planning
  REFLECTIVE: 5000, // Deep thinking
  // Above REFLECTIVE = stuck
};

/**
 * Burst detection threshold (ms)
 */
const BURST_IKI_THRESHOLD = 150; // Consecutive keys faster than this = burst
const MIN_BURST_LENGTH = 4; // Minimum keys for a burst

/**
 * Classify a pause by duration
 */
export function classifyPause(durationMs: number): PauseType {
  if (durationMs < PAUSE_THRESHOLDS.PHYSICAL) return 'physical';
  if (durationMs < PAUSE_THRESHOLDS.LEXICAL) return 'lexical';
  if (durationMs < PAUSE_THRESHOLDS.COGNITIVE) return 'cognitive';
  if (durationMs < PAUSE_THRESHOLDS.REFLECTIVE) return 'reflective';
  return 'stuck';
}

/**
 * Check if character is a word boundary
 */
function isWordBoundary(char: string): boolean {
  return /[\s.,!?;:-]/.test(char);
}

/**
 * Check if character is a sentence boundary
 */
function isSentenceBoundary(char: string): boolean {
  return /[.!?]/.test(char);
}

/**
 * Extract pauses from keystroke sequence
 */
export function extractPauses(events: KeystrokeEvent[]): PauseEvent[] {
  const pauses: PauseEvent[] = [];
  const keydowns = events.filter((e) => e.type === 'keydown' && !e.isDeletion);

  for (let i = 1; i < keydowns.length; i++) {
    const curr = keydowns[i];
    const prev = keydowns[i - 1];
    if (!curr || !prev) continue;

    const duration = curr.timestamp - prev.timestamp;

    // Only track significant pauses (> physical threshold)
    if (duration > PAUSE_THRESHOLDS.PHYSICAL) {
      pauses.push({
        durationMs: duration,
        type: classifyPause(duration),
        position: curr.position,
        atWordBoundary: isWordBoundary(prev.key),
        atSentenceBoundary: isSentenceBoundary(prev.key),
        prevKey: prev.key,
        timestamp: curr.timestamp,
      });
    }
  }

  return pauses;
}

/**
 * Extract burst segments from keystroke sequence
 */
export function extractBursts(events: KeystrokeEvent[]): BurstSegment[] {
  const bursts: BurstSegment[] = [];
  const keydowns = events.filter((e) => e.type === 'keydown' && !e.isDeletion);

  if (keydowns.length === 0) return bursts;
  const firstKey = keydowns[0];
  if (!firstKey) return bursts;

  let burstStart = 0;
  let burstContent = firstKey.key;
  let burstIKIs: number[] = [];

  for (let i = 1; i < keydowns.length; i++) {
    const curr = keydowns[i];
    const prev = keydowns[i - 1];
    if (!curr || !prev) continue;

    const iki = curr.timestamp - prev.timestamp;

    if (iki < BURST_IKI_THRESHOLD) {
      // Continue burst
      burstContent += curr.key;
      burstIKIs.push(iki);
    } else {
      // End of burst - save if long enough
      const burstStartKey = keydowns[burstStart];
      const prevKey = keydowns[i - 1];
      if (burstContent.length >= MIN_BURST_LENGTH && burstStartKey && prevKey) {
        bursts.push({
          startPosition: burstStartKey.position,
          endPosition: prevKey.position,
          length: burstContent.length,
          avgIKI:
            burstIKIs.length > 0 ? burstIKIs.reduce((a, b) => a + b, 0) / burstIKIs.length : 0,
          content: burstContent,
          startTimestamp: burstStartKey.timestamp,
        });
      }
      // Start new potential burst
      burstStart = i;
      burstContent = curr.key;
      burstIKIs = [];
    }
  }

  // Check final burst
  const burstStartKey = keydowns[burstStart];
  const lastKey = keydowns[keydowns.length - 1];
  if (burstContent.length >= MIN_BURST_LENGTH && burstStartKey && lastKey) {
    bursts.push({
      startPosition: burstStartKey.position,
      endPosition: lastKey.position,
      length: burstContent.length,
      avgIKI: burstIKIs.length > 0 ? burstIKIs.reduce((a, b) => a + b, 0) / burstIKIs.length : 0,
      content: burstContent,
      startTimestamp: burstStartKey.timestamp,
    });
  }

  return bursts;
}

/**
 * Calculate IKI statistics
 */
function calculateIKIStats(events: KeystrokeEvent[]): { avg: number; stdDev: number; cv: number } {
  const keydowns = events.filter((e) => e.type === 'keydown' && !e.isDeletion);
  const ikis: number[] = [];

  for (let i = 1; i < keydowns.length; i++) {
    const curr = keydowns[i];
    const prev = keydowns[i - 1];
    if (curr && prev) {
      ikis.push(curr.timestamp - prev.timestamp);
    }
  }

  if (ikis.length === 0) return { avg: 0, stdDev: 0, cv: 0 };

  const avg = ikis.reduce((a, b) => a + b, 0) / ikis.length;
  const variance = ikis.reduce((sum, iki) => sum + Math.pow(iki - avg, 2), 0) / ikis.length;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? stdDev / avg : 0;

  return { avg, stdDev, cv };
}

/**
 * Classify overall typing rhythm
 */
function classifyRhythm(analysis: Omit<TypingAnalysis, 'rhythm' | 'confidence'>): {
  rhythm: TypingRhythm;
  confidence: number;
} {
  const { deletionRatio, ikiCV, pauses, fluencyScore } = analysis;

  // Rushed: Too fast (very low IKI) or copying pattern
  if (analysis.avgIKI < 80 && deletionRatio < 0.05) {
    return { rhythm: 'rushed', confidence: 0.75 };
  }

  // Fragmented: High deletion ratio
  if (deletionRatio > 0.3) {
    return { rhythm: 'fragmented', confidence: 0.8 };
  }

  // Hesitant: Many cognitive/reflective pauses
  const hesitantPauses =
    pauses.distribution.cognitive + pauses.distribution.reflective + pauses.distribution.stuck;
  if (hesitantPauses > pauses.totalPauses * 0.3) {
    return { rhythm: 'hesitant', confidence: 0.7 };
  }

  // Fluent: Low CV, good fluency score
  if (ikiCV < 0.6 && fluencyScore > 0.7) {
    return { rhythm: 'fluent', confidence: 0.8 };
  }

  // Deliberate: Moderate pacing
  return { rhythm: 'deliberate', confidence: 0.65 };
}

/**
 * Calculate cognitive load from typing patterns
 */
function calculateCognitiveLoad(
  pauses: PauseAnalysis,
  deletionRatio: number,
  ikiCV: number
): number {
  // Weight factors for cognitive load
  const pauseWeight = 0.4;
  const deletionWeight = 0.3;
  const variabilityWeight = 0.3;

  // Normalize pause score (more cognitive/reflective pauses = higher load)
  const cognitivePauses =
    pauses.distribution.cognitive + pauses.distribution.reflective + pauses.distribution.stuck;
  const pauseScore = Math.min(1, cognitivePauses / Math.max(1, pauses.totalPauses));

  // Deletion score (capped at 1)
  const deletionScore = Math.min(1, deletionRatio * 3);

  // Variability score
  const variabilityScore = Math.min(1, ikiCV);

  return (
    pauseWeight * pauseScore + deletionWeight * deletionScore + variabilityWeight * variabilityScore
  );
}

/**
 * Calculate fluency score
 */
function calculateFluencyScore(
  avgIKI: number,
  ikiCV: number,
  deletionRatio: number,
  burstCoverage: number
): number {
  // Optimal typing is around 150-250ms IKI
  const ikiScore = avgIKI > 100 && avgIKI < 300 ? 1 - Math.abs(avgIKI - 175) / 175 : 0.5;

  // Low CV = consistent = fluent
  const consistencyScore = Math.max(0, 1 - ikiCV);

  // Low deletion ratio = fluent
  const deletionScore = Math.max(0, 1 - deletionRatio * 2);

  // High burst coverage = automatic typing = fluent
  const burstScore = burstCoverage;

  return 0.25 * ikiScore + 0.3 * consistencyScore + 0.25 * deletionScore + 0.2 * burstScore;
}

/**
 * Analyze a complete typing session
 */
export function analyzeTypingSession(events: KeystrokeEvent[]): TypingAnalysis {
  if (events.length < 2) {
    return createEmptyAnalysis();
  }

  const keydowns = events.filter((e) => e.type === 'keydown');
  const deletions = keydowns.filter((e) => e.isDeletion);
  const productions = keydowns.filter((e) => !e.isDeletion);

  // Basic stats
  const totalKeystrokes = keydowns.length;
  const deletionRatio = deletions.length / totalKeystrokes;
  const finalLength = productions.length - deletions.length; // Simplified

  // Calculate session duration
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const sessionDuration = firstEvent && lastEvent ? lastEvent.timestamp - firstEvent.timestamp : 0;
  const cpm = sessionDuration > 0 ? (productions.length / sessionDuration) * 60000 : 0;

  // IKI statistics
  const ikiStats = calculateIKIStats(
    productions.length > 1 ? productions.map((p, i) => events.find((e) => e === p)!) : events
  );

  // Extract pauses
  const pauseEvents = extractPauses(events);
  const pauseDistribution: Record<PauseType, number> = {
    physical: 0,
    lexical: 0,
    cognitive: 0,
    reflective: 0,
    stuck: 0,
  };
  pauseEvents.forEach((p) => pauseDistribution[p.type]++);

  const pauses: PauseAnalysis = {
    totalPauses: pauseEvents.length,
    distribution: pauseDistribution,
    avgPauseDuration:
      pauseEvents.length > 0
        ? pauseEvents.reduce((s, p) => s + p.durationMs, 0) / pauseEvents.length
        : 0,
    maxPause: pauseEvents.length > 0 ? Math.max(...pauseEvents.map((p) => p.durationMs)) : 0,
    wordBoundaryPauses: pauseEvents.filter((p) => p.atWordBoundary).length,
    sentenceBoundaryPauses: pauseEvents.filter((p) => p.atSentenceBoundary).length,
  };

  // Extract bursts
  const burstSegments = extractBursts(events);
  const totalBurstChars = burstSegments.reduce((s, b) => s + b.length, 0);
  const bursts: BurstAnalysis = {
    totalBursts: burstSegments.length,
    avgBurstLength: burstSegments.length > 0 ? totalBurstChars / burstSegments.length : 0,
    burstCoverage: productions.length > 0 ? totalBurstChars / productions.length : 0,
    avgBurstIKI:
      burstSegments.length > 0
        ? burstSegments.reduce((s, b) => s + b.avgIKI, 0) / burstSegments.length
        : 0,
  };

  // Derived scores
  const fluencyScore = calculateFluencyScore(
    ikiStats.avg,
    ikiStats.cv,
    deletionRatio,
    bursts.burstCoverage
  );
  const cognitiveLoad = calculateCognitiveLoad(pauses, deletionRatio, ikiStats.cv);

  // Partial analysis for rhythm classification
  const partialAnalysis = {
    totalKeystrokes,
    finalLength,
    deletionRatio,
    avgIKI: ikiStats.avg,
    ikiStdDev: ikiStats.stdDev,
    ikiCV: ikiStats.cv,
    cpm,
    pauses,
    bursts,
    cognitiveLoad,
    fluencyScore,
  };

  const { rhythm, confidence } = classifyRhythm(partialAnalysis);

  return {
    ...partialAnalysis,
    rhythm,
    confidence,
  };
}

/**
 * Create empty analysis for insufficient data
 */
function createEmptyAnalysis(): TypingAnalysis {
  return {
    rhythm: 'deliberate',
    confidence: 0,
    totalKeystrokes: 0,
    finalLength: 0,
    deletionRatio: 0,
    avgIKI: 0,
    ikiStdDev: 0,
    ikiCV: 0,
    cpm: 0,
    pauses: {
      totalPauses: 0,
      distribution: { physical: 0, lexical: 0, cognitive: 0, reflective: 0, stuck: 0 },
      avgPauseDuration: 0,
      maxPause: 0,
      wordBoundaryPauses: 0,
      sentenceBoundaryPauses: 0,
    },
    bursts: {
      totalBursts: 0,
      avgBurstLength: 0,
      burstCoverage: 0,
      avgBurstIKI: 0,
    },
    cognitiveLoad: 0.5,
    fluencyScore: 0.5,
  };
}

/**
 * Serialize analysis for storage
 */
export function serializeTypingAnalysis(analysis: TypingAnalysis): Record<string, unknown> {
  return {
    rhythm: analysis.rhythm,
    confidence: Math.round(analysis.confidence * 100) / 100,
    cpm: Math.round(analysis.cpm),
    deletionRatio: Math.round(analysis.deletionRatio * 100) / 100,
    cognitiveLoad: Math.round(analysis.cognitiveLoad * 100) / 100,
    fluencyScore: Math.round(analysis.fluencyScore * 100) / 100,
    pauseCount: analysis.pauses.totalPauses,
    burstCoverage: Math.round(analysis.bursts.burstCoverage * 100) / 100,
  };
}

export default {
  classifyPause,
  extractPauses,
  extractBursts,
  analyzeTypingSession,
  serializeTypingAnalysis,
};
