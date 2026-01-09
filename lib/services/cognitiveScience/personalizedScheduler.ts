/**
 * Personalized Study Scheduler
 * 
 * Optimizes study timing based on:
 * 1. Circadian rhythms and cognitive peaks
 * 2. Sleep patterns and alertness
 * 3. Individual learning velocity
 * 4. Exam date proximity
 * 5. Knowledge decay curves
 * 
 * Key Research:
 * - Wright, K.P. et al. (2006). Circadian modulation of cognition
 * - Schmidt, C. et al. (2007). Circadian preference modulates cognition
 * - Hasher, L. et al. (1999). Circadian rhythms and memory
 * - Walker, M.P. (2008). Sleep, memory, and plasticity
 * 
 * @module lib/services/cognitiveScience/personalizedScheduler
 */

export interface ChronotypeProfile {
  type: 'strong-morning' | 'moderate-morning' | 'intermediate' | 'moderate-evening' | 'strong-evening';
  peakAlertHour: number; // 0-23
  peakCognitiveHour: number; // 0-23
  optimalStudyWindows: { start: number; end: number; quality: 'peak' | 'good' | 'acceptable' }[];
  avoidHours: number[];
  sleepSchedule: { bedtime: number; wakeTime: number; duration: number };
}

export interface StudySchedule {
  date: Date;
  blocks: ScheduledStudyBlock[];
  totalMinutes: number;
  estimatedEfficiency: number; // 0-1
  chronotypeAlignment: number; // How well it matches user's circadian rhythm
  recommendations: string[];
}

export interface ScheduledStudyBlock {
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  contentType: 'new-learning' | 'review' | 'practice' | 'light-review';
  topics: string[];
  cognitiveIntensity: 'high' | 'medium' | 'low';
  expectedRetention: number;
  isOptimalTime: boolean;
  breakAfter: number; // minutes
}

export interface ExamCountdownPlan {
  examDate: Date;
  daysRemaining: number;
  phase: 'initial-learning' | 'deepening' | 'consolidation' | 'review' | 'tapering';
  dailyTargetMinutes: number;
  focusAreas: { topic: string; priority: 'critical' | 'high' | 'medium' | 'low' }[];
  weeklyMilestones: { week: number; goals: string[] }[];
  restDaysRecommended: number[];
}

export interface SleepImpactAssessment {
  hoursSlept: number;
  sleepQuality: 'poor' | 'fair' | 'good' | 'excellent';
  cognitiveImpact: number; // multiplier (1.0 = normal)
  recommendations: string[];
  adjustedStudyCapacity: number; // minutes
  consolidationBenefit: string;
}

/**
 * Determine chronotype from MEQ (Morningness-Eveningness Questionnaire) score
 * or from behavioral patterns
 */
export function determineChronotype(
  preferredWakeTime: number, // hour 0-23
  preferredBedTime: number,
  mostAlertTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night',
  difficultToWakeEarly: boolean
): ChronotypeProfile {
  // Calculate sleep midpoint (simple chronotype indicator)
  let sleepMidpoint = (preferredBedTime + (preferredWakeTime + 24)) / 2;
  if (sleepMidpoint >= 24) sleepMidpoint -= 24;
  
  let type: ChronotypeProfile['type'];
  let peakAlertHour: number;
  let peakCognitiveHour: number;
  
  // Chronotype determination based on sleep midpoint and preferences
  if (sleepMidpoint < 2.5 && mostAlertTimeOfDay === 'morning') {
    type = 'strong-morning';
    peakAlertHour = 9;
    peakCognitiveHour = 10;
  } else if (sleepMidpoint < 3.5 || (!difficultToWakeEarly && mostAlertTimeOfDay === 'morning')) {
    type = 'moderate-morning';
    peakAlertHour = 10;
    peakCognitiveHour = 11;
  } else if (sleepMidpoint > 5.5 && (mostAlertTimeOfDay === 'evening' || mostAlertTimeOfDay === 'night')) {
    type = 'strong-evening';
    peakAlertHour = 21;
    peakCognitiveHour = 20;
  } else if (sleepMidpoint > 4.5 || mostAlertTimeOfDay === 'evening') {
    type = 'moderate-evening';
    peakAlertHour = 19;
    peakCognitiveHour = 18;
  } else {
    type = 'intermediate';
    peakAlertHour = 14;
    peakCognitiveHour = 15;
  }
  
  // Generate optimal study windows based on chronotype
  const optimalStudyWindows = generateStudyWindows(type, peakCognitiveHour);
  
  // Hours to avoid (post-lunch dip, late night, etc.)
  const avoidHours = generateAvoidHours(type, preferredBedTime);
  
  return {
    type,
    peakAlertHour,
    peakCognitiveHour,
    optimalStudyWindows,
    avoidHours,
    sleepSchedule: {
      bedtime: preferredBedTime,
      wakeTime: preferredWakeTime,
      duration: calculateSleepDuration(preferredBedTime, preferredWakeTime),
    },
  };
}

function generateStudyWindows(
  type: ChronotypeProfile['type'],
  peakHour: number
): ChronotypeProfile['optimalStudyWindows'] {
  const windows: ChronotypeProfile['optimalStudyWindows'] = [];
  
  // Peak window (2 hours around peak cognitive time)
  windows.push({
    start: Math.max(6, peakHour - 1),
    end: Math.min(23, peakHour + 1),
    quality: 'peak',
  });
  
  // Good windows (2-4 hours from peak)
  if (type.includes('morning')) {
    windows.push({ start: peakHour + 2, end: peakHour + 4, quality: 'good' });
    windows.push({ start: Math.max(6, peakHour - 3), end: peakHour - 1, quality: 'good' });
  } else if (type.includes('evening')) {
    windows.push({ start: peakHour - 4, end: peakHour - 2, quality: 'good' });
    windows.push({ start: 14, end: 16, quality: 'good' }); // Post-dip recovery
  } else {
    windows.push({ start: 9, end: 11, quality: 'good' });
    windows.push({ start: 16, end: 18, quality: 'good' });
  }
  
  // Acceptable windows
  windows.push({ start: 8, end: 20, quality: 'acceptable' });
  
  return windows;
}

function generateAvoidHours(type: ChronotypeProfile['type'], bedtime: number): number[] {
  const avoid: number[] = [];
  
  // Post-lunch dip (universal circadian phenomenon)
  avoid.push(13, 14);
  
  // Hours near bedtime (sleep pressure affects cognition)
  avoid.push((bedtime - 1 + 24) % 24);
  avoid.push(bedtime);
  
  // Late night for morning types
  if (type.includes('morning')) {
    avoid.push(21, 22, 23);
  }
  
  // Early morning for evening types
  if (type.includes('evening')) {
    avoid.push(6, 7, 8);
  }
  
  return [...new Set(avoid)];
}

function calculateSleepDuration(bedtime: number, wakeTime: number): number {
  let duration = wakeTime - bedtime;
  if (duration < 0) duration += 24;
  return duration;
}

/**
 * Assess the impact of sleep on cognitive performance
 * Based on Walker's research on sleep and memory consolidation
 */
export function assessSleepImpact(
  hoursSlept: number,
  sleepQuality: 'poor' | 'fair' | 'good' | 'excellent',
  nightsWithPoorSleep: number // in the last week
): SleepImpactAssessment {
  // Base cognitive impact from sleep duration
  let cognitiveImpact = 1.0;
  
  if (hoursSlept < 5) {
    cognitiveImpact = 0.6; // Severe impairment
  } else if (hoursSlept < 6) {
    cognitiveImpact = 0.75;
  } else if (hoursSlept < 7) {
    cognitiveImpact = 0.9;
  } else if (hoursSlept > 9) {
    cognitiveImpact = 0.95; // Slight oversleep impairment
  }
  
  // Adjust for sleep quality
  const qualityMultiplier = {
    poor: 0.7,
    fair: 0.85,
    good: 1.0,
    excellent: 1.1,
  };
  cognitiveImpact *= qualityMultiplier[sleepQuality];
  
  // Cumulative sleep debt (research shows effects compound)
  if (nightsWithPoorSleep > 2) {
    cognitiveImpact *= Math.max(0.6, 1 - nightsWithPoorSleep * 0.08);
  }
  
  // Calculate adjusted study capacity
  const baseStudyCapacity = 180; // 3 hours of effective study
  const adjustedStudyCapacity = Math.round(baseStudyCapacity * cognitiveImpact);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (hoursSlept < 7) {
    recommendations.push(
      '💤 Sleep debt affects learning significantly. Prioritize 7-8 hours tonight.'
    );
    recommendations.push(
      'Memory consolidation happens during sleep. Tonight\'s sleep will strengthen what you learn today.'
    );
  }
  
  if (sleepQuality === 'poor' || sleepQuality === 'fair') {
    recommendations.push(
      'Poor sleep quality reduces working memory capacity. Focus on review rather than new material.'
    );
  }
  
  if (nightsWithPoorSleep > 3) {
    recommendations.push(
      '⚠️ Cumulative sleep debt detected. Consider a recovery nap (20-30 min) or earlier bedtime.'
    );
  }
  
  if (cognitiveImpact < 0.8) {
    recommendations.push(
      'Today\'s reduced capacity suggests focusing on easier material or taking a rest day.'
    );
  }
  
  // Consolidation benefit message
  const consolidationBenefit = 
    hoursSlept >= 7 
      ? 'Good sleep will consolidate today\'s learning. Memories are strengthened during deep sleep.'
      : 'Insufficient sleep reduces consolidation. Consider reviewing yesterday\'s material again tomorrow.';
  
  return {
    hoursSlept,
    sleepQuality,
    cognitiveImpact: Math.round(cognitiveImpact * 100) / 100,
    recommendations,
    adjustedStudyCapacity,
    consolidationBenefit,
  };
}

/**
 * Generate an exam countdown study plan
 * Implements tapering (like athletic training) near the exam
 */
export function generateExamCountdownPlan(
  examDate: Date,
  totalTopics: number,
  currentMasteryPercent: number,
  dailyAvailableMinutes: number
): ExamCountdownPlan {
  const now = new Date();
  const daysRemaining = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Determine phase
  let phase: ExamCountdownPlan['phase'];
  let dailyTargetMinutes: number;
  
  if (daysRemaining > 60) {
    phase = 'initial-learning';
    dailyTargetMinutes = Math.min(dailyAvailableMinutes, 120);
  } else if (daysRemaining > 30) {
    phase = 'deepening';
    dailyTargetMinutes = Math.min(dailyAvailableMinutes, 150);
  } else if (daysRemaining > 14) {
    phase = 'consolidation';
    dailyTargetMinutes = Math.min(dailyAvailableMinutes, 180);
  } else if (daysRemaining > 3) {
    phase = 'review';
    dailyTargetMinutes = Math.min(dailyAvailableMinutes, 120);
  } else {
    phase = 'tapering';
    dailyTargetMinutes = Math.min(dailyAvailableMinutes, 60); // Light review only
  }
  
  // Calculate priorities
  const criticalTopics = Math.ceil(totalTopics * 0.2); // Top 20%
  const highTopics = Math.ceil(totalTopics * 0.3);
  const focusAreas: ExamCountdownPlan['focusAreas'] = [];
  
  for (let i = 0; i < totalTopics; i++) {
    let priority: 'critical' | 'high' | 'medium' | 'low';
    if (i < criticalTopics) priority = 'critical';
    else if (i < criticalTopics + highTopics) priority = 'high';
    else if (i < totalTopics * 0.7) priority = 'medium';
    else priority = 'low';
    
    focusAreas.push({ topic: `Topic ${i + 1}`, priority });
  }
  
  // Weekly milestones
  const weeklyMilestones: ExamCountdownPlan['weeklyMilestones'] = [];
  const totalWeeks = Math.ceil(daysRemaining / 7);
  
  for (let week = 1; week <= Math.min(totalWeeks, 8); week++) {
    const weekGoals: string[] = [];
    const weekProgress = (week / totalWeeks) * 100;
    
    if (weekProgress < 40) {
      weekGoals.push(`Complete first pass of ${Math.ceil(totalTopics * 0.25)} new topics`);
      weekGoals.push('Focus on understanding, not memorization');
    } else if (weekProgress < 70) {
      weekGoals.push('Complete practice questions for covered topics');
      weekGoals.push('Identify weak areas through self-testing');
    } else if (weekProgress < 90) {
      weekGoals.push('Review and reinforce weak areas');
      weekGoals.push('Full-length practice sessions');
    } else {
      weekGoals.push('Light review of high-yield topics only');
      weekGoals.push('Rest and mental preparation');
    }
    
    weeklyMilestones.push({ week, goals: weekGoals });
  }
  
  // Rest days (research shows rest improves consolidation)
  const restDaysRecommended: number[] = [];
  if (daysRemaining > 7) {
    // One rest day per week
    for (let i = 6; i < daysRemaining; i += 7) {
      restDaysRecommended.push(i);
    }
  }
  // Mandatory rest day before exam
  if (daysRemaining > 1) {
    restDaysRecommended.push(daysRemaining - 1);
  }
  
  return {
    examDate,
    daysRemaining,
    phase,
    dailyTargetMinutes,
    focusAreas,
    weeklyMilestones,
    restDaysRecommended,
  };
}

/**
 * Generate a daily study schedule optimized for circadian rhythms
 */
export function generateDailySchedule(
  chronotype: ChronotypeProfile,
  availableMinutes: number,
  topicsToStudy: { topic: string; isNew: boolean; difficulty: number }[],
  currentDate: Date = new Date()
): StudySchedule {
  const blocks: ScheduledStudyBlock[] = [];
  let remainingMinutes = availableMinutes;
  
  // Sort study windows by quality
  const sortedWindows = [...chronotype.optimalStudyWindows]
    .sort((a, b) => {
      const qualityOrder = { peak: 0, good: 1, acceptable: 2 };
      return qualityOrder[a.quality] - qualityOrder[b.quality];
    });
  
  // Separate topics by type
  const newTopics = topicsToStudy.filter(t => t.isNew);
  const reviewTopics = topicsToStudy.filter(t => !t.isNew);
  
  // Allocate new learning to peak hours, review to good/acceptable
  for (const window of sortedWindows) {
    if (remainingMinutes <= 0) break;
    
    // Skip if this hour should be avoided
    const windowHours = [];
    for (let h = window.start; h < window.end; h++) {
      if (!chronotype.avoidHours.includes(h)) {
        windowHours.push(h);
      }
    }
    
    if (windowHours.length === 0) continue;
    
    // Determine block type based on window quality
    let contentType: ScheduledStudyBlock['contentType'];
    let cognitiveIntensity: ScheduledStudyBlock['cognitiveIntensity'];
    let topics: string[];
    let blockDuration: number;
    
    if (window.quality === 'peak' && newTopics.length > 0) {
      contentType = 'new-learning';
      cognitiveIntensity = 'high';
      topics = newTopics.slice(0, 3).map(t => t.topic);
      blockDuration = Math.min(50, remainingMinutes); // Max 50 min for intensive
    } else if (window.quality === 'good') {
      contentType = 'practice';
      cognitiveIntensity = 'medium';
      topics = reviewTopics.slice(0, 5).map(t => t.topic);
      blockDuration = Math.min(45, remainingMinutes);
    } else {
      contentType = 'light-review';
      cognitiveIntensity = 'low';
      topics = reviewTopics.slice(-5).map(t => t.topic);
      blockDuration = Math.min(30, remainingMinutes);
    }
    
    const startHour = windowHours[0];
    const startTime = new Date(currentDate);
    startTime.setHours(startHour, 0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + blockDuration);
    
    blocks.push({
      startTime,
      endTime,
      durationMinutes: blockDuration,
      contentType,
      topics,
      cognitiveIntensity,
      expectedRetention: window.quality === 'peak' ? 0.85 : window.quality === 'good' ? 0.75 : 0.65,
      isOptimalTime: window.quality === 'peak',
      breakAfter: blockDuration >= 45 ? 10 : 5,
    });
    
    remainingMinutes -= blockDuration;
  }
  
  // Calculate metrics
  const totalMinutes = blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const peakMinutes = blocks.filter(b => b.isOptimalTime).reduce((sum, b) => sum + b.durationMinutes, 0);
  const chronotypeAlignment = totalMinutes > 0 ? peakMinutes / totalMinutes : 0;
  const estimatedEfficiency = 0.7 + (chronotypeAlignment * 0.25);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (chronotypeAlignment < 0.3) {
    recommendations.push(
      `Your schedule doesn't align well with your ${chronotype.type} chronotype. Try to study during your peak hours (around ${chronotype.peakCognitiveHour}:00).`
    );
  }
  
  if (newTopics.length > 0 && !blocks.some(b => b.contentType === 'new-learning' && b.isOptimalTime)) {
    recommendations.push(
      'New material is best learned during peak cognitive hours. Schedule difficult topics in the morning/evening based on your type.'
    );
  }
  
  if (totalMinutes > 180) {
    recommendations.push(
      'Long study sessions (>3 hours) have diminishing returns. Consider splitting across multiple days.'
    );
  }
  
  recommendations.push(
    `Based on your chronotype, your cognitive peak is around ${chronotype.peakCognitiveHour}:00. Schedule your hardest material then.`
  );
  
  return {
    date: currentDate,
    blocks,
    totalMinutes,
    estimatedEfficiency,
    chronotypeAlignment,
    recommendations,
  };
}

/**
 * Calculate optimal spacing based on exam date
 * Uses the "expanding retrieval" principle
 */
export function calculateExamOptimizedSpacing(
  examDate: Date,
  currentStability: number,
  lastReviewDate: Date
): {
  optimalNextReview: Date;
  reviewsBeforeExam: number;
  spacingStrategy: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
} {
  const now = new Date();
  const daysUntilExam = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceReview = Math.ceil((now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate how many reviews are possible before exam
  let reviewsBeforeExam = 0;
  let nextInterval = Math.min(currentStability, Math.floor(daysUntilExam / 3));
  let totalDays = 0;
  
  while (totalDays + nextInterval < daysUntilExam) {
    reviewsBeforeExam++;
    totalDays += nextInterval;
    nextInterval = Math.ceil(nextInterval * 1.5); // Expanding intervals
  }
  
  // Determine urgency
  let urgency: 'low' | 'medium' | 'high' | 'critical';
  if (daysUntilExam <= 3) {
    urgency = 'critical';
  } else if (daysUntilExam <= 7) {
    urgency = 'high';
  } else if (daysSinceReview > currentStability) {
    urgency = 'medium';
  } else {
    urgency = 'low';
  }
  
  // Calculate optimal next review
  let daysToNextReview: number;
  if (urgency === 'critical') {
    daysToNextReview = 0; // Review today
  } else if (urgency === 'high') {
    daysToNextReview = 1;
  } else {
    daysToNextReview = Math.min(currentStability, Math.floor(daysUntilExam / (reviewsBeforeExam + 1)));
  }
  
  const optimalNextReview = new Date(now);
  optimalNextReview.setDate(optimalNextReview.getDate() + daysToNextReview);
  
  // Spacing strategy
  let spacingStrategy: string;
  if (daysUntilExam <= 7) {
    spacingStrategy = 'INTENSIVE: Daily review of all material recommended';
  } else if (daysUntilExam <= 21) {
    spacingStrategy = 'CONSOLIDATION: Review every 2-3 days with focus on weak areas';
  } else if (daysUntilExam <= 60) {
    spacingStrategy = 'EXPANDING: Use spaced repetition with gradually increasing intervals';
  } else {
    spacingStrategy = 'INITIAL: Focus on learning new material, review weekly';
  }
  
  return {
    optimalNextReview,
    reviewsBeforeExam,
    spacingStrategy,
    urgency,
  };
}

/**
 * Generate personalized study tips based on profile
 */
export function generatePersonalizedTips(
  chronotype: ChronotypeProfile,
  sleepAssessment: SleepImpactAssessment,
  examCountdown?: ExamCountdownPlan
): string[] {
  const tips: string[] = [];
  
  // Chronotype tips
  if (chronotype.type.includes('morning')) {
    tips.push('🌅 As a morning person, tackle your hardest topics between 9-11 AM');
    tips.push('Avoid studying after 9 PM - your cognitive capacity drops significantly');
  } else if (chronotype.type.includes('evening')) {
    tips.push('🌙 As an evening person, save complex material for late afternoon/evening');
    tips.push('Don\'t force early morning study - it\'s less effective for your chronotype');
  } else {
    tips.push('⚖️ Your intermediate chronotype gives you flexibility. Use mid-morning and late afternoon.');
  }
  
  // Sleep tips
  if (sleepAssessment.hoursSlept < 7) {
    tips.push('💤 Sleep debt is real. One hour less sleep = ~25% reduced learning efficiency');
    tips.push('A 20-minute power nap can restore some cognitive function');
  }
  
  // Exam countdown tips
  if (examCountdown) {
    if (examCountdown.phase === 'tapering') {
      tips.push('🎯 Final days: Light review only. Trust your preparation.');
      tips.push('Heavy studying now can cause interference. Rest is more valuable.');
    } else if (examCountdown.phase === 'review') {
      tips.push('Focus on high-yield topics and weak areas identified in practice tests');
      tips.push('Simulate exam conditions with timed practice');
    }
  }
  
  // Universal tips based on research
  tips.push('📚 Testing yourself is 2-3x more effective than re-reading');
  tips.push('🧠 Interleave topics instead of studying one subject for hours');
  tips.push('😴 Sleep consolidates memories - review key material before bed');
  
  return tips;
}

export default {
  determineChronotype,
  assessSleepImpact,
  generateExamCountdownPlan,
  generateDailySchedule,
  calculateExamOptimizedSpacing,
  generatePersonalizedTips,
};
