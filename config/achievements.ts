/**
 * Achievement definitions for PANaCEa adaptive learning platform
 * Defines all available achievements with metadata for display and unlock logic
 */

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface AchievementDefinition {
  id: string;
  name: string; // Shown name (may be hidden until unlock)
  description: string; // Shown description (may be hidden until unlock)
  rarity: AchievementRarity;
  category: 'performance' | 'consistency' | 'mastery' | 'milestone' | 'special';
  displayOrder: number;
  icon: string; // Icon identifier or emoji code
  hidden: boolean; // If true, name/desc are replaced until unlock
  hiddenName?: string; // Name shown when locked
  hiddenDescription?: string; // Description shown when locked
  requirements: {
    type: 'accuracy' | 'streak' | 'count' | 'mastery' | 'special';
    value: number;
    condition?: string; // Additional context (e.g., "in_one_session")
  };
}

/**
 * Complete achievement definitions database
 * Professional medical platform aesthetic - no emojis
 */
export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Performance Achievements
  {
    id: 'first_correct',
    name: 'First Steps',
    description: 'Answer your first question correctly',
    rarity: 'common',
    category: 'milestone',
    displayOrder: 1,
    icon: 'check-circle',
    hidden: false,
    requirements: {
      type: 'count',
      value: 1,
    },
  },
  {
    id: 'perfect_10',
    name: 'Perfect Ten',
    description: 'Answer 10 questions in a row correctly',
    rarity: 'uncommon',
    category: 'performance',
    displayOrder: 10,
    icon: 'target',
    hidden: false,
    requirements: {
      type: 'streak',
      value: 10,
    },
  },
  {
    id: 'flawless_20',
    name: 'Flawless Execution',
    description: 'Achieve a 20-question perfect streak',
    rarity: 'rare',
    category: 'performance',
    displayOrder: 20,
    icon: 'award',
    hidden: false,
    requirements: {
      type: 'streak',
      value: 20,
    },
  },
  {
    id: 'unstoppable_50',
    name: 'Unstoppable',
    description: 'Maintain a 50-question perfect streak',
    rarity: 'epic',
    category: 'performance',
    displayOrder: 30,
    icon: 'trophy',
    hidden: true,
    hiddenName: 'Locked Achievement',
    hiddenDescription: 'Achieve an extraordinary performance streak',
    requirements: {
      type: 'streak',
      value: 50,
    },
  },
  {
    id: 'legendary_100',
    name: 'Clinical Excellence',
    description: 'Complete a perfect 100-question streak',
    rarity: 'legendary',
    category: 'performance',
    displayOrder: 40,
    icon: 'star',
    hidden: true,
    hiddenName: 'Locked Achievement',
    hiddenDescription: 'Demonstrate exceptional clinical reasoning',
    requirements: {
      type: 'streak',
      value: 100,
    },
  },

  // Consistency Achievements
  {
    id: 'daily_dedication_7',
    name: 'Weekly Commitment',
    description: 'Study for 7 consecutive days',
    rarity: 'uncommon',
    category: 'consistency',
    displayOrder: 50,
    icon: 'calendar-check',
    hidden: false,
    requirements: {
      type: 'streak',
      value: 7,
      condition: 'daily',
    },
  },
  {
    id: 'daily_dedication_30',
    name: 'Monthly Mastery',
    description: 'Maintain a 30-day study streak',
    rarity: 'rare',
    category: 'consistency',
    displayOrder: 60,
    icon: 'flame',
    hidden: false,
    requirements: {
      type: 'streak',
      value: 30,
      condition: 'daily',
    },
  },
  {
    id: 'daily_dedication_100',
    name: 'Unwavering Discipline',
    description: 'Study consistently for 100 consecutive days',
    rarity: 'epic',
    category: 'consistency',
    displayOrder: 70,
    icon: 'flame-kindling',
    hidden: true,
    hiddenName: 'Locked Achievement',
    hiddenDescription: 'Demonstrate exceptional consistency',
    requirements: {
      type: 'streak',
      value: 100,
      condition: 'daily',
    },
  },

  // Mastery Achievements
  {
    id: 'cardio_mastery',
    name: 'Cardiovascular Specialist',
    description: 'Achieve Gold tier mastery in Cardiovascular system',
    rarity: 'rare',
    category: 'mastery',
    displayOrder: 100,
    icon: 'heart-pulse',
    hidden: false,
    requirements: {
      type: 'mastery',
      value: 1,
      condition: 'CV',
    },
  },
  {
    id: 'pulm_mastery',
    name: 'Pulmonary Expert',
    description: 'Achieve Gold tier mastery in Pulmonary system',
    rarity: 'rare',
    category: 'mastery',
    displayOrder: 101,
    icon: 'wind',
    hidden: false,
    requirements: {
      type: 'mastery',
      value: 1,
      condition: 'PULM',
    },
  },
  {
    id: 'gi_mastery',
    name: 'Gastroenterology Authority',
    description: 'Achieve Gold tier mastery in Gastrointestinal system',
    rarity: 'rare',
    category: 'mastery',
    displayOrder: 102,
    icon: 'activity',
    hidden: false,
    requirements: {
      type: 'mastery',
      value: 1,
      condition: 'GI',
    },
  },
  {
    id: 'neuro_mastery',
    name: 'Neurological Virtuoso',
    description: 'Achieve Gold tier mastery in Neurological system',
    rarity: 'rare',
    category: 'mastery',
    displayOrder: 103,
    icon: 'brain',
    hidden: false,
    requirements: {
      type: 'mastery',
      value: 1,
      condition: 'NEURO',
    },
  },
  {
    id: 'all_systems_gold',
    name: 'Comprehensive Excellence',
    description: 'Achieve Gold tier mastery in all organ systems',
    rarity: 'legendary',
    category: 'mastery',
    displayOrder: 150,
    icon: 'badge-check',
    hidden: true,
    hiddenName: 'Locked Achievement',
    hiddenDescription: 'Master all medical systems',
    requirements: {
      type: 'mastery',
      value: 10,
      condition: 'all_systems',
    },
  },

  // Milestone Achievements
  {
    id: 'questions_100',
    name: 'Centurion',
    description: 'Answer 100 questions total',
    rarity: 'common',
    category: 'milestone',
    displayOrder: 200,
    icon: 'circle-check',
    hidden: false,
    requirements: {
      type: 'count',
      value: 100,
    },
  },
  {
    id: 'questions_500',
    name: 'Dedicated Scholar',
    description: 'Answer 500 questions total',
    rarity: 'uncommon',
    category: 'milestone',
    displayOrder: 201,
    icon: 'book-open',
    hidden: false,
    requirements: {
      type: 'count',
      value: 500,
    },
  },
  {
    id: 'questions_1000',
    name: 'Knowledge Seeker',
    description: 'Answer 1,000 questions total',
    rarity: 'rare',
    category: 'milestone',
    displayOrder: 202,
    icon: 'graduation-cap',
    hidden: false,
    requirements: {
      type: 'count',
      value: 1000,
    },
  },
  {
    id: 'questions_5000',
    name: 'Clinical Authority',
    description: 'Answer 5,000 questions total',
    rarity: 'epic',
    category: 'milestone',
    displayOrder: 203,
    icon: 'shield-check',
    hidden: true,
    hiddenName: 'Locked Achievement',
    hiddenDescription: 'Reach a significant milestone',
    requirements: {
      type: 'count',
      value: 5000,
    },
  },

  // Accuracy Achievements
  {
    id: 'accuracy_80_session',
    name: 'Strong Performance',
    description: 'Achieve 80% accuracy in a 20+ question session',
    rarity: 'uncommon',
    category: 'performance',
    displayOrder: 300,
    icon: 'trending-up',
    hidden: false,
    requirements: {
      type: 'accuracy',
      value: 80,
      condition: 'session_20',
    },
  },
  {
    id: 'accuracy_90_session',
    name: 'Exceptional Precision',
    description: 'Achieve 90% accuracy in a 30+ question session',
    rarity: 'rare',
    category: 'performance',
    displayOrder: 301,
    icon: 'crosshair',
    hidden: false,
    requirements: {
      type: 'accuracy',
      value: 90,
      condition: 'session_30',
    },
  },
  {
    id: 'accuracy_95_session',
    name: 'Near Perfect',
    description: 'Achieve 95% accuracy in a 50+ question session',
    rarity: 'epic',
    category: 'performance',
    displayOrder: 302,
    icon: 'bullseye',
    hidden: true,
    hiddenName: 'Locked Achievement',
    hiddenDescription: 'Demonstrate remarkable accuracy',
    requirements: {
      type: 'accuracy',
      value: 95,
      condition: 'session_50',
    },
  },

  // Special Achievements
  {
    id: 'baseline_complete',
    name: 'Baseline Established',
    description: 'Complete the baseline diagnostic assessment',
    rarity: 'common',
    category: 'special',
    displayOrder: 5,
    icon: 'clipboard-check',
    hidden: false,
    requirements: {
      type: 'special',
      value: 1,
      condition: 'baseline',
    },
  },
  {
    id: 'night_owl',
    name: 'Night Shift',
    description: 'Study session completed between midnight and 5 AM',
    rarity: 'uncommon',
    category: 'special',
    displayOrder: 400,
    icon: 'moon',
    hidden: false,
    requirements: {
      type: 'special',
      value: 1,
      condition: 'night_study',
    },
  },
  {
    id: 'early_bird',
    name: 'Morning Rounds',
    description: 'Study session completed between 5 AM and 7 AM',
    rarity: 'uncommon',
    category: 'special',
    displayOrder: 401,
    icon: 'sunrise',
    hidden: false,
    requirements: {
      type: 'special',
      value: 1,
      condition: 'morning_study',
    },
  },
];

/**
 * Get achievement by ID
 */
export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Get display name for locked achievement
 */
export function getAchievementDisplayName(
  achievement: AchievementDefinition,
  isUnlocked: boolean
): string {
  if (isUnlocked || !achievement.hidden) {
    return achievement.name;
  }
  return achievement.hiddenName || 'Locked Achievement';
}

/**
 * Get display description for locked achievement
 */
export function getAchievementDisplayDescription(
  achievement: AchievementDefinition,
  isUnlocked: boolean
): string {
  if (isUnlocked || !achievement.hidden) {
    return achievement.description;
  }
  return achievement.hiddenDescription || 'Complete the requirements to unlock';
}

/**
 * Get rarity color for achievement medals
 */
export function getAchievementRarityColor(rarity: AchievementRarity): string {
  const colors: Record<AchievementRarity, string> = {
    common: '#94a3b8', // slate-400
    uncommon: '#22c55e', // green-500
    rare: '#3b82f6', // blue-500
    epic: '#a855f7', // purple-500
    legendary: '#f59e0b', // amber-500
  };
  return colors[rarity];
}

/**
 * Sort achievements by display order
 */
export function sortAchievements(achievements: AchievementDefinition[]): AchievementDefinition[] {
  return [...achievements].sort((a, b) => a.displayOrder - b.displayOrder);
}
