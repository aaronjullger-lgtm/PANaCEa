/**
 * Learning Style Detection System
 * 
 * Sprint: User Data Improvement Plan - Step 4 (Sprint B)
 * 
 * Analyzes behavioral patterns to detect how users learn best.
 * Stores results in UserLearningProfile.learningStyle JSON field.
 * 
 * Dimensions analyzed:
 * 1. Pace Preference: fast-decider, thorough-analyzer, or balanced
 * 2. Explanation Engagement: deep-dive, moderate, or minimal
 * 3. Repetition Pattern: spaced-repetition-focused, mass-practice, or mixed
 * 4. Error Recovery: reflective (learns from mistakes) or persistent (pushes through)
 * 
 * Research basis:
 * - Kolb's Learning Styles (1984)
 * - VARK model adapted for digital learning
 * - Metacognitive awareness studies
 */

export interface LearningStyleProfile {
  // Primary dimensions
  pacePreference: 'fast-decider' | 'thorough-analyzer' | 'balanced';
  explanationEngagement: 'deep-dive' | 'moderate' | 'minimal';
  repetitionPattern: 'spaced-repetition' | 'mass-practice' | 'mixed';
  errorRecovery: 'reflective' | 'persistent';
  
  // Confidence scores (0-1) for each dimension
  confidence: {
    pace: number;
    explanation: number;
    repetition: number;
    errorRecovery: number;
  };
  
  // Overall learning style label
  overallStyle: string; // e.g., "Fast Intuitive Learner", "Methodical Deep Processor"
  
  // Recommendations based on style
  recommendations: string[];
  
  // Last updated
  lastAnalyzed: Date;
  
  // Sample size used for detection
  dataPoints: {
    questions: number;
    sessions: number;
    days: number;
  };
}

/**
 * Input data for learning style detection
 */
export interface LearningBehaviorData {
  // From QuestionAttempt and UserBehaviorMetrics
  attempts: {
    timeToFirstClick: number;
    answerChanges: number;
    dwellTime: number;
    wasCorrect: boolean;
    confidenceLevel?: number;
    createdAt: Date;
  }[];
  
  // From StudySession
  sessions: {
    questionsAnswered: number;
    durationMs: number;
    avgAccuracy: number;
    createdAt: Date;
  }[];
  
  // From explanation/hint interactions (if tracked)
  explanationViews?: {
    viewedBeforeAnswer: boolean;
    viewDurationMs: number;
    wasHelpful?: boolean; // User feedback
  }[];
  
  // From review patterns
  reviewHistory?: {
    cardId: string;
    interval: number; // Days since last review
    wasReview: boolean; // vs. new card
  }[];
}

/**
 * Detect pace preference from response timing
 */
function detectPacePreference(
  attempts: LearningBehaviorData['attempts']
): { style: 'fast-decider' | 'thorough-analyzer' | 'balanced'; confidence: number } {
  if (attempts.length < 10) {
    return { style: 'balanced', confidence: 0.3 };
  }
  
  const avgTimeToFirstClick = attempts.reduce((sum, a) => sum + a.timeToFirstClick, 0) / attempts.length;
  const avgAnswerChanges = attempts.reduce((sum, a) => sum + a.answerChanges, 0) / attempts.length;
  const avgDwellTime = attempts.reduce((sum, a) => sum + a.dwellTime, 0) / attempts.length;
  
  // Fast decider: Quick first click, few changes
  if (avgTimeToFirstClick < 3000 && avgAnswerChanges < 0.3) {
    const confidence = Math.min(0.9, attempts.length / 50);
    return { style: 'fast-decider', confidence };
  }
  
  // Thorough analyzer: Longer deliberation, more changes
  if (avgTimeToFirstClick > 8000 && avgDwellTime > 60000) {
    const confidence = Math.min(0.9, attempts.length / 50);
    return { style: 'thorough-analyzer', confidence };
  }
  
  // Balanced: In between
  return {
    style: 'balanced',
    confidence: Math.min(0.8, attempts.length / 40),
  };
}

/**
 * Detect explanation engagement from viewing behavior
 */
function detectExplanationEngagement(
  explanationViews: LearningBehaviorData['explanationViews'],
  totalQuestions: number
): { style: 'deep-dive' | 'moderate' | 'minimal'; confidence: number } {
  if (!explanationViews || explanationViews.length === 0) {
    return { style: 'minimal', confidence: 0.6 };
  }
  
  const viewRate = explanationViews.length / totalQuestions;
  const avgViewDuration = explanationViews.reduce((sum, v) => sum + v.viewDurationMs, 0) / explanationViews.length;
  const viewedBeforeAnswerCount = explanationViews.filter(v => v.viewedBeforeAnswer).length;
  
  // Deep-dive: High view rate, long durations, proactive viewing
  if (viewRate > 0.7 && avgViewDuration > 45000 && viewedBeforeAnswerCount > explanationViews.length * 0.5) {
    return { style: 'deep-dive', confidence: 0.85 };
  }
  
  // Minimal: Low view rate or very short durations
  if (viewRate < 0.2 || avgViewDuration < 10000) {
    return { style: 'minimal', confidence: 0.80 };
  }
  
  // Moderate: In between
  return { style: 'moderate', confidence: 0.75 };
}

/**
 * Detect repetition pattern from review history
 */
function detectRepetitionPattern(
  reviewHistory: LearningBehaviorData['reviewHistory']
): { style: 'spaced-repetition' | 'mass-practice' | 'mixed'; confidence: number } {
  if (!reviewHistory || reviewHistory.length < 20) {
    return { style: 'mixed', confidence: 0.4 };
  }
  
  const reviews = reviewHistory.filter(r => r.wasReview);
  if (reviews.length === 0) {
    return { style: 'mixed', confidence: 0.5 };
  }
  
  // Calculate average interval between reviews
  const avgInterval = reviews.reduce((sum, r) => sum + r.interval, 0) / reviews.length;
  const intervalStdDev = Math.sqrt(
    reviews.reduce((sum, r) => sum + Math.pow(r.interval - avgInterval, 2), 0) / reviews.length
  );
  
  // Spaced repetition: Increasing intervals, high variance
  if (avgInterval > 5 && intervalStdDev > 3) {
    return { style: 'spaced-repetition', confidence: 0.85 };
  }
  
  // Mass practice: Short intervals, low variance
  if (avgInterval < 2 && intervalStdDev < 1) {
    return { style: 'mass-practice', confidence: 0.80 };
  }
  
  // Mixed: Combination of patterns
  return { style: 'mixed', confidence: 0.70 };
}

/**
 * Detect error recovery style from post-error behavior
 */
function detectErrorRecovery(
  attempts: LearningBehaviorData['attempts']
): { style: 'reflective' | 'persistent'; confidence: number } {
  if (attempts.length < 20) {
    return { style: 'reflective', confidence: 0.4 };
  }
  
  // Find sequences: incorrect answer → next attempt on same or similar question
  const incorrectAttempts = attempts.map((a, idx) => ({ ...a, idx })).filter(a => !a.wasCorrect);
  
  if (incorrectAttempts.length === 0) {
    return { style: 'reflective', confidence: 0.5 };
  }
  
  // Analyze time to next attempt and performance after errors
  let totalPostErrorDelay = 0;
  let improvedAfterError = 0;
  let totalPostErrorAttempts = 0;
  
  incorrectAttempts.forEach((errorAttempt, i) => {
    // Find next few attempts
    const nextAttempts = attempts.slice(errorAttempt.idx + 1, errorAttempt.idx + 4);
    
    if (nextAttempts.length > 0) {
      // Time delay (in minutes) before next attempt
      const delay = (nextAttempts[0].createdAt.getTime() - errorAttempt.createdAt.getTime()) / (1000 * 60);
      totalPostErrorDelay += delay;
      
      // Check if performance improved
      const postErrorCorrectRate = nextAttempts.filter(a => a.wasCorrect).length / nextAttempts.length;
      if (postErrorCorrectRate > 0.6) improvedAfterError++;
      
      totalPostErrorAttempts++;
    }
  });
  
  if (totalPostErrorAttempts === 0) {
    return { style: 'reflective', confidence: 0.4 };
  }
  
  const avgPostErrorDelay = totalPostErrorDelay / totalPostErrorAttempts;
  const improvementRate = improvedAfterError / totalPostErrorAttempts;
  
  // Reflective: Takes time after errors, shows improvement
  if (avgPostErrorDelay > 5 && improvementRate > 0.7) {
    return { style: 'reflective', confidence: 0.85 };
  }
  
  // Persistent: Quick return, pushes through
  if (avgPostErrorDelay < 2) {
    return { style: 'persistent', confidence: 0.80 };
  }
  
  return { style: 'reflective', confidence: 0.60 };
}

/**
 * Generate overall learning style label
 */
function generateOverallStyle(profile: Omit<LearningStyleProfile, 'overallStyle' | 'recommendations' | 'lastAnalyzed' | 'dataPoints'>): string {
  const { pacePreference, explanationEngagement, repetitionPattern, errorRecovery } = profile;
  
  // Map to descriptive labels
  const paceLabels = {
    'fast-decider': 'Intuitive',
    'thorough-analyzer': 'Methodical',
    'balanced': 'Adaptive',
  };
  
  const engagementLabels = {
    'deep-dive': 'Deep Processor',
    'moderate': 'Balanced Learner',
    'minimal': 'Efficient Learner',
  };
  
  const repetitionLabels = {
    'spaced-repetition': 'Strategic Reviewer',
    'mass-practice': 'Intensive Studier',
    'mixed': 'Flexible Learner',
  };
  
  const recoveryLabels = {
    'reflective': 'Reflective',
    'persistent': 'Persistent',
  };
  
  // Combine primary characteristics
  return `${paceLabels[pacePreference]} ${engagementLabels[explanationEngagement]}`;
}

/**
 * Generate personalized recommendations based on learning style
 */
function generateRecommendations(profile: Omit<LearningStyleProfile, 'recommendations' | 'lastAnalyzed' | 'dataPoints'>): string[] {
  const recommendations: string[] = [];
  
  // Pace-based recommendations
  if (profile.pacePreference === 'fast-decider') {
    recommendations.push('Trust your instincts - your first answer is usually correct');
    recommendations.push('Challenge yourself with harder questions to maintain engagement');
  } else if (profile.pacePreference === 'thorough-analyzer') {
    recommendations.push('Set time limits to avoid overthinking - your detailed approach is valuable but can slow progress');
    recommendations.push('Review answer explanations after submission rather than before');
  }
  
  // Explanation engagement recommendations
  if (profile.explanationEngagement === 'deep-dive') {
    recommendations.push('Your deep engagement with explanations is excellent - consider creating study notes');
    recommendations.push('Try teaching concepts to others to reinforce your understanding');
  } else if (profile.explanationEngagement === 'minimal') {
    recommendations.push('Spend more time reviewing explanations, especially for incorrect answers');
    recommendations.push('Your efficiency is good, but deeper review can improve long-term retention');
  }
  
  // Repetition pattern recommendations
  if (profile.repetitionPattern === 'mass-practice') {
    recommendations.push('Space out your reviews more - distributed practice improves long-term retention');
    recommendations.push('Use the FSRS system to schedule optimal review intervals');
  } else if (profile.repetitionPattern === 'spaced-repetition') {
    recommendations.push('Excellent use of spaced repetition - keep up the distributed practice');
  }
  
  // Error recovery recommendations
  if (profile.errorRecovery === 'reflective') {
    recommendations.push('Your reflective approach to errors is ideal for deep learning');
    recommendations.push('Continue taking time to understand mistakes before moving on');
  } else if (profile.errorRecovery === 'persistent') {
    recommendations.push('Your persistence is admirable - balance it with reflection on mistakes');
    recommendations.push('After errors, review the explanation before attempting more questions');
  }
  
  return recommendations;
}

/**
 * Main function: Detect learning style from behavioral data
 */
export function detectLearningStyle(data: LearningBehaviorData): LearningStyleProfile {
  // Detect each dimension
  const pace = detectPacePreference(data.attempts);
  const explanation = detectExplanationEngagement(data.explanationViews, data.attempts.length);
  const repetition = detectRepetitionPattern(data.reviewHistory);
  const recovery = detectErrorRecovery(data.attempts);
  
  // Build partial profile
  const partialProfile = {
    pacePreference: pace.style,
    explanationEngagement: explanation.style,
    repetitionPattern: repetition.style,
    errorRecovery: recovery.style,
    confidence: {
      pace: pace.confidence,
      explanation: explanation.confidence,
      repetition: repetition.confidence,
      errorRecovery: recovery.confidence,
    },
  };
  
  // Generate overall style and recommendations
  const overallStyle = generateOverallStyle(partialProfile);
  const recommendations = generateRecommendations(partialProfile);
  
  // Calculate data points
  const uniqueDays = new Set(data.attempts.map(a => a.createdAt.toISOString().split('T')[0])).size;
  
  return {
    ...partialProfile,
    overallStyle,
    recommendations,
    lastAnalyzed: new Date(),
    dataPoints: {
      questions: data.attempts.length,
      sessions: data.sessions.length,
      days: uniqueDays,
    },
  };
}

/**
 * Check if learning style detection has sufficient data
 */
export function hasSufficientDataForDetection(data: LearningBehaviorData): {
  sufficient: boolean;
  missing: string[];
  confidence: 'low' | 'medium' | 'high';
} {
  const missing: string[] = [];
  
  if (data.attempts.length < 20) {
    missing.push(`Need ${20 - data.attempts.length} more question attempts`);
  }
  
  if (data.sessions.length < 3) {
    missing.push(`Need ${3 - data.sessions.length} more study sessions`);
  }
  
  const uniqueDays = new Set(data.attempts.map(a => a.createdAt.toISOString().split('T')[0])).size;
  if (uniqueDays < 3) {
    missing.push(`Need data from ${3 - uniqueDays} more days`);
  }
  
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (data.attempts.length >= 100 && data.sessions.length >= 10 && uniqueDays >= 7) {
    confidence = 'high';
  } else if (data.attempts.length >= 50 && data.sessions.length >= 5 && uniqueDays >= 5) {
    confidence = 'medium';
  }
  
  return {
    sufficient: missing.length === 0,
    missing,
    confidence,
  };
}

/**
 * Update learning style in database (helper for automation job)
 */
export async function updateUserLearningStyle(
  userId: string,
  data: LearningBehaviorData,
  prisma: any // PrismaClient
): Promise<LearningStyleProfile | null> {
  const check = hasSufficientDataForDetection(data);
  
  if (!check.sufficient) {
    console.log(`⚠️ Insufficient data for user ${userId}: ${check.missing.join(', ')}`);
    return null;
  }
  
  const profile = detectLearningStyle(data);
  
  // Update UserLearningProfile
  await prisma.userLearningProfile.update({
    where: { userId },
    data: {
      // Store as JSON in existing learningInsights field
      learningInsights: [
        `Learning Style: ${profile.overallStyle}`,
        `Pace: ${profile.pacePreference} (${Math.round(profile.confidence.pace * 100)}% confidence)`,
        `Explanation: ${profile.explanationEngagement}`,
        `Repetition: ${profile.repetitionPattern}`,
        `Error Recovery: ${profile.errorRecovery}`,
      ],
      recommendations: profile.recommendations,
      updatedAt: new Date(),
    },
  });
  
  console.log(`✅ Updated learning style for user ${userId}: ${profile.overallStyle}`);
  
  return profile;
}
