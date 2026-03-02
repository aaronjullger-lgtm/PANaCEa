/**
 * useOSCEMetrics Hook
 * 
 * Tracks sequential clinical decisions in OSCE simulator.
 * Calculates continuous clinical confidence index from decision-pathing.
 * Extended Phase 4: Captures speech patterns, diagnostic ordering efficiency,
 * rapport-building behaviors, and derives implicit OSCE rating.
 */

import { useRef, useCallback } from 'react';
import {
  type SpeechMetrics,
  type DiagnosticEfficiency,
  type RapportMetrics,
  type OSCETelemetry,
  type OSCEImplicitRating,
  analyzeOSCESpeechPatterns,
  calculateDiagnosticEfficiency,
  deriveOSCEImplicitRating,
  calculateOSCEEfficiencyScore,
} from '../lib/osce-implicit-metrics';

interface OSCEAction {
  type: 'order' | 'exam' | 'diagnosis' | 'treatment' | 'communication';
  action: string;
  timestamp: number;
  timeFromStart: number;
  isCorrect?: boolean;
  isRedFlag?: boolean;
}

interface OSCEMetrics {
  actions: OSCEAction[];
  totalTime: number;
  redFlagsMissed: number;
  unnecessaryOrders: number;
  clinicalConfidenceIndex: number;
  // Extended telemetry
  speechMetrics?: SpeechMetrics;
  diagnosticEfficiency?: DiagnosticEfficiency;
  rapportMetrics?: RapportMetrics;
  implicitRating?: OSCEImplicitRating;
  efficiencyScore?: number;
}

export function useOSCEMetrics() {
  const startTime = useRef<number>(Date.now());
  const actions = useRef<OSCEAction[]>([]);
  const speechTranscript = useRef<string>('');
  const speechTiming = useRef<number[]>([]);
  const rapportBehaviors = useRef<RapportMetrics>({
    empathyStatements: 0,
    educationStatements: 0,
    openEndedQuestions: 0,
    closedEndedQuestions: 0,
    patientCenteredRatio: 0.5,
    introducedSelf: false,
    askedForPerspective: false,
  });

  const logAction = useCallback((
    type: OSCEAction['type'],
    action: string,
    metadata?: { isCorrect?: boolean; isRedFlag?: boolean }
  ) => {
    const now = Date.now();
    actions.current.push({
      type,
      action,
      timestamp: now,
      timeFromStart: now - startTime.current,
      ...metadata,
    });
  }, []);

  /**
   * Log a speech utterance with its timestamp.
   * Call this each time a speech segment is recognized.
   * @param text The spoken text (single word or phrase)
   * @param timestamp Optional timestamp (ms from start). If not provided, uses current time.
   */
  const logSpeech = useCallback((text: string, timestamp?: number) => {
    const now = timestamp ?? Date.now();
    speechTranscript.current += (speechTranscript.current ? ' ' : '') + text;
    speechTiming.current.push(now);
  }, []);

  /**
   * Log a rapport-building behavior.
   */
  const logRapportBehavior = useCallback((behavior: keyof RapportMetrics, value?: number | boolean) => {
    if (behavior === 'introducedSelf' || behavior === 'askedForPerspective') {
      if (typeof value === 'boolean') {
        rapportBehaviors.current[behavior] = value;
      } else {
        rapportBehaviors.current[behavior] = true;
      }
    } else if (behavior === 'patientCenteredRatio') {
      if (typeof value === 'number') {
        rapportBehaviors.current[behavior] = value;
      }
    } else {
      // empathyStatements, educationStatements, openEndedQuestions, closedEndedQuestions
      const current = rapportBehaviors.current[behavior] as number;
      rapportBehaviors.current[behavior] = current + (typeof value === 'number' ? value : 1);
    }
  }, []);

  /**
   * Calculate comprehensive OSCE metrics including implicit rating.
   */
  const calculateMetrics = useCallback((): OSCEMetrics => {
    const totalTime = Date.now() - startTime.current;
    const redFlagsMissed = actions.current.filter(a => a.isRedFlag === false).length;
    const unnecessaryOrders = actions.current.filter(
      a => a.type === 'order' && a.isCorrect === false
    ).length;

    // Clinical confidence index: penalize red flags, reward efficiency
    const baseScore = 3.0;
    const redFlagPenalty = redFlagsMissed * 0.5;
    const unnecessaryPenalty = unnecessaryOrders * 0.2;
    const efficiencyBonus = totalTime < 300000 ? 0.3 : 0; // < 5min bonus

    const clinicalConfidenceIndex = Math.max(
      1.0,
      Math.min(4.0, baseScore - redFlagPenalty - unnecessaryPenalty + efficiencyBonus)
    );

    // Speech metrics
    const speechMetrics = speechTranscript.current
      ? analyzeOSCESpeechPatterns(speechTranscript.current, speechTiming.current)
      : undefined;

    // Diagnostic efficiency
    const diagnosticEfficiency = calculateDiagnosticEfficiency(actions.current);

    // Rapport metrics (if any logged)
    const rapportMetrics = rapportBehaviors.current.empathyStatements > 0 ||
      rapportBehaviors.current.educationStatements > 0 ||
      rapportBehaviors.current.openEndedQuestions > 0 ||
      rapportBehaviors.current.closedEndedQuestions > 0 ||
      rapportBehaviors.current.introducedSelf ||
      rapportBehaviors.current.askedForPerspective
      ? rapportBehaviors.current
      : undefined;

    // Build OSCE telemetry
    const telemetry: OSCETelemetry = {
      speech: speechMetrics,
      diagnosticEfficiency,
      rapport: rapportMetrics,
      totalTimeMs: totalTime,
      diagnosisCorrect: actions.current.some(a => a.type === 'diagnosis' && a.isCorrect === true),
      actions: actions.current.map(a => ({
        type: a.type,
        action: a.action,
        timestamp: a.timestamp,
        timeFromStart: a.timeFromStart,
        isCorrect: a.isCorrect,
        isRedFlag: a.isRedFlag,
      })),
    };

    // Derive implicit rating
    const implicitRating = deriveOSCEImplicitRating(telemetry);
    const efficiencyScore = calculateOSCEEfficiencyScore(telemetry).score;

    return {
      actions: actions.current,
      totalTime,
      redFlagsMissed,
      unnecessaryOrders,
      clinicalConfidenceIndex,
      speechMetrics,
      diagnosticEfficiency,
      rapportMetrics,
      implicitRating,
      efficiencyScore,
    };
  }, []);

  const reset = useCallback(() => {
    startTime.current = Date.now();
    actions.current = [];
    speechTranscript.current = '';
    speechTiming.current = [];
    rapportBehaviors.current = {
      empathyStatements: 0,
      educationStatements: 0,
      openEndedQuestions: 0,
      closedEndedQuestions: 0,
      patientCenteredRatio: 0.5,
      introducedSelf: false,
      askedForPerspective: false,
    };
  }, []);

  return {
    logAction,
    logSpeech,
    logRapportBehavior,
    calculateMetrics,
    reset,
  };
}