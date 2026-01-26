/**
 * Student Insights Service
 *
 * Provides automated learning insights and recommendations:
 * - Performance tracking and trends
 * - Weak area identification
 * - Personalized study recommendations
 * - Time optimization analysis
 */

export interface StudentInsights {
  hasData: boolean;
  message?: string;
  period?: string;
  summary?: {
    totalQuestions: number;
    accuracy: number;
    trend: 'improving' | 'declining' | 'stable';
    trendChange: number;
  };
  weakAreas?: Array<{
    system: string;
    accuracy: number;
    questionsAnswered: number;
    recommendation: string;
  }>;
  strongAreas?: Array<{
    system: string;
    accuracy: number;
    questionsAnswered: number;
  }>;
  recommendations?: string[];
  timeOptimization?: {
    avgSeconds: number;
    message: string;
  };
  systemBreakdown?: Array<{
    system: string;
    total: number;
    correct: number;
    accuracy: number;
  }>;
}

/**
 * Get personalized study insights for a student
 */
export async function getStudentInsights(
  userId: string,
  period: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<StudentInsights> {
  try {
    const response = await fetch(`/api/student/insights?userId=${userId}&period=${period}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch insights');
    }

    const data = await response.json();
    return data.insights;
  } catch (error) {
    console.error('Error fetching student insights:', error);
    return {
      hasData: false,
      message: 'Unable to load insights. Please try again later.',
    };
  }
}

/**
 * Format insight message for display
 */
export function formatInsightMessage(insights: StudentInsights): string {
  if (!insights.hasData) {
    return insights.message || 'No data available';
  }

  if (!insights.summary) {
    return 'Insights are being generated...';
  }

  const { accuracy, trend, trendChange } = insights.summary;
  const trendLabel = trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Stable';

  let message = `[${trendLabel}] Your accuracy is ${accuracy}% `;

  if (trend !== 'stable') {
    message += `(${trendChange > 0 ? '+' : ''}${trendChange}% ${trend})`;
  }

  return message;
}

/**
 * Get priority action for student
 */
export function getPriorityAction(insights: StudentInsights): string | null {
  if (!insights.hasData || !insights.weakAreas || insights.weakAreas.length === 0) {
    return null;
  }

  const weakest = insights.weakAreas[0];
  return `Focus on ${weakest.system} (${weakest.accuracy}% accuracy) - ${weakest.recommendation}`;
}

/**
 * Check if student needs a break (declining performance)
 */
export function needsBreak(insights: StudentInsights): boolean {
  return insights.hasData && insights.summary?.trend === 'declining';
}

/**
 * Get achievement level based on accuracy
 */
export function getAchievementLevel(accuracy: number): {
  level: string;
  emoji: string;
  message: string;
} {
  if (accuracy >= 90) {
    return {
      level: 'Master',
      emoji: '',
      message: "Outstanding performance! You're exam-ready!",
    };
  } else if (accuracy >= 80) {
    return {
      level: 'Expert',
      emoji: '',
      message: 'Great work! Keep pushing to master level!',
    };
  } else if (accuracy >= 70) {
    return {
      level: 'Proficient',
      emoji: '',
      message: 'Good progress! Focus on weak areas to improve.',
    };
  } else if (accuracy >= 60) {
    return {
      level: 'Developing',
      emoji: '',
      message: 'Keep studying! Review fundamentals and practice more.',
    };
  } else {
    return {
      level: 'Beginner',
      emoji: '🌱',
      message: 'Everyone starts somewhere! Consistent practice is key.',
    };
  }
}
