/**
 * Toggle Settings Types
 *
 * Comprehensive type definitions for user-configurable toggle settings
 * that control content delivery, question formats, feedback mechanisms,
 * and performance tracking features.
 */

/**
 * Content Difficulty Settings
 * Controls the complexity and scope of medical content presented
 */
export interface ContentDifficultySettings {
  /** Show only core PANCE blueprint content (excludes advanced pathology) */
  coreOnly: boolean;
  
  /** Include advanced content (rare conditions, complex mechanisms) */
  advancedContent: boolean;
  
  /** Filter to high-yield topics only (commonly tested concepts) */
  highYieldOnly: boolean;
  
  /** Prioritize first-line treatment questions (vs. second/third-line) */
  firstLineOnly: boolean;
}

/**
 * Question Format Settings
 * Controls how questions are presented and displayed
 */
export interface QuestionFormatSettings {
  /** Vignette style: 'standard' | 'brief' | 'detailed' */
  vignetteStyle: 'standard' | 'brief' | 'detailed';
  
  /** Include images in questions (X-rays, CT scans, dermpath) */
  imageIntegration: boolean;
  
  /** Lab value display: 'interpreted' | 'raw' | 'both' */
  labValueDisplay: 'interpreted' | 'raw' | 'both';
  
  /** Show vital signs in questions */
  showVitals: boolean;
  
  /** Include multimedia (audio for heart/lung sounds) */
  multimediaEnabled: boolean;
}

/**
 * Feedback & Review Settings
 * Controls how feedback is delivered and review sessions are configured
 */
export interface FeedbackSettings {
  /** Show immediate feedback after each answer */
  immediateFeedback: boolean;
  
  /** Explanation depth: 'brief' | 'standard' | 'comprehensive' */
  explanationDepth: 'brief' | 'standard' | 'comprehensive';
  
  /** Enable spaced repetition algorithm (FSRS) */
  spacedRepetition: boolean;
  
  /** Auto-advance to next question after viewing explanation */
  autoAdvance: boolean;
  
  /** Show clinical pearls with explanations */
  showPearls: boolean;
  
  /** Display related concepts and differential diagnoses */
  showRelatedConcepts: boolean;
}

/**
 * Performance Tracking Settings
 * Controls visibility and granularity of performance metrics
 */
export interface PerformanceTrackingSettings {
  /** Track and display answer streaks */
  streakTracking: boolean;
  
  /** Show detailed analytics on dashboard */
  detailedAnalytics: boolean;
  
  /** Enable progress notifications */
  progressNotifications: boolean;
  
  /** Show real-time performance trends */
  realtimeTrends: boolean;
  
  /** Display system-by-system breakdown */
  systemBreakdown: boolean;
  
  /** Show longitudinal progress over time */
  longitudinalView: boolean;
}

/**
 * Combined Toggle Settings
 * Master interface containing all toggle categories
 */
export interface ToggleSettings {
  contentDifficulty: ContentDifficultySettings;
  questionFormat: QuestionFormatSettings;
  feedback: FeedbackSettings;
  performanceTracking: PerformanceTrackingSettings;
}

/**
 * Default Toggle Settings
 * Sensible defaults for new users
 */
export const DEFAULT_TOGGLE_SETTINGS: ToggleSettings = {
  contentDifficulty: {
    coreOnly: false,
    advancedContent: true,
    highYieldOnly: false,
    firstLineOnly: false,
  },
  questionFormat: {
    vignetteStyle: 'standard',
    imageIntegration: true,
    labValueDisplay: 'interpreted',
    showVitals: true,
    multimediaEnabled: true,
  },
  feedback: {
    immediateFeedback: true,
    explanationDepth: 'standard',
    spacedRepetition: true,
    autoAdvance: false,
    showPearls: true,
    showRelatedConcepts: true,
  },
  performanceTracking: {
    streakTracking: true,
    detailedAnalytics: true,
    progressNotifications: true,
    realtimeTrends: true,
    systemBreakdown: true,
    longitudinalView: true,
  },
};

/**
 * LocalStorage key for toggle settings persistence
 */
export const TOGGLE_SETTINGS_STORAGE_KEY = 'panceai_toggle_settings';

/**
 * Helper function to load toggle settings from localStorage
 */
export function loadToggleSettings(): ToggleSettings {
  try {
    const saved = localStorage.getItem(TOGGLE_SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ToggleSettings;
      // Merge with defaults to ensure all properties exist
      return {
        contentDifficulty: { ...DEFAULT_TOGGLE_SETTINGS.contentDifficulty, ...parsed.contentDifficulty },
        questionFormat: { ...DEFAULT_TOGGLE_SETTINGS.questionFormat, ...parsed.questionFormat },
        feedback: { ...DEFAULT_TOGGLE_SETTINGS.feedback, ...parsed.feedback },
        performanceTracking: { ...DEFAULT_TOGGLE_SETTINGS.performanceTracking, ...parsed.performanceTracking },
      };
    }
  } catch (error) {
    console.error('Failed to load toggle settings:', error);
  }
  return DEFAULT_TOGGLE_SETTINGS;
}

/**
 * Helper function to save toggle settings to localStorage
 */
export function saveToggleSettings(settings: ToggleSettings): void {
  try {
    localStorage.setItem(TOGGLE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save toggle settings:', error);
  }
}
