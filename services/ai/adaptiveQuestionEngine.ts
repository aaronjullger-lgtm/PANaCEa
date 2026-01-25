/**
 * Adaptive Question Engine - Sprint 3
 *
 * AI-powered question selection that adapts to learning patterns.
 */

import type { SystemPerformance } from '../analytics/panaceScorePredictor';

export interface QuestionSelectionCriteria {
  userId: string;
  targetDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  focusSystems?: string[];
  avoidRecent?: boolean;
  prioritizeWeakAreas?: boolean;
  sessionGoal?: 'learn' | 'review' | 'challenge' | 'exam_prep';
}

export interface SelectedQuestion {
  questionId: string;
  conditionId: string;
  system: string;
  difficulty: string;
  selectionReason: string;
  predictedAccuracy: number;
  learningValue: number;
}

export interface AdaptiveState {
  currentDifficulty: number; // 0-100
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  recentAccuracy: number;
  cognitiveLoad: number;
  shouldAdjust: 'easier' | 'harder' | 'maintain';
}

export function calculateAdaptiveState(
  recentAttempts: { wasCorrect: boolean; difficulty: string; responseTimeMs: number }[]
): AdaptiveState {
  const last10 = recentAttempts.slice(-10);
  const last5 = recentAttempts.slice(-5);

  // Calculate recent accuracy
  const recentAccuracy =
    last10.length > 0 ? last10.filter((a) => a.wasCorrect).length / last10.length : 0.5;

  // Count streaks
  let consecutiveCorrect = 0;
  let consecutiveIncorrect = 0;
  for (let i = recentAttempts.length - 1; i >= 0; i--) {
    if (recentAttempts[i].wasCorrect) {
      if (consecutiveIncorrect > 0) break;
      consecutiveCorrect++;
    } else {
      if (consecutiveCorrect > 0) break;
      consecutiveIncorrect++;
    }
  }

  // Estimate cognitive load from response times
  const avgResponseTime =
    last5.length > 0 ? last5.reduce((sum, a) => sum + a.responseTimeMs, 0) / last5.length : 30000;
  const cognitiveLoad = Math.min(100, avgResponseTime / 600); // 60s = 100% load

  // Current difficulty estimate
  const difficultyMap: Record<string, number> = { easy: 25, medium: 50, hard: 75 };
  const currentDifficulty =
    last5.length > 0
      ? last5.reduce((sum, a) => sum + (difficultyMap[a.difficulty] || 50), 0) / last5.length
      : 50;

  // Determine adjustment
  let shouldAdjust: AdaptiveState['shouldAdjust'] = 'maintain';
  if (consecutiveCorrect >= 3 && recentAccuracy > 0.8) {
    shouldAdjust = 'harder';
  } else if (consecutiveIncorrect >= 2 || recentAccuracy < 0.5) {
    shouldAdjust = 'easier';
  }

  return {
    currentDifficulty,
    consecutiveCorrect,
    consecutiveIncorrect,
    recentAccuracy,
    cognitiveLoad,
    shouldAdjust,
  };
}

export function selectOptimalQuestions(
  criteria: QuestionSelectionCriteria,
  availableQuestions: { id: string; conditionId: string; system: string; difficulty: string }[],
  systemPerformance: SystemPerformance[],
  adaptiveState: AdaptiveState,
  recentQuestionIds: string[],
  count: number = 10
): SelectedQuestion[] {
  const selected: SelectedQuestion[] = [];
  const systemAccuracy: Record<string, number> = {};

  for (const sys of systemPerformance) {
    systemAccuracy[sys.system.toLowerCase()] = sys.accuracy;
  }

  // Score each question
  const scored = availableQuestions.map((q) => {
    let score = 50; // Base score
    const sysAcc = systemAccuracy[q.system.toLowerCase()] ?? 0.5;

    // 1. Prioritize weak areas
    if (criteria.prioritizeWeakAreas && sysAcc < 0.6) {
      score += 30;
    }

    // 2. Focus system bonus
    if (criteria.focusSystems?.includes(q.system)) {
      score += 25;
    }

    // 3. Difficulty matching
    const diffValue: Record<string, number> = { easy: 25, medium: 50, hard: 75 };
    const qDiff = diffValue[q.difficulty] || 50;
    let targetDiff = adaptiveState.currentDifficulty;

    if (adaptiveState.shouldAdjust === 'easier') targetDiff -= 15;
    else if (adaptiveState.shouldAdjust === 'harder') targetDiff += 15;

    const diffMatch = 1 - Math.abs(qDiff - targetDiff) / 100;
    score += diffMatch * 20;

    // 4. Avoid recent questions
    if (criteria.avoidRecent && recentQuestionIds.includes(q.id)) {
      score -= 50;
    }

    // 5. Session goal adjustments
    if (criteria.sessionGoal === 'challenge' && q.difficulty === 'hard') {
      score += 15;
    } else if (criteria.sessionGoal === 'review' && sysAcc > 0.7) {
      score += 10;
    } else if (criteria.sessionGoal === 'learn' && sysAcc < 0.7) {
      score += 15;
    }

    // Predicted accuracy
    const predictedAccuracy =
      sysAcc * (q.difficulty === 'easy' ? 1.2 : q.difficulty === 'hard' ? 0.8 : 1);

    // Learning value (higher for challenging but achievable)
    const learningValue =
      predictedAccuracy > 0.3 && predictedAccuracy < 0.9
        ? (1 - Math.abs(predictedAccuracy - 0.7)) * 100
        : 30;

    return {
      question: q,
      score,
      predictedAccuracy: Math.min(1, Math.max(0, predictedAccuracy)),
      learningValue,
    };
  });

  // Sort by score and select top N
  scored.sort((a, b) => b.score - a.score);

  for (const item of scored.slice(0, count)) {
    selected.push({
      questionId: item.question.id,
      conditionId: item.question.conditionId,
      system: item.question.system,
      difficulty: item.question.difficulty,
      selectionReason: getSelectionReason(item.score, criteria),
      predictedAccuracy: Math.round(item.predictedAccuracy * 100) / 100,
      learningValue: Math.round(item.learningValue),
    });
  }

  return selected;
}

function getSelectionReason(score: number, criteria: QuestionSelectionCriteria): string {
  if (criteria.prioritizeWeakAreas) return 'Targets weak area';
  if (criteria.focusSystems?.length) return 'Matches focus system';
  if (criteria.sessionGoal === 'challenge') return 'Challenging question';
  if (criteria.sessionGoal === 'review') return 'Review of strong area';
  if (score > 70) return 'Optimal learning value';
  return 'Balanced selection';
}

export function generateSessionPlan(
  systemPerformance: SystemPerformance[],
  sessionDurationMinutes: number,
  goal: 'learn' | 'review' | 'challenge' | 'exam_prep'
): { phase: string; durationMinutes: number; focus: string; difficulty: string }[] {
  const plan: { phase: string; durationMinutes: number; focus: string; difficulty: string }[] = [];

  // Find weakest and strongest systems
  const sorted = [...systemPerformance].sort((a, b) => a.accuracy - b.accuracy);
  const weakest = sorted[0]?.system || 'General';
  const strongest = sorted[sorted.length - 1]?.system || 'General';

  if (goal === 'exam_prep') {
    plan.push({
      phase: 'Warm-up',
      durationMinutes: Math.round(sessionDurationMinutes * 0.15),
      focus: strongest,
      difficulty: 'easy',
    });
    plan.push({
      phase: 'Weak Area Focus',
      durationMinutes: Math.round(sessionDurationMinutes * 0.4),
      focus: weakest,
      difficulty: 'medium',
    });
    plan.push({
      phase: 'Mixed Practice',
      durationMinutes: Math.round(sessionDurationMinutes * 0.3),
      focus: 'Mixed',
      difficulty: 'hard',
    });
    plan.push({
      phase: 'Cool-down Review',
      durationMinutes: Math.round(sessionDurationMinutes * 0.15),
      focus: 'Review Mistakes',
      difficulty: 'medium',
    });
  } else if (goal === 'challenge') {
    plan.push({
      phase: 'Warm-up',
      durationMinutes: Math.round(sessionDurationMinutes * 0.2),
      focus: 'General',
      difficulty: 'medium',
    });
    plan.push({
      phase: 'Challenge',
      durationMinutes: Math.round(sessionDurationMinutes * 0.8),
      focus: 'All Systems',
      difficulty: 'hard',
    });
  } else if (goal === 'review') {
    plan.push({
      phase: 'Spaced Review',
      durationMinutes: sessionDurationMinutes,
      focus: 'Due for Review',
      difficulty: 'adaptive',
    });
  } else {
    plan.push({
      phase: 'Learn',
      durationMinutes: Math.round(sessionDurationMinutes * 0.7),
      focus: weakest,
      difficulty: 'medium',
    });
    plan.push({
      phase: 'Reinforce',
      durationMinutes: Math.round(sessionDurationMinutes * 0.3),
      focus: weakest,
      difficulty: 'easy',
    });
  }

  return plan;
}
