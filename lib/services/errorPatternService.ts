/**
 * Error Pattern Classification Service
 *
 * Classifies incorrect answers by cognitive bias pattern using existing
 * telemetry data (timeToFirstClick, answerSwitches, commitmentGapMs,
 * confusion pairs). Identifies systematic reasoning errors that a learner
 * can target for improvement.
 *
 * Cognitive bias patterns:
 *   - ANCHORING: locked onto first impression, ignored contradicting info
 *   - PREMATURE_CLOSURE: stopped reasoning too early in the vignette
 *   - AVAILABILITY_BIAS: chose recently-seen condition over more likely one
 *   - CONFIRMATION_BIAS: consistently wrong on DDx where conditions share features
 *   - REPRESENTATIVENESS: over-matched to "textbook" presentation
 *   - RAPID_GUESS: answered too fast to have read the vignette
 *
 * Research basis:
 *   - Croskerry (2003): Cognitive forcing strategies in clinical decision making
 *   - Norman & Eva (2010): Diagnostic error and clinical reasoning
 *   - Tversky & Kahneman (1974): Judgment under uncertainty
 *
 * Architecture:
 *   Pure classification — operates on individual attempt telemetry.
 *   No database access; caller provides attempt records.
 *
 * Sprint 23 — Error pattern classification
 * @module lib/services/errorPatternService
 */

// ─── Types ──────────────────────────────────────────────────────────────

/** Telemetry from a single incorrect attempt */
export interface IncorrectAttemptTelemetry {
  /** Question identifier */
  questionId: string;
  /** System (organ system) */
  system: string;
  /** Condition tested */
  conditionTested: string;
  /** Condition the student's answer pointed to (if identifiable) */
  selectedCondition: string | null;
  /** Time from question display to first option click (ms) */
  timeToFirstClickMs: number;
  /** Total dwell time on question (ms) */
  totalDwellTimeMs: number;
  /** Number of times the student changed their answer */
  answerSwitches: number;
  /** Gap between first click and final submission (ms) */
  commitmentGapMs: number;
  /** Whether the student viewed the hint */
  hintViewed: boolean;
  /** Par time for this question type (ms) */
  parTimeMs: number;
  /** Whether this condition was reviewed in the last 24h */
  selectedConditionRecentlySeen: boolean;
  /** Confusion pair: conditions often confused with each other */
  isConfusionPair: boolean;
  /** Whether the student's first click was on the correct answer */
  firstClickWasCorrect: boolean;
  /** Vignette length in characters (proxy for complexity) */
  vignetteLengthChars: number;
  /** Position in session (0-indexed) */
  sessionPosition: number;
  /** Total questions in session */
  sessionLength: number;
}

/** Classified error pattern */
export interface ErrorPattern {
  /** The primary pattern identified */
  pattern: ErrorPatternType;
  /** Confidence in the classification (0-1) */
  confidence: number;
  /** Evidence signals that support this classification */
  evidence: string[];
  /** Targeted remediation suggestion */
  remediation: string;
}

export type ErrorPatternType =
  | 'ANCHORING'
  | 'PREMATURE_CLOSURE'
  | 'AVAILABILITY_BIAS'
  | 'CONFIRMATION_BIAS'
  | 'REPRESENTATIVENESS'
  | 'RAPID_GUESS'
  | 'FATIGUE'
  | 'UNKNOWN';

/** Aggregate pattern analysis across multiple attempts */
export interface PatternProfile {
  /** Total incorrect attempts analyzed */
  totalAnalyzed: number;
  /** Count per pattern */
  patternCounts: Record<ErrorPatternType, number>;
  /** Most frequent pattern */
  dominantPattern: ErrorPatternType | null;
  /** Top 3 patterns with relative frequency */
  topPatterns: { pattern: ErrorPatternType; count: number; frequency: number }[];
  /** System-level breakdown: which systems trigger which patterns */
  systemPatterns: Record<string, ErrorPatternType[]>;
  /** Remediations in priority order */
  remediations: { pattern: ErrorPatternType; remediation: string; frequency: number }[];
}

// ─── Constants ──────────────────────────────────────────────────────────

/** Thresholds for pattern detection */
const THRESHOLDS = {
  /** Time ratio below which the answer is considered a rapid guess */
  RAPID_GUESS_RATIO: 0.25,
  /** First click very fast + no switches = anchoring signal */
  ANCHORING_FIRST_CLICK_RATIO: 0.3,
  /** Commitment gap below this (ms) = premature closure risk */
  PREMATURE_CLOSURE_GAP_MS: 2000,
  /** Session position ratio above which fatigue is suspected */
  FATIGUE_POSITION_RATIO: 0.75,
  /** Answer switches threshold for premature closure pattern */
  PREMATURE_CLOSURE_SWITCHES: 0,
  /** Min confidence to report a pattern */
  MIN_CONFIDENCE: 0.3,
} as const;

// ─── Single Attempt Classification ──────────────────────────────────────

/**
 * Classify the error pattern for a single incorrect attempt.
 * Returns the most likely pattern with confidence and evidence.
 */
export function classifyErrorPattern(
  attempt: IncorrectAttemptTelemetry
): ErrorPattern {
  const candidates: ErrorPattern[] = [];

  // ── 1. RAPID_GUESS ────────────────────────────────────────────────
  const timeRatio = attempt.totalDwellTimeMs / Math.max(attempt.parTimeMs, 1);
  if (timeRatio < THRESHOLDS.RAPID_GUESS_RATIO) {
    candidates.push({
      pattern: 'RAPID_GUESS',
      confidence: Math.min(1, 0.5 + 0.5 * ((THRESHOLDS.RAPID_GUESS_RATIO - timeRatio) / THRESHOLDS.RAPID_GUESS_RATIO)),
      evidence: [
        `Dwell time ${Math.round(attempt.totalDwellTimeMs)}ms vs par ${Math.round(attempt.parTimeMs)}ms (${Math.round(timeRatio * 100)}% of par)`,
      ],
      remediation: 'Slow down. Read the entire vignette before looking at answer choices. Cover the options and predict the answer first.',
    });
  }

  // ── 2. ANCHORING ──────────────────────────────────────────────────
  const firstClickRatio = attempt.timeToFirstClickMs / Math.max(attempt.parTimeMs, 1);
  if (
    firstClickRatio < THRESHOLDS.ANCHORING_FIRST_CLICK_RATIO &&
    attempt.answerSwitches === 0 &&
    !attempt.firstClickWasCorrect
  ) {
    candidates.push({
      pattern: 'ANCHORING',
      confidence: 0.6 + (THRESHOLDS.ANCHORING_FIRST_CLICK_RATIO - firstClickRatio) * 0.5,
      evidence: [
        `First click at ${Math.round(attempt.timeToFirstClickMs)}ms (${Math.round(firstClickRatio * 100)}% of par)`,
        'No answer switches — stuck on initial impression',
        'First click was incorrect',
      ],
      remediation: 'Practice "consider the opposite." After your first impression, actively look for evidence against it before committing.',
    });
  }

  // ── 3. PREMATURE_CLOSURE ──────────────────────────────────────────
  if (
    attempt.firstClickWasCorrect &&
    attempt.answerSwitches > 0 &&
    attempt.commitmentGapMs < THRESHOLDS.PREMATURE_CLOSURE_GAP_MS
  ) {
    candidates.push({
      pattern: 'PREMATURE_CLOSURE',
      confidence: 0.7,
      evidence: [
        'First click was correct, then changed answer',
        `Commitment gap only ${Math.round(attempt.commitmentGapMs)}ms`,
        `${attempt.answerSwitches} answer switch(es)`,
      ],
      remediation: 'Trust your first instinct more. When you feel compelled to switch, re-read the vignette. Your initial reasoning was correct here.',
    });
  }

  // ── 4. AVAILABILITY_BIAS ──────────────────────────────────────────
  if (attempt.selectedConditionRecentlySeen && attempt.selectedCondition !== attempt.conditionTested) {
    candidates.push({
      pattern: 'AVAILABILITY_BIAS',
      confidence: 0.65,
      evidence: [
        `Selected condition "${attempt.selectedCondition}" was reviewed recently`,
        `Correct answer was "${attempt.conditionTested}" — a different condition`,
      ],
      remediation: 'Be aware of recency effects. The condition you just studied isn\'t always the answer. Consider base rates and full differential.',
    });
  }

  // ── 5. CONFIRMATION_BIAS ──────────────────────────────────────────
  if (attempt.isConfusionPair) {
    const conf = 0.6 + (attempt.answerSwitches > 0 ? 0.1 : 0);
    candidates.push({
      pattern: 'CONFIRMATION_BIAS',
      confidence: conf,
      evidence: [
        `"${attempt.conditionTested}" and "${attempt.selectedCondition}" are a known confusion pair`,
        'Shared clinical features may have led to selective attention',
      ],
      remediation: 'For conditions that look alike, build a comparison table of distinguishing features. Focus on what\'s DIFFERENT, not what\'s shared.',
    });
  }

  // ── 6. FATIGUE ────────────────────────────────────────────────────
  const positionRatio = attempt.sessionLength > 0
    ? attempt.sessionPosition / attempt.sessionLength
    : 0;
  if (positionRatio >= THRESHOLDS.FATIGUE_POSITION_RATIO && timeRatio < 0.6) {
    candidates.push({
      pattern: 'FATIGUE',
      confidence: 0.5 + (positionRatio - THRESHOLDS.FATIGUE_POSITION_RATIO) * 1.5,
      evidence: [
        `Question ${attempt.sessionPosition + 1}/${attempt.sessionLength} (${Math.round(positionRatio * 100)}% through session)`,
        `Dwell time only ${Math.round(timeRatio * 100)}% of par — rushing late in session`,
      ],
      remediation: 'Consider shorter sessions. Performance drops after 75% of your session. Take a break or end the session earlier.',
    });
  }

  // ── Select best candidate ─────────────────────────────────────────
  if (candidates.length === 0) {
    return {
      pattern: 'UNKNOWN',
      confidence: 0.3,
      evidence: ['No strong signal for a specific cognitive bias pattern'],
      remediation: 'Review this question carefully. Consider what led to the incorrect reasoning.',
    };
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0]!;
  // Clamp confidence
  best.confidence = Math.min(1, best.confidence);
  return best;
}

// ─── Batch Analysis ─────────────────────────────────────────────────────

/**
 * Analyze a batch of incorrect attempts and produce a pattern profile.
 */
export function buildPatternProfile(
  attempts: IncorrectAttemptTelemetry[]
): PatternProfile {
  const patterns: ErrorPattern[] = attempts.map(classifyErrorPattern);

  // Count per pattern
  const patternCounts: Record<ErrorPatternType, number> = {
    ANCHORING: 0,
    PREMATURE_CLOSURE: 0,
    AVAILABILITY_BIAS: 0,
    CONFIRMATION_BIAS: 0,
    REPRESENTATIVENESS: 0,
    RAPID_GUESS: 0,
    FATIGUE: 0,
    UNKNOWN: 0,
  };
  for (const p of patterns) {
    patternCounts[p.pattern]++;
  }

  // Top patterns
  const topPatterns = Object.entries(patternCounts)
    .filter(([, count]) => count > 0)
    .map(([pattern, count]) => ({
      pattern: pattern as ErrorPatternType,
      count,
      frequency: attempts.length > 0 ? count / attempts.length : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Dominant pattern
  const dominantPattern = topPatterns.length > 0 ? topPatterns[0]!.pattern : null;

  // System-level breakdown
  const systemPatterns: Record<string, ErrorPatternType[]> = {};
  for (let i = 0; i < attempts.length; i++) {
    const system = attempts[i]!.system;
    if (!systemPatterns[system]) systemPatterns[system] = [];
    systemPatterns[system]!.push(patterns[i]!.pattern);
  }

  // Unique remediations by pattern frequency
  const remediationMap = new Map<ErrorPatternType, string>();
  for (const p of patterns) {
    if (!remediationMap.has(p.pattern)) {
      remediationMap.set(p.pattern, p.remediation);
    }
  }
  const remediations = topPatterns.map((tp) => ({
    pattern: tp.pattern,
    remediation: remediationMap.get(tp.pattern) ?? '',
    frequency: tp.frequency,
  }));

  return {
    totalAnalyzed: attempts.length,
    patternCounts,
    dominantPattern,
    topPatterns,
    systemPatterns,
    remediations,
  };
}
