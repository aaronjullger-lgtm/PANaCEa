/**
 * Deep Session Analysis API
 *
 * POST /api/intelligence/analyze-session
 *
 * Provides deep analysis of a study session including:
 * - Learning pattern insights
 * - Error classification
 * - Knowledge gap detection
 * - Cognitive state assessment
 * - Personalized recommendations
 *
 * This endpoint powers the intelligent session analytics and
 * generates actionable insights for improving study effectiveness.
 */

import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { resolveUserId } from '../../_shared/user-resolver';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { z } from 'zod';

// Zod schema for session attempt
const SessionAttemptSchema = z.object({
  questionId: z.string(),
  conditionId: z.string().nullable().optional(),
  system: z.string().nullable().optional(),
  wasCorrect: z.boolean(),
  responseTimeMs: z.number(),
  answerChanged: z.boolean().optional().default(false),
  selectedAnswer: z.string(),
  correctAnswer: z.string(),
  difficulty: z.string(),
  timestamp: z.number(),
});

// Zod schema for analyze session request
const AnalyzeSessionSchema = z.object({
  body: z.object({
    sessionId: z.string().optional(),
    attempts: z.array(SessionAttemptSchema).min(1, 'At least one attempt required'),
    sessionStartTime: z.number(),
    sessionEndTime: z.number(),
    mode: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

// ============================================================================
// Types
// ============================================================================

interface SessionAttempt {
  questionId: string;
  conditionId?: string | null;
  system?: string | null;
  wasCorrect: boolean;
  responseTimeMs: number;
  answerChanged: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  difficulty: string;
  timestamp: number;
}

interface ErrorClassification {
  questionId: string;
  conceptId: string;
  errorType: string;
  confidence: number;
  indicators: string[];
  remediation: string;
}

interface ConceptRetentionSummary {
  conceptId: string;
  system: string;
  currentRetention: number;
  reviewUrgency: string;
  nextOptimalReview: string;
  consecutiveCorrect: number;
  accuracyTrend: 'improving' | 'stable' | 'declining';
}

interface KnowledgeGap {
  conceptId: string;
  conceptName: string;
  system: string;
  gapType: string;
  severity: string;
  blocksCount: number;
  suggestedResources: string[];
}

interface CognitiveStateSnapshot {
  cognitiveLoad: number;
  attentionLevel: number;
  fatigueLevel: number;
  flowState: number;
  workingMemoryLoad: number;
}

interface LearningInsight {
  category: 'strength' | 'weakness' | 'opportunity' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action?: string;
}

interface SessionAnalysisResponse {
  success: true;
  analysis: {
    // Session performance
    sessionScore: number;
    accuracyBySystem: Record<string, { correct: number; total: number; accuracy: number }>;
    difficultyCurve: { questionNumber: number; difficulty: string; correct: boolean }[];

    // Learning patterns
    learningEfficiency: number;
    retentionStrength: number;
    spacingEffectiveness: number;

    // Error analysis
    errorClassifications: ErrorClassification[];
    errorDistribution: Record<string, number>;
    dominantErrorType: string;

    // Concept states
    conceptsAnalyzed: number;
    conceptRetentionSummaries: ConceptRetentionSummary[];
    conceptsNeedingReview: number;
    conceptsOverdue: number;

    // Knowledge gaps
    knowledgeGaps: KnowledgeGap[];
    criticalGapsCount: number;
    totalBlockedConcepts: number;

    // Cognitive state
    cognitiveState: CognitiveStateSnapshot;
    shouldTakeBreak: boolean;
    breakReason?: string;

    // Predictions
    predictedRetention7Days: number;
    predictedRetention30Days: number;
    estimatedTimeToMastery: number;

    // Insights and recommendations
    insights: LearningInsight[];
    prioritizedRecommendations: string[];
    nextSessionFocus: string[];
  };
}

// ============================================================================
// Error Type Constants
// ============================================================================

type ErrorTypeValue =
  | 'knowledge_gap'
  | 'incomplete_learning'
  | 'interference'
  | 'retrieval_failure'
  | 'application_error'
  | 'careless'
  | 'time_pressure'
  | 'misread'
  | 'overthinking'
  | 'guessing';

// Use 'as const' to ensure TypeScript knows these are literal string values
const ERROR_TYPES = {
  KNOWLEDGE_GAP: 'knowledge_gap',
  INCOMPLETE_LEARNING: 'incomplete_learning',
  INTERFERENCE: 'interference',
  RETRIEVAL_FAILURE: 'retrieval_failure',
  APPLICATION_ERROR: 'application_error',
  CARELESS: 'careless',
  TIME_PRESSURE: 'time_pressure',
  MISREAD: 'misread',
  OVERTHINKING: 'overthinking',
  GUESSING: 'guessing',
} as const satisfies Record<string, ErrorTypeValue>;

// ============================================================================
// Analysis Functions
// ============================================================================

function classifyError(
  attempt: SessionAttempt,
  previousAttempts: SessionAttempt[],
  avgResponseTime: number
): ErrorClassification {
  const indicators: string[] = [];
  let errorType: ErrorTypeValue = ERROR_TYPES.KNOWLEDGE_GAP;
  let confidence = 50;

  // Fast + wrong = careless or time pressure
  if (attempt.responseTimeMs < 15000) {
    indicators.push('Very fast response');
    errorType = ERROR_TYPES.CARELESS;
    confidence = 60;
  }

  // Changed answer and got wrong = overthinking
  if (attempt.answerChanged) {
    indicators.push('Changed answer before submission');
    errorType = ERROR_TYPES.OVERTHINKING;
    confidence = 80;
  }

  // Very long time = struggling / knowledge gap
  if (attempt.responseTimeMs > avgResponseTime * 2) {
    indicators.push('Response time much longer than average');
    if (!attempt.answerChanged) {
      errorType = ERROR_TYPES.RETRIEVAL_FAILURE;
      confidence = 70;
    }
  }

  // Check for previous correct on same concept
  const previousCorrect = previousAttempts.some(
    (p) => p.conditionId === attempt.conditionId && p.wasCorrect
  );
  if (previousCorrect) {
    indicators.push('Previously answered similar correctly');
    errorType = ERROR_TYPES.INTERFERENCE;
    confidence = 75;
  }

  // Never seen this concept + slow = knowledge gap
  const neverSeen = !previousAttempts.some((p) => p.conditionId === attempt.conditionId);
  if (neverSeen && attempt.responseTimeMs > 60000) {
    indicators.push('First encounter with concept');
    indicators.push('Long deliberation time');
    errorType = ERROR_TYPES.KNOWLEDGE_GAP;
    confidence = 85;
  }

  // Generate remediation based on error type
  const remediations: Record<string, string> = {
    [ERROR_TYPES.KNOWLEDGE_GAP]: 'Study this concept from the beginning - focus on core facts',
    [ERROR_TYPES.INCOMPLETE_LEARNING]: 'Review explanations and practice active recall',
    [ERROR_TYPES.INTERFERENCE]: 'Compare and contrast with similar concepts',
    [ERROR_TYPES.RETRIEVAL_FAILURE]: 'Practice retrieval without hints',
    [ERROR_TYPES.APPLICATION_ERROR]: 'Work through case-based scenarios',
    [ERROR_TYPES.CARELESS]: 'Slow down slightly and read questions more carefully',
    [ERROR_TYPES.TIME_PRESSURE]: 'Practice timed conditions to build speed',
    [ERROR_TYPES.MISREAD]: 'Highlight key terms in questions',
    [ERROR_TYPES.OVERTHINKING]: 'Trust your first instinct more often',
    [ERROR_TYPES.GUESSING]: 'Mark for review and return with fresh eyes',
  };

  return {
    questionId: attempt.questionId,
    conceptId: attempt.conditionId || attempt.system || 'unknown',
    errorType,
    confidence,
    indicators,
    remediation: remediations[errorType] ?? 'Review this concept and practice active recall',
  };
}

function calculateCognitiveState(attempts: SessionAttempt[]): CognitiveStateSnapshot {
  if (attempts.length < 3) {
    return {
      cognitiveLoad: 50,
      attentionLevel: 70,
      fatigueLevel: 20,
      flowState: 50,
      workingMemoryLoad: 50,
    };
  }

  const recent = attempts.slice(-15);
  const veryRecent = attempts.slice(-5);

  // Calculate accuracy
  const recentAccuracy = veryRecent.filter((a) => a.wasCorrect).length / veryRecent.length;

  // Calculate response time trends
  const avgResponseTime = recent.reduce((sum, a) => sum + a.responseTimeMs, 0) / recent.length;
  const answerChangeRate = recent.filter((a) => a.answerChanged).length / recent.length;

  // Cognitive load
  let cognitiveLoad = 50;
  const timeRatio = avgResponseTime / 60000;
  if (timeRatio > 1.5) cognitiveLoad += 20;
  else if (timeRatio > 1.2) cognitiveLoad += 10;
  else if (timeRatio < 0.7) cognitiveLoad -= 10;
  cognitiveLoad += answerChangeRate * 30;
  if (recentAccuracy < 0.5) cognitiveLoad += 15;
  else if (recentAccuracy < 0.7) cognitiveLoad += 5;
  else if (recentAccuracy > 0.85) cognitiveLoad -= 10;

  // Attention level from response consistency
  const responseTimes = veryRecent.map((a) => a.responseTimeMs);
  const avgRecentTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const variance =
    responseTimes.reduce((sum, t) => sum + Math.pow(t - avgRecentTime, 2), 0) /
    responseTimes.length;
  const normalizedVariance = variance / (avgRecentTime * avgRecentTime);
  const attentionLevel = Math.max(20, Math.min(100, 80 - normalizedVariance * 100));

  // Working memory load
  const workingMemoryLoad = Math.min(100, 30 + answerChangeRate * 50);

  // Fatigue from session length and error clustering
  const lastAttempt = attempts[attempts.length - 1];
  const firstAttempt = attempts[0];
  const sessionMinutes =
    lastAttempt && firstAttempt ? (lastAttempt.timestamp - firstAttempt.timestamp) / 60000 : 0;
  let fatigueLevel = Math.min(100, sessionMinutes * 0.8);

  // Check for declining performance
  if (attempts.length >= 20) {
    const early = attempts.slice(0, 10);
    const late = attempts.slice(-10);
    const earlyAccuracy =
      early.length > 0
        ? early.filter((a: SessionAttempt) => a.wasCorrect).length / early.length
        : 0;
    const lateAccuracy =
      late.length > 0 ? late.filter((a: SessionAttempt) => a.wasCorrect).length / late.length : 0;
    if (lateAccuracy < earlyAccuracy - 0.15) {
      fatigueLevel += 20;
    }
  }

  // Flow state
  let flowState = 50;
  if (
    recentAccuracy >= 0.7 &&
    recentAccuracy <= 0.9 &&
    cognitiveLoad >= 40 &&
    cognitiveLoad <= 70
  ) {
    flowState = 80 + (recentAccuracy - 0.7) * 100;
  } else if (recentAccuracy > 0.9 && cognitiveLoad < 40) {
    flowState = 40; // Too easy
  } else if (recentAccuracy < 0.5 && cognitiveLoad > 70) {
    flowState = 30; // Too hard
  }

  return {
    cognitiveLoad: Math.max(0, Math.min(100, Math.round(cognitiveLoad))),
    attentionLevel: Math.round(attentionLevel),
    fatigueLevel: Math.max(0, Math.min(100, Math.round(fatigueLevel))),
    flowState: Math.max(0, Math.min(100, Math.round(flowState))),
    workingMemoryLoad: Math.round(workingMemoryLoad),
  };
}

function generateInsights(
  attempts: SessionAttempt[],
  errorClassifications: ErrorClassification[],
  cognitiveState: CognitiveStateSnapshot,
  accuracyBySystem: Record<string, { correct: number; total: number; accuracy: number }>
): LearningInsight[] {
  const insights: LearningInsight[] = [];

  // Accuracy insights
  const totalAccuracy = attempts.filter((a) => a.wasCorrect).length / attempts.length;

  if (totalAccuracy >= 0.85) {
    insights.push({
      category: 'strength',
      title: 'Excellent Performance',
      description: `${Math.round(totalAccuracy * 100)}% accuracy shows strong mastery`,
      impact: 'high',
    });
  } else if (totalAccuracy < 0.6) {
    insights.push({
      category: 'warning',
      title: 'Performance Below Target',
      description: 'Accuracy below 60% suggests need for focused review',
      impact: 'high',
      action: 'Focus on weaker topics with easier questions first',
    });
  }

  // System-specific insights
  const systemAccuracies = Object.entries(accuracyBySystem);
  const weakSystems = systemAccuracies.filter(([, data]) => data.accuracy < 0.6 && data.total >= 3);
  const strongSystems = systemAccuracies.filter(
    ([, data]) => data.accuracy >= 0.85 && data.total >= 3
  );

  if (weakSystems.length > 0) {
    insights.push({
      category: 'weakness',
      title: `Weakness in ${weakSystems.map(([s]) => s).join(', ')}`,
      description: `Below 60% accuracy in these systems needs attention`,
      impact: 'high',
      action: 'Schedule dedicated review sessions for weak systems',
    });
  }

  if (strongSystems.length > 0) {
    insights.push({
      category: 'strength',
      title: `Strong in ${strongSystems.map(([s]) => s).join(', ')}`,
      description: `85%+ accuracy shows solid mastery`,
      impact: 'medium',
    });
  }

  // Error pattern insights
  const errorCounts: Record<string, number> = {};
  for (const err of errorClassifications) {
    errorCounts[err.errorType] = (errorCounts[err.errorType] || 0) + 1;
  }

  const totalErrors = errorClassifications.length;
  if (totalErrors > 0) {
    if ((errorCounts[ERROR_TYPES.OVERTHINKING] || 0) / totalErrors > 0.3) {
      insights.push({
        category: 'opportunity',
        title: 'Answer Changing Pattern',
        description: 'You often change correct answers to incorrect ones',
        impact: 'high',
        action: 'Trust your first instinct more - practice committing to answers',
      });
    }

    if ((errorCounts[ERROR_TYPES.CARELESS] || 0) / totalErrors > 0.25) {
      insights.push({
        category: 'opportunity',
        title: 'Careless Errors',
        description: 'Quick mistakes on questions you likely know',
        impact: 'medium',
        action: 'Take an extra 5-10 seconds to verify before submitting',
      });
    }

    if ((errorCounts[ERROR_TYPES.INTERFERENCE] || 0) / totalErrors > 0.2) {
      insights.push({
        category: 'weakness',
        title: 'Concept Confusion',
        description: 'Similar concepts are being confused with each other',
        impact: 'high',
        action: 'Create comparison charts for frequently confused topics',
      });
    }
  }

  // Cognitive state insights
  if (cognitiveState.fatigueLevel > 70) {
    insights.push({
      category: 'warning',
      title: 'High Fatigue Detected',
      description: 'Performance may be declining due to mental fatigue',
      impact: 'high',
      action: 'Take a 10-15 minute break before continuing',
    });
  }

  if (cognitiveState.flowState > 70) {
    insights.push({
      category: 'strength',
      title: 'In the Zone',
      description: "You're in a great learning flow state right now",
      impact: 'medium',
      action: 'Continue while flow state lasts!',
    });
  }

  if (cognitiveState.attentionLevel < 50) {
    insights.push({
      category: 'warning',
      title: 'Attention Wandering',
      description: 'Response patterns suggest decreased focus',
      impact: 'medium',
      action: 'Try a quick break or switch to a different topic',
    });
  }

  return insights.slice(0, 10); // Return top 10 insights
}

function generateRecommendations(
  insights: LearningInsight[],
  errorClassifications: ErrorClassification[],
  accuracyBySystem: Record<string, { correct: number; total: number; accuracy: number }>
): string[] {
  const recommendations: string[] = [];

  // Based on warnings and weaknesses
  const warnings = insights.filter((i) => i.category === 'warning' || i.category === 'weakness');
  for (const warning of warnings) {
    if (warning.action) {
      recommendations.push(warning.action);
    }
  }

  // Based on error types
  const errorCounts: Record<string, number> = {};
  for (const err of errorClassifications) {
    errorCounts[err.errorType] = (errorCounts[err.errorType] || 0) + 1;
  }

  const dominantError = Object.entries(errorCounts).sort(([, a], [, b]) => b - a)[0];
  if (dominantError && dominantError[1] >= 2) {
    const remediations: Record<string, string> = {
      [ERROR_TYPES.KNOWLEDGE_GAP]: 'Focus on foundational content before advanced topics',
      [ERROR_TYPES.INTERFERENCE]:
        'Practice distinguishing similar conditions with side-by-side comparisons',
      [ERROR_TYPES.OVERTHINKING]:
        'Set a personal rule: only change answer if you find concrete evidence',
      [ERROR_TYPES.CARELESS]: 'Use a mental checklist before submitting each answer',
      [ERROR_TYPES.TIME_PRESSURE]:
        'Practice untimed first to build confidence, then add time limits',
    };

    const errorTypeKey = dominantError[0];
    const remediation = remediations[errorTypeKey];
    if (remediation) {
      recommendations.push(remediation);
    }
  }

  // Based on system performance
  const weakSystems = Object.entries(accuracyBySystem)
    .filter(([, data]) => data.accuracy < 0.6 && data.total >= 3)
    .map(([system]) => system);

  if (weakSystems.length > 0) {
    recommendations.push(`Schedule focused review on: ${weakSystems.join(', ')}`);
  }

  return [...new Set(recommendations)].slice(0, 5); // Unique, top 5
}

function determineNextSessionFocus(
  accuracyBySystem: Record<string, { correct: number; total: number; accuracy: number }>,
  errorClassifications: ErrorClassification[]
): string[] {
  const focus: string[] = [];

  // Prioritize weak systems
  const sortedSystems = Object.entries(accuracyBySystem)
    .filter(([, data]) => data.total >= 2)
    .sort(([, a], [, b]) => a.accuracy - b.accuracy);

  const weakestSystem = sortedSystems[0];
  if (weakestSystem) {
    const systemName = weakestSystem[0];
    const systemData = weakestSystem[1];
    if (systemData && systemData.accuracy < 0.7 && systemName) {
      focus.push(`${systemName} system review`);
    }
  }

  // Prioritize concepts with knowledge gaps
  const gapConcepts = errorClassifications
    .filter(
      (e) =>
        e.errorType === ERROR_TYPES.KNOWLEDGE_GAP || e.errorType === ERROR_TYPES.INCOMPLETE_LEARNING
    )
    .map((e) => e.conceptId);

  const uniqueGapConcepts = [...new Set(gapConcepts)].slice(0, 3);
  for (const concept of uniqueGapConcepts) {
    focus.push(`Deep dive: ${concept}`);
  }

  // Add review for interference patterns
  const interferenceConcepts = errorClassifications
    .filter((e) => e.errorType === ERROR_TYPES.INTERFERENCE)
    .map((e) => e.conceptId);

  if (interferenceConcepts.length >= 2) {
    focus.push('Comparison drill for confused concepts');
  }

  return focus.slice(0, 5);
}

// ============================================================================
// Main Handler
// ============================================================================

export const onRequestPost = authenticatedEndpoint(
  AnalyzeSessionSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/intelligence/analyze-session', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const { attempts, sessionStartTime, sessionEndTime, mode } = validated.body;

      // Calculate basic metrics
      const totalCorrect = attempts.filter((a) => a.wasCorrect).length;
      const sessionScore = Math.round((totalCorrect / attempts.length) * 100);

      // Calculate accuracy by system
      const accuracyBySystem: Record<string, { correct: number; total: number; accuracy: number }> =
        {};
      for (const attempt of attempts) {
        const system = attempt.system || 'unknown';
        if (!accuracyBySystem[system]) {
          accuracyBySystem[system] = { correct: 0, total: 0, accuracy: 0 };
        }
        accuracyBySystem[system].total++;
        if (attempt.wasCorrect) {
          accuracyBySystem[system].correct++;
        }
      }
      for (const system of Object.keys(accuracyBySystem)) {
        const systemStats = accuracyBySystem[system];
        if (systemStats) {
          systemStats.accuracy = systemStats.correct / systemStats.total;
        }
      }

      // Build difficulty curve
      const difficultyCurve = attempts.map((a: SessionAttempt, i: number) => ({
        questionNumber: i + 1,
        difficulty: a.difficulty,
        correct: a.wasCorrect,
      }));

      // Classify errors
      const avgResponseTime =
        attempts.reduce((sum, a) => sum + a.responseTimeMs, 0) / attempts.length;
      const incorrectAttempts = attempts.filter((a) => !a.wasCorrect);
      const errorClassifications: ErrorClassification[] = [];

      for (const attempt of incorrectAttempts) {
        const previousAttempts = attempts.filter((a) => a.timestamp < attempt.timestamp);
        const classification = classifyError(attempt, previousAttempts, avgResponseTime);
        errorClassifications.push(classification);
      }

      // Calculate error distribution
      const errorDistribution: Record<string, number> = {};
      for (const err of errorClassifications) {
        errorDistribution[err.errorType] = (errorDistribution[err.errorType] || 0) + 1;
      }

      // Find dominant error type
      const sortedErrors = Object.entries(errorDistribution).sort(
        ([, a], [, b]) => (b ?? 0) - (a ?? 0)
      );
      const topError = sortedErrors[0];
      const dominantErrorType = topError?.[0] ?? 'none';

      // Calculate cognitive state
      const cognitiveState = calculateCognitiveState(attempts);

      // Should take break?
      const shouldTakeBreak =
        cognitiveState.fatigueLevel > 75 ||
        cognitiveState.attentionLevel < 40 ||
        (cognitiveState.cognitiveLoad > 85 && cognitiveState.flowState < 30);

      let breakReason: string | undefined;
      if (shouldTakeBreak) {
        if (cognitiveState.fatigueLevel > 75) {
          breakReason = 'High fatigue detected - your accuracy may decline';
        } else if (cognitiveState.attentionLevel < 40) {
          breakReason = 'Attention is wandering - a short break may help';
        } else {
          breakReason = 'Cognitive overload - give your brain a rest';
        }
      }

      // Generate concept retention summaries (simplified - would integrate with learningPatternEngine)
      const conceptsAnalyzed = new Set(
        attempts.map((a: SessionAttempt) => a.conditionId).filter(Boolean)
      ).size;
      const conceptRetentionSummaries: ConceptRetentionSummary[] = [];

      // Group by concept and calculate trends
      const conceptAttempts: Record<string, SessionAttempt[]> = {};
      for (const attempt of attempts) {
        if (attempt.conditionId) {
          const conditionAttempts = conceptAttempts[attempt.conditionId] ?? [];
          conditionAttempts.push(attempt);
          conceptAttempts[attempt.conditionId] = conditionAttempts;
        }
      }

      for (const [conceptId, conceptAtts] of Object.entries(conceptAttempts)) {
        if (conceptAtts.length === 0) continue; // Skip empty arrays

        const accuracy =
          conceptAtts.filter((a: SessionAttempt) => a.wasCorrect).length / conceptAtts.length;
        const trend: 'improving' | 'stable' | 'declining' =
          conceptAtts.length >= 3
            ? conceptAtts.slice(-2).every((a: SessionAttempt) => a.wasCorrect)
              ? 'improving'
              : conceptAtts.slice(-2).every((a: SessionAttempt) => !a.wasCorrect)
                ? 'declining'
                : 'stable'
            : 'stable';

        const firstAttempt = conceptAtts[0];
        conceptRetentionSummaries.push({
          conceptId,
          system: firstAttempt?.system || 'unknown',
          currentRetention: Math.round(accuracy * 100),
          reviewUrgency: accuracy < 0.5 ? 'overdue' : accuracy < 0.7 ? 'due' : 'stable',
          nextOptimalReview: new Date(
            Date.now() + (accuracy > 0.8 ? 7 : accuracy > 0.6 ? 3 : 1) * 86400000
          ).toISOString(),
          consecutiveCorrect: conceptAtts
            .slice()
            .reverse()
            .findIndex((a: SessionAttempt) => !a.wasCorrect),
          accuracyTrend: trend,
        });
      }

      // Knowledge gaps (simplified)
      const knowledgeGaps: KnowledgeGap[] = errorClassifications
        .filter(
          (e) =>
            e.errorType === ERROR_TYPES.KNOWLEDGE_GAP ||
            e.errorType === ERROR_TYPES.INCOMPLETE_LEARNING
        )
        .map((e) => {
          const matchingAttempt = attempts.find(
            (a: SessionAttempt) => a.conditionId === e.conceptId
          );
          const system = matchingAttempt?.system ?? 'unknown';

          return {
            conceptId: e.conceptId,
            conceptName: e.conceptId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            system,
            gapType: e.errorType,
            severity: e.confidence > 70 ? 'significant' : 'moderate',
            blocksCount: 0, // Would calculate from concept graph
            suggestedResources: [e.remediation],
          };
        });

      // Calculate learning metrics
      const learningEfficiency = Math.round(
        sessionScore * 0.4 +
          (100 - cognitiveState.cognitiveLoad) * 0.3 +
          cognitiveState.flowState * 0.3
      );
      const retentionStrength = Math.round(
        sessionScore * 0.5 +
          (conceptRetentionSummaries.filter((c) => c.accuracyTrend === 'improving').length /
            Math.max(1, conceptRetentionSummaries.length)) *
            50
      );
      const spacingEffectiveness = 70; // Would calculate from actual spacing data

      // Predictions (simplified)
      const predictedRetention7Days = Math.round(retentionStrength * 0.85);
      const predictedRetention30Days = Math.round(retentionStrength * 0.65);
      const estimatedTimeToMastery = Math.max(0, Math.round(((80 - sessionScore) / 10) * 3)); // hours

      // Generate insights
      const insights = generateInsights(
        attempts,
        errorClassifications,
        cognitiveState,
        accuracyBySystem
      );

      // Generate recommendations
      const prioritizedRecommendations = generateRecommendations(
        insights,
        errorClassifications,
        accuracyBySystem
      );

      // Determine next session focus
      const nextSessionFocus = determineNextSessionFocus(accuracyBySystem, errorClassifications);

      // Save session analytics to database (optional) — use internal user id from Clerk
      try {
        const internalUserId = await resolveUserId(prisma, auth.userId);
        if (internalUserId) {
          await prisma.studySession.create({
            data: {
              id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              userId: internalUserId,
              startedAt: new Date(sessionStartTime),
              endedAt: new Date(sessionEndTime),
              totalQuestions: attempts.length,
              correctAnswers: totalCorrect,
              accuracy: totalCorrect / attempts.length,
              totalTimeMs: sessionEndTime - sessionStartTime,
              avgTimePerQuestion: Math.round(avgResponseTime),
              systemsCovered: [
                ...new Set(attempts.map((a) => a.system).filter(Boolean)),
              ] as string[],
              mode,
              updatedAt: new Date(),
            },
          });
          log.info('Session analytics saved', {
            sessionScore,
            totalQuestions: attempts.length,
            correctCount: totalCorrect,
          });
        }
      } catch (dbError: any) {
        log.warn('Failed to save session to database', { error: dbError.message });
        // Continue with analysis even if DB save fails
      }

      const response: SessionAnalysisResponse = {
        success: true,
        analysis: {
          sessionScore,
          accuracyBySystem,
          difficultyCurve,
          learningEfficiency,
          retentionStrength,
          spacingEffectiveness,
          errorClassifications,
          errorDistribution,
          dominantErrorType,
          conceptsAnalyzed,
          conceptRetentionSummaries,
          conceptsNeedingReview: conceptRetentionSummaries.filter(
            (c) => c.reviewUrgency !== 'stable'
          ).length,
          conceptsOverdue: conceptRetentionSummaries.filter((c) => c.reviewUrgency === 'overdue')
            .length,
          knowledgeGaps,
          criticalGapsCount: knowledgeGaps.filter(
            (g) => g.severity === 'significant' || g.severity === 'critical'
          ).length,
          totalBlockedConcepts: knowledgeGaps.reduce((sum, g) => sum + g.blocksCount, 0),
          cognitiveState,
          shouldTakeBreak,
          breakReason,
          predictedRetention7Days,
          predictedRetention30Days,
          estimatedTimeToMastery,
          insights,
          prioritizedRecommendations,
          nextSessionFocus,
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      log.error('Session analysis error', { error: error.message });
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          details: error.message || 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
