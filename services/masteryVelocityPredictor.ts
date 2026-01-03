/**
 * Mastery & Velocity Predictor - Sprint 2
 * 
 * Time-to-mastery calculations and progress velocity tracking.
 */

export interface MasteryPrediction {
  conceptId: string;
  conceptName: string;
  currentMastery: number;
  predictedMasteryIn7Days: number;
  predictedMasteryIn30Days: number;
  timeToMasteryHours: number;
  optimalReviewDates: Date[];
  riskOfForgetting: 'low' | 'medium' | 'high';
}

export interface ProgressVelocity {
  currentVelocity: number;
  targetVelocity: number;
  velocityTrend: 'accelerating' | 'steady' | 'decelerating';
  projectedCompletionDate: Date;
  onTrack: boolean;
  daysAheadOrBehind: number;
}

const MASTERY_THRESHOLD = 85;

export function calculateTimeToMastery(
  conceptId: string,
  conceptName: string,
  currentMastery: number,
  practiceHistory: { timestamp: Date; wasCorrect: boolean }[],
  avgLearningRate = 1.0
): MasteryPrediction {
  // Model forgetting curve
  const initialRetention = practiceHistory.length >= 2
    ? practiceHistory.slice(0, 5).filter(p => p.wasCorrect).length / Math.min(5, practiceHistory.length) * 0.5 + 0.5
    : 0.9;
  
  let decayRate = 0.3;
  if (practiceHistory.length >= 3) {
    let forgotCount = 0;
    for (let i = 1; i < practiceHistory.length; i++) {
      if (practiceHistory[i-1].wasCorrect && !practiceHistory[i].wasCorrect) forgotCount++;
    }
    decayRate = Math.min(0.5, forgotCount / practiceHistory.length + 0.2);
  }

  const stability = 1 / decayRate;
  const retention7 = initialRetention * Math.exp(-7 / stability);
  const retention30 = initialRetention * Math.exp(-30 / stability);

  const masteryGap = MASTERY_THRESHOLD - currentMastery;
  const hoursToMastery = masteryGap > 0 ? Math.ceil(masteryGap / (5 * avgLearningRate)) : 0;

  // Generate review schedule (spaced repetition intervals)
  const now = new Date();
  const baseInterval = Math.max(1, Math.round(stability));
  const reviewDates = [1, 2.5, 6, 14, 30].map(mult => {
    const d = new Date(now);
    d.setDate(d.getDate() + Math.round(baseInterval * mult));
    return d;
  });

  const projected7Day = currentMastery * retention7;
  const riskOfForgetting: MasteryPrediction['riskOfForgetting'] =
    projected7Day >= 70 ? 'low' : projected7Day >= 50 ? 'medium' : 'high';

  return {
    conceptId,
    conceptName,
    currentMastery,
    predictedMasteryIn7Days: Math.round(currentMastery * retention7),
    predictedMasteryIn30Days: Math.round(currentMastery * retention30),
    timeToMasteryHours: hoursToMastery,
    optimalReviewDates: reviewDates,
    riskOfForgetting,
  };
}

export function predictProgressVelocity(
  weeklyProgress: { questionsAttempted: number; correctAnswers: number; newConceptsMastered: number }[],
  targetConceptCount: number,
  targetDate: Date,
  currentMasteredConcepts: number
): ProgressVelocity {
  const recentWeeks = weeklyProgress.slice(-4);
  const totalNewConcepts = recentWeeks.reduce((sum, w) => sum + w.newConceptsMastered, 0);
  const totalDays = recentWeeks.length * 7;
  const currentVelocity = totalDays > 0 ? totalNewConcepts / totalDays : 0;

  const daysUntilTarget = Math.max(1, (targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const conceptsRemaining = Math.max(0, targetConceptCount - currentMasteredConcepts);
  const targetVelocity = conceptsRemaining / daysUntilTarget;

  // Trend calculation
  let velocityTrend: ProgressVelocity['velocityTrend'] = 'steady';
  if (weeklyProgress.length >= 3) {
    const recent = weeklyProgress.slice(-3).map(w => w.newConceptsMastered / 7);
    const slope = (recent[2] - recent[0]) / 2;
    velocityTrend = slope > 0.1 ? 'accelerating' : slope < -0.1 ? 'decelerating' : 'steady';
  }

  const projectedCompletionDate = currentVelocity > 0
    ? new Date(Date.now() + (conceptsRemaining / currentVelocity) * 24 * 60 * 60 * 1000)
    : new Date(targetDate.getTime() + 365 * 24 * 60 * 60 * 1000);

  const onTrack = projectedCompletionDate <= targetDate;
  const daysAheadOrBehind = Math.round((targetDate.getTime() - projectedCompletionDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    currentVelocity: Math.round(currentVelocity * 100) / 100,
    targetVelocity: Math.round(targetVelocity * 100) / 100,
    velocityTrend,
    projectedCompletionDate,
    onTrack,
    daysAheadOrBehind,
  };
}
