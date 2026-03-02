/**
 * OSCE Implicit Metrics Engine
 * 
 * Extended telemetry for OSCE simulations:
 * - Speech patterns (hesitation, speech rate, filler words)
 * - Diagnostic ordering (sequence of exam maneuvers)
 * - Time to diagnosis
 * - Accuracy of physical exam findings
 * - Rapport-building behaviors (empathy statements, patient education)
 * 
 * Derives a continuous implicit rating (1.0-4.0) from multimodal interaction data.
 * Follows the same pattern as lib/implicit-metrics.ts but specialized for OSCE.
 */

import { Rating } from './fsrs';

/**
 * Speech pattern metrics derived from transcript and timing data
 */
export interface SpeechMetrics {
  /** Words per minute (speech rate) */
  wordsPerMinute: number;
  /** Average pause length between utterances (ms) */
  averagePauseMs: number;
  /** Number of filler words per 100 words */
  fillerWordsPer100: number;
  /** Ratio of hesitation markers (e.g., "um", "uh") to total words */
  hesitationRatio: number;
  /** Total speech time (ms) */
  speechDurationMs: number;
  /** Speech fluency score (0-1, higher is more fluent) */
  fluencyScore: number;
}

/**
 * Diagnostic efficiency metrics based on sequence of actions
 */
export interface DiagnosticEfficiency {
  /** Number of correct actions taken */
  correctActions: number;
  /** Number of unnecessary/incorrect actions */
  unnecessaryActions: number;
  /** Time from start to correct diagnosis (ms) */
  timeToDiagnosisMs: number;
  /** Optimal time benchmark (ms) */
  optimalTimeMs: number;
  /** Sequence similarity to ideal pathway (0-1) */
  pathwaySimilarity: number;
  /** Number of red flags missed */
  redFlagsMissed: number;
  /** Number of critical actions performed */
  criticalActionsPerformed: number;
}

/**
 * Rapport-building behaviors captured during OSCE
 */
export interface RapportMetrics {
  /** Number of empathy statements */
  empathyStatements: number;
  /** Number of patient education statements */
  educationStatements: number;
  /** Number of open-ended questions */
  openEndedQuestions: number;
  /** Number of closed-ended questions */
  closedEndedQuestions: number;
  /** Ratio of patient-centered vs clinician-centered speech */
  patientCenteredRatio: number;
  /** Whether the candidate introduced themselves */
  introducedSelf: boolean;
  /** Whether the candidate asked for patient's perspective */
  askedForPerspective: boolean;
}

/**
 * Comprehensive OSCE telemetry combining all implicit signals
 */
export interface OSCETelemetry {
  /** Speech pattern analysis (if speech transcription available) */
  speech?: SpeechMetrics;
  /** Diagnostic efficiency metrics */
  diagnosticEfficiency: DiagnosticEfficiency;
  /** Rapport-building metrics */
  rapport?: RapportMetrics;
  /** Overall time spent on the encounter (ms) */
  totalTimeMs: number;
  /** Whether the diagnosis was correct */
  diagnosisCorrect: boolean;
  /** Clinical confidence index (1.0-4.0) derived from explicit scoring */
  clinicalConfidenceIndex?: number;
  /** Actions logged during the encounter */
  actions: Array<{
    type: 'order' | 'exam' | 'diagnosis' | 'treatment' | 'communication';
    action: string;
    timestamp: number;
    timeFromStart: number;
    isCorrect?: boolean;
    isRedFlag?: boolean;
  }>;
}

/**
 * Efficiency score combining diagnostic accuracy and time
 */
export interface EfficiencyScore {
  /** Overall efficiency score (0-1) */
  score: number;
  /** Breakdown by category */
  breakdown: {
    accuracy: number;
    timeEfficiency: number;
    pathwayAdherence: number;
    rapport: number;
  };
}

/**
 * Result of OSCE implicit rating derivation
 */
export interface OSCEImplicitRating {
  /** Continuous rating (1.0-4.0) similar to FSRS grade */
  continuousRating: number;
  /** Discrete FSRS rating (Again=1, Easy=4) */
  discreteRating: Rating;
  /** Confidence in derived rating (0-1) */
  confidence: number;
  /** Component scores that contributed to rating */
  componentScores: {
    speech: number;
    diagnosticEfficiency: number;
    rapport: number;
    timeEfficiency: number;
  };
}

/**
 * Analyze speech patterns from transcript and timing data.
 * 
 * @param transcript Full text of speech (words separated by spaces)
 * @param timing Array of timestamps (ms) for each word start
 * @returns SpeechMetrics
 */
export function analyzeOSCESpeechPatterns(
  transcript: string,
  timing: number[]
): SpeechMetrics {
  const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // If no words, return default metrics
  if (wordCount === 0 || timing.length === 0) {
    return {
      wordsPerMinute: 0,
      averagePauseMs: 0,
      fillerWordsPer100: 0,
      hesitationRatio: 0,
      speechDurationMs: 0,
      fluencyScore: 0,
    };
  }

  // Calculate speech duration
  const speechDurationMs = Math.max(...timing) - Math.min(...timing);
  
  // Words per minute
  const wordsPerMinute = speechDurationMs > 0 ? (wordCount / (speechDurationMs / 60000)) : 0;
  
  // Average pause between words (gaps)
  let totalPause = 0;
  let pauseCount = 0;
  for (let i = 1; i < timing.length; i++) {
    const gap = timing[i]! - timing[i - 1]!;
    // Assume a gap > 50ms is a pause (ignore tiny gaps)
    if (gap > 50) {
      totalPause += gap;
      pauseCount++;
    }
  }
  const averagePauseMs = pauseCount > 0 ? totalPause / pauseCount : 0;
  
  // Count filler words (simplistic; could be enhanced with NLP)
  const fillerWords = ['um', 'uh', 'er', 'ah', 'like', 'you know', 'well'];
  let fillerCount = 0;
  for (const word of words) {
    if (fillerWords.includes(word.toLowerCase())) {
      fillerCount++;
    }
  }
  const fillerWordsPer100 = wordCount > 0 ? (fillerCount / wordCount) * 100 : 0;
  
  // Hesitation ratio: filler words plus long pauses
  const hesitationRatio = fillerCount / Math.max(wordCount, 1);
  
  // Fluency score: higher speech rate, lower pauses, fewer fillers → higher score
  const rateScore = Math.min(wordsPerMinute / 200, 1); // normalize to 200 wpm max
  const pauseScore = averagePauseMs < 500 ? 1 : Math.max(0, 1 - (averagePauseMs - 500) / 2000);
  const fillerScore = Math.max(0, 1 - fillerWordsPer100 / 20); // 20 fillers per 100 words max
  const fluencyScore = (rateScore + pauseScore + fillerScore) / 3;
  
  return {
    wordsPerMinute,
    averagePauseMs,
    fillerWordsPer100,
    hesitationRatio,
    speechDurationMs,
    fluencyScore,
  };
}

/**
 * Calculate diagnostic efficiency based on action sequence.
 * 
 * @param actions Array of OSCE actions logged during encounter
 * @param correctSequence Reference sequence of ideal actions (optional)
 * @returns DiagnosticEfficiency
 */
export function calculateDiagnosticEfficiency(
  actions: Array<{
    type: string;
    action: string;
    timestamp: number;
    isCorrect?: boolean;
    isRedFlag?: boolean;
  }>,
  correctSequence?: Array<{ type: string; action: string }>
): DiagnosticEfficiency {
  const correctActions = actions.filter(a => a.isCorrect === true).length;
  const unnecessaryActions = actions.filter(a => a.isCorrect === false).length;
  const redFlagsMissed = actions.filter(a => a.isRedFlag === false).length;
  const criticalActionsPerformed = actions.filter(a => a.isCorrect === true && a.type === 'exam').length;
  
  // Determine time to diagnosis: find first action of type 'diagnosis' that is correct
  let timeToDiagnosisMs = 0;
  const diagnosisAction = actions.find(a => a.type === 'diagnosis' && a.isCorrect === true);
  if (diagnosisAction) {
    timeToDiagnosisMs = diagnosisAction.timestamp;
  }
  
  // Pathway similarity (if correctSequence provided)
  let pathwaySimilarity = 0;
  if (correctSequence && actions.length > 0) {
    // Simple Jaccard similarity based on action types
    const idealTypes = new Set(correctSequence.map(a => a.type));
    const actualTypes = new Set(actions.map(a => a.type));
    const intersection = new Set(Array.from(idealTypes).filter(t => actualTypes.has(t)));
    const union = new Set(Array.from(idealTypes).concat(Array.from(actualTypes)));
    pathwaySimilarity = union.size > 0 ? intersection.size / union.size : 0;
  }
  
  // Optimal time benchmark: median time of correct diagnosis across cohort (placeholder)
  const optimalTimeMs = 300000; // 5 minutes default
  
  return {
    correctActions,
    unnecessaryActions,
    timeToDiagnosisMs,
    optimalTimeMs,
    pathwaySimilarity,
    redFlagsMissed,
    criticalActionsPerformed,
  };
}

/**
 * Derive a continuous implicit rating (1.0-4.0) from OSCE telemetry.
 * 
 * Baseline algorithm:
 * - Base rating 3.0 for correct diagnosis
 * - Penalties for inefficiencies, missed red flags, poor rapport
 * - Bonuses for fast diagnosis, excellent rapport, fluency
 * - Clamp to [1.0, 4.0]
 * 
 * @param telemetry OSCE telemetry data
 * @returns OSCEImplicitRating
 */
export function deriveOSCEImplicitRating(telemetry: OSCETelemetry): OSCEImplicitRating {
  const base = telemetry.diagnosisCorrect ? 3.0 : 1.0;
  let grade = base;
  
  // If diagnosis incorrect, rating is 1.0 (Again) with low confidence
  if (!telemetry.diagnosisCorrect) {
    return {
      continuousRating: 1.0,
      discreteRating: Rating.Again,
      confidence: 0.9,
      componentScores: {
        speech: 0,
        diagnosticEfficiency: 0,
        rapport: 0,
        timeEfficiency: 0,
      },
    };
  }
  
  // Component scores (0-1 scale)
  const speechScore = telemetry.speech?.fluencyScore ?? 0.5;
  const rapportScore = telemetry.rapport ? calculateRapportScore(telemetry.rapport) : 0.5;
  
  // Diagnostic efficiency score
  const diag = telemetry.diagnosticEfficiency;
  const accuracyScore = diag.correctActions / Math.max(diag.correctActions + diag.unnecessaryActions, 1);
  const timeScore = diag.timeToDiagnosisMs > 0 
    ? Math.min(diag.optimalTimeMs / diag.timeToDiagnosisMs, 2) // up to 2x faster than optimal
    : 0.5;
  const pathwayScore = diag.pathwaySimilarity;
  const redFlagPenalty = diag.redFlagsMissed * 0.1;
  
  const diagnosticEfficiencyScore = (accuracyScore * 0.4 + timeScore * 0.3 + pathwayScore * 0.3) - redFlagPenalty;
  
  // Time efficiency score (normalized)
  const timeEfficiencyScore = Math.min(1, diag.optimalTimeMs / Math.max(diag.timeToDiagnosisMs, 1));
  
  // Compute grade adjustments
  const speechAdjustment = (speechScore - 0.5) * 0.5; // ±0.25
  const rapportAdjustment = (rapportScore - 0.5) * 0.5;
  const diagnosticAdjustment = (diagnosticEfficiencyScore - 0.5) * 1.0; // ±0.5
  const timeAdjustment = (timeEfficiencyScore - 0.5) * 0.5;
  
  grade += speechAdjustment + rapportAdjustment + diagnosticAdjustment + timeAdjustment;
  
  // Clamp to FSRS range
  grade = Math.max(1.0, Math.min(4.0, grade));
  
  // Discrete rating mapping
  let discreteRating: Rating;
  if (grade < 1.5) discreteRating = Rating.Again;
  else if (grade < 2.5) discreteRating = Rating.Hard;
  else if (grade < 3.5) discreteRating = Rating.Good;
  else discreteRating = Rating.Easy;
  
  // Confidence calculation
  let confidence = 0.7;
  // Higher confidence if we have speech and rapport data
  if (telemetry.speech && telemetry.rapport) confidence += 0.1;
  // Lower confidence if missing critical data
  if (!telemetry.speech || !telemetry.rapport) confidence -= 0.1;
  confidence = Math.max(0.5, Math.min(0.95, confidence));
  
  return {
    continuousRating: grade,
    discreteRating,
    confidence,
    componentScores: {
      speech: speechScore,
      diagnosticEfficiency: diagnosticEfficiencyScore,
      rapport: rapportScore,
      timeEfficiency: timeEfficiencyScore,
    },
  };
}

/**
 * Helper to calculate a rapport score from rapport metrics.
 */
function calculateRapportScore(rapport: RapportMetrics): number {
  let score = 0;
  // Empathy statements
  score += Math.min(rapport.empathyStatements, 5) * 0.05; // max 0.25
  // Education statements
  score += Math.min(rapport.educationStatements, 5) * 0.05; // max 0.25
  // Open-ended questions
  score += Math.min(rapport.openEndedQuestions, 5) * 0.04; // max 0.2
  // Patient-centered ratio
  score += rapport.patientCenteredRatio * 0.2; // up to 0.2
  // Introduced self
  if (rapport.introducedSelf) score += 0.05;
  // Asked for perspective
  if (rapport.askedForPerspective) score += 0.05;
  return Math.min(score, 1.0);
}

/**
 * Compute an overall efficiency score combining diagnostic accuracy and time.
 * 
 * @param telemetry OSCE telemetry
 * @returns EfficiencyScore
 */
export function calculateOSCEEfficiencyScore(telemetry: OSCETelemetry): EfficiencyScore {
  const diag = telemetry.diagnosticEfficiency;
  const accuracy = diag.correctActions / Math.max(diag.correctActions + diag.unnecessaryActions, 1);
  const timeEfficiency = diag.timeToDiagnosisMs > 0
    ? Math.min(diag.optimalTimeMs / diag.timeToDiagnosisMs, 2) / 2 // normalize to 0-1
    : 0.5;
  const pathwayAdherence = diag.pathwaySimilarity;
  const rapport = telemetry.rapport ? calculateRapportScore(telemetry.rapport) : 0.5;
  
  const overall = accuracy * 0.4 + timeEfficiency * 0.3 + pathwayAdherence * 0.2 + rapport * 0.1;
  
  return {
    score: overall,
    breakdown: {
      accuracy,
      timeEfficiency,
      pathwayAdherence,
      rapport,
    },
  };
}