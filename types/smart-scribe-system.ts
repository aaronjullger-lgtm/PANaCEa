/**
 * Module 4: Smart Scribe & Tutor System Type Definitions
 * 
 * Automated documentation and synthesis layer using:
 * - gemini-dictation for real-time SOAP note generation
 * - info_genius for dynamic remediation graphics
 * - echoscript for timing analysis
 * - Enhanced audio visualization with haptic feedback
 * 
 * @module smart-scribe-system
 */

// ============================================================================
// SOAP NOTE GENERATION (GEMINI-DICTATION)
// ============================================================================

/**
 * SOAP note sections.
 */
export type SOAPSection = 'subjective' | 'objective' | 'assessment' | 'plan';

/**
 * HPI element categories (structured documentation).
 */
export type HPIElement =
  | 'chief_complaint'
  | 'onset'
  | 'location'
  | 'duration'
  | 'character'
  | 'aggravating_factors'
  | 'relieving_factors'
  | 'timing'
  | 'severity'
  | 'associated_symptoms'
  | 'previous_episodes'
  | 'risk_factors';

/**
 * SOAP note element with source tracking.
 */
export interface SOAPElement {
  /** Element content */
  content: string;
  
  /** Source of information */
  source: 'transcript' | 'vitals' | 'physical_exam' | 'labs' | 'inferred';
  
  /** Timestamp when captured */
  timestamp: string;
  
  /** Transcript excerpt that supports this element */
  transcriptExcerpt?: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Is this a critical "must-have" element */
  isCritical: boolean;
}

/**
 * Complete SOAP note structure.
 */
export interface SOAPNote {
  /** Note ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Subjective section */
  subjective: {
    chiefComplaint: SOAPElement;
    hpi: Record<HPIElement, SOAPElement | null>;
    reviewOfSystems: {
      constitutional?: SOAPElement;
      cardiovascular?: SOAPElement;
      respiratory?: SOAPElement;
      gastrointestinal?: SOAPElement;
      genitourinary?: SOAPElement;
      neurological?: SOAPElement;
      psychiatric?: SOAPElement;
    };
    pastMedicalHistory?: SOAPElement;
    medications?: SOAPElement;
    allergies?: SOAPElement;
    socialHistory?: SOAPElement;
    familyHistory?: SOAPElement;
  };
  
  /** Objective section */
  objective: {
    vitalSigns: SOAPElement;
    generalAppearance?: SOAPElement;
    physicalExam: {
      cardiovascular?: SOAPElement;
      respiratory?: SOAPElement;
      abdominal?: SOAPElement;
      neurological?: SOAPElement;
      musculoskeletal?: SOAPElement;
      skin?: SOAPElement;
    };
    labs?: SOAPElement;
    imaging?: SOAPElement;
  };
  
  /** Assessment section */
  assessment: {
    primaryDiagnosis: SOAPElement;
    differentialDiagnoses: SOAPElement[];
    clinicalReasoning: SOAPElement;
  };
  
  /** Plan section */
  plan: {
    diagnosticWorkup?: SOAPElement;
    treatment?: SOAPElement;
    patientEducation?: SOAPElement;
    followUp?: SOAPElement;
    disposition?: SOAPElement;
  };
  
  /** Metadata */
  metadata: {
    author: 'student' | 'ai_gold_standard';
    createdAt: string;
    completionTime?: number; // seconds
    wordCount: number;
    completenessScore: number; // 0-100
  };
}

/**
 * Real-time SOAP note generator using gemini-dictation.
 */
export interface RealtimeSOAPGenerator {
  /** Generator ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Current draft note */
  draftNote: SOAPNote;
  
  /** Transcript buffer */
  transcriptBuffer: Array<{
    speaker: 'student' | 'patient';
    text: string;
    timestamp: string;
  }>;
  
  /** Vitals updates */
  vitalsHistory: Array<{
    vitals: Record<string, string | number>;
    timestamp: string;
  }>;
  
  /** Physical findings updates */
  physicalFindingsHistory: Array<{
    findings: Record<string, unknown>;
    timestamp: string;
  }>;
  
  /** Generator status */
  status: 'idle' | 'listening' | 'generating' | 'complete';
  
  /** Last update timestamp */
  lastUpdateAt: string;
  
  /** Configuration */
  config: {
    /** Update frequency (ms) */
    updateInterval: number;
    
    /** Minimum confidence threshold to include element */
    confidenceThreshold: number;
    
    /** Enable real-time streaming to UI */
    enableStreaming: boolean;
  };
}

/**
 * SOAP note comparison result.
 */
export interface SOAPComparison {
  /** Comparison ID */
  id: string;
  
  /** Student's note */
  studentNote: SOAPNote;
  
  /** AI gold standard note */
  goldStandardNote: SOAPNote;
  
  /** Element-by-element comparison */
  elementComparison: Array<{
    section: SOAPSection;
    elementType: string; // e.g., "hpi.onset", "assessment.primaryDiagnosis"
    
    studentContent?: string;
    goldStandardContent: string;
    
    status: 'present' | 'missing' | 'incomplete' | 'incorrect';
    
    /** Feedback for this element */
    feedback: string;
    
    /** Severity of missing/incorrect element */
    severity: 'critical' | 'important' | 'minor';
  }>;
  
  /** Overall scores */
  scores: {
    completeness: number; // 0-100
    accuracy: number;     // 0-100
    organization: number; // 0-100
    overall: number;      // 0-100
  };
  
  /** Strengths */
  strengths: string[];
  
  /** Areas for improvement */
  areasForImprovement: string[];
  
  /** Teaching points */
  teachingPoints: string[];
}

// ============================================================================
// DYNAMIC REMEDIATION GRAPHICS (INFO_GENIUS)
// ============================================================================

/**
 * Infographic type for remediation.
 */
export type InfographicType =
  | 'comparison'           // Side-by-side comparison (e.g., Erythema Nodosum vs. Migrans)
  | 'flowchart'            // Decision tree/algorithm
  | 'timeline'             // Pathophysiology timeline
  | 'anatomy'              // Anatomical diagram with labels
  | 'drug_comparison'      // Medication comparison table
  | 'differential_table'   // Differential diagnosis table
  | 'algorithm'            // Treatment/diagnostic algorithm
  | 'mnemonic_visual';     // Mnemonic with visual aids

/**
 * Visual complexity level.
 */
export type VisualComplexity = 'simple' | 'moderate' | 'detailed';

/**
 * Target audience for infographic.
 */
export type InfographicAudience = 'student' | 'resident' | 'attending';

/**
 * Dynamic infographic request.
 */
export interface InfographicRequest {
  /** Request ID */
  id: string;
  
  /** Infographic type */
  type: InfographicType;
  
  /** Primary concept */
  primaryConcept: string;
  
  /** Secondary concept (for comparisons) */
  secondaryConcept?: string;
  
  /** Student's confusion point */
  confusionPoint: string;
  
  /** Target audience */
  audience: InfographicAudience;
  
  /** Visual complexity */
  complexity: VisualComplexity;
  
  /** Key teaching points to emphasize */
  teachingPoints: string[];
  
  /** Color scheme */
  colorScheme: 'light' | 'dark' | 'colorblind_friendly';
  
  /** Additional context */
  context?: {
    /** Related case details */
    caseContext?: string;
    
    /** Student's incorrect answer */
    studentAnswer?: string;
    
    /** Correct answer */
    correctAnswer?: string;
  };
}

/**
 * Generated infographic.
 */
export interface GeneratedInfographic {
  /** Infographic ID */
  id: string;
  
  /** Request ID */
  requestId: string;
  
  /** Image URL */
  imageUrl: string;
  
  /** SVG markup (for interactive elements) */
  svgMarkup?: string;
  
  /** Thumbnail URL */
  thumbnailUrl: string;
  
  /** Title */
  title: string;
  
  /** Description */
  description: string;
  
  /** Key takeaways */
  keyTakeaways: string[];
  
  /** Interactive elements */
  interactiveElements?: Array<{
    elementId: string;
    type: 'hover' | 'click';
    action: 'highlight' | 'tooltip' | 'expand';
    content: string;
  }>;
  
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    model: string;
    generationTime: number; // ms
    cost?: number;
  };
  
  /** Status */
  status: 'generating' | 'ready' | 'failed';
  
  /** Error message (if failed) */
  error?: string;
}

/**
 * Remediation graphics library.
 */
export interface RemediationGraphicsLibrary {
  /** Library ID */
  id: string;
  
  /** Infographics */
  infographics: Map<string, GeneratedInfographic>;
  
  /** Common comparison pairs */
  commonComparisons: Array<{
    conceptA: string;
    conceptB: string;
    frequency: number; // How often students confuse these
    infographicId?: string;
  }>;
  
  /** Pre-generated high-yield infographics */
  preGeneratedLibrary: Array<{
    topic: string;
    concepts: string[];
    infographicId: string;
    panceRelevance: number;
  }>;
}

// ============================================================================
// ENHANCED AUDIO VISUALIZATION
// ============================================================================

/**
 * Audio visualization type.
 */
export type AudioVisualizationType =
  | 'waveform'       // Standard waveform
  | 'vitality_meter' // Patient vitality visualization
  | 'spectrum'       // Frequency spectrum
  | 'circular'       // Circular audio reactive
  | 'particle';      // Particle system

/**
 * Haptic feedback pattern.
 */
export type HapticPattern =
  | 'pulse'          // Rhythmic pulse (for HR)
  | 'alarm'          // Urgent alarm pattern
  | 'confirmation'   // Success confirmation
  | 'warning'        // Warning vibration
  | 'breath'         // Breathing rhythm (for RR)
  | 'none';

/**
 * Enhanced audio visualization configuration.
 */
export interface AudioVisualizationConfig {
  /** Visualization type */
  type: AudioVisualizationType;
  
  /** Color scheme */
  colorScheme: {
    primary: string;
    secondary: string;
    alert: string;
    stable: string;
  };
  
  /** Theme matching */
  matchSystemTheme: boolean;
  
  /** Background blur effect */
  backgroundBlur: {
    enabled: boolean;
    intensity: number; // 0-20 (blur radius in px)
    darkOverlay: number; // 0-1 (opacity)
  };
  
  /** Vitality mapping */
  vitalityMapping: {
    enabled: boolean;
    
    /** Map vitals to visualization parameters */
    vitalEffects: {
      o2sat: {
        threshold: { critical: number; warning: number; normal: number };
        effect: 'color_shift' | 'intensity' | 'speed';
      };
      hr: {
        threshold: { critical: number; warning: number; normal: number };
        effect: 'pulse_rate' | 'amplitude';
      };
      bp: {
        threshold: { critical: string; warning: string; normal: string };
        effect: 'color_gradient';
      };
    };
  };
  
  /** Haptic feedback */
  hapticFeedback: {
    enabled: boolean;
    
    /** Map events to haptic patterns */
    eventPatterns: {
      patientSpeaking: HapticPattern;
      criticalAlert: HapticPattern;
      vitalChange: HapticPattern;
      bargeIn: HapticPattern;
    };
    
    /** Intensity (0-1) */
    intensity: number;
  };
  
  /** Animation settings */
  animation: {
    smoothing: number; // 0-1
    responsiveness: number; // 0-1
    particleCount?: number; // For particle visualization
  };
}

/**
 * Real-time audio visualization state.
 */
export interface AudioVisualizationState {
  /** Is visualization active */
  isActive: boolean;
  
  /** Current audio level (RMS) */
  audioLevel: number;
  
  /** Frequency data (for spectrum) */
  frequencyData?: Uint8Array;
  
  /** Current vitality color */
  vitalityColor: string;
  
  /** Current animation state */
  animationState: {
    waveformPoints: number[];
    particlePositions?: Array<{ x: number; y: number; velocity: { x: number; y: number } }>;
  };
  
  /** Last haptic trigger */
  lastHapticTrigger?: {
    pattern: HapticPattern;
    timestamp: string;
  };
}

// ============================================================================
// TIMING METRICS (ECHOSCRIPT)
// ============================================================================

/**
 * Clinical timing metric categories.
 */
export type TimingMetricType =
  | 'recognition'         // Time to recognize condition
  | 'action'              // Time to critical action
  | 'diagnosis'           // Time to correct diagnosis
  | 'intervention'        // Time to intervention
  | 'communication'       // Time spent on communication
  | 'decision';           // Decision-making time

/**
 * Clinical timing metric.
 */
export interface TimingMetric {
  /** Metric ID */
  id: string;
  
  /** Metric type */
  type: TimingMetricType;
  
  /** Metric name */
  name: string;
  
  /** Start time */
  startTime: string;
  
  /** End time */
  endTime?: string;
  
  /** Duration (seconds) */
  duration?: number;
  
  /** Target duration (for comparison) */
  targetDuration?: number;
  
  /** Status */
  status: 'in_progress' | 'completed' | 'exceeded_target';
  
  /** Clinical significance */
  significance: 'critical' | 'important' | 'routine';
  
  /** Description */
  description: string;
}

/**
 * Echo path node (conversation decision tree).
 */
export interface EchoPathNode {
  /** Node ID */
  id: string;
  
  /** Node type */
  type: 'question' | 'action' | 'finding' | 'decision';
  
  /** Content */
  content: string;
  
  /** Timestamp */
  timestamp: string;
  
  /** Parent node ID */
  parentId?: string;
  
  /** Child node IDs */
  childrenIds: string[];
  
  /** Relevance score (0-1) */
  relevanceScore: number;
  
  /** Was this node on the optimal path */
  isOptimalPath: boolean;
  
  /** Time spent on this branch */
  timeSpent: number;
}

/**
 * Complete echo path visualization.
 */
export interface EchoPath {
  /** Path ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** All nodes in the conversation */
  nodes: EchoPathNode[];
  
  /** Optimal path (what should have been asked) */
  optimalPath: string[]; // Node IDs
  
  /** Actual path taken */
  actualPath: string[];
  
  /** Path efficiency score */
  efficiencyScore: number; // 0-100
  
  /** Rabbit holes (unproductive branches) */
  rabbitHoles: Array<{
    startNodeId: string;
    endNodeId: string;
    timeWasted: number;
    reason: string;
  }>;
  
  /** Critical paths taken */
  criticalPathsCovered: string[];
  
  /** Critical paths missed */
  criticalPathsMissed: string[];
  
  /** Visualization data */
  visualization: {
    layout: 'tree' | 'force_directed' | 'timeline';
    nodePositions: Record<string, { x: number; y: number }>;
    edgeList: Array<{ from: string; to: string; weight: number }>;
  };
}

/**
 * Session timing analytics.
 */
export interface SessionTimingAnalytics {
  /** Session ID */
  sessionId: string;
  
  /** All timing metrics */
  metrics: TimingMetric[];
  
  /** Echo path */
  echoPath: EchoPath;
  
  /** Key milestones */
  milestones: Array<{
    name: string;
    timestamp: string;
    elapsed: number; // seconds from session start
    target?: number;
    achieved: boolean;
  }>;
  
  /** Overall session timeline */
  timeline: Array<{
    timestamp: string;
    event: string;
    duration: number;
    category: 'question' | 'action' | 'decision' | 'system';
  }>;
  
  /** Performance summary */
  summary: {
    totalDuration: number;
    efficientlySpent: number;
    wastefullySpent: number;
    criticalActionsTimeliness: number; // 0-100
    questioningEfficiency: number; // 0-100
  };
}

// ============================================================================
// AUTOMATED CASE FILE
// ============================================================================

/**
 * Complete automated case file (final output).
 */
export interface AutomatedCaseFile {
  /** Case file ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Case details */
  case: {
    patientName: string;
    chiefComplaint: string;
    diagnosis: string;
    specialty: string;
  };
  
  /** Transcript */
  transcript: {
    fullTranscript: string;
    keyExchanges: Array<{
      timestamp: string;
      speaker: 'student' | 'patient';
      text: string;
      significance: 'critical' | 'important' | 'routine';
    }>;
  };
  
  /** SOAP notes */
  soapNotes: {
    studentNote: SOAPNote;
    goldStandardNote: SOAPNote;
    comparison: SOAPComparison;
  };
  
  /** Timing analytics */
  timingAnalytics: SessionTimingAnalytics;
  
  /** Clinical performance */
  clinicalPerformance: {
    overallScore: number;
    categoryScores: {
      history: number;
      physicalExam: number;
      diagnosis: number;
      management: number;
      communication: number;
    };
    strengths: string[];
    areasForImprovement: string[];
  };
  
  /** Personalized pearls */
  pearls: Array<{
    category: 'missed_finding' | 'inefficient_questioning' | 'diagnosis_reasoning' | 'treatment_gap';
    title: string;
    description: string;
    relevantTranscriptExcerpt?: string;
    recommendedReading?: string;
    infographic?: GeneratedInfographic;
  }>;
  
  /** AI tutor insights */
  tutorInsights: {
    keyTeachingPoints: string[];
    recommendedResources: string[];
    similarCasesToReview: string[];
    nextSteps: string[];
  };
  
  /** Generated at */
  generatedAt: string;
  
  /** Export formats available */
  exportFormats: {
    pdf: string;
    json: string;
    html: string;
  };
}

// ============================================================================
// GEMINI-DICTATION API
// ============================================================================

/**
 * Gemini dictation request.
 */
export interface GeminiDictationRequest {
  /** Audio stream */
  audioStream: ReadableStream<Uint8Array>;
  
  /** Clinical context for improved accuracy */
  context: {
    specialty?: string;
    patientAge?: number;
    chiefComplaint?: string;
    priorNotes?: string;
  };
  
  /** Language model */
  model: string;
  
  /** Enable real-time streaming */
  enableStreaming: boolean;
  
  /** Custom vocabulary (medical terms) */
  customVocabulary?: string[];
}

/**
 * Gemini dictation response.
 */
export interface GeminiDictationResponse {
  /** Transcribed text */
  text: string;
  
  /** Confidence score */
  confidence: number;
  
  /** Is final (vs. interim result) */
  isFinal: boolean;
  
  /** Timestamp */
  timestamp: string;
  
  /** Detected medical terms */
  medicalTerms?: string[];
}

// ============================================================================
// EXAMPLE CONFIGURATIONS
// ============================================================================

/**
 * Example: Real-time SOAP generator config.
 */
export const EXAMPLE_SOAP_GENERATOR_CONFIG: RealtimeSOAPGenerator['config'] = {
  updateInterval: 5000, // Update every 5 seconds
  confidenceThreshold: 0.7,
  enableStreaming: true,
};

/**
 * Example: Audio visualization config for COPD patient.
 */
export const EXAMPLE_COPD_AUDIO_VIZ: AudioVisualizationConfig = {
  type: 'vitality_meter',
  colorScheme: {
    primary: '#3b82f6',    // Blue
    secondary: '#8b5cf6',  // Purple
    alert: '#ef4444',      // Red
    stable: '#10b981',     // Green
  },
  matchSystemTheme: true,
  backgroundBlur: {
    enabled: true,
    intensity: 10,
    darkOverlay: 0.3,
  },
  vitalityMapping: {
    enabled: true,
    vitalEffects: {
      o2sat: {
        threshold: { critical: 88, warning: 92, normal: 95 },
        effect: 'color_shift', // Red when low, blue when normal
      },
      hr: {
        threshold: { critical: 120, warning: 100, normal: 80 },
        effect: 'pulse_rate',
      },
      bp: {
        threshold: { critical: '90/60', warning: '100/70', normal: '120/80' },
        effect: 'color_gradient',
      },
    },
  },
  hapticFeedback: {
    enabled: true,
    eventPatterns: {
      patientSpeaking: 'none',
      criticalAlert: 'alarm',
      vitalChange: 'warning',
      bargeIn: 'confirmation',
    },
    intensity: 0.7,
  },
  animation: {
    smoothing: 0.8,
    responsiveness: 0.6,
  },
};

/**
 * Example: Infographic request for Erythema confusion.
 */
export const EXAMPLE_ERYTHEMA_COMPARISON: InfographicRequest = {
  id: 'infographic-erythema-comparison',
  type: 'comparison',
  primaryConcept: 'Erythema Nodosum',
  secondaryConcept: 'Erythema Migrans',
  confusionPoint: 'Student confused the two skin lesions',
  audience: 'student',
  complexity: 'moderate',
  teachingPoints: [
    'Erythema Nodosum: Tender nodules on shins, associated with systemic disease',
    'Erythema Migrans: Bulls-eye rash, pathognomonic for Lyme disease',
    'Key difference: Location and appearance',
  ],
  colorScheme: 'light',
  context: {
    caseContext: 'Patient with knee pain and rash',
    studentAnswer: 'Lyme disease',
    correctAnswer: 'Sarcoidosis with Erythema Nodosum',
  },
};
