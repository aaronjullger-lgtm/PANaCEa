// types/osce-enhanced.ts
// Deep OSCE Enhancement Types

// =============================================================================
// 1. QUICK ORDER SYSTEM TYPES
// =============================================================================

export type OrderCategory = 'labs' | 'imaging' | 'procedures' | 'medications';

export type CostTier = '$' | '$$' | '$$$' | '$$$$';

export interface OrderableItem {
  id: string;
  name: string;
  category: OrderCategory;
  subcategory?: string;
  costTier: CostTier;
  turnaroundMinutes: number; // Estimated turnaround time
  requiresContrast?: boolean;
  contraindications?: string[];
  commonIndications?: string[];
  relatedChiefComplaints?: string[]; // For smart suggestions
  isStat?: boolean;
}

export interface OrderBundle {
  id: string;
  name: string;
  description: string;
  items: string[]; // OrderableItem IDs
  relatedChiefComplaints: string[];
  icon?: string;
}

export interface PlacedOrder {
  id: string;
  itemId: string;
  itemName: string;
  category: OrderCategory;
  orderedAt: number;
  status: 'pending' | 'in_progress' | 'resulted' | 'cancelled';
  result?: string;
  interpretation?: string;
  resultedAt?: number;
  isStat: boolean;
  alerts?: OrderAlert[];
}

export interface OrderAlert {
  type: 'allergy' | 'duplicate' | 'contraindication' | 'interaction' | 'cost';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommendation?: string;
}

export interface PatientAllergy {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
}

// =============================================================================
// 2. AI PATIENT PERSONALITY ENGINE TYPES
// =============================================================================

export type CommunicationStyle =
  | 'verbose'
  | 'terse'
  | 'anxious'
  | 'stoic'
  | 'angry'
  | 'confused'
  | 'evasive'
  | 'dramatic';

export type HealthLiteracy = 'low' | 'moderate' | 'high';

export type PainBehavior = 'minimizer' | 'accurate' | 'catastrophizer';

export type HiddenAgenda =
  | 'none'
  | 'afraid_of_diagnosis'
  | 'wants_specific_medication'
  | 'social_issues'
  | 'secondary_gain'
  | 'family_pressure';

export interface PatientPersonalityMatrix {
  communicationStyle: CommunicationStyle;
  healthLiteracy: HealthLiteracy;
  painBehavior: PainBehavior;
  hiddenAgenda: HiddenAgenda;
  trustThreshold: number; // 1-10, affects when sensitive info is revealed
  anxietyLevel: number; // 1-10
  cooperativeness: number; // 1-10
}

export interface NonVerbalCue {
  id: string;
  trigger: string; // What question/action triggers this
  cue: string; // The non-verbal description
  timing: 'immediate' | 'delayed' | 'conditional';
  condition?: string; // Optional condition for the cue
}

export interface InformationControlRule {
  topic: string;
  requiredTrustLevel: number; // 0-10
  requiredQuestionType?: string; // e.g., 'direct', 'empathetic', 'specific'
  volunteeredAt?: number; // Trust level at which patient volunteers info
  hints?: string[]; // Partial information given before full disclosure
}

export interface EmotionalState {
  current: 'neutral' | 'anxious' | 'frustrated' | 'tearful' | 'angry' | 'relieved';
  triggers: { action: string; transition: string }[];
  decayRate: number; // How quickly emotions return to neutral
}

export interface RapportMeter {
  score: number; // 0-100
  empathyPoints: number;
  trustPoints: number;
  frustrationPoints: number;
  milestones: RapportMilestone[];
}

export interface RapportMilestone {
  threshold: number;
  unlocks: string; // What information/behavior change this unlocks
  achieved: boolean;
  achievedAt?: number;
}

// =============================================================================
// 3. INTERACTIVE PHYSICAL EXAM TYPES
// =============================================================================

export type BodyRegion =
  | 'head'
  | 'eyes'
  | 'ears'
  | 'nose'
  | 'throat'
  | 'neck'
  | 'chest_anterior'
  | 'chest_posterior'
  | 'heart'
  | 'lungs'
  | 'abdomen_ruq'
  | 'abdomen_luq'
  | 'abdomen_rlq'
  | 'abdomen_llq'
  | 'abdomen_epigastric'
  | 'abdomen_periumbilical'
  | 'pelvis'
  | 'back_upper'
  | 'back_lower'
  | 'arm_right'
  | 'arm_left'
  | 'hand_right'
  | 'hand_left'
  | 'leg_right'
  | 'leg_left'
  | 'foot_right'
  | 'foot_left'
  | 'skin'
  | 'lymph_nodes'
  | 'neurological'
  | 'musculoskeletal';

export type ExamTechnique =
  | 'inspection'
  | 'palpation'
  | 'percussion'
  | 'auscultation'
  | 'neurological'
  | 'special_test';

export interface ExamManeuver {
  id: string;
  name: string;
  category: ExamTechnique;
  region?: BodyRegion;
  technique?: ExamTechnique; // Deprecated, use category
  description?: string;
  normalFinding?: string;
  timeToPerform?: number; // seconds
  isSpecialTest?: boolean;
  associatedConditions?: string[];
}

export interface ExamFinding {
  maneuverId: string;
  maneuverName: string;
  region: BodyRegion;
  finding: string;
  isAbnormal: boolean;
  significance?: string;
  performedAt: number;
  audioUrl?: string; // For heart/lung sounds
  imageUrl?: string; // For visual findings
}

export interface ExamTreeNode {
  id: string;
  label: string;
  region?: BodyRegion;
  children?: ExamTreeNode[];
  maneuvers?: ExamManeuver[];
  isExpanded?: boolean;
}

export interface SmartExamSuggestion {
  maneuver: ExamManeuver;
  relevanceScore: number; // 0-100
  reason: string;
  basedOn: 'hpi' | 'chief_complaint' | 'differential' | 'previous_finding';
}

// =============================================================================
// 4. COMPREHENSIVE SCORING & CRITICAL ACTION TRACKING
// =============================================================================

export type CriticalActionCategory =
  | 'safety'
  | 'diagnosis'
  | 'communication'
  | 'procedure'
  | 'efficiency';

export interface CriticalAction {
  id: string;
  category: CriticalActionCategory;
  description: string;
  weight: number; // 1-10
  triggered: boolean;
  triggeredAt?: number;
  missedPenalty: number; // Points deducted if missed
  context?: string; // When this action is relevant
  requiredFor?: string[]; // Conditions that require this action
}

export interface CompetencyScore {
  history: number; // 0-100
  physicalExam: number;
  diagnosticReasoning: number;
  treatment: number;
  communication: number;
  efficiency: number;
}

export interface ScoringEvent {
  timestamp: number;
  eventType: 'positive' | 'negative' | 'neutral';
  category: CriticalActionCategory | 'general';
  description: string;
  pointsAwarded: number;
  criticalActionId?: string;
}

export interface TimelineEntry {
  timestamp: number;
  phase: 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';
  action: string;
  evaluation?: 'excellent' | 'good' | 'fair' | 'poor' | 'missed';
  criticalAction?: CriticalAction;
  feedback?: string;
}

export interface ExpertComparison {
  action: string;
  expertTiming: number; // When expert would do this (relative to start)
  userTiming?: number; // When user did this
  expertComment: string;
  wasPerformed: boolean;
  timingDifference?: number; // Positive = user was later
}

export interface LearningGap {
  category: CriticalActionCategory;
  topic: string;
  severity: 'minor' | 'moderate' | 'significant';
  recommendation: string;
  relatedResources?: string[];
}

export interface OSCEScoreReport {
  overallScore: number;
  competencyScores: CompetencyScore;
  criticalActions: CriticalAction[];
  timeline: TimelineEntry[];
  expertComparisons: ExpertComparison[];
  learningGaps: LearningGap[];
  strengths: string[];
  areasForImprovement: string[];
  acgmeMilestoneLevel?: number; // 1-5
  /** Gemini-graded communication quality (0-100) */
  communicationScore?: number;
  /** Gemini-graded differential diagnosis quality (0-100) */
  differentialScore?: number;
  /** Dangerous clinical actions detected during encounter */
  dangerousActionsDetected?: Array<{ description: string; penalty: number }>;
  /** Student-submitted differential diagnoses */
  submittedDifferentials?: string[];
}

// =============================================================================
// 5. ENHANCED ENCOUNTER SESSION STATE
// =============================================================================

export interface EnhancedEncounterSession {
  id: string;
  caseId: string;
  startTime: number;
  endTime?: number;

  // Patient State
  patientPersonality: PatientPersonalityMatrix;
  rapportMeter: RapportMeter;
  emotionalState: EmotionalState;
  nonVerbalCues: NonVerbalCue[];
  revealedInformation: Set<string>;

  // Orders
  placedOrders: PlacedOrder[];
  orderAlerts: OrderAlert[];

  // Physical Exam
  completedExams: ExamFinding[];
  suggestedExams: SmartExamSuggestion[];

  // Scoring
  scoringEvents: ScoringEvent[];
  criticalActionsTracked: CriticalAction[];

  // Conversation
  conversationHistory: EnhancedChatMessage[];

  // Final Results
  finalDiagnosis?: string;
  differentialDiagnoses: string[];
  treatmentPlan?: string;
  scoreReport?: OSCEScoreReport;
}

export interface EnhancedChatMessage {
  id: string;
  role: 'user' | 'patient' | 'system';
  content: string;
  timestamp: number;
  phase: 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';
  metadata?: {
    triggeredCues?: string[];
    rapportChange?: number;
    emotionalImpact?: string;
    criticalActionTriggered?: string;
  };
}

// =============================================================================
// 6. CONFIGURATION TYPES
// =============================================================================

export interface OSCEEnhancedSettings {
  enablePersonalityEngine: boolean;
  enableRapportMeter: boolean;
  enableNonVerbalCues: boolean;
  enableCriticalActionTracking: boolean;
  enableOrderSystem: boolean;
  enableBodyMap: boolean;
  showExpertComparison: boolean;
  difficulty: 'easy' | 'standard' | 'challenging';
}

export const DEFAULT_OSCE_ENHANCED_SETTINGS: OSCEEnhancedSettings = {
  enablePersonalityEngine: true,
  enableRapportMeter: true,
  enableNonVerbalCues: true,
  enableCriticalActionTracking: true,
  enableOrderSystem: true,
  enableBodyMap: true,
  showExpertComparison: true,
  difficulty: 'standard',
};
