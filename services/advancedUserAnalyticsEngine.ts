/**
 * Advanced User Analytics Engine
 * 
 * Comprehensive cognitive and performance analytics system that:
 * - Tracks cognitive load and mental fatigue in real-time
 * - Identifies learning patterns and optimal study conditions
 * - Provides personalized FSRS parameter adjustments
 * - Generates adaptive question targeting based on user state
 * - Predicts performance with high accuracy
 * 
 * This is the brain of the personalized learning system.
 */

import type { FSRSParameters } from '../lib/fsrs';
import { defaultParameters } from '../lib/fsrs';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CognitiveState {
  /** Current mental load (0-100) */
  cognitiveLoad: number;
  /** Sustained attention level (0-100) */
  attentionLevel: number;
  /** Working memory utilization estimate (0-100) */
  workingMemoryLoad: number;
  /** Fatigue indicator (0-100, higher = more fatigued) */
  fatigueLevel: number;
  /** Flow state indicator (0-100) */
  flowState: number;
  /** Time of measurement */
  timestamp: number;
}

export interface LearningVelocity {
  /** Questions mastered per hour */
  masteryRate: number;
  /** New concepts absorbed per session */
  conceptsPerSession: number;
  /** Retention efficiency (% retained after 24h) */
  retentionEfficiency: number;
  /** Trend direction */
  trend: 'accelerating' | 'stable' | 'decelerating';
  /** Comparison to personal best */
  personalBestRatio: number;
}

export interface ResponsePatternMetrics {
  /** Time from question display to first interaction (ms) */
  initialProcessingTime: number;
  /** Time spent reading before answering */
  readingPhaseMs: number;
  /** Time in deliberation/elimination phase */
  deliberationPhaseMs: number;
  /** Confidence of final selection based on timing */
  selectionConfidence: number;
  /** Number of option revisits */
  optionRevisits: number;
  /** Elimination pattern score (0=random, 100=systematic) */
  eliminationSystematicity: number;
}

export interface PerformanceByTimeOfDay {
  hour: number;
  accuracy: number;
  avgTimeMs: number;
  cognitiveLoadAvg: number;
  questionsAttempted: number;
}

export interface PerformanceByDayOfWeek {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  accuracy: number;
  avgStudyMinutes: number;
  retentionRate: number;
}

export interface SystemMasteryProfile {
  system: string;
  masteryLevel: number; // 0-100
  stabilityScore: number; // FSRS-derived
  difficultyRating: number; // Personal difficulty
  forgettingCurve: number; // Days to 50% retention
  optimalReviewInterval: number; // Days
  questionsSeen: number;
  lastReviewed: Date | null;
  weakSubtopics: string[];
  strongSubtopics: string[];
}

export interface OptimalStudyConditions {
  bestTimeOfDay: number; // Hour (0-23)
  bestDayOfWeek: number; // 0=Sun, 6=Sat
  optimalSessionLength: number; // Minutes
  optimalBreakInterval: number; // Minutes between breaks
  idealDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  preferredQuestionTypes: string[];
  environmentFactors: {
    devicePreference: 'desktop' | 'mobile' | 'tablet';
    sessionTimePreference: 'short' | 'medium' | 'long';
  };
}

export interface PersonalizedFSRSParams {
  parameters: FSRSParameters;
  confidence: number;
  lastCalibration: Date;
  improvements: string[];
  systemOverrides: Map<string, Partial<FSRSParameters>>;
}

export interface QuestionTargeting {
  /** Priority-ordered list of systems to target */
  targetSystems: Array<{ system: string; priority: number; reason: string }>;
  /** Recommended difficulty level */
  recommendedDifficulty: 'easy' | 'medium' | 'hard';
  /** Specific condition IDs to prioritize */
  priorityConditions: string[];
  /** Concepts due for spaced review */
  dueForReview: Array<{ conditionId: string; dueDate: Date; urgency: number }>;
  /** Suggested question format preferences */
  formatPreferences: {
    preferVignettes: boolean;
    includeImages: boolean;
    focusOnDifferentials: boolean;
  };
}

export interface ComprehensiveUserAnalytics {
  userId: string;
  cognitiveState: CognitiveState;
  learningVelocity: LearningVelocity;
  optimalConditions: OptimalStudyConditions;
  systemMastery: SystemMasteryProfile[];
  fsrsParams: PersonalizedFSRSParams;
  questionTargeting: QuestionTargeting;
  predictedPANCEScore: number;
  predictedPassProbability: number;
  daysToExamReadiness: number | null;
  insights: AnalyticsInsight[];
  lastUpdated: Date;
}

export interface AnalyticsInsight {
  id: string;
  type: 'strength' | 'weakness' | 'opportunity' | 'alert' | 'milestone';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  description: string;
  actionable: boolean;
  action?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  COGNITIVE_HISTORY: 'panceai_cognitive_history',
  RESPONSE_PATTERNS: 'panceai_response_patterns',
  TIME_OF_DAY_STATS: 'panceai_tod_stats',
  LEARNING_VELOCITY: 'panceai_learning_velocity',
  PERSONALIZED_FSRS: 'panceai_personalized_fsrs',
  SESSION_COGNITIVE: 'panceai_session_cognitive',
} as const;

// ============================================================================
// Cognitive Load Tracking
// ============================================================================

interface CognitiveDataPoint {
  timestamp: number;
  responseTimeMs: number;
  wasCorrect: boolean;
  difficulty: string;
  answerChanges: number;
  eliminationsUsed: number;
  sequentialErrors: number;
}

const cognitiveHistory: CognitiveDataPoint[] = [];
let currentCognitiveState: CognitiveState | null = null;

/**
 * Record a cognitive data point after answering a question
 */
export function recordCognitiveDataPoint(data: CognitiveDataPoint): void {
  cognitiveHistory.push(data);
  
  // Keep last 100 data points in memory
  if (cognitiveHistory.length > 100) {
    cognitiveHistory.shift();
  }
  
  // Update cognitive state estimate
  updateCognitiveState();
  
  // Persist to session storage
  try {
    const existing = sessionStorage.getItem(STORAGE_KEYS.SESSION_COGNITIVE);
    const history = existing ? JSON.parse(existing) : [];
    history.push(data);
    if (history.length > 200) history.shift();
    sessionStorage.setItem(STORAGE_KEYS.SESSION_COGNITIVE, JSON.stringify(history));
  } catch (e) {
    console.warn('[AdvancedAnalytics] Failed to persist cognitive data:', e);
  }
}

/**
 * Calculate current cognitive state from recent data points
 */
function updateCognitiveState(): void {
  if (cognitiveHistory.length < 3) {
    currentCognitiveState = {
      cognitiveLoad: 50,
      attentionLevel: 70,
      workingMemoryLoad: 50,
      fatigueLevel: 20,
      flowState: 50,
      timestamp: Date.now(),
    };
    return;
  }
  
  const recent = cognitiveHistory.slice(-15);
  const veryRecent = cognitiveHistory.slice(-5);
  
  // Calculate cognitive load based on response times and accuracy
  const avgResponseTime = average(recent.map(d => d.responseTimeMs));
  const recentAccuracy = veryRecent.filter(d => d.wasCorrect).length / veryRecent.length;
  const answerChangeRate = average(recent.map(d => d.answerChanges));
  
  // Cognitive load increases with:
  // - Longer response times (struggling)
  // - More answer changes (uncertainty)
  // - Lower accuracy (overload)
  let cognitiveLoad = 50;
  
  // Time factor (assuming 60s is baseline)
  const timeRatio = avgResponseTime / 60000;
  if (timeRatio > 1.5) cognitiveLoad += 20;
  else if (timeRatio > 1.2) cognitiveLoad += 10;
  else if (timeRatio < 0.7) cognitiveLoad -= 10;
  
  // Answer change factor
  cognitiveLoad += answerChangeRate * 10;
  
  // Accuracy factor
  if (recentAccuracy < 0.5) cognitiveLoad += 15;
  else if (recentAccuracy < 0.7) cognitiveLoad += 5;
  else if (recentAccuracy > 0.85) cognitiveLoad -= 10;
  
  // Attention level based on response consistency
  const responseTimes = veryRecent.map(d => d.responseTimeMs);
  const responseVariance = variance(responseTimes);
  const normalizedVariance = responseVariance / (avgResponseTime * avgResponseTime);
  const attentionLevel = Math.max(20, Math.min(100, 80 - normalizedVariance * 100));
  
  // Working memory load from elimination patterns
  const avgEliminations = average(recent.map(d => d.eliminationsUsed));
  const workingMemoryLoad = Math.min(100, 30 + avgEliminations * 15);
  
  // Fatigue detection from error clustering and time trends
  const errorClusterRate = countErrorClusters(veryRecent);
  const sessionLength = Date.now() - (cognitiveHistory[0]?.timestamp || Date.now());
  const sessionMinutes = sessionLength / 60000;
  let fatigueLevel = Math.min(100, sessionMinutes * 0.8 + errorClusterRate * 15);
  
  // Detect response time drift (increasing over session = fatigue)
  if (cognitiveHistory.length >= 20) {
    const early = cognitiveHistory.slice(0, 10);
    const late = cognitiveHistory.slice(-10);
    const earlyAvg = average(early.map(d => d.responseTimeMs));
    const lateAvg = average(late.map(d => d.responseTimeMs));
    if (lateAvg > earlyAvg * 1.3) {
      fatigueLevel += 15;
    }
  }
  
  // Flow state - optimal challenge with good accuracy
  let flowState = 50;
  if (recentAccuracy >= 0.7 && recentAccuracy <= 0.9 && cognitiveLoad >= 40 && cognitiveLoad <= 70) {
    flowState = 80 + (recentAccuracy - 0.7) * 100;
  } else if (recentAccuracy > 0.9 && cognitiveLoad < 40) {
    // Too easy
    flowState = 40;
  } else if (recentAccuracy < 0.5 && cognitiveLoad > 70) {
    // Too hard
    flowState = 30;
  }
  
  currentCognitiveState = {
    cognitiveLoad: clamp(cognitiveLoad, 0, 100),
    attentionLevel: clamp(attentionLevel, 0, 100),
    workingMemoryLoad: clamp(workingMemoryLoad, 0, 100),
    fatigueLevel: clamp(fatigueLevel, 0, 100),
    flowState: clamp(flowState, 0, 100),
    timestamp: Date.now(),
  };
}

/**
 * Get current cognitive state
 */
export function getCognitiveState(): CognitiveState {
  if (!currentCognitiveState) {
    updateCognitiveState();
  }
  return currentCognitiveState!;
}

/**
 * Check if user should take a break based on cognitive state
 */
export function shouldSuggestBreak(): { suggest: boolean; reason?: string } {
  const state = getCognitiveState();
  
  if (state.fatigueLevel > 75) {
    return { suggest: true, reason: 'High fatigue detected - your accuracy may decline' };
  }
  
  if (state.attentionLevel < 40) {
    return { suggest: true, reason: 'Attention is wandering - a short break may help' };
  }
  
  if (state.cognitiveLoad > 85 && state.flowState < 30) {
    return { suggest: true, reason: 'Cognitive overload - give your brain a rest' };
  }
  
  return { suggest: false };
}

// ============================================================================
// Learning Velocity Tracking
// ============================================================================

interface VelocityDataPoint {
  timestamp: number;
  questionsCorrect: number;
  questionsTotal: number;
  newConceptsIntroduced: number;
  conceptsRetained: number; // From spaced review
  sessionDurationMs: number;
}

const velocityHistory: VelocityDataPoint[] = [];

/**
 * Record session velocity data
 */
export function recordSessionVelocity(data: VelocityDataPoint): void {
  velocityHistory.push(data);
  
  // Keep last 30 sessions
  if (velocityHistory.length > 30) {
    velocityHistory.shift();
  }
  
  // Persist
  try {
    localStorage.setItem(STORAGE_KEYS.LEARNING_VELOCITY, JSON.stringify(velocityHistory));
  } catch (e) {
    console.warn('[AdvancedAnalytics] Failed to persist velocity data:', e);
  }
}

/**
 * Calculate current learning velocity
 */
export function getLearningVelocity(): LearningVelocity {
  if (velocityHistory.length < 2) {
    return {
      masteryRate: 0,
      conceptsPerSession: 0,
      retentionEfficiency: 85,
      trend: 'stable',
      personalBestRatio: 0,
    };
  }
  
  const recent = velocityHistory.slice(-5);
  const older = velocityHistory.slice(-15, -5);
  
  // Mastery rate: questions correct per hour
  const totalTime = recent.reduce((sum, d) => sum + d.sessionDurationMs, 0);
  const totalCorrect = recent.reduce((sum, d) => sum + d.questionsCorrect, 0);
  const masteryRate = totalTime > 0 ? (totalCorrect / totalTime) * 3600000 : 0;
  
  // Concepts per session
  const conceptsPerSession = average(recent.map(d => d.newConceptsIntroduced));
  
  // Retention efficiency
  const totalRetained = recent.reduce((sum, d) => sum + d.conceptsRetained, 0);
  const totalIntroduced = recent.reduce((sum, d) => sum + d.newConceptsIntroduced, 0);
  const retentionEfficiency = totalIntroduced > 0 
    ? (totalRetained / totalIntroduced) * 100 
    : 85;
  
  // Trend analysis
  let trend: 'accelerating' | 'stable' | 'decelerating' = 'stable';
  if (older.length >= 3) {
    const recentRate = average(recent.map(d => d.questionsCorrect / (d.sessionDurationMs / 3600000)));
    const olderRate = average(older.map(d => d.questionsCorrect / (d.sessionDurationMs / 3600000)));
    
    if (recentRate > olderRate * 1.1) trend = 'accelerating';
    else if (recentRate < olderRate * 0.9) trend = 'decelerating';
  }
  
  // Personal best comparison
  const allRates = velocityHistory.map(d => d.questionsCorrect / (d.sessionDurationMs / 3600000));
  const personalBest = Math.max(...allRates);
  const personalBestRatio = personalBest > 0 ? masteryRate / personalBest : 0;
  
  return {
    masteryRate,
    conceptsPerSession,
    retentionEfficiency,
    trend,
    personalBestRatio,
  };
}

// ============================================================================
// Time-of-Day Performance Analysis
// ============================================================================

interface TimeOfDayData {
  hour: number;
  attempts: number;
  correct: number;
  totalTimeMs: number;
  cognitiveLoadSum: number;
}

/**
 * Get performance breakdown by hour of day
 */
export function getPerformanceByTimeOfDay(): PerformanceByTimeOfDay[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TIME_OF_DAY_STATS);
    if (!stored) return [];
    
    const data: TimeOfDayData[] = JSON.parse(stored);
    
    return data
      .filter(d => d.attempts >= 5)
      .map(d => ({
        hour: d.hour,
        accuracy: (d.correct / d.attempts) * 100,
        avgTimeMs: d.totalTimeMs / d.attempts,
        cognitiveLoadAvg: d.cognitiveLoadSum / d.attempts,
        questionsAttempted: d.attempts,
      }));
  } catch {
    return [];
  }
}

/**
 * Record attempt for time-of-day analysis
 */
export function recordTimeOfDayAttempt(
  wasCorrect: boolean,
  timeMs: number,
  cognitiveLoad: number
): void {
  const hour = new Date().getHours();
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TIME_OF_DAY_STATS);
    const data: TimeOfDayData[] = stored ? JSON.parse(stored) : [];
    
    let hourData = data.find(d => d.hour === hour);
    if (!hourData) {
      hourData = { hour, attempts: 0, correct: 0, totalTimeMs: 0, cognitiveLoadSum: 0 };
      data.push(hourData);
    }
    
    hourData.attempts++;
    if (wasCorrect) hourData.correct++;
    hourData.totalTimeMs += timeMs;
    hourData.cognitiveLoadSum += cognitiveLoad;
    
    localStorage.setItem(STORAGE_KEYS.TIME_OF_DAY_STATS, JSON.stringify(data));
  } catch (e) {
    console.warn('[AdvancedAnalytics] Failed to record TOD data:', e);
  }
}

/**
 * Find optimal study time based on historical performance
 */
export function getOptimalStudyTime(): { hour: number; confidence: number } {
  const todStats = getPerformanceByTimeOfDay();
  
  if (todStats.length < 3) {
    return { hour: 19, confidence: 0.3 }; // Default to 7 PM with low confidence
  }
  
  // Weight accuracy highly, but also consider cognitive load
  const scored = todStats.map(d => ({
    hour: d.hour,
    score: d.accuracy * 0.7 + (100 - d.cognitiveLoadAvg) * 0.3,
    samples: d.questionsAttempted,
  }));
  
  // Find best hour with sufficient samples
  const qualified = scored.filter(s => s.samples >= 10);
  if (qualified.length === 0) {
    const best = scored.reduce((a, b) => a.score > b.score ? a : b);
    return { hour: best.hour, confidence: 0.4 };
  }
  
  const best = qualified.reduce((a, b) => a.score > b.score ? a : b);
  const confidence = Math.min(0.95, 0.5 + (best.samples / 100) * 0.45);
  
  return { hour: best.hour, confidence };
}

// ============================================================================
// Personalized FSRS Parameter Optimization
// ============================================================================

/**
 * Calculate personalized FSRS parameters based on user performance
 */
export function calculatePersonalizedFSRS(
  avgRetention: number,
  avgDifficulty: number,
  learningSpeed: 'slow' | 'normal' | 'fast',
  forgettingRate: number // % forgotten after 7 days
): PersonalizedFSRSParams {
  const params = { ...defaultParameters };
  const improvements: string[] = [];
  const systemOverrides = new Map<string, Partial<FSRSParameters>>();
  
  // Adjust request retention based on user's natural retention
  if (avgRetention < 80) {
    params.request_retention = 0.85;
    improvements.push('Increased target retention due to higher forgetting rate');
  } else if (avgRetention > 95) {
    params.request_retention = 0.88;
    improvements.push('Optimized retention target - you retain well with less review');
  }
  
  // Adjust initial stability weights based on learning speed
  if (learningSpeed === 'fast') {
    params.w[0] *= 1.2; // New card stability
    params.w[1] *= 1.15;
    params.w[2] *= 1.1;
    params.w[3] *= 1.05;
    improvements.push('Increased initial stability for fast learning pattern');
  } else if (learningSpeed === 'slow') {
    params.w[0] *= 0.85;
    params.w[1] *= 0.9;
    params.w[2] *= 0.95;
    improvements.push('Decreased initial stability for more frequent early reviews');
  }
  
  // Adjust difficulty factor based on user's average performance
  if (avgDifficulty > 7) {
    params.w[4] *= 1.1;
    params.w[5] *= 0.9;
    improvements.push('Adjusted difficulty scaling for challenging material');
  }
  
  // Adjust forgetting stability based on measured forgetting rate
  if (forgettingRate > 30) {
    params.w[11] *= 0.9; // Reduce forget stability
    improvements.push('Reduced forget stability due to higher lapse rate');
  }
  
  return {
    parameters: params,
    confidence: Math.min(0.9, 0.5 + (avgRetention > 0 ? 0.3 : 0)),
    lastCalibration: new Date(),
    improvements,
    systemOverrides,
  };
}

/**
 * Get system-specific FSRS adjustments
 */
export function getSystemFSRSAdjustments(
  systemMastery: SystemMasteryProfile[]
): Map<string, Partial<FSRSParameters>> {
  const adjustments = new Map<string, Partial<FSRSParameters>>();
  
  for (const system of systemMastery) {
    if (system.questionsSeen < 20) continue;
    
    const adjustment: Partial<FSRSParameters> = {};
    
    // Systems with high difficulty need more frequent review
    if (system.difficultyRating > 7) {
      adjustment.request_retention = 0.92;
    }
    
    // Systems with fast forgetting need shorter intervals
    if (system.forgettingCurve < 5) {
      adjustment.maximum_interval = 30; // Cap at 30 days
    }
    
    if (Object.keys(adjustment).length > 0) {
      adjustments.set(system.system, adjustment);
    }
  }
  
  return adjustments;
}

// ============================================================================
// Question Targeting Engine
// ============================================================================

/**
 * Generate intelligent question targeting based on user analytics
 */
export function generateQuestionTargeting(
  systemMastery: SystemMasteryProfile[],
  cognitiveState: CognitiveState,
  learningVelocity: LearningVelocity,
  recentPerformance: { system: string; accuracy: number }[]
): QuestionTargeting {
  const targetSystems: Array<{ system: string; priority: number; reason: string }> = [];
  
  // 1. Prioritize weak systems that need attention
  const weakSystems = systemMastery
    .filter(s => s.masteryLevel < 60 && s.questionsSeen >= 10)
    .sort((a, b) => a.masteryLevel - b.masteryLevel);
  
  for (const system of weakSystems.slice(0, 3)) {
    targetSystems.push({
      system: system.system,
      priority: 100 - system.masteryLevel,
      reason: `Low mastery (${system.masteryLevel}%) - needs focused review`,
    });
  }
  
  // 2. Add systems due for spaced review
  const now = new Date();
  const dueSystems = systemMastery
    .filter(s => {
      if (!s.lastReviewed) return false;
      const daysSince = (now.getTime() - s.lastReviewed.getTime()) / 86400000;
      return daysSince >= s.optimalReviewInterval;
    })
    .sort((a, b) => {
      const aDays = a.lastReviewed ? (now.getTime() - a.lastReviewed.getTime()) / 86400000 : 999;
      const bDays = b.lastReviewed ? (now.getTime() - b.lastReviewed.getTime()) / 86400000 : 999;
      return bDays - aDays;
    });
  
  for (const system of dueSystems.slice(0, 2)) {
    const existing = targetSystems.find(t => t.system === system.system);
    if (!existing) {
      targetSystems.push({
        system: system.system,
        priority: 70,
        reason: 'Due for spaced repetition review',
      });
    }
  }
  
  // 3. If cognitive load is low, introduce new challenging content
  if (cognitiveState.cognitiveLoad < 50 && cognitiveState.flowState > 60) {
    const challengingSystems = systemMastery
      .filter(s => s.masteryLevel >= 60 && s.masteryLevel < 85)
      .slice(0, 1);
    
    for (const system of challengingSystems) {
      const existing = targetSystems.find(t => t.system === system.system);
      if (!existing) {
        targetSystems.push({
          system: system.system,
          priority: 50,
          reason: 'Good cognitive state - introducing advanced content',
        });
      }
    }
  }
  
  // Determine recommended difficulty
  let recommendedDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  if (cognitiveState.fatigueLevel > 60 || cognitiveState.cognitiveLoad > 70) {
    recommendedDifficulty = 'easy';
  } else if (cognitiveState.flowState > 70 && learningVelocity.trend === 'accelerating') {
    recommendedDifficulty = 'hard';
  }
  
  // Gather priority conditions from weak subtopics
  const priorityConditions: string[] = [];
  for (const system of weakSystems) {
    priorityConditions.push(...system.weakSubtopics.slice(0, 2));
  }
  
  // Due for review items
  const dueForReview: Array<{ conditionId: string; dueDate: Date; urgency: number }> = [];
  // This would be populated from FSRS card state
  
  // Format preferences based on cognitive state
  const formatPreferences = {
    preferVignettes: cognitiveState.cognitiveLoad < 60, // Simpler format if tired
    includeImages: cognitiveState.attentionLevel > 50,
    focusOnDifferentials: learningVelocity.trend !== 'decelerating',
  };
  
  return {
    targetSystems: targetSystems.sort((a, b) => b.priority - a.priority),
    recommendedDifficulty,
    priorityConditions: priorityConditions.slice(0, 10),
    dueForReview,
    formatPreferences,
  };
}

// ============================================================================
// Comprehensive Analytics Generation
// ============================================================================

/**
 * Generate complete user analytics snapshot
 */
export function generateComprehensiveAnalytics(
  userId: string,
  systemMastery: SystemMasteryProfile[],
  overallAccuracy: number,
  totalQuestions: number
): ComprehensiveUserAnalytics {
  const cognitiveState = getCognitiveState();
  const learningVelocity = getLearningVelocity();
  const optimalTime = getOptimalStudyTime();
  
  // Calculate predicted PANCE score
  const avgMastery = systemMastery.length > 0
    ? average(systemMastery.map(s => s.masteryLevel))
    : 50;
  const predictedPANCEScore = Math.round(200 + (overallAccuracy / 100) * 400 + (avgMastery / 100) * 200);
  
  // Pass probability based on predicted score (passing ~450)
  const predictedPassProbability = Math.min(99, Math.max(1, 
    50 + (predictedPANCEScore - 450) * 0.5
  ));
  
  // Days to readiness
  let daysToExamReadiness: number | null = null;
  if (predictedPANCEScore < 500) {
    // Estimate based on learning velocity
    const pointsNeeded = 500 - predictedPANCEScore;
    const pointsPerDay = learningVelocity.masteryRate > 0 ? learningVelocity.masteryRate * 0.5 : 2;
    daysToExamReadiness = Math.ceil(pointsNeeded / pointsPerDay);
  }
  
  // Generate insights
  const insights = generateInsights(
    cognitiveState,
    learningVelocity,
    systemMastery,
    overallAccuracy
  );
  
  // Optimal conditions
  const optimalConditions: OptimalStudyConditions = {
    bestTimeOfDay: optimalTime.hour,
    bestDayOfWeek: 1, // Would need more data to determine
    optimalSessionLength: cognitiveState.fatigueLevel > 50 ? 20 : 45,
    optimalBreakInterval: 25,
    idealDifficulty: cognitiveState.flowState > 60 ? 'adaptive' : 'medium',
    preferredQuestionTypes: [],
    environmentFactors: {
      devicePreference: 'desktop',
      sessionTimePreference: 'medium',
    },
  };
  
  // FSRS params
  const forgettingRate = 100 - learningVelocity.retentionEfficiency;
  const fsrsParams = calculatePersonalizedFSRS(
    overallAccuracy,
    5, // avg difficulty placeholder
    learningVelocity.trend === 'accelerating' ? 'fast' : 'normal',
    forgettingRate
  );
  fsrsParams.systemOverrides = getSystemFSRSAdjustments(systemMastery);
  
  // Question targeting
  const recentPerformance = systemMastery.map(s => ({
    system: s.system,
    accuracy: s.masteryLevel,
  }));
  const questionTargeting = generateQuestionTargeting(
    systemMastery,
    cognitiveState,
    learningVelocity,
    recentPerformance
  );
  
  return {
    userId,
    cognitiveState,
    learningVelocity,
    optimalConditions,
    systemMastery,
    fsrsParams,
    questionTargeting,
    predictedPANCEScore,
    predictedPassProbability,
    daysToExamReadiness,
    insights,
    lastUpdated: new Date(),
  };
}

/**
 * Generate actionable insights from analytics data
 */
function generateInsights(
  cognitive: CognitiveState,
  velocity: LearningVelocity,
  systems: SystemMasteryProfile[],
  accuracy: number
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];
  
  // Cognitive insights
  if (cognitive.fatigueLevel > 70) {
    insights.push({
      id: 'high-fatigue',
      type: 'alert',
      severity: 'warning',
      title: 'Mental Fatigue Detected',
      description: 'Your response patterns indicate fatigue. Consider taking a 10-15 minute break.',
      actionable: true,
      action: 'Take a break',
    });
  }
  
  if (cognitive.flowState > 75) {
    insights.push({
      id: 'flow-state',
      type: 'opportunity',
      severity: 'success',
      title: 'You\'re in the Zone!',
      description: 'You\'re experiencing optimal focus. This is a great time to tackle challenging content.',
      actionable: false,
    });
  }
  
  // Learning velocity insights
  if (velocity.trend === 'accelerating') {
    insights.push({
      id: 'velocity-up',
      type: 'milestone',
      severity: 'success',
      title: 'Learning Velocity Increasing',
      description: `You're learning ${Math.round((velocity.personalBestRatio - 1) * 100)}% faster than your average!`,
      actionable: false,
      data: { ratio: velocity.personalBestRatio },
    });
  } else if (velocity.trend === 'decelerating' && velocity.personalBestRatio < 0.7) {
    insights.push({
      id: 'velocity-down',
      type: 'alert',
      severity: 'warning',
      title: 'Learning Pace Slowing',
      description: 'Your learning velocity has decreased. Consider reviewing your study approach or taking a longer break.',
      actionable: true,
      action: 'Review study strategy',
    });
  }
  
  // System-specific insights
  const weakestSystem = systems.reduce((a, b) => 
    a.masteryLevel < b.masteryLevel && a.questionsSeen >= 10 ? a : b,
    systems[0]
  );
  
  if (weakestSystem && weakestSystem.masteryLevel < 50) {
    insights.push({
      id: 'weak-system',
      type: 'weakness',
      severity: 'warning',
      title: `${weakestSystem.system} Needs Attention`,
      description: `Your ${weakestSystem.system} mastery is at ${weakestSystem.masteryLevel}%. Focus on: ${weakestSystem.weakSubtopics.slice(0, 2).join(', ')}`,
      actionable: true,
      action: `Study ${weakestSystem.system}`,
      data: { system: weakestSystem.system, mastery: weakestSystem.masteryLevel },
    });
  }
  
  const strongestSystem = systems.reduce((a, b) =>
    a.masteryLevel > b.masteryLevel && a.questionsSeen >= 10 ? a : b,
    systems[0]
  );
  
  if (strongestSystem && strongestSystem.masteryLevel > 85) {
    insights.push({
      id: 'strong-system',
      type: 'strength',
      severity: 'success',
      title: `Excellent ${strongestSystem.system} Performance`,
      description: `You've achieved ${strongestSystem.masteryLevel}% mastery in ${strongestSystem.system}!`,
      actionable: false,
      data: { system: strongestSystem.system, mastery: strongestSystem.masteryLevel },
    });
  }
  
  // Accuracy milestones
  if (accuracy >= 80) {
    insights.push({
      id: 'accuracy-milestone',
      type: 'milestone',
      severity: 'success',
      title: 'High Accuracy Achieved',
      description: `Your ${accuracy.toFixed(1)}% accuracy puts you on track for PANCE success!`,
      actionable: false,
    });
  }
  
  return insights;
}

// ============================================================================
// Utility Functions
// ============================================================================

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function variance(nums: number[]): number {
  if (nums.length === 0) return 0;
  const avg = average(nums);
  return average(nums.map(n => Math.pow(n - avg, 2)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countErrorClusters(data: CognitiveDataPoint[]): number {
  let clusters = 0;
  let consecutiveErrors = 0;
  
  for (const point of data) {
    if (!point.wasCorrect) {
      consecutiveErrors++;
      if (consecutiveErrors >= 3) clusters++;
    } else {
      consecutiveErrors = 0;
    }
  }
  
  return clusters;
}

// ============================================================================
// Exports for Integration
// ============================================================================

export default {
  // Cognitive state
  recordCognitiveDataPoint,
  getCognitiveState,
  shouldSuggestBreak,
  
  // Learning velocity
  recordSessionVelocity,
  getLearningVelocity,
  
  // Time of day
  recordTimeOfDayAttempt,
  getPerformanceByTimeOfDay,
  getOptimalStudyTime,
  
  // FSRS
  calculatePersonalizedFSRS,
  getSystemFSRSAdjustments,
  
  // Question targeting
  generateQuestionTargeting,
  
  // Comprehensive
  generateComprehensiveAnalytics,
};
