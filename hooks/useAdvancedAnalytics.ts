/**
 * useAdvancedAnalytics Hook
 *
 * Real-time analytics hook that provides:
 * - Live cognitive state monitoring
 * - Automatic data point recording after each question
 * - Smart break suggestions
 * - Adaptive session recommendations
 * - Integration with question generation and FSRS
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCognitiveState,
  getLearningVelocity,
  recordCognitiveDataPoint,
  recordTimeOfDayAttempt,
  recordSessionVelocity,
  shouldSuggestBreak,
  getOptimalStudyTime,
  generateComprehensiveAnalytics,
  type CognitiveState,
  type LearningVelocity,
  type SystemMasteryProfile,
  type ComprehensiveUserAnalytics,
  type AnalyticsInsight,
} from '@/services/analytics';
import {
  getAdaptiveFSRS,
  generateAdaptiveStudyPlan,
  type StudySessionPlan,
} from '@/services/domain';
import {
  getIntelligentQuestions,
  enhanceSessionSettings,
  type IntelligentQuestionResult,
} from '@/services/ai';
import { storeQuestionAttempt, generateId, type QuestionAttemptRecord } from '@/services/analytics';
import type { Question, SessionSettings } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsState {
  cognitiveState: CognitiveState;
  learningVelocity: LearningVelocity;
  breakSuggestion: { suggest: boolean; reason?: string };
  optimalStudyTime: { hour: number; confidence: number };
  activeInsights: AnalyticsInsight[];
  sessionPlan: StudySessionPlan | null;
  isTracking: boolean;
}

export interface QuestionAnalyticsData {
  questionId: string;
  responseTimeMs: number;
  wasCorrect: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  answerChanges: number;
  eliminationsUsed: number;
  system: string;
}

export interface UseAdvancedAnalyticsReturn {
  /** Current analytics state */
  state: AnalyticsState;
  /** Record data after answering a question */
  recordQuestionAttempt: (data: QuestionAnalyticsData) => void;
  /** Alias for recordQuestionAttempt (backwards compatibility) */
  recordQuestionResult?: (data: QuestionAnalyticsData) => void;
  /** Current cognitive state */
  cognitiveState?: CognitiveState;
  /** Get intelligent questions based on current state */
  getSmartQuestions: (count: number) => Promise<Question[]>;
  /** Enhance session settings with analytics intelligence */
  getEnhancedSettings: (settings: SessionSettings) => SessionSettings;
  /** Generate a personalized study plan */
  generateStudyPlan: (availableMinutes: number) => StudySessionPlan;
  /** Start tracking for a new session */
  startTracking: () => void;
  /** Stop tracking and finalize session data */
  stopTracking: () => void;
  /** Force refresh all analytics */
  refresh: () => void;
  /** Dismiss break suggestion */
  dismissBreakSuggestion: () => void;
  /** Get current estimated PANCE score */
  estimatedScore: number | null;
  /** Get personalized recommendations */
  recommendations: string[];
  /** Check if user is in flow state */
  isInFlowState: boolean;
  /** Current session duration in minutes */
  sessionDuration: number;
  /** Questions answered this session */
  questionsThisSession: number;
  /** Accuracy this session */
  sessionAccuracy: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAdvancedAnalytics(
  systemMastery: SystemMasteryProfile[] = [],
  userId?: string
): UseAdvancedAnalyticsReturn {
  // State
  const [state, setState] = useState<AnalyticsState>({
    cognitiveState: {
      cognitiveLoad: 50,
      attentionLevel: 70,
      workingMemoryLoad: 50,
      fatigueLevel: 20,
      flowState: 50,
      timestamp: Date.now(),
    },
    learningVelocity: {
      masteryRate: 0,
      conceptsPerSession: 0,
      retentionEfficiency: 85,
      trend: 'stable',
      personalBestRatio: 0,
    },
    breakSuggestion: { suggest: false },
    optimalStudyTime: { hour: 19, confidence: 0.3 },
    activeInsights: [],
    sessionPlan: null,
    isTracking: false,
  });

  // Session tracking
  const sessionStartRef = useRef<number | null>(null);
  const questionsRef = useRef<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const consecutiveErrorsRef = useRef(0);

  // Computed values
  const [estimatedScore, setEstimatedScore] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  // Refresh analytics state
  const refresh = useCallback(() => {
    try {
      const cognitive = getCognitiveState();
      const velocity = getLearningVelocity();
      const breakCheck = shouldSuggestBreak();
      const optimalTime = getOptimalStudyTime();

      setState((prev) => ({
        ...prev,
        cognitiveState: cognitive,
        learningVelocity: velocity,
        breakSuggestion: breakCheck,
        optimalStudyTime: optimalTime,
      }));

      // Generate comprehensive analytics if we have user data
      if (userId && systemMastery.length > 0) {
        const overall =
          questionsRef.current.total > 0
            ? (questionsRef.current.correct / questionsRef.current.total) * 100
            : 70;

        const analytics = generateComprehensiveAnalytics(
          userId,
          systemMastery,
          overall,
          questionsRef.current.total
        );

        setEstimatedScore(analytics.predictedPANCEScore);
        setRecommendations(
          analytics.insights
            .filter((i) => i.actionable)
            .map((i) => i.description)
            .slice(0, 5)
        );
        setState((prev) => ({
          ...prev,
          activeInsights: analytics.insights,
        }));
      }
    } catch (error) {
      console.warn('[useAdvancedAnalytics] Refresh error:', error);
    }
  }, [userId, systemMastery]);

  // Initial load and periodic refresh
  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [refresh]);

  // Start tracking
  const startTracking = useCallback(() => {
    sessionStartRef.current = Date.now();
    questionsRef.current = { correct: 0, total: 0 };
    consecutiveErrorsRef.current = 0;

    setState((prev) => ({ ...prev, isTracking: true }));

    // Initialize FSRS with current mastery
    getAdaptiveFSRS(systemMastery);

    if (import.meta.env.DEV) console.debug('[Analytics] Session tracking started');
  }, [systemMastery]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (sessionStartRef.current) {
      const sessionDuration = Date.now() - sessionStartRef.current;
      const { correct, total } = questionsRef.current;

      // Record session velocity
      recordSessionVelocity({
        timestamp: Date.now(),
        questionsCorrect: correct,
        questionsTotal: total,
        newConceptsIntroduced: Math.floor(total * 0.3), // Estimate
        conceptsRetained: Math.floor(correct * 0.9), // Estimate
        sessionDurationMs: sessionDuration,
      });

      if (import.meta.env.DEV) console.debug('[Analytics] Session tracking stopped', {
        duration: sessionDuration / 60000,
        questions: total,
        accuracy: total > 0 ? (correct / total) * 100 : 0,
      });
    }

    sessionStartRef.current = null;
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  // Record question attempt
  const recordQuestionAttempt = useCallback(
    (data: QuestionAnalyticsData) => {
      // Update session counters
      questionsRef.current.total++;
      if (data.wasCorrect) {
        questionsRef.current.correct++;
        consecutiveErrorsRef.current = 0;
      } else {
        consecutiveErrorsRef.current++;
      }

      // Record cognitive data point
      recordCognitiveDataPoint({
        timestamp: Date.now(),
        responseTimeMs: data.responseTimeMs,
        wasCorrect: data.wasCorrect,
        difficulty: data.difficulty,
        answerChanges: data.answerChanges,
        eliminationsUsed: data.eliminationsUsed,
        sequentialErrors: consecutiveErrorsRef.current,
      });

      // Record time-of-day data
      const cognitive = getCognitiveState();
      recordTimeOfDayAttempt(data.wasCorrect, data.responseTimeMs, cognitive.cognitiveLoad);

      // Store in deep analytics store for research-backed analysis
      const now = new Date();
      const attemptRecord: QuestionAttemptRecord = {
        id: generateId(),
        questionId: data.questionId,
        timestamp: Date.now(),
        isCorrect: data.wasCorrect,
        timeToAnswerMs: data.responseTimeMs,
        parTimeMs: data.difficulty === 'hard' ? 90000 : data.difficulty === 'easy' ? 45000 : 60000,
        timeRatio:
          data.responseTimeMs /
          (data.difficulty === 'hard' ? 90000 : data.difficulty === 'easy' ? 45000 : 60000),
        system: data.system,
        difficulty: data.difficulty,
        answerChanges: data.answerChanges,
        firstAnswer: null, // Would need to track this upstream
        finalAnswer: 0,
        correctAnswer: 0,
        eliminatedCount: data.eliminationsUsed,
        hesitationMs: 0,
        inferredConfidence: data.wasCorrect ? 75 : 45, // Simple heuristic
        behavioralConfidence: cognitive.flowState,
        cognitiveLoad: cognitive.cognitiveLoad,
        fatigueLevel: cognitive.fatigueLevel,
        flowState: cognitive.flowState,
        sessionId: sessionStartRef.current?.toString() || 'unknown',
        questionNumberInSession: questionsRef.current.total,
        streakAtQuestion: consecutiveErrorsRef.current === 0 ? questionsRef.current.total : 0,
        sessionAccuracyAtQuestion:
          questionsRef.current.total > 0
            ? (questionsRef.current.correct / questionsRef.current.total) * 100
            : 0,
        hourOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        minutesSinceSessionStart: sessionStartRef.current
          ? (Date.now() - sessionStartRef.current) / 60000
          : 0,
      };

      // Store asynchronously (non-blocking)
      storeQuestionAttempt(attemptRecord).catch((err) => {
        console.warn('[useAdvancedAnalytics] Failed to store attempt:', err);
      });

      // Refresh state after recording
      setTimeout(refresh, 100);
    },
    [refresh]
  );

  // Get smart questions
  const getSmartQuestions = useCallback(
    async (count: number): Promise<Question[]> => {
      try {
        const result = await getIntelligentQuestions(
          {
            maxQuestions: count,
            includeWeakAreas: true,
            includeReviews: true,
          },
          systemMastery,
          [] // Previous question IDs
        );

        // Update session plan
        setState((prev) => ({
          ...prev,
          sessionPlan: {
            recommendedQuestions: result.sessionPlan.recommendedCount,
            newCardsLimit: Math.floor(result.sessionPlan.recommendedCount * 0.3),
            reviewCardsLimit: Math.floor(result.sessionPlan.recommendedCount * 0.7),
            focusSystems: result.sessionPlan.systemFocus,
            estimatedTimeMinutes: result.sessionPlan.estimatedTime,
            breakSuggestions: result.sessionPlan.breakAfter
              ? [{ afterQuestion: result.sessionPlan.breakAfter, durationMinutes: 5 }]
              : [],
            difficultyProgression: ['easy', 'medium', 'hard'],
          },
        }));

        return result.questions;
      } catch (error) {
        console.error('[useAdvancedAnalytics] Smart questions error:', error);
        return [];
      }
    },
    [systemMastery]
  );

  // Enhance settings
  const getEnhancedSettings = useCallback(
    (settings: SessionSettings): SessionSettings => {
      try {
        const enhanced = enhanceSessionSettings(settings, systemMastery);
        return enhanced;
      } catch (error) {
        console.warn('[useAdvancedAnalytics] Settings enhancement error:', error);
        return settings;
      }
    },
    [systemMastery]
  );

  // Generate study plan
  const generateStudyPlan = useCallback(
    (availableMinutes: number): StudySessionPlan => {
      try {
        return generateAdaptiveStudyPlan(
          availableMinutes,
          20, // Estimated new cards
          10, // Estimated reviews
          systemMastery
        );
      } catch (error) {
        console.warn('[useAdvancedAnalytics] Study plan error:', error);
        return {
          recommendedQuestions: Math.floor(availableMinutes * 0.8),
          newCardsLimit: 10,
          reviewCardsLimit: 15,
          focusSystems: [],
          estimatedTimeMinutes: availableMinutes,
          breakSuggestions: [],
          difficultyProgression: ['easy', 'medium', 'hard'],
        };
      }
    },
    [systemMastery]
  );

  // Dismiss break suggestion
  const dismissBreakSuggestion = useCallback(() => {
    setState((prev) => ({
      ...prev,
      breakSuggestion: { suggest: false },
    }));
  }, []);

  // Computed properties
  const isInFlowState = state.cognitiveState.flowState > 70;

  const sessionDuration = sessionStartRef.current
    ? Math.floor((Date.now() - sessionStartRef.current) / 60000)
    : 0;

  const questionsThisSession = questionsRef.current.total;

  const sessionAccuracy =
    questionsRef.current.total > 0
      ? (questionsRef.current.correct / questionsRef.current.total) * 100
      : 0;

  return {
    state,
    recordQuestionAttempt,
    recordQuestionResult: recordQuestionAttempt, // Alias
    cognitiveState: state.cognitiveState,
    getSmartQuestions,
    getEnhancedSettings,
    generateStudyPlan,
    startTracking,
    stopTracking,
    refresh,
    dismissBreakSuggestion,
    estimatedScore,
    recommendations,
    isInFlowState,
    sessionDuration,
    questionsThisSession,
    sessionAccuracy,
  };
}

export default useAdvancedAnalytics;
