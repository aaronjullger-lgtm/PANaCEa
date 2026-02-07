/**
 * Module 5: Interface Fabric System Type Definitions
 * 
 * UI/UX and gamification layer using:
 * - lumina for adaptive dashboard aesthetics
 * - svg_generator for avatars, badges, and achievements
 * - Circadian UI adaptation
 * - Visual progression system
 * - Metacognition widgets
 * 
 * @module interface-fabric-system
 */

// ============================================================================
// CIRCADIAN UI (LUMINA)
// ============================================================================

/**
 * User's circadian profile for adaptive UI.
 */
export interface UserCircadianProfile {
  /** User ID */
  userId: string;
  
  /** Peak performance hours (0-23) */
  peakHours: number[];
  
  /** Low energy hours (0-23) */
  lowEnergyHours: number[];
  
  /** Preferred study times */
  preferredStudyTimes: Array<{
    dayOfWeek: number; // 0-6
    startHour: number;
    endHour: number;
  }>;
  
  /** Current timezone */
  timezone: string;
  
  /** Sleep schedule */
  sleepSchedule?: {
    bedtime: string; // "22:00"
    wakeTime: string; // "06:00"
  };
  
  /** Updated at */
  updatedAt: string;
}

/**
 * UI mode based on circadian state.
 */
export type UIMode = 'focus' | 'review' | 'rest' | 'standard';

/**
 * Theme configuration for a UI mode.
 */
export interface UIThemeConfig {
  /** Mode name */
  mode: UIMode;
  
  /** Color palette */
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    text: string;
    textMuted: string;
    border: string;
    accent: string;
  };
  
  /** Typography */
  typography: {
    fontFamily: string;
    fontSize: number; // base size in px
    lineHeight: number;
    fontWeight: number;
  };
  
  /** Spacing */
  spacing: {
    compact: boolean;
    cardPadding: number;
    sectionGap: number;
  };
  
  /** Visual effects */
  effects: {
    blur: number; // 0-20
    saturation: number; // 0-150 (%)
    contrast: number; // 0-200 (%)
    brightness: number; // 0-200 (%)
    animations: 'full' | 'reduced' | 'none';
  };
  
  /** Accessibility */
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
  };
}

/**
 * Pre-defined UI modes.
 */
export const UI_MODES: Record<UIMode, UIThemeConfig> = {
  focus: {
    mode: 'focus',
    colors: {
      background: '#0a0e27',
      surface: '#151933',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      text: '#f8fafc',
      textMuted: '#cbd5e1',
      border: '#334155',
      accent: '#06b6d4',
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 16,
      lineHeight: 1.6,
      fontWeight: 500,
    },
    spacing: {
      compact: true,
      cardPadding: 16,
      sectionGap: 24,
    },
    effects: {
      blur: 0,
      saturation: 90,
      contrast: 120,
      brightness: 100,
      animations: 'reduced',
    },
    accessibility: {
      highContrast: true,
      largeText: false,
      reducedMotion: true,
    },
  },
  review: {
    mode: 'review',
    colors: {
      background: '#1e1b29',
      surface: '#2a2438',
      primary: '#f59e0b',
      secondary: '#ec4899',
      text: '#fef3c7',
      textMuted: '#fbbf24',
      border: '#78350f',
      accent: '#fb923c',
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 15,
      lineHeight: 1.7,
      fontWeight: 400,
    },
    spacing: {
      compact: false,
      cardPadding: 20,
      sectionGap: 32,
    },
    effects: {
      blur: 8,
      saturation: 110,
      contrast: 100,
      brightness: 95,
      animations: 'full',
    },
    accessibility: {
      highContrast: false,
      largeText: false,
      reducedMotion: false,
    },
  },
  rest: {
    mode: 'rest',
    colors: {
      background: '#1a1a2e',
      surface: '#16213e',
      primary: '#0f3460',
      secondary: '#533483',
      text: '#e0e0e0',
      textMuted: '#a0a0a0',
      border: '#2a2a4e',
      accent: '#00adb5',
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 14,
      lineHeight: 1.8,
      fontWeight: 300,
    },
    spacing: {
      compact: false,
      cardPadding: 24,
      sectionGap: 40,
    },
    effects: {
      blur: 12,
      saturation: 70,
      contrast: 90,
      brightness: 85,
      animations: 'full',
    },
    accessibility: {
      highContrast: false,
      largeText: false,
      reducedMotion: false,
    },
  },
  standard: {
    mode: 'standard',
    colors: {
      background: '#0f172a',
      surface: '#1e293b',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      border: '#334155',
      accent: '#06b6d4',
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 15,
      lineHeight: 1.6,
      fontWeight: 400,
    },
    spacing: {
      compact: false,
      cardPadding: 20,
      sectionGap: 32,
    },
    effects: {
      blur: 4,
      saturation: 100,
      contrast: 100,
      brightness: 100,
      animations: 'full',
    },
    accessibility: {
      highContrast: false,
      largeText: false,
      reducedMotion: false,
    },
  },
};

/**
 * Adaptive UI state.
 */
export interface AdaptiveUIState {
  /** Current mode */
  currentMode: UIMode;
  
  /** Current theme config */
  theme: UIThemeConfig;
  
  /** Reason for current mode */
  reason: 'peak_hours' | 'low_energy' | 'user_preference' | 'time_of_day' | 'manual';
  
  /** Last mode change */
  lastModeChange: string;
  
  /** User can override */
  userOverride?: UIMode;
}

// ============================================================================
// METACOGNITION WIDGETS
// ============================================================================

/**
 * Metacognition widget type.
 */
export type MetacognitionWidgetType =
  | 'retention_probability'
  | 'mastery_progress'
  | 'time_to_review'
  | 'weak_areas'
  | 'study_streak'
  | 'performance_trend'
  | 'confidence_calibration';

/**
 * Metacognition widget configuration.
 */
export interface MetacognitionWidget {
  /** Widget ID */
  id: string;
  
  /** Widget type */
  type: MetacognitionWidgetType;
  
  /** Display position */
  position: 'inline' | 'sidebar' | 'modal' | 'tooltip';
  
  /** Widget title */
  title: string;
  
  /** Current value */
  value: number | string;
  
  /** Visualization */
  visualization: {
    type: 'progress_bar' | 'chart' | 'number' | 'icon' | 'badge';
    color: string;
    icon?: string;
  };
  
  /** Tooltip explanation */
  tooltip: string;
  
  /** Action button */
  action?: {
    label: string;
    onClick: string; // Function name or route
  };
  
  /** Update frequency */
  updateFrequency: 'real_time' | 'per_question' | 'per_session' | 'daily';
}

/**
 * Example: Retention probability widget next to "Start Quiz" button.
 */
export const RETENTION_PROBABILITY_WIDGET: MetacognitionWidget = {
  id: 'retention-prob-cardio',
  type: 'retention_probability',
  position: 'inline',
  title: 'Retention Probability',
  value: '87%',
  visualization: {
    type: 'progress_bar',
    color: '#10b981',
    icon: 'brain',
  },
  tooltip: 'Your estimated retention of Cardiology concepts based on FSRS algorithm. > 85% is excellent.',
  action: {
    label: 'Start Quiz',
    onClick: 'startQuiz("cardiology")',
  },
  updateFrequency: 'daily',
};

// ============================================================================
// AVATAR & PROGRESSION SYSTEM (SVG_GENERATOR)
// ============================================================================

/**
 * User avatar progression stage.
 */
export type AvatarStage =
  | 'student_year_1'
  | 'student_year_2'
  | 'clinical_year'
  | 'graduate'
  | 'practicing_pa';

/**
 * Avatar accessory (earned through mastery).
 */
export interface AvatarAccessory {
  /** Accessory ID */
  id: string;
  
  /** Accessory name */
  name: string;
  
  /** Accessory type */
  type: 'coat' | 'stethoscope' | 'badge' | 'lapel_pin' | 'tool' | 'background';
  
  /** Requirement */
  requirement: {
    type: 'mastery' | 'streak' | 'achievement' | 'completion';
    target: string; // e.g., "cardiology_mastery_100"
    threshold: number;
  };
  
  /** SVG path or URL */
  svgPath?: string;
  svgUrl?: string;
  
  /** Unlock status */
  unlocked: boolean;
  unlockedAt?: string;
  
  /** Display order (layering) */
  zIndex: number;
}

/**
 * Complete user avatar.
 */
export interface UserAvatar {
  /** Avatar ID */
  id: string;
  
  /** User ID */
  userId: string;
  
  /** Current stage */
  stage: AvatarStage;
  
  /** Experience points */
  xp: number;
  
  /** Base SVG (generated by svg_generator) */
  baseSvg: string;
  
  /** Equipped accessories */
  equippedAccessories: AvatarAccessory[];
  
  /** All unlocked accessories */
  unlockedAccessories: AvatarAccessory[];
  
  /** Avatar metadata */
  metadata: {
    createdAt: string;
    lastUpdated: string;
    totalAccessories: number;
    progressPercentage: number;
  };
}

/**
 * Avatar progression milestones.
 */
export const AVATAR_MILESTONES: Record<string, AvatarAccessory> = {
  short_coat: {
    id: 'short-white-coat',
    name: 'Short White Coat',
    type: 'coat',
    requirement: {
      type: 'completion',
      target: 'onboarding',
      threshold: 100,
    },
    unlocked: true,
    zIndex: 1,
  },
  stethoscope: {
    id: 'stethoscope',
    name: 'Stethoscope',
    type: 'stethoscope',
    requirement: {
      type: 'mastery',
      target: 'cardiology',
      threshold: 100,
    },
    unlocked: false,
    zIndex: 3,
  },
  long_coat: {
    id: 'long-white-coat',
    name: 'Long White Coat',
    type: 'coat',
    requirement: {
      type: 'mastery',
      target: 'all_systems',
      threshold: 80,
    },
    unlocked: false,
    zIndex: 1,
  },
  cardiology_pin: {
    id: 'cardiology-lapel-pin',
    name: 'Cardiology Mastery Pin',
    type: 'lapel_pin',
    requirement: {
      type: 'mastery',
      target: 'cardiology',
      threshold: 100,
    },
    unlocked: false,
    zIndex: 4,
  },
};

// ============================================================================
// ACHIEVEMENT & BADGE SYSTEM
// ============================================================================

/**
 * Achievement category.
 */
export type AchievementCategory =
  | 'clinical_performance'
  | 'study_consistency'
  | 'mastery'
  | 'speed'
  | 'special';

/**
 * Achievement badge.
 */
export interface AchievementBadge {
  /** Badge ID */
  id: string;
  
  /** Badge name */
  name: string;
  
  /** Category */
  category: AchievementCategory;
  
  /** Description */
  description: string;
  
  /** SVG badge (generated by svg_generator) */
  svgBadge: string;
  
  /** Criteria */
  criteria: {
    type: string;
    threshold: number;
    timeframe?: string;
  };
  
  /** Rarity */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  
  /** Unlock status */
  unlocked: boolean;
  unlockedAt?: string;
  
  /** Display on profile */
  displayOnProfile: boolean;
}

/**
 * Example badges.
 */
export const ACHIEVEMENT_BADGES: Record<string, AchievementBadge> = {
  code_blue_survivor: {
    id: 'code-blue-survivor',
    name: 'The Code Blue Survivor',
    category: 'clinical_performance',
    description: 'Saved a patient in cardiac arrest in < 2 minutes',
    svgBadge: '', // Generated by svg_generator
    criteria: {
      type: 'time_to_action',
      threshold: 120, // 2 minutes
      timeframe: 'single_case',
    },
    rarity: 'epic',
    unlocked: false,
    displayOnProfile: true,
  },
  streak_warrior: {
    id: 'streak-warrior',
    name: '100-Day Streak Warrior',
    category: 'study_consistency',
    description: 'Studied for 100 consecutive days',
    svgBadge: '',
    criteria: {
      type: 'study_streak',
      threshold: 100,
    },
    rarity: 'legendary',
    unlocked: false,
    displayOnProfile: true,
  },
  diagnostic_ace: {
    id: 'diagnostic-ace',
    name: 'Diagnostic Ace',
    category: 'clinical_performance',
    description: '10 correct diagnoses in a row',
    svgBadge: '',
    criteria: {
      type: 'correct_diagnoses',
      threshold: 10,
    },
    rarity: 'rare',
    unlocked: false,
    displayOnProfile: true,
  },
};

// ============================================================================
// PHANTOM PATIENT SYSTEM
// ============================================================================

/**
 * Phantom patient (background visual motivator).
 */
export interface PhantomPatient {
  /** Patient ID */
  id: string;
  
  /** Patient name */
  name: string;
  
  /** Patient condition */
  condition: string;
  
  /** Health state (0-100) */
  healthState: number;
  
  /** Video loop URL (veo_cameos) */
  videoUrl: string;
  
  /** Health decay rate */
  decayRate: number; // Points per day of inactivity
  
  /** Healing rate */
  healingRate: number; // Points per study session
  
  /** Current status */
  status: 'healthy' | 'stable' | 'declining' | 'critical' | 'recovered';
  
  /** Last interaction */
  lastInteraction: string;
  
  /** Days since interaction */
  daysSinceInteraction: number;
  
  /** Message to user */
  message?: string;
}

/**
 * Phantom patient state changes.
 */
export const PHANTOM_PATIENT_STATES = {
  healthy: {
    healthRange: [80, 100],
    videoStyle: 'sitting_up_smiling',
    message: 'Looking great! Keep up the studying.',
  },
  stable: {
    healthRange: [60, 79],
    videoStyle: 'resting_comfortably',
    message: 'Doing okay, but could use your attention.',
  },
  declining: {
    healthRange: [40, 59],
    videoStyle: 'uncomfortable_restless',
    message: 'Not feeling well. When was your last study session?',
  },
  critical: {
    healthRange: [0, 39],
    videoStyle: 'severe_distress',
    message: "I really need your help. You haven't studied in a while!",
  },
  recovered: {
    healthRange: [100, 100],
    videoStyle: 'discharged_waving',
    message: 'Fully recovered! Your consistency paid off.',
  },
};

// ============================================================================
// AUDIO-FIRST REVIEWS
// ============================================================================

/**
 * Audio podcast review configuration.
 */
export interface AudioPodcastReview {
  /** Podcast ID */
  id: string;
  
  /** User ID */
  userId: string;
  
  /** Title */
  title: string;
  
  /** Description */
  description: string;
  
  /** Audio URL (generated by voice-library) */
  audioUrl: string;
  
  /** Duration (seconds) */
  duration: number;
  
  /** Content summary */
  content: {
    weakAreas: string[];
    missedQuestions: number;
    keyTeachingPoints: string[];
    citations: string[];
  };
  
  /** Voice configuration */
  voice: {
    voiceId: string;
    rate: number;
    tone: 'educational' | 'conversational' | 'motivational';
  };
  
  /** Generation timestamp */
  generatedAt: string;
  
  /** Playback stats */
  playbackStats?: {
    plays: number;
    completionRate: number;
    lastPlayed?: string;
  };
}

// ============================================================================
// CONSULT SYSTEM
// ============================================================================

/**
 * Consultant persona type.
 */
export type ConsultantType =
  | 'cardiologist'
  | 'surgeon'
  | 'pulmonologist'
  | 'neurologist'
  | 'intensivist'
  | 'radiologist'
  | 'pathologist';

/**
 * Consultant persona.
 */
export interface ConsultantPersona {
  /** Consultant ID */
  id: string;
  
  /** Name */
  name: string;
  
  /** Type */
  type: ConsultantType;
  
  /** Personality */
  personality: 'grumpy' | 'busy' | 'thorough' | 'impatient' | 'helpful';
  
  /** Voice configuration */
  voice: {
    voiceId: string;
    rate: number;
    pitch: number;
    toneDescriptors: string[];
  };
  
  /** Response behavior */
  behavior: {
    patienceThreshold: number; // Seconds before "hanging up"
    requiresSBAR: boolean;
    interruptsIfRambling: boolean;
    asksClarifyingQuestions: boolean;
  };
  
  /** Availability */
  availability: {
    respondTime: number; // Seconds delay before answering
    mayDeclineConsult: boolean;
  };
}

/**
 * Consult request.
 */
export interface ConsultRequest {
  /** Request ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Student ID */
  studentId: string;
  
  /** Consultant requested */
  consultantType: ConsultantType;
  
  /** Consultant assigned */
  consultantPersona: ConsultantPersona;
  
  /** SBAR provided by student */
  sbar?: {
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
  };
  
  /** Transcript of consult call */
  transcript: Array<{
    speaker: 'student' | 'consultant';
    text: string;
    timestamp: string;
  }>;
  
  /** Outcome */
  outcome: 'advice_given' | 'hung_up' | 'declined' | 'transferred' | 'in_progress';
  
  /** Feedback */
  feedback?: {
    sbarQuality: number; // 0-100
    communicationClarity: number;
    timeEfficiency: number;
    overallScore: number;
    comments: string;
  };
  
  /** Timestamps */
  requestedAt: string;
  answeredAt?: string;
  completedAt?: string;
}

/**
 * Example consultant personas.
 */
export const CONSULTANT_PERSONAS: Record<ConsultantType, ConsultantPersona> = {
  cardiologist: {
    id: 'cardio-dr-johnson',
    name: 'Dr. Johnson',
    type: 'cardiologist',
    personality: 'busy',
    voice: {
      voiceId: 'Puck',
      rate: 1.2,
      pitch: 0,
      toneDescriptors: ['hurried', 'professional', 'slightly impatient'],
    },
    behavior: {
      patienceThreshold: 45, // Seconds
      requiresSBAR: true,
      interruptsIfRambling: true,
      asksClarifyingQuestions: true,
    },
    availability: {
      respondTime: 5, // 5 seconds to "pick up"
      mayDeclineConsult: false,
    },
  },
  surgeon: {
    id: 'surgeon-dr-martinez',
    name: 'Dr. Martinez',
    type: 'surgeon',
    personality: 'grumpy',
    voice: {
      voiceId: 'Charon',
      rate: 0.9,
      pitch: -1,
      toneDescriptors: ['gruff', 'direct', 'no-nonsense'],
    },
    behavior: {
      patienceThreshold: 30,
      requiresSBAR: true,
      interruptsIfRambling: true,
      asksClarifyingQuestions: false, // Just wants the facts
    },
    availability: {
      respondTime: 10, // Takes a while to answer
      mayDeclineConsult: true, // "Is this surgical?"
    },
  },
  // ... more personas
};

// ============================================================================
// LUMINA API INTEGRATION
// ============================================================================

/**
 * Lumina API request for dashboard generation.
 */
export interface LuminaDashboardRequest {
  /** User circadian profile */
  circadianProfile: UserCircadianProfile;
  
  /** Current time */
  currentTime: string;
  
  /** User preferences */
  preferences: {
    preferredMode?: UIMode;
    enableAdaptiveUI: boolean;
    enableAnimations: boolean;
  };
  
  /** Content to display */
  content: {
    widgets: MetacognitionWidget[];
    recentActivity: unknown[];
    upcomingReviews: unknown[];
  };
}

/**
 * Lumina API response.
 */
export interface LuminaDashboardResponse {
  /** Recommended UI mode */
  recommendedMode: UIMode;
  
  /** Theme configuration */
  theme: UIThemeConfig;
  
  /** Layout recommendation */
  layout: {
    widgetPositions: Record<string, { x: number; y: number; width: number; height: number }>;
    priorityOrder: string[];
  };
  
  /** Reasoning */
  reasoning: string;
}
