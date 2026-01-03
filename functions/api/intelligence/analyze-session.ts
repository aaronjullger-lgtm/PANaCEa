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

import { authenticateRequest, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export const onRequestOptions = handleCorsOptions;

// ============================================================================
// Types
// ============================================================================

interface SessionAttempt {
  questionId: string;
  conditionId: string | null;
  system: string | null;
  wasCorrect: boolean;
  responseTimeMs: number;
  answerChanged: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  difficulty: string;
  timestamp: number;
}

interface AnalyzeSessionRequest {
  sessionId?: string;
  attempts: SessionAttempt[];
  sessionStartTime: number;
  sessionEndTime: number;
  mode?: string;
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

const ERROR_TYPES: Record<string, ErrorTypeValue> = {
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
};

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
    p => p.conditionId === attempt.conditionId && p.wasCorrect
  );
  if (previousCorrect) {
    indicators.push('Previously answered similar correctly');
    errorType = ERROR_TYPES.INTERFERENCE;
    confidence = 75;
  }

  // Never seen this concept + slow = knowledge gap
  const neverSeen = !previousAttempts.some(p => p.conditionId === attempt.conditionId);
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
    remediation: remediations[errorType],
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
  const recentAccuracy = veryRecent.filter(a => a.wasCorrect).length / veryRecent.length;

  // Calculate response time trends
  const avgResponseTime = recent.reduce((sum, a) => sum + a.responseTimeMs, 0) / recent.length;
  const answerChangeRate = recent.filter(a => a.answerChanged).length / recent.length;

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
  const responseTimes = veryRecent.map(a => a.responseTimeMs);
  const avgRecentTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const variance = responseTimes.reduce((sum, t) => sum + Math.pow(t - avgRecentTime, 2), 0) / responseTimes.length;
  const normalizedVariance = variance / (avgRecentTime * avgRecentTime);
  const attentionLevel = Math.max(20, Math.min(100, 80 - normalizedVariance * 100));

  // Working memory load
  const workingMemoryLoad = Math.min(100, 30 + answerChangeRate * 50);

  // Fatigue from session length and error clustering
  const sessionMinutes = (attempts[attempts.length - 1].timestamp - attempts[0].timestamp) / 60000;
  let fatigueLevel = Math.min(100, sessionMinutes * 0.8);
  
  // Check for declining performance
  if (attempts.length >= 20) {
    const early = attempts.slice(0, 10);
    const late = attempts.slice(-10);
    const earlyAccuracy = early.filter(a => a.wasCorrect).length / early.length;
    const lateAccuracy = late.filter(a => a.wasCorrect).length / late.length;
    if (lateAccuracy < earlyAccuracy - 0.15) {
      fatigueLevel += 20;
    }
  }

  // Flow state
  let flowState = 50;
  if (recentAccuracy >= 0.7 && recentAccuracy <= 0.9 && cognitiveLoad >= 40 && cognitiveLoad <= 70) {
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
  const totalAccuracy = attempts.filter(a => a.wasCorrect).length / attempts.length;
  
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
  const strongSystems = systemAccuracies.filter(([, data]) => data.accuracy >= 0.85 && data.total >= 3);

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
      description: 'You\'re in a great learning flow state right now',
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
  const warnings = insights.filter(i => i.category === 'warning' || i.category === 'weakness');
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

  const dominantError = Object.entries(errorCounts).sort(([,a], [,b]) => b - a)[0];
  if (dominantError && dominantError[1] >= 2) {
    const remediations: Record<string, string> = {
      [ERROR_TYPES.KNOWLEDGE_GAP]: 'Focus on foundational content before advanced topics',
      [ERROR_TYPES.INTERFERENCE]: 'Practice distinguishing similar conditions with side-by-side comparisons',
      [ERROR_TYPES.OVERTHINKING]: 'Set a personal rule: only change answer if you find concrete evidence',
      [ERROR_TYPES.CARELESS]: 'Use a mental checklist before submitting each answer',
      [ERROR_TYPES.TIME_PRESSURE]: 'Practice untimed first to build confidence, then add time limits',
    };
    
    if (remediations[dominantError[0]]) {
      recommendations.push(remediations[dominantError[0]]);
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

  if (sortedSystems.length > 0 && sortedSystems[0][1].accuracy < 0.7) {
    focus.push(`${sortedSystems[0][0]} system review`);
  }

  // Prioritize concepts with knowledge gaps
  const gapConcepts = errorClassifications
    .filter(e => e.errorType === ERROR_TYPES.KNOWLEDGE_GAP || e.errorType === ERROR_TYPES.INCOMPLETE_LEARNING)
    .map(e => e.conceptId);
  
  const uniqueGapConcepts = [...new Set(gapConcepts)].slice(0, 3);
  for (const concept of uniqueGapConcepts) {
    focus.push(`Deep dive: ${concept}`);
  }

  // Add review for interference patterns
  const interferenceConcepts = errorClassifications
    .filter(e => e.errorType === ERROR_TYPES.INTERFERENCE)
    .map(e => e.conceptId);
  
  if (interferenceConcepts.length >= 2) {
    focus.push('Comparison drill for confused concepts');
  }

  return focus.slice(0, 5);
}

// ============================================================================
// Helper Functions
// ============================================================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Main Handler
// ============================================================================

export async function onRequestPost(context: { request: Request; env: Env }) {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const body = await context.request.json() as AnalyzeSessionRequest;
    const { attempts, sessionStartTime, sessionEndTime } = body;

    if (!attempts || attempts.length === 0) {
      return new Response(JSON.stringify({ error: 'No attempts provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate basic metrics
    const totalCorrect = attempts.filter(a => a.wasCorrect).length;
    const sessionScore = Math.round((totalCorrect / attempts.length) * 100);

    // Calculate accuracy by system
    const accuracyBySystem: Record<string, { correct: number; total: number; accuracy: number }> = {};
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
      accuracyBySystem[system].accuracy = accuracyBySystem[system].correct / accuracyBySystem[system].total;
    }

    // Build difficulty curve
    const difficultyCurve = attempts.map((a, i) => ({
      questionNumber: i + 1,
      difficulty: a.difficulty,
      correct: a.wasCorrect,
    }));

    // Classify errors
    const avgResponseTime = attempts.reduce((sum, a) => sum + a.responseTimeMs, 0) / attempts.length;
    const incorrectAttempts = attempts.filter(a => !a.wasCorrect);
    const errorClassifications: ErrorClassification[] = [];
    
    for (const attempt of incorrectAttempts) {
      const previousAttempts = attempts.filter(a => a.timestamp < attempt.timestamp);
      const classification = classifyError(attempt, previousAttempts, avgResponseTime);
      errorClassifications.push(classification);
    }

    // Calculate error distribution
    const errorDistribution: Record<string, number> = {};
    for (const err of errorClassifications) {
      errorDistribution[err.errorType] = (errorDistribution[err.errorType] || 0) + 1;
    }

    // Find dominant error type
    const dominantErrorType = Object.entries(errorDistribution)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    // Calculate cognitive state
    const cognitiveState = calculateCognitiveState(attempts);

    // Should take break?
    const shouldTakeBreak = cognitiveState.fatigueLevel > 75 || 
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
    const conceptsAnalyzed = new Set(attempts.map(a => a.conditionId).filter(Boolean)).size;
    const conceptRetentionSummaries: ConceptRetentionSummary[] = [];
    
    // Group by concept and calculate trends
    const conceptAttempts: Record<string, SessionAttempt[]> = {};
    for (const attempt of attempts) {
      if (attempt.conditionId) {
        if (!conceptAttempts[attempt.conditionId]) {
          conceptAttempts[attempt.conditionId] = [];
        }
        conceptAttempts[attempt.conditionId].push(attempt);
      }
    }

    for (const [conceptId, conceptAtts] of Object.entries(conceptAttempts)) {
      const accuracy = conceptAtts.filter(a => a.wasCorrect).length / conceptAtts.length;
      const trend: 'improving' | 'stable' | 'declining' = 
        conceptAtts.length >= 3 
          ? (conceptAtts.slice(-2).every(a => a.wasCorrect) ? 'improving' 
             : conceptAtts.slice(-2).every(a => !a.wasCorrect) ? 'declining' 
             : 'stable')
          : 'stable';

      conceptRetentionSummaries.push({
        conceptId,
        system: conceptAtts[0]?.system || 'unknown',
        currentRetention: Math.round(accuracy * 100),
        reviewUrgency: accuracy < 0.5 ? 'overdue' : accuracy < 0.7 ? 'due' : 'stable',
        nextOptimalReview: new Date(Date.now() + (accuracy > 0.8 ? 7 : accuracy > 0.6 ? 3 : 1) * 86400000).toISOString(),
        consecutiveCorrect: conceptAtts.slice().reverse().findIndex(a => !a.wasCorrect),
        accuracyTrend: trend,
      });
    }

    // Knowledge gaps (simplified)
    const knowledgeGaps: KnowledgeGap[] = errorClassifications
      .filter(e => e.errorType === ERROR_TYPES.KNOWLEDGE_GAP || e.errorType === ERROR_TYPES.INCOMPLETE_LEARNING)
      .map(e => ({
        conceptId: e.conceptId,
        conceptName: e.conceptId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        system: attempts.find(a => a.conditionId === e.conceptId)?.system || 'unknown',
        gapType: e.errorType,
        severity: e.confidence > 70 ? 'significant' : 'moderate',
        blocksCount: 0, // Would calculate from concept graph
        suggestedResources: [e.remediation],
      }));

    // Calculate learning metrics
    const learningEfficiency = Math.round(
      (sessionScore * 0.4 + (100 - cognitiveState.cognitiveLoad) * 0.3 + cognitiveState.flowState * 0.3)
    );
    const retentionStrength = Math.round(
      sessionScore * 0.5 + 
      (conceptRetentionSummaries.filter(c => c.accuracyTrend === 'improving').length / Math.max(1, conceptRetentionSummaries.length)) * 50
    );
    const spacingEffectiveness = 70; // Would calculate from actual spacing data

    // Predictions (simplified)
    const predictedRetention7Days = Math.round(retentionStrength * 0.85);
    const predictedRetention30Days = Math.round(retentionStrength * 0.65);
    const estimatedTimeToMastery = Math.max(0, Math.round((80 - sessionScore) / 10 * 3)); // hours

    // Generate insights
    const insights = generateInsights(attempts, errorClassifications, cognitiveState, accuracyBySystem);

    // Generate recommendations
    const prioritizedRecommendations = generateRecommendations(insights, errorClassifications, accuracyBySystem);

    // Determine next session focus
    const nextSessionFocus = determineNextSessionFocus(accuracyBySystem, errorClassifications);

    // Save session analytics to database (optional)
    try {
      await prisma.studySession.create({
        data: {
          id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          userId: auth,
          startedAt: new Date(sessionStartTime),
          endedAt: new Date(sessionEndTime),
          totalQuestions: attempts.length,
          correctAnswers: totalCorrect,
          accuracy: totalCorrect / attempts.length,
          totalTimeMs: sessionEndTime - sessionStartTime,
          avgTimePerQuestion: Math.round(avgResponseTime),
          systemsCovered: [...new Set(attempts.map(a => a.system).filter(Boolean))] as string[],
          mode: body.mode,
        },
      });
    } catch (dbError) {
      console.warn('[AnalyzeSession] Failed to save session to database:', dbError);
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
        conceptsNeedingReview: conceptRetentionSummaries.filter(c => c.reviewUrgency !== 'stable').length,
        conceptsOverdue: conceptRetentionSummaries.filter(c => c.reviewUrgency === 'overdue').length,
        knowledgeGaps,
        criticalGapsCount: knowledgeGaps.filter(g => g.severity === 'significant' || g.severity === 'critical').length,
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

  } catch (error) {
    console.error('[AnalyzeSession] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
}
