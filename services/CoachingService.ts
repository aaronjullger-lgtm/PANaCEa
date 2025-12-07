import type { PerformanceRecord } from '@/types';

/**
 * Parameters for AI tutor answer analysis
 */
export interface AnalyzeAnswerParams {
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  condition: string;
}

/**
 * Analyze user's answer and provide Socratic dialogue response
 * This is a placeholder that returns a helpful response. In production,
 * this would call an AI API for dynamic responses.
 */
export async function analyzeAnswer(params: AnalyzeAnswerParams): Promise<string> {
  const { questionText, isCorrect, explanation, condition } = params;
  
  // Simple fallback response - in production, this would call Gemini API
  if (!isCorrect) {
    return `Let's break this down together. When thinking about ${condition}, remember these key points:\n\n${explanation}\n\nWhat specific part would you like me to clarify?`;
  }
  
  return `Great job! You got it right. ${explanation}\n\nDo you have any questions about the underlying concept?`;
}

/**
 * User metrics for AI coaching analysis
 */
export interface UserMetrics {
  /** Average time spent on questions (ms) */
  averageQuestionTime: number;
  /** Percentage of questions where answer was changed */
  secondGuessRate: number;
  /** Performance decay by system over time */
  systemDecay: Record<string, number>;
  /** Total questions attempted */
  totalQuestions: number;
  /** Overall accuracy */
  overallAccuracy: number;
  /** Performance by time of day */
  performanceByHour: Record<number, { correct: number; total: number }>;
  /** Vignette stamina (performance on long vs short questions) */
  vignetteStamina: {
    shortQuestions: { correct: number; total: number };
    longQuestions: { correct: number; total: number };
  };
}

/**
 * Study recommendation from coaching service
 */
export interface StudyRecommendation {
  prescription: string;
  focusAreas: string[];
  optimalTimeSlot?: string;
  confidence: number; // 0-100
}

/**
 * Search history entry
 */
export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
  resultCount: number;
}

/**
 * Calculate user metrics from performance data
 */
export function calculateUserMetrics(
  performanceData: PerformanceRecord[]
): UserMetrics {
  if (performanceData.length === 0) {
    return {
      averageQuestionTime: 0,
      secondGuessRate: 0,
      systemDecay: {},
      totalQuestions: 0,
      overallAccuracy: 0,
      performanceByHour: {},
      vignetteStamina: {
        shortQuestions: { correct: 0, total: 0 },
        longQuestions: { correct: 0, total: 0 }
      }
    };
  }

  // Calculate average question time
  const timesRecorded = performanceData.filter(r => r.timeSpentMs);
  const averageQuestionTime = timesRecorded.length > 0
    ? timesRecorded.reduce((sum, r) => sum + (r.timeSpentMs || 0), 0) / timesRecorded.length
    : 0;

  // Calculate second-guess rate
  const answersWithChanges = performanceData.filter(r => r.finalAnswerWasChanged);
  const secondGuessRate = performanceData.length > 0
    ? (answersWithChanges.length / performanceData.length) * 100
    : 0;

  // Calculate system decay (performance trend over time by system)
  const systemDecay: Record<string, number> = {};
  const systemPerformance: Record<string, { early: number[]; late: number[] }> = {};

  performanceData.forEach((record, index) => {
    const system = record.system || 'OTHER';
    if (!systemPerformance[system]) {
      systemPerformance[system] = { early: [], late: [] };
    }

    const isEarly = index < performanceData.length / 2;
    const accuracy = record.isCorrect ? 1 : 0;

    if (isEarly) {
      systemPerformance[system].early.push(accuracy);
    } else {
      systemPerformance[system].late.push(accuracy);
    }
  });

  Object.keys(systemPerformance).forEach(system => {
    const early = systemPerformance[system].early;
    const late = systemPerformance[system].late;

    if (early.length > 0 && late.length > 0) {
      const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length;
      const lateAvg = late.reduce((a, b) => a + b, 0) / late.length;
      systemDecay[system] = (earlyAvg - lateAvg) * 100; // Positive means decay
    }
  });

  // Calculate overall accuracy
  const correctCount = performanceData.filter(r => r.isCorrect).length;
  const overallAccuracy = (correctCount / performanceData.length) * 100;

  // Calculate performance by hour
  const performanceByHour: Record<number, { correct: number; total: number }> = {};
  performanceData.forEach(record => {
    const hour = new Date(record.timestamp).getHours();
    if (!performanceByHour[hour]) {
      performanceByHour[hour] = { correct: 0, total: 0 };
    }
    performanceByHour[hour].total += 1;
    if (record.isCorrect) {
      performanceByHour[hour].correct += 1;
    }
  });

  // Calculate vignette stamina
  const vignetteStamina = {
    shortQuestions: { correct: 0, total: 0 },
    longQuestions: { correct: 0, total: 0 }
  };

  performanceData.forEach(record => {
    const wordCount = record.questionWordCount || 0;
    const isLong = wordCount > 100; // Threshold for "long" question

    if (isLong) {
      vignetteStamina.longQuestions.total += 1;
      if (record.isCorrect) vignetteStamina.longQuestions.correct += 1;
    } else {
      vignetteStamina.shortQuestions.total += 1;
      if (record.isCorrect) vignetteStamina.shortQuestions.correct += 1;
    }
  });

  return {
    averageQuestionTime,
    secondGuessRate,
    systemDecay,
    totalQuestions: performanceData.length,
    overallAccuracy,
    performanceByHour,
    vignetteStamina
  };
}

/**
 * Generate AI coaching study prescription based on user metrics
 */
export function generateStudyPrescription(
  performanceData: PerformanceRecord[]
): StudyRecommendation {
  const metrics = calculateUserMetrics(performanceData);

  // Not enough data
  if (metrics.totalQuestions < 10) {
    return {
      prescription: 'Complete at least 10 questions to receive personalized recommendations.',
      focusAreas: ['Build your baseline performance'],
      confidence: 0
    };
  }

  const recommendations: string[] = [];
  const focusAreas: string[] = [];
  let optimalTimeSlot: string | undefined;

  // Analyze vignette stamina
  const longAccuracy = metrics.vignetteStamina.longQuestions.total > 0
    ? (metrics.vignetteStamina.longQuestions.correct / metrics.vignetteStamina.longQuestions.total) * 100
    : 0;
  const shortAccuracy = metrics.vignetteStamina.shortQuestions.total > 0
    ? (metrics.vignetteStamina.shortQuestions.correct / metrics.vignetteStamina.shortQuestions.total) * 100
    : 0;

  if (longAccuracy < shortAccuracy - 15) {
    recommendations.push('Your performance drops on longer vignettes.');
    focusAreas.push('Practice reading comprehension and stamina with full-length cases');
  }

  // Analyze second-guess factor
  if (metrics.secondGuessRate > 40) {
    recommendations.push('You frequently change your answer - trust your first instinct more.');
    focusAreas.push('Work on confidence and decisiveness');
  } else if (metrics.secondGuessRate < 10) {
    recommendations.push('You rarely reconsider answers - review questions more carefully.');
    focusAreas.push('Develop critical thinking and self-questioning');
  }

  // Analyze system decay
  const decayingSystems = Object.entries(metrics.systemDecay)
    .filter(([_, decay]) => decay > 10)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (decayingSystems.length > 0) {
    const systemNames = decayingSystems.map(([system]) => system).join(', ');
    recommendations.push(`Performance degrades over time in: ${systemNames}`);
    focusAreas.push('Take frequent breaks during long study sessions');
    focusAreas.push(`Review ${systemNames} topics with spaced repetition`);
  }

  // Find optimal time slot
  const hourlyPerformance = Object.entries(metrics.performanceByHour)
    .filter(([_, data]) => data.total >= 3) // At least 3 questions
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      accuracy: (data.correct / data.total) * 100
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  if (hourlyPerformance.length > 0) {
    const bestHour = hourlyPerformance[0].hour;
    const timeRange = getTimeRange(bestHour);
    optimalTimeSlot = timeRange;
    recommendations.push(`You perform best during ${timeRange}`);
  }

  // Build final prescription
  let prescription = recommendations.join(' ');
  if (recommendations.length === 0) {
    prescription = 'Your study patterns look balanced. Continue with consistent practice.';
    focusAreas.push('Maintain your current routine');
  }

  // Add focus recommendation if available
  if (optimalTimeSlot) {
    prescription += ` Focus on ${focusAreas[0] || 'challenging topics'} during ${optimalTimeSlot}.`;
  }

  return {
    prescription,
    focusAreas,
    optimalTimeSlot,
    confidence: Math.min(100, metrics.totalQuestions * 2) // Confidence increases with data
  };
}

/**
 * Get human-readable time range from hour
 */
function getTimeRange(hour: number): string {
  if (hour >= 5 && hour < 9) return '5 AM - 9 AM (Early Morning)';
  if (hour >= 9 && hour < 12) return '9 AM - 12 PM (Morning)';
  if (hour >= 12 && hour < 14) return '12 PM - 2 PM (Midday)';
  if (hour >= 14 && hour < 17) return '2 PM - 5 PM (Afternoon)';
  if (hour >= 17 && hour < 20) return '5 PM - 8 PM (Evening)';
  if (hour >= 20 && hour < 23) return '8 PM - 11 PM (Night)';
  return '11 PM - 5 AM (Late Night)';
}

/**
 * Analyze search history to find frequently searched vs rarely drilled topics
 */
export function analyzeSearchHistory(
  searchHistory: SearchHistoryEntry[],
  performanceData: PerformanceRecord[]
): { frequentlySearched: string[]; rarelyDrilled: string[] } {
  // Count search frequency
  const searchCounts: Record<string, number> = {};
  searchHistory.forEach(entry => {
    const query = entry.query.toLowerCase();
    searchCounts[query] = (searchCounts[query] || 0) + 1;
  });

  // Get top searched terms
  const frequentlySearched = Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query]) => query);

  // Find topics that are searched but not practiced
  const practicedTopics = new Set(
    performanceData.map(r => r.topic.toLowerCase())
  );

  const rarelyDrilled = frequentlySearched.filter(
    query => !Array.from(practicedTopics).some(topic => 
      topic.includes(query) || query.includes(topic)
    )
  );

  return { frequentlySearched, rarelyDrilled };
}
