/**
 * User Preferences Types
 *
 * Type definitions for user preferences across the application.
 */

export interface UserPreferencesPayload {
  // Study preferences
  dailyGoal?: number;
  preferredSystems?: string[];
  sessionLength?: number;
  difficulty?: string;

  // Timing preferences
  wakeTime?: string;
  studyReminders?: boolean;
  reminderTime?: string;
  reminderDays?: number[];

  // UI preferences
  theme?: string;
  soundEnabled?: boolean;
  hapticFeedback?: boolean;
  animationsEnabled?: boolean;
  fontSize?: string;

  // Learning preferences
  showHints?: boolean;
  autoAdvance?: boolean;
  explanationDepth?: string;
  showPearls?: boolean;
  showRelatedConcepts?: boolean;

  // Review preferences
  fsrsEnabled?: boolean;
  reviewBeforeExam?: boolean;
  mixNewAndReview?: boolean;

  // Advanced settings
  keyboardShortcuts?: boolean;
  developerMode?: boolean;
  betaFeatures?: boolean;

  // Notification preferences
  emailDigest?: boolean;
  emailFrequency?: string;
  pushNotifications?: boolean;

  // Privacy preferences
  shareAnonymousData?: boolean;
  showOnLeaderboard?: boolean;

  // Custom settings
  customSettings?: any;
}

export interface UserPreferencesWithMeta extends UserPreferencesPayload {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
