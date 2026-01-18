/**
 * Real-time Session Optimizer - Sprint 5
 *
 * Optimizes study sessions in real-time based on cognitive state.
 */

export interface CognitiveSnapshot {
  attentionLevel: number; // 0-100
  fatigueLevel: number; // 0-100
  cognitiveLoad: number; // 0-100
  flowState: number; // 0-100
  frustrationRisk: number; // 0-100
  timestamp: Date;
}

export interface SessionOptimization {
  shouldContinue: boolean;
  recommendedAction:
    | 'continue'
    | 'take_break'
    | 'switch_topic'
    | 'lower_difficulty'
    | 'end_session';
  reason: string;
  suggestedDuration?: number;
  suggestedTopic?: string;
}

export interface PerformanceMetrics {
  questionsAttempted: number;
  correctAnswers: number;
  avgResponseTimeMs: number;
  responseTimeTrend: 'faster' | 'stable' | 'slower';
  accuracyTrend: 'improving' | 'stable' | 'declining';
  sessionDurationMinutes: number;
}

export function analyzeCognitiveState(
  recentAttempts: { wasCorrect: boolean; responseTimeMs: number; timestamp: Date }[],
  sessionStartTime: Date
): CognitiveSnapshot {
  const now = new Date();
  const sessionMinutes = (now.getTime() - sessionStartTime.getTime()) / 60000;
  const last10 = recentAttempts.slice(-10);
  const last5 = recentAttempts.slice(-5);

  // Attention: based on response consistency
  const responseTimes = last10.map((a) => a.responseTimeMs);
  const avgTime = responseTimes.reduce((a, b) => a + b, 0) / (responseTimes.length || 1);
  const variance =
    responseTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) /
    (responseTimes.length || 1);
  const attentionLevel = Math.max(0, 100 - Math.sqrt(variance) / 100);

  // Fatigue: increases with session duration and declining performance
  const baseFatigue = Math.min(80, (sessionMinutes / 90) * 100);
  const recentAccuracy = last5.filter((a) => a.wasCorrect).length / (last5.length || 1);
  const olderAccuracy = last10.slice(0, 5).filter((a) => a.wasCorrect).length / 5;
  const performanceDecline = Math.max(0, olderAccuracy - recentAccuracy);
  const fatigueLevel = Math.min(100, baseFatigue + performanceDecline * 50);

  // Cognitive load: based on response time
  const cognitiveLoad = Math.min(100, avgTime / 600);

  // Flow state: high when consistent correct answers with moderate response time
  const isInFlow =
    recentAccuracy > 0.7 && avgTime > 15000 && avgTime < 45000 && variance < 100000000;
  const flowState = isInFlow
    ? Math.min(100, 70 + (recentAccuracy - 0.7) * 100)
    : Math.max(0, recentAccuracy * 50);

  // Frustration risk: high when many incorrect with long response times
  const incorrectCount = last5.filter((a) => !a.wasCorrect).length;
  const frustrationRisk = Math.min(100, incorrectCount * 20 + (avgTime > 60000 ? 30 : 0));

  return {
    attentionLevel: Math.round(attentionLevel),
    fatigueLevel: Math.round(fatigueLevel),
    cognitiveLoad: Math.round(cognitiveLoad),
    flowState: Math.round(flowState),
    frustrationRisk: Math.round(frustrationRisk),
    timestamp: now,
  };
}

export function optimizeSession(
  cognitive: CognitiveSnapshot,
  metrics: PerformanceMetrics,
  currentSystem: string,
  systemAccuracies: Record<string, number>
): SessionOptimization {
  // Check for session end conditions
  if (cognitive.fatigueLevel > 85) {
    return {
      shouldContinue: false,
      recommendedAction: 'end_session',
      reason: 'High fatigue detected - rest will improve retention',
    };
  }

  if (cognitive.frustrationRisk > 80) {
    return {
      shouldContinue: true,
      recommendedAction: 'lower_difficulty',
      reason: 'Frustration building - switching to easier questions',
    };
  }

  if (cognitive.fatigueLevel > 60 && metrics.sessionDurationMinutes > 45) {
    return {
      shouldContinue: true,
      recommendedAction: 'take_break',
      reason: 'Time for a 5-10 minute break to restore focus',
      suggestedDuration: 10,
    };
  }

  if (metrics.accuracyTrend === 'declining' && metrics.questionsAttempted > 15) {
    // Find a stronger topic to switch to
    const strongerTopic = Object.entries(systemAccuracies)
      .filter(([sys]) => sys !== currentSystem)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    if (strongerTopic) {
      return {
        shouldContinue: true,
        recommendedAction: 'switch_topic',
        reason: 'Performance declining - switching to build confidence',
        suggestedTopic: strongerTopic,
      };
    }
  }

  if (cognitive.flowState > 70) {
    return {
      shouldContinue: true,
      recommendedAction: 'continue',
      reason: 'Excellent flow state - keep going!',
    };
  }

  if (cognitive.attentionLevel < 40) {
    return {
      shouldContinue: true,
      recommendedAction: 'take_break',
      reason: 'Attention waning - a short break will help',
      suggestedDuration: 5,
    };
  }

  return {
    shouldContinue: true,
    recommendedAction: 'continue',
    reason: 'Session progressing well',
  };
}

export function calculateOptimalSessionLength(
  historicalSessions: { duration: number; accuracy: number; questionsAttempted: number }[],
  timeOfDay: number // 0-23 hour
): { optimalMinutes: number; reasoning: string } {
  if (historicalSessions.length < 5) {
    return { optimalMinutes: 45, reasoning: 'Default recommendation for new users' };
  }

  // Find sessions with best accuracy
  const sorted = [...historicalSessions].sort((a, b) => b.accuracy - a.accuracy);
  const topSessions = sorted.slice(0, Math.ceil(sorted.length * 0.3));
  const avgOptimalDuration =
    topSessions.reduce((sum, s) => sum + s.duration, 0) / topSessions.length;

  // Adjust for time of day
  let timeAdjustment = 1;
  if (timeOfDay >= 6 && timeOfDay <= 10)
    timeAdjustment = 1.1; // Morning boost
  else if (timeOfDay >= 14 && timeOfDay <= 16)
    timeAdjustment = 0.9; // Post-lunch dip
  else if (timeOfDay >= 22 || timeOfDay <= 5) timeAdjustment = 0.75; // Late night

  const optimalMinutes = Math.round(avgOptimalDuration * timeAdjustment);

  return {
    optimalMinutes: Math.max(20, Math.min(90, optimalMinutes)),
    reasoning: `Based on your ${topSessions.length} best sessions, adjusted for ${timeOfDay}:00`,
  };
}

export function predictFatiguePoint(
  currentCognitive: CognitiveSnapshot,
  sessionStartTime: Date
): { minutesUntilFatigue: number; confidence: number } {
  const sessionMinutes = (new Date().getTime() - sessionStartTime.getTime()) / 60000;
  const fatigueRate = currentCognitive.fatigueLevel / (sessionMinutes || 1);

  // Predict when fatigue will hit 80%
  const targetFatigue = 80;
  const remainingFatigue = targetFatigue - currentCognitive.fatigueLevel;
  const minutesUntilFatigue = fatigueRate > 0 ? remainingFatigue / fatigueRate : 60;

  // Confidence decreases with longer predictions
  const confidence = Math.max(30, 100 - minutesUntilFatigue);

  return {
    minutesUntilFatigue: Math.max(5, Math.round(minutesUntilFatigue)),
    confidence: Math.round(confidence),
  };
}
