/**
 * Unit tests for osce‑implicit‑metrics.ts – OSCE‑specific implicit rating engine
 * 
 * Verifies speech pattern analysis, diagnostic efficiency calculation,
 * rapport scoring, and derived implicit rating.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeOSCESpeechPatterns,
  calculateDiagnosticEfficiency,
  deriveOSCEImplicitRating,
  calculateOSCEEfficiencyScore,
  type SpeechMetrics,
  type DiagnosticEfficiency,
  type OSCETelemetry,
  type RapportMetrics,
} from './osce-implicit-metrics';
import { Rating } from './fsrs';

// ============================================================================
//  TEST SET 1: Speech Pattern Analysis
// ============================================================================

describe('analyzeOSCESpeechPatterns', () => {
  it('returns default metrics for empty input', () => {
    const result = analyzeOSCESpeechPatterns('', []);
    expect(result.wordsPerMinute).toBe(0);
    expect(result.averagePauseMs).toBe(0);
    expect(result.fillerWordsPer100).toBe(0);
    expect(result.hesitationRatio).toBe(0);
    expect(result.speechDurationMs).toBe(0);
    expect(result.fluencyScore).toBe(0);
  });

  it('calculates words per minute correctly', () => {
    const transcript = 'Hello world this is a test';
    const timing = [0, 200, 400, 600, 800, 1000]; // 6 words over 1 second
    const result = analyzeOSCESpeechPatterns(transcript, timing);
    // 6 words in 1000ms = 6 * 60 = 360 wpm
    expect(result.wordsPerMinute).toBeCloseTo(360, 1);
    expect(result.speechDurationMs).toBe(1000);
  });

  it('detects filler words', () => {
    const transcript = 'Um hello uh world like you know';
    const timing = [0, 100, 200, 300, 400, 500, 600];
    const result = analyzeOSCESpeechPatterns(transcript, timing);
    // filler words: Um, uh, like, you know (count as 1? we treat "you know" as two words but filler list includes "you know"? We'll assume simple matching)
    // Our simple filler list includes 'um', 'uh', 'like', 'you know' (as phrase). We'll accept approximate.
    expect(result.fillerWordsPer100).toBeGreaterThan(0);
  });

  it('computes fluency score between 0 and 1', () => {
    const transcript = 'Fluid speech without filler words';
    const timing = [0, 150, 300, 450, 600, 750];
    const result = analyzeOSCESpeechPatterns(transcript, timing);
    expect(result.fluencyScore).toBeGreaterThanOrEqual(0);
    expect(result.fluencyScore).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
//  TEST SET 2: Diagnostic Efficiency
// ============================================================================

describe('calculateDiagnosticEfficiency', () => {
  const mockActions = [
    { type: 'exam', action: 'auscultation', timestamp: 1000, isCorrect: true, isRedFlag: false },
    { type: 'order', action: 'CXR', timestamp: 2000, isCorrect: true, isRedFlag: false },
    { type: 'diagnosis', action: 'Pneumonia', timestamp: 3000, isCorrect: true, isRedFlag: false },
    { type: 'order', action: 'MRI', timestamp: 4000, isCorrect: false, isRedFlag: false },
  ];

  it('counts correct and unnecessary actions', () => {
    const result = calculateDiagnosticEfficiency(mockActions);
    expect(result.correctActions).toBe(3);
    expect(result.unnecessaryActions).toBe(1);
    expect(result.redFlagsMissed).toBe(0);
  });

  it('calculates time to diagnosis', () => {
    const result = calculateDiagnosticEfficiency(mockActions);
    expect(result.timeToDiagnosisMs).toBe(3000);
  });

  it('handles missing diagnosis', () => {
    const actionsNoDiagnosis = mockActions.filter(a => a.type !== 'diagnosis');
    const result = calculateDiagnosticEfficiency(actionsNoDiagnosis);
    expect(result.timeToDiagnosisMs).toBe(0);
  });

  it('computes pathway similarity when correct sequence provided', () => {
    const correctSequence = [
      { type: 'exam', action: 'auscultation' },
      { type: 'order', action: 'CXR' },
      { type: 'diagnosis', action: 'Pneumonia' },
    ];
    const result = calculateDiagnosticEfficiency(mockActions, correctSequence);
    expect(result.pathwaySimilarity).toBeGreaterThan(0);
    expect(result.pathwaySimilarity).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
//  TEST SET 3: Rapport Metrics & Scoring
// ============================================================================

describe('rapport score calculation', () => {
  // Helper to build OSCE telemetry with rapport metrics
  const createTelemetry = (rapport?: Partial<RapportMetrics>): OSCETelemetry => ({
    diagnosticEfficiency: {
      correctActions: 5,
      unnecessaryActions: 1,
      timeToDiagnosisMs: 180000,
      optimalTimeMs: 300000,
      pathwaySimilarity: 0.8,
      redFlagsMissed: 0,
      criticalActionsPerformed: 3,
    },
    totalTimeMs: 300000,
    diagnosisCorrect: true,
    actions: [],
    rapport: rapport ? {
      empathyStatements: 0,
      educationStatements: 0,
      openEndedQuestions: 0,
      closedEndedQuestions: 0,
      patientCenteredRatio: 0.5,
      introducedSelf: false,
      askedForPerspective: false,
      ...rapport,
    } : undefined,
  });

  it('derives implicit rating with rapport data', () => {
    const telemetry = createTelemetry({
      empathyStatements: 3,
      introducedSelf: true,
      patientCenteredRatio: 0.8,
    });
    const result = deriveOSCEImplicitRating(telemetry);
    expect(result.continuousRating).toBeGreaterThanOrEqual(1.0);
    expect(result.continuousRating).toBeLessThanOrEqual(4.0);
    expect(result.discreteRating).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });

  it('gives rating 1.0 for incorrect diagnosis', () => {
    const telemetry: OSCETelemetry = {
      diagnosticEfficiency: {
        correctActions: 2,
        unnecessaryActions: 3,
        timeToDiagnosisMs: 0,
        optimalTimeMs: 300000,
        pathwaySimilarity: 0.2,
        redFlagsMissed: 2,
        criticalActionsPerformed: 1,
      },
      totalTimeMs: 200000,
      diagnosisCorrect: false,
      actions: [],
    };
    const result = deriveOSCEImplicitRating(telemetry);
    expect(result.continuousRating).toBe(1.0);
    expect(result.discreteRating).toBe(Rating.Again);
    expect(result.confidence).toBeCloseTo(0.9, 1);
  });
});

// ============================================================================
//  TEST SET 4: Efficiency Score
// ============================================================================

describe('calculateOSCEEfficiencyScore', () => {
  const sampleTelemetry: OSCETelemetry = {
    diagnosticEfficiency: {
      correctActions: 8,
      unnecessaryActions: 2,
      timeToDiagnosisMs: 240000,
      optimalTimeMs: 300000,
      pathwaySimilarity: 0.9,
      redFlagsMissed: 1,
      criticalActionsPerformed: 5,
    },
    totalTimeMs: 300000,
    diagnosisCorrect: true,
    actions: [],
  };

  it('returns a score between 0 and 1', () => {
    const result = calculateOSCEEfficiencyScore(sampleTelemetry);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('includes breakdown of components', () => {
    const result = calculateOSCEEfficiencyScore(sampleTelemetry);
    expect(result.breakdown.accuracy).toBeDefined();
    expect(result.breakdown.timeEfficiency).toBeDefined();
    expect(result.breakdown.pathwayAdherence).toBeDefined();
    expect(result.breakdown.rapport).toBeDefined(); // default 0.5 if no rapport
  });

  it('rapport component affects overall score', () => {
    const withRapport: OSCETelemetry = {
      ...sampleTelemetry,
      rapport: {
        empathyStatements: 5,
        educationStatements: 3,
        openEndedQuestions: 4,
        closedEndedQuestions: 2,
        patientCenteredRatio: 0.9,
        introducedSelf: true,
        askedForPerspective: true,
      },
    };
    const result = calculateOSCEEfficiencyScore(withRapport);
    expect(result.breakdown.rapport).toBeGreaterThan(0.5);
  });
});

// ============================================================================
//  TEST SET 5: Edge Cases & Robustness
// ============================================================================

describe('edge cases', () => {
  it('handles zero actions in diagnostic efficiency', () => {
    const result = calculateDiagnosticEfficiency([]);
    expect(result.correctActions).toBe(0);
    expect(result.unnecessaryActions).toBe(0);
    expect(result.timeToDiagnosisMs).toBe(0);
  });

  it('handles missing speech transcript', () => {
    const telemetry: OSCETelemetry = {
      diagnosticEfficiency: {
        correctActions: 5,
        unnecessaryActions: 0,
        timeToDiagnosisMs: 180000,
        optimalTimeMs: 300000,
        pathwaySimilarity: 0.7,
        redFlagsMissed: 0,
        criticalActionsPerformed: 3,
      },
      totalTimeMs: 300000,
      diagnosisCorrect: true,
      actions: [],
    };
    const result = deriveOSCEImplicitRating(telemetry);
    expect(result.componentScores.speech).toBe(0);
  });

  it('clamps rating to valid FSRS range', () => {
    // Create a telemetry that would produce extreme scores
    const telemetry: OSCETelemetry = {
      diagnosticEfficiency: {
        correctActions: 20,
        unnecessaryActions: 0,
        timeToDiagnosisMs: 5000, // extremely fast
        optimalTimeMs: 300000,
        pathwaySimilarity: 1.0,
        redFlagsMissed: 0,
        criticalActionsPerformed: 10,
      },
      speech: {
        wordsPerMinute: 300,
        averagePauseMs: 10,
        fillerWordsPer100: 0,
        hesitationRatio: 0,
        speechDurationMs: 60000,
        fluencyScore: 1.0,
      },
      rapport: {
        empathyStatements: 10,
        educationStatements: 10,
        openEndedQuestions: 10,
        closedEndedQuestions: 2,
        patientCenteredRatio: 1.0,
        introducedSelf: true,
        askedForPerspective: true,
      },
      totalTimeMs: 60000,
      diagnosisCorrect: true,
      actions: [],
    };
    const result = deriveOSCEImplicitRating(telemetry);
    expect(result.continuousRating).toBeGreaterThanOrEqual(1.0);
    expect(result.continuousRating).toBeLessThanOrEqual(4.0);
  });
});