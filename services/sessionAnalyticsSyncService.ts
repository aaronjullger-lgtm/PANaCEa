/**
 * Session Analytics Sync Service
 * 
 * Aggregates all session behavioral data and syncs to the database.
 * Collects data from all Sprint 4 behavioral services and sends to /api/analytics/session.
 */

import { getSessionSummary, calculateDistributionDrift } from './panceDistributionService';
import { analyzePatterns } from './answerPatternService';
import { calculateBehavioralCalibration, getBehavioralInsights } from './behavioralConfidenceService';
import { getMomentumInsights } from './sessionMomentumService';
import { getPrediction, getConfidenceInterval } from './performancePredictionService';

// Storage key for pending sync
const PENDING_SYNC_KEY = 'panceai_pending_session_sync';

export interface SessionAnalyticsPayload {
  sessionId?: string;
  startedAt: string;
  endedAt: string;
  
  // Core metrics
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  totalTimeMs: number;
  avgTimePerQuestion?: number;
  
  // Streak data
  bestStreak: number;
  finalStreak: number;
  avgStreak?: number;
  errorClusters?: number;
  
  // Momentum metrics
  peakMomentum?: number;
  avgMomentum?: number;
  momentumTrend?: string;
  
  // Behavioral signals
  totalAnswerChanges: number;
  helpfulChanges: number;
  harmfulChanges: number;
  firstInstinctAccuracy?: number;
  
  // Confidence calibration
  avgInferredConfidence?: number;
  highConfidenceAccuracy?: number;
  lowConfidenceAccuracy?: number;
  calibrationScore?: number;
  
  // Time pressure analysis
  questionsUnderPar?: number;
  questionsOverPar?: number;
  rushingAccuracy?: number;
  deliberateAccuracy?: number;
  
  // Fatigue indicators
  early10Accuracy?: number;
  late10Accuracy?: number;
  staminaFade?: number;
  
  // PANCE distribution
  distributionScore?: number;
  systemsCovered?: string[];
  
  // Predicted score
  predictedScore?: number;
  scoreConfidence?: string;
  passLikelihood?: number;
  
  // Session settings
  mode?: string;
  focus?: string;
  difficulty?: string;
  
  // Device info
  deviceType?: string;
  browserName?: string;
}

/**
 * Collect all session analytics from behavioral services
 */
export function collectSessionAnalytics(
  sessionStartTime: number,
  totalQuestions: number,
  correctAnswers: number,
  bestStreak: number,
  finalStreak: number,
  mode?: string,
  focus?: string,
  difficulty?: string
): SessionAnalyticsPayload {
  const endTime = Date.now();
  const totalTimeMs = endTime - sessionStartTime;
  const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  
  // Get PANCE distribution data
  const distributionSummary = getSessionSummary();
  
  // Get pattern analysis
  const patterns = analyzePatterns();
  
  // Get behavioral calibration
  const calibration = calculateBehavioralCalibration();
  const behavioralInsights = getBehavioralInsights();
  
  // Get momentum insights
  const momentum = getMomentumInsights();
  
  // Get performance prediction
  const prediction = getPrediction();
  const confidenceInterval = getConfidenceInterval();
  
  // Detect device type
  const deviceType = detectDeviceType();
  const browserName = detectBrowser();
  
  // Calculate error clusters from pattern data
  const errorClusters = countErrorClusters(patterns);
  
  // Calculate time pressure metrics from behavioral data
  const timePressureMetrics = calculateTimePressureMetrics(behavioralInsights);
  
  return {
    sessionId: generateSessionId(),
    startedAt: new Date(sessionStartTime).toISOString(),
    endedAt: new Date(endTime).toISOString(),
    
    // Core metrics
    totalQuestions,
    correctAnswers,
    accuracy,
    totalTimeMs,
    avgTimePerQuestion: totalQuestions > 0 ? Math.round(totalTimeMs / totalQuestions) : undefined,
    
    // Streak data
    bestStreak,
    finalStreak,
    avgStreak: patterns.avgStreakLength,
    errorClusters,
    
    // Momentum metrics
    peakMomentum: momentum?.peakMomentum,
    avgMomentum: momentum?.avgMomentum,
    momentumTrend: momentum?.currentLevel,
    
    // Behavioral signals
    totalAnswerChanges: patterns.totalChanges || 0,
    helpfulChanges: patterns.changedToCorrect || 0,
    harmfulChanges: patterns.changedToWrong || 0,
    firstInstinctAccuracy: patterns.firstInstinctAccuracy,
    
    // Confidence calibration (calibration returns high/medium/low directly, not in breakdown)
    avgInferredConfidence: undefined, // Not available in current calibration structure
    highConfidenceAccuracy: calibration.high?.accuracy,
    lowConfidenceAccuracy: calibration.low?.accuracy,
    calibrationScore: calibration.calibrationScore,
    
    // Time pressure analysis
    questionsUnderPar: timePressureMetrics.underPar,
    questionsOverPar: timePressureMetrics.overPar,
    rushingAccuracy: timePressureMetrics.rushingAccuracy,
    deliberateAccuracy: timePressureMetrics.deliberateAccuracy,
    
    // Fatigue indicators
    early10Accuracy: behavioralInsights?.early10Accuracy,
    late10Accuracy: behavioralInsights?.late10Accuracy,
    staminaFade: behavioralInsights?.staminaFade,
    
    // PANCE distribution
    distributionScore: distributionSummary?.distributionScore,
    systemsCovered: Object.keys(distributionSummary?.systemBreakdown || {}),
    
    // Predicted score
    predictedScore: prediction?.predictedScore,
    scoreConfidence: prediction?.confidence,
    passLikelihood: prediction?.passLikelihood,
    
    // Session settings
    mode,
    focus,
    difficulty,
    
    // Device info
    deviceType,
    browserName,
  };
}

/**
 * Sync session analytics to the database
 */
export async function syncSessionAnalytics(
  payload: SessionAnalyticsPayload,
  token?: string | null
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/analytics/session', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[SessionAnalyticsSync] API error:', error);
      
      // Queue for retry if offline or server error
      if (response.status >= 500 || !navigator.onLine) {
        queueForRetry(payload);
      }
      
      return { success: false, error: error.error || 'Failed to sync' };
    }

    const result = await response.json();
    console.log('[SessionAnalyticsSync] Success:', result.sessionId);
    
    return { success: true, sessionId: result.sessionId };
    
  } catch (error) {
    console.error('[SessionAnalyticsSync] Network error:', error);
    
    // Queue for retry on network failure
    queueForRetry(payload);
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

/**
 * Queue session for retry when offline
 */
function queueForRetry(payload: SessionAnalyticsPayload): void {
  try {
    const pending = getPendingSync();
    pending.push(payload);
    
    // Keep only last 10 pending sessions
    if (pending.length > 10) {
      pending.shift();
    }
    
    sessionStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
    console.log('[SessionAnalyticsSync] Queued for retry, pending:', pending.length);
  } catch (error) {
    console.error('[SessionAnalyticsSync] Failed to queue:', error);
  }
}

/**
 * Get pending sessions awaiting sync
 */
function getPendingSync(): SessionAnalyticsPayload[] {
  try {
    const raw = sessionStorage.getItem(PENDING_SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Process pending session syncs
 */
export async function processPendingSync(token?: string | null): Promise<{
  synced: number;
  failed: number;
}> {
  const pending = getPendingSync();
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  console.log('[SessionAnalyticsSync] Processing pending:', pending.length);
  
  let synced = 0;
  let failed = 0;
  const remaining: SessionAnalyticsPayload[] = [];

  for (const payload of pending) {
    const result = await syncSessionAnalytics(payload, token);
    if (result.success) {
      synced++;
    } else {
      failed++;
      remaining.push(payload);
    }
  }

  // Update pending queue
  try {
    sessionStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
  } catch {}

  return { synced, failed };
}

/**
 * Get user's learning profile from the database
 */
export async function fetchLearningProfile(
  token?: string | null
): Promise<{
  profile: any | null;
  sessions: any[];
  aggregateStats: any | null;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/analytics/session?includeProfile=true&limit=20', {
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { profile: null, sessions: [], aggregateStats: null, error: error.error };
    }

    const data = await response.json();
    return {
      profile: data.profile,
      sessions: data.sessions || [],
      aggregateStats: data.aggregateStats,
    };
    
  } catch (error) {
    console.error('[SessionAnalyticsSync] Fetch profile error:', error);
    return {
      profile: null,
      sessions: [],
      aggregateStats: null,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function detectDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent.toLowerCase();
  
  if (/ipad|tablet|playbook|silk/.test(ua) || 
      (ua.includes('android') && !ua.includes('mobile'))) {
    return 'tablet';
  }
  
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) {
    return 'mobile';
  }
  
  return 'desktop';
}

function detectBrowser(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent;
  
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Edg')) return 'edge';
  
  return 'other';
}

function countErrorClusters(patterns: ReturnType<typeof analyzePatterns>): number {
  // Count sequences of 3+ errors within 5 questions
  // This is a simplified approximation based on pattern data
  const errorRate = patterns.firstInstinctAccuracy !== undefined
    ? 100 - patterns.firstInstinctAccuracy
    : 30; // Default assumption
    
  // Estimate clusters based on error rate
  // Higher error rates tend to cluster
  if (errorRate > 50) return Math.ceil(errorRate / 20);
  if (errorRate > 30) return Math.ceil(errorRate / 30);
  return 0;
}

interface TimePressureMetrics {
  underPar: number;
  overPar: number;
  rushingAccuracy?: number;
  deliberateAccuracy?: number;
}

function calculateTimePressureMetrics(
  insights: ReturnType<typeof getBehavioralInsights> | null
): TimePressureMetrics {
  if (!insights) {
    return { underPar: 0, overPar: 0 };
  }

  // These values would ideally come from the behavioral service
  // For now, estimate based on available calibration data
  return {
    underPar: Math.round((insights.rushingTendency || 0) * 10),
    overPar: Math.round((1 - (insights.rushingTendency || 0.5)) * 10),
    rushingAccuracy: insights.rushingAccuracy,
    deliberateAccuracy: insights.deliberateAccuracy,
  };
}
