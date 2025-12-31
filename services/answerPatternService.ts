/**
 * Answer Pattern Analyzer
 * 
 * Analyzes patterns in how users answer questions to provide
 * actionable insights for test-taking improvement:
 * 
 * - First instinct accuracy (should you trust your gut?)
 * - Answer change outcomes (do changes help or hurt?)
 * - Time-accuracy correlation (are you rushing?)
 * - Elimination effectiveness (is your strategy working?)
 */

export interface AnswerPatternData {
  questionId: string;
  firstAnswer: number;
  finalAnswer: number;
  correctAnswer: number;
  timeSpentMs: number;
  parTimeMs: number;
  eliminatedCount: number;
  answerChangeCount: number;
  wasCorrect: boolean;
  timestamp: number;
}

export interface PatternInsights {
  firstInstinctAccuracy: number | null;
  changedToCorrect: number;
  changedToWrong: number;
  changeRecommendation: 'trust_instinct' | 'deliberate_more' | 'neutral';
  
  rushAccuracy: number | null;
  slowAccuracy: number | null;
  pacingRecommendation: 'slow_down' | 'speed_up' | 'good_pace' | null;
  
  eliminationEffectiveness: number | null;
  eliminationRecommendation: string | null;
  
  overallInsights: string[];
  
  // Additional fields for analytics sync
  totalChanges: number;
  avgStreakLength: number | null;
}

const STORAGE_KEY = 'panceai_answer_patterns';

/**
 * Record an answer pattern
 */
export function recordAnswerPattern(data: Omit<AnswerPatternData, 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  
  const patterns = getAnswerPatterns();
  patterns.push({
    ...data,
    timestamp: Date.now(),
  });
  
  // Keep last 100 for analysis
  if (patterns.length > 100) {
    patterns.shift();
  }
  
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
}

/**
 * Get all recorded patterns
 */
export function getAnswerPatterns(): AnswerPatternData[] {
  if (typeof window === 'undefined') return [];
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Analyze patterns and generate insights
 */
export function analyzePatterns(): PatternInsights {
  const patterns = getAnswerPatterns();
  
  const insights: string[] = [];
  
  // Initialize results with defaults
  const result: PatternInsights = {
    firstInstinctAccuracy: null,
    changedToCorrect: 0,
    changedToWrong: 0,
    changeRecommendation: 'neutral',
    rushAccuracy: null,
    slowAccuracy: null,
    pacingRecommendation: null,
    eliminationEffectiveness: null,
    eliminationRecommendation: null,
    overallInsights: insights,
    totalChanges: patterns.reduce((sum, p) => sum + p.answerChangeCount, 0),
    avgStreakLength: calculateAvgStreakLength(patterns),
  };
  
  if (patterns.length < 10) {
    insights.push('Answer more questions for personalized insights');
    return result;
  }
  
  // === First Instinct Analysis ===
  // When first answer was the final answer, how often was it correct?
  const noChangePatterns = patterns.filter(p => p.answerChangeCount === 0);
  if (noChangePatterns.length >= 5) {
    const firstInstinctCorrect = noChangePatterns.filter(p => p.wasCorrect).length;
    result.firstInstinctAccuracy = Math.round((firstInstinctCorrect / noChangePatterns.length) * 100);
    
    if (result.firstInstinctAccuracy >= 75) {
      insights.push(`Your first instinct is right ${result.firstInstinctAccuracy}% of the time - trust it!`);
    }
  }
  
  // === Answer Change Analysis ===
  const changedPatterns = patterns.filter(p => p.answerChangeCount > 0);
  
  changedPatterns.forEach(p => {
    const firstWasCorrect = p.firstAnswer === p.correctAnswer;
    const finalWasCorrect = p.wasCorrect;
    
    if (!firstWasCorrect && finalWasCorrect) {
      result.changedToCorrect++;
    } else if (firstWasCorrect && !finalWasCorrect) {
      result.changedToWrong++;
    }
  });
  
  if (changedPatterns.length >= 5) {
    if (result.changedToWrong > result.changedToCorrect * 1.5) {
      result.changeRecommendation = 'trust_instinct';
      insights.push('When you change answers, you often change to wrong ones. Trust your first instinct more.');
    } else if (result.changedToCorrect > result.changedToWrong * 1.5) {
      result.changeRecommendation = 'deliberate_more';
      insights.push('Your answer changes usually improve your score. Take time to reconsider.');
    }
  }
  
  // === Pacing Analysis ===
  const rushPatterns = patterns.filter(p => p.timeSpentMs < p.parTimeMs * 0.5);
  const slowPatterns = patterns.filter(p => p.timeSpentMs > p.parTimeMs * 1.5);
  
  if (rushPatterns.length >= 5) {
    const rushCorrect = rushPatterns.filter(p => p.wasCorrect).length;
    result.rushAccuracy = Math.round((rushCorrect / rushPatterns.length) * 100);
  }
  
  if (slowPatterns.length >= 5) {
    const slowCorrect = slowPatterns.filter(p => p.wasCorrect).length;
    result.slowAccuracy = Math.round((slowCorrect / slowPatterns.length) * 100);
  }
  
  if (result.rushAccuracy !== null && result.slowAccuracy !== null) {
    if (result.rushAccuracy < 50 && result.slowAccuracy > result.rushAccuracy + 15) {
      result.pacingRecommendation = 'slow_down';
      insights.push('You rush through questions (${result.rushAccuracy}% accuracy) but do better when you slow down (${result.slowAccuracy}%). Take more time.');
    } else if (result.slowAccuracy < result.rushAccuracy - 10) {
      result.pacingRecommendation = 'speed_up';
      insights.push('Overthinking may hurt you. Quick answers are often your best answers.');
    } else {
      result.pacingRecommendation = 'good_pace';
    }
  }
  
  // === Elimination Strategy Analysis ===
  const eliminationPatterns = patterns.filter(p => p.eliminatedCount > 0);
  const noEliminationPatterns = patterns.filter(p => p.eliminatedCount === 0);
  
  if (eliminationPatterns.length >= 5 && noEliminationPatterns.length >= 5) {
    const eliminationAccuracy = eliminationPatterns.filter(p => p.wasCorrect).length / eliminationPatterns.length;
    const noEliminationAccuracy = noEliminationPatterns.filter(p => p.wasCorrect).length / noEliminationPatterns.length;
    
    result.eliminationEffectiveness = Math.round((eliminationAccuracy - noEliminationAccuracy) * 100);
    
    if (eliminationAccuracy > noEliminationAccuracy + 0.1) {
      result.eliminationRecommendation = 'effective';
      insights.push('Your elimination strategy adds ${Math.round(result.eliminationEffectiveness)}% to your accuracy. Keep using it!');
    } else if (eliminationAccuracy < noEliminationAccuracy - 0.1) {
      result.eliminationRecommendation = 'reconsider';
      insights.push('Elimination might be slowing you down. You do better with gut instinct.');
    } else {
      result.eliminationRecommendation = 'neutral';
    }
  }
  
  // === Overall Accuracy by Time of Day (if enough data) ===
  // This could be expanded in future versions
  
  return result;
}

/**
 * Get a summary suitable for session end display
 */
export function getPatternSummary(): {
  totalAnswered: number;
  answerChanges: { helpful: number; harmful: number; neutral: number };
  topInsight: string | null;
} {
  const patterns = getAnswerPatterns();
  const analysis = analyzePatterns();
  
  let helpful = 0;
  let harmful = 0;
  let neutral = 0;
  
  patterns.filter(p => p.answerChangeCount > 0).forEach(p => {
    const firstWasCorrect = p.firstAnswer === p.correctAnswer;
    const finalWasCorrect = p.wasCorrect;
    
    if (!firstWasCorrect && finalWasCorrect) helpful++;
    else if (firstWasCorrect && !finalWasCorrect) harmful++;
    else neutral++;
  });
  
  return {
    totalAnswered: patterns.length,
    answerChanges: { helpful, harmful, neutral },
    topInsight: analysis.overallInsights[0] || null,
  };
}

/**
 * Reset pattern data
 */
export function resetAnswerPatterns(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Calculate average streak length from patterns
 */
function calculateAvgStreakLength(patterns: AnswerPatternData[]): number | null {
  if (patterns.length < 5) return null;
  
  const streaks: number[] = [];
  let currentStreak = 0;
  
  for (const p of patterns) {
    if (p.wasCorrect) {
      currentStreak++;
    } else {
      if (currentStreak > 0) {
        streaks.push(currentStreak);
      }
      currentStreak = 0;
    }
  }
  
  // Don't forget the final streak if it exists
  if (currentStreak > 0) {
    streaks.push(currentStreak);
  }
  
  if (streaks.length === 0) return 0;
  
  return streaks.reduce((sum, s) => sum + s, 0) / streaks.length;
}
