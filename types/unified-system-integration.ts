/**
 * Unified System Integration Type Definitions
 *
 * Defines the "glue" that connects all 5 modules seamlessly:
 * - Cross-module state management
 * - Context propagation
 * - Intelligence coordination
 * - Event bus for inter-module communication
 * - Unified analytics
 *
 * @module unified-system-integration
 */

// ============================================================================
// UNIFIED SESSION STATE
// ============================================================================

/**
 * Complete session state spanning all modules.
 */
export interface UnifiedSessionState {
  /** Session metadata */
  session: {
    id: string;
    userId: string;
    startTime: string;
    currentModule: 'osce' | 'clinical_eye' | 'sim_lab' | 'review' | 'dashboard';
    mode: 'study' | 'practice' | 'exam';
  };

  /** Module 1: OSCE State */
  osce?: {
    caseId: string;
    patientName: string;
    chiefComplaint: string;
    currentAVState: string;
    vitals: Record<string, string | number>;
    physicalFindings: Record<string, unknown>;
    transcript: Array<{ speaker: string; text: string; timestamp: string }>;
    studentActions: Array<{ action: string; timestamp: string }>;
    diagnosis?: string;
  };

  /** Module 2: Clinical Eye State */
  clinicalEye?: {
    currentQuestionId: string;
    imagesViewed: string[];
    clickHistory: Array<{ imageId: string; x: number; y: number; timestamp: string }>;
    heatmapsRevealed: string[];
    findingsIdentified: string[];
  };

  /** Module 3: Sim Lab State */
  simLab?: {
    procedureId: string;
    currentStep: number;
    equipmentTrayComplete: boolean;
    sterileFieldIntact: boolean;
    contaminationEvents: number;
    geometryValidations: Array<{ stepId: string; passed: boolean }>;
  };

  /** Module 4: Smart Scribe State */
  smartScribe?: {
    draftSOAPNote: string;
    soapCompleteness: number;
    timingMetrics: Array<{ name: string; duration: number }>;
    infographicsGenerated: string[];
    echoPathNodes: number;
    efficiencyScore: number;
  };

  /** Module 5: Interface State */
  interface?: {
    uiMode: 'focus' | 'review' | 'rest' | 'standard';
    avatarXP: number;
    phantomPatientHealth: number;
    recentAchievements: string[];
    audioPodcastsAvailable: string[];
  };

  /** AI Tutor State */
  aiTutor?: {
    queriesThisSession: number;
    hintsUsed: number;
    currentHintLevel: 'subtle' | 'moderate' | 'explicit' | 'answer';
    citationsProvided: Array<{ source: string; relevance: number }>;
  };

  /** Cross-Module Context */
  sharedContext: {
    /** Clinical scenario context shared across all modules */
    clinicalScenario?: {
      patientAge: number;
      patientSex: string;
      chiefComplaint: string;
      workingDiagnosis?: string;
      criticalFindings: string[];
    };

    /** Learning context */
    learningContext: {
      weakAreas: string[];
      recentMistakes: string[];
      confusionPairs: Array<{ conceptA: string; conceptB: string }>;
      strengths: string[];
    };

    /** Performance context */
    performanceContext: {
      currentStreak: number;
      sessionCount: number;
      averageScore: number;
      masteryBySystem: Record<string, number>;
    };
  };
}

// ============================================================================
// EVENT BUS (INTER-MODULE COMMUNICATION)
// ============================================================================

/**
 * Event types for cross-module communication.
 */
export type SystemEventType =
  // Module transitions
  | 'MODULE_ENTERED'
  | 'MODULE_EXITED'

  // Clinical events (Module 1 → Others)
  | 'DIAGNOSIS_MADE'
  | 'CRITICAL_ACTION_TAKEN'
  | 'VITALS_CRITICAL'
  | 'PATIENT_DECOMPENSATING'

  // Learning events (All → Module 4, 5)
  | 'MISTAKE_MADE'
  | 'CONCEPT_CONFUSED'
  | 'TEACHING_POINT_RELEVANT'
  | 'WEAK_AREA_IDENTIFIED'

  // UI events (Module 5 → Others)
  | 'UI_MODE_CHANGED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'PHANTOM_PATIENT_UPDATED'

  // AI Tutor events
  | 'TUTOR_QUERY_MADE'
  | 'HINT_REQUESTED'
  | 'CITATION_VIEWED'

  // Progress events
  | 'XP_GAINED'
  | 'MASTERY_UPDATED'
  | 'STREAK_UPDATED';

/**
 * Base system event.
 */
export interface SystemEvent {
  type: SystemEventType;
  timestamp: string;
  sourceModule: string;
  sessionId: string;
  payload: unknown;
}

/**
 * Diagnosis event (Module 1 → Module 4 for SOAP, Module 5 for rewards).
 */
export interface DiagnosisMadeEvent extends SystemEvent {
  type: 'DIAGNOSIS_MADE';
  payload: {
    diagnosis: string;
    confidence: number;
    isCorrect: boolean;
    correctDiagnosis: string;
    timeToAction: number;
  };
}

/**
 * Mistake event (Any Module → Module 4 for infographic, AI Tutor for help).
 */
export interface MistakeMadeEvent extends SystemEvent {
  type: 'MISTAKE_MADE';
  payload: {
    category: 'diagnosis' | 'procedure' | 'imaging' | 'communication';
    incorrectAnswer: string;
    correctAnswer: string;
    questionId?: string;
    confusionPoint: string;
  };
}

/**
 * Achievement unlocked event (Module 5 → All for notification).
 */
export interface AchievementUnlockedEvent extends SystemEvent {
  type: 'ACHIEVEMENT_UNLOCKED';
  payload: {
    badgeId: string;
    badgeName: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    description: string;
  };
}

// ============================================================================
// INTELLIGENCE COORDINATION
// ============================================================================

/**
 * Central intelligence coordinator that manages all AI services.
 */
export interface IntelligenceCoordinator {
  /** Session ID */
  sessionId: string;

  /** Active AI services */
  activeServices: {
    voicePatient: boolean; // Module 1: native_audio
    soapGenerator: boolean; // Module 4: gemini-dictation
    tutor: boolean; // AI Tutor: ask_the_manual
    timingAnalytics: boolean; // Module 4: echoscript
    infographicGenerator: boolean; // Module 4: info_genius
  };

  /** Shared context pool */
  contextPool: {
    clinicalContext: Record<string, unknown>;
    conversationHistory: Array<{ role: string; content: string }>;
    performanceHistory: Array<{ metric: string; value: number }>;
    userPreferences: Record<string, unknown>;
  };

  /** Service coordination rules */
  coordinationRules: {
    /** When diagnosis made → trigger SOAP finalization */
    onDiagnosisMade: ['finalize_soap', 'generate_debrief'];

    /** When mistake made → trigger infographic + tutor */
    onMistakeMade: ['generate_infographic', 'offer_tutor_help'];

    /** When critical vital → trigger state transition + alert */
    onCriticalVital: ['transition_av_state', 'haptic_alert', 'ui_notification'];

    /** When session ends → trigger all analytics */
    onSessionEnd: ['finalize_soap', 'generate_analytics', 'create_case_file', 'update_phantom'];
  };
}

/**
 * Context propagation between modules.
 */
export interface ContextPropagation {
  /** Source module */
  source: string;

  /** Target modules */
  targets: string[];

  /** Context data */
  context: {
    type: 'clinical' | 'learning' | 'performance' | 'preference';
    data: Record<string, unknown>;
  };

  /** Propagation strategy */
  strategy: 'immediate' | 'batched' | 'on_demand';

  /** TTL (seconds) */
  ttl?: number;
}

// ============================================================================
// UNIFIED ANALYTICS
// ============================================================================

/**
 * Complete analytics spanning all modules.
 */
export interface UnifiedAnalytics {
  /** Session ID */
  sessionId: string;

  /** Module 1: OSCE Analytics */
  osceAnalytics: {
    duration: number;
    questionsAsked: number;
    criticalFindingsIdentified: number;
    criticalFindingsMissed: number;
    diagnosisCorrect: boolean;
    timeToAction: number;
    communicationScore: number;
    clinicalReasoningScore: number;
  };

  /** Module 2: Clinical Eye Analytics */
  clinicalEyeAnalytics: {
    questionsAttempted: number;
    pointAndClickAccuracy: number;
    heatmapsUsed: number;
    averageTimePerImage: number;
    findingIdentificationRate: number;
  };

  /** Module 3: Sim Lab Analytics */
  simLabAnalytics: {
    proceduresAttempted: number;
    equipmentTrayAccuracy: number;
    sterileFieldBreaches: number;
    geometryValidationScore: number;
    procedureCompletionRate: number;
    averageTimePerProcedure: number;
  };

  /** Module 4: Documentation Analytics */
  documentationAnalytics: {
    soapCompletenessScore: number;
    soapAccuracyScore: number;
    timingEfficiencyScore: number;
    conversationPathEfficiency: number;
    rabbitHoles: number;
    infographicsGenerated: number;
  };

  /** Module 5: Engagement Analytics */
  engagementAnalytics: {
    uiModeTransitions: number;
    avatarXPGained: number;
    achievementsUnlocked: number;
    phantomPatientHealthChange: number;
    audioPodcastsListened: number;
    consultsRequested: number;
  };

  /** AI Tutor Analytics */
  tutorAnalytics: {
    queriesMade: number;
    hintsUsed: number;
    citationsViewed: number;
    averageResponseTime: number;
    satisfactionRating?: number;
  };

  /** Composite Scores */
  compositeScores: {
    overallPerformance: number; // 0-100
    clinicalCompetence: number; // 0-100
    proceduralSkills: number; // 0-100
    visualDiagnostics: number; // 0-100
    documentation: number; // 0-100
    communication: number; // 0-100
    engagement: number; // 0-100
  };
}

// ============================================================================
// CROSS-MODULE TRANSITIONS
// ============================================================================

/**
 * Smooth transition between modules.
 */
export interface ModuleTransition {
  /** Transition ID */
  id: string;

  /** From module */
  fromModule: string;

  /** To module */
  toModule: string;

  /** Transition type */
  type: 'natural_flow' | 'user_initiated' | 'system_recommended';

  /** Context carried over */
  contextCarryOver: {
    clinicalScenario?: Record<string, unknown>;
    patientDetails?: Record<string, unknown>;
    workingDiagnosis?: string;
    orderedTests?: string[];
  };

  /** UI animation */
  animation: {
    type: 'slide' | 'fade' | 'zoom' | 'medical_scan';
    duration: number;
    easing: string;
  };

  /** Pre-load requirements */
  preLoad: string[]; // Resources to pre-load before transition
}

/**
 * Natural flow transitions (typical learning path).
 */
export const NATURAL_FLOW_TRANSITIONS: Record<string, ModuleTransition> = {
  osce_to_clinical_eye: {
    id: 'osce-to-eye',
    fromModule: 'osce',
    toModule: 'clinical_eye',
    type: 'natural_flow',
    contextCarryOver: {
      clinicalScenario: { preserved: true },
      workingDiagnosis: { preserved: true },
      orderedTests: { preserved: true },
    },
    animation: {
      type: 'medical_scan',
      duration: 800,
      easing: 'ease-in-out',
    },
    preLoad: ['ecg_image', 'xray_image'],
  },
  clinical_eye_to_sim_lab: {
    id: 'eye-to-sim',
    fromModule: 'clinical_eye',
    toModule: 'sim_lab',
    type: 'natural_flow',
    contextCarryOver: {
      clinicalScenario: { preserved: true },
      workingDiagnosis: { preserved: true },
    },
    animation: {
      type: 'zoom',
      duration: 600,
      easing: 'ease-in-out',
    },
    preLoad: ['procedure_video', 'equipment_images'],
  },
  sim_lab_to_debrief: {
    id: 'sim-to-debrief',
    fromModule: 'sim_lab',
    toModule: 'review',
    type: 'natural_flow',
    contextCarryOver: {
      clinicalScenario: { preserved: true },
    },
    animation: {
      type: 'fade',
      duration: 1000,
      easing: 'ease-out',
    },
    preLoad: ['soap_comparison', 'analytics_charts'],
  },
};

// ============================================================================
// INTELLIGENT ROUTING
// ============================================================================

/**
 * AI-driven navigation recommendations.
 */
export interface IntelligentRouting {
  /** Current context */
  currentContext: {
    module: string;
    activity: string;
    performance: number;
    timeSpent: number;
  };

  /** Recommendations */
  recommendations: Array<{
    targetModule: string;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
    expectedBenefit: string;
    estimatedTime: number;
  }>;

  /** Auto-navigation rules */
  autoNavigationRules: {
    /** If OSCE diagnosis correct → Suggest related imaging */
    onCorrectDiagnosis: {
      target: 'clinical_eye';
      reason: 'Reinforce with visual diagnostics';
    };

    /** If imaging finding identified → Suggest related procedure */
    onFindingIdentified: {
      target: 'sim_lab';
      reason: 'Practice the intervention';
    };

    /** If procedure completed → Suggest review */
    onProcedureComplete: {
      target: 'review';
      reason: 'Consolidate learning';
    };

    /** If struggling (score < 60%) → Suggest AI Tutor */
    onStruggling: {
      target: 'ai_tutor';
      reason: 'Get targeted help';
    };
  };
}

// ============================================================================
// UNIFIED UI STATE
// ============================================================================

/**
 * Global UI state synchronized across all views.
 */
export interface UnifiedUIState {
  /** Theme and mode */
  theme: {
    mode: 'focus' | 'review' | 'rest' | 'standard';
    colorScheme: Record<string, string>;
    transitioningTo?: string;
  };

  /** Layout */
  layout: {
    /** Main content area module */
    mainContent: string;

    /** Sidebar state */
    sidebar: {
      visible: boolean;
      content: 'ai_tutor' | 'analytics' | 'notes' | 'resources';
      width: number;
    };

    /** Overlay state */
    overlay?: {
      type: 'infographic' | 'achievement' | 'notification' | 'tutorial';
      content: unknown;
      dismissible: boolean;
    };

    /** Bottom panel (vitals, audio viz, etc.) */
    bottomPanel?: {
      visible: boolean;
      content: 'vitals' | 'audio_viz' | 'timing' | 'controls';
      height: number;
    };
  };

  /** Notifications */
  notifications: Array<{
    id: string;
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
    action?: { label: string; onClick: string };
    dismissedAt?: string;
  }>;

  /** Loading states */
  loading: {
    videoLoading: boolean;
    audioLoading: boolean;
    infographicGenerating: boolean;
    soapGenerating: boolean;
  };

  /** Tutorial/onboarding */
  tutorial?: {
    active: boolean;
    currentStep: number;
    module: string;
  };
}

// ============================================================================
// CONTEXT SHARING PROTOCOL
// ============================================================================

/**
 * Context sharing between AI services for consistency.
 */
export interface AIServiceContext {
  /** Session ID */
  sessionId: string;

  /** Clinical context (shared with all AI services) */
  clinical: {
    patientAge: number;
    patientSex: string;
    chiefComplaint: string;
    vitals: Record<string, string | number>;
    physicalFindings: string[];
    labResults?: Record<string, unknown>;
    imagingResults?: string[];
    workingDiagnosis?: string;
    differentialDiagnoses?: string[];
  };

  /** Conversation history (shared with voice AI, SOAP generator, tutor) */
  conversation: Array<{
    speaker: 'student' | 'patient' | 'consultant' | 'tutor';
    content: string;
    timestamp: string;
    relevance?: number;
  }>;

  /** Student performance (shared with tutor, UI) */
  performance: {
    currentScore: number;
    recentMistakes: string[];
    weakAreas: string[];
    strengths: string[];
    hintsUsed: number;
    timeOnTask: number;
  };

  /** User preferences (shared with all services) */
  preferences: {
    hintThreshold: number;
    audioVisualizationType: string;
    hapticEnabled: boolean;
    uiModePreference?: string;
  };
}

/**
 * Context synchronization service.
 */
export interface ContextSyncService {
  /** Get shared context */
  getContext(sessionId: string): AIServiceContext;

  /** Update context */
  updateContext(sessionId: string, updates: Partial<AIServiceContext>): void;

  /** Subscribe to context changes */
  subscribeToContext(sessionId: string, callback: (context: AIServiceContext) => void): () => void;

  /** Broadcast context update to all services */
  broadcastUpdate(sessionId: string, updates: Partial<AIServiceContext>): void;
}

// ============================================================================
// UNIFIED RECOMMENDATION ENGINE
// ============================================================================

/**
 * AI-driven recommendations across all modules.
 */
export interface UnifiedRecommendation {
  /** Recommendation ID */
  id: string;

  /** Recommendation type */
  type: 'next_activity' | 'review_material' | 'practice_area' | 'take_break';

  /** Target activity */
  target: {
    module: string;
    activity: string;
    details: Record<string, unknown>;
  };

  /** Reasoning */
  reasoning: string;

  /** Expected benefit */
  expectedBenefit: {
    metric: string;
    improvement: number;
    confidence: number;
  };

  /** Priority */
  priority: 'low' | 'medium' | 'high' | 'urgent';

  /** Estimated time */
  estimatedTime: number;

  /** Expires at */
  expiresAt: string;
}

/**
 * Recommendation engine that analyzes performance across all modules.
 */
export interface RecommendationEngine {
  /** Analyze session state and generate recommendations */
  generateRecommendations(state: UnifiedSessionState): UnifiedRecommendation[];

  /** Get next best action */
  getNextBestAction(state: UnifiedSessionState): UnifiedRecommendation;

  /** Evaluate recommendation effectiveness */
  trackRecommendationOutcome(
    recommendationId: string,
    accepted: boolean,
    outcome?: { metricImprovement: number }
  ): void;
}

// ============================================================================
// SEAMLESS INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: OSCE → Imaging → Procedure → Debrief (Complete Flow)
 */
export interface CompleteWorkflow {
  /** Phase 1: OSCE Interview (Module 1) */
  phase1_osce: {
    diagnosis: 'Tension Pneumothorax';
    timeToRecognition: 45; // seconds
    criticalActions: ['recognize_hypoxia', 'identify_tracheal_deviation'];
    clinicalContext: {
      o2: 86;
      hr: 125;
      bp: '90/60';
      mentalStatus: 'agitated';
    };
  };

  /** Phase 2: Imaging Confirmation (Module 2) */
  phase2_imaging: {
    modalit: 'chest_xray';
    findingIdentified: 'pneumothorax_line';
    clickAccuracy: 95; // Within 5% of target
    timeToIdentify: 30; // seconds
  };

  /** Phase 3: Intervention (Module 3) */
  phase3_procedure: {
    procedure: 'needle_decompression';
    landmarksIdentified: ['2nd_intercostal', 'midclavicular_line'];
    sterileFieldIntact: true;
    geometryScore: 88; // Correct angle and depth
    timeToComplete: 120; // 2 minutes
  };

  /** Phase 4: Documentation (Module 4) */
  phase4_documentation: {
    soapNote: 'auto_generated';
    soapCompleteness: 92;
    timingEfficiency: 85;
    infographicGenerated: 'tension_ptx_vs_simple_ptx';
  };

  /** Phase 5: Rewards (Module 5) */
  phase5_rewards: {
    xpGained: 50;
    badgeUnlocked: 'emergency_hero';
    phantomPatientHealed: 15;
    audioPodcastGenerated: true;
  };

  /** Overall Outcome */
  outcome: {
    overallScore: 88;
    passed: true;
    timeToIntervention: 195; // 3m 15s (excellent for tension PTX)
    caseFileUrl: string;
  };
}
