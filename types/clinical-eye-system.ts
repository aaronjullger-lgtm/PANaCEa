/**
 * Module 2: Clinical Eye System Type Definitions
 * 
 * Visual diagnostics system using:
 * - veo_cameos for standardized patient videos
 * - spatial-understanding for interactive radiology/pathology
 * - Point-and-click diagnostics
 * - Reveal-on-hover heatmaps
 * 
 * @module clinical-eye-system
 */

// ============================================================================
// STANDARDIZED PATIENT VIDEOS (VEO_CAMEOS)
// ============================================================================

/**
 * Clinical setting for video background.
 */
export type ClinicalSetting =
  | 'emergency_department'
  | 'outpatient_clinic'
  | 'hospital_room'
  | 'home_visit'
  | 'ambulance'
  | 'icu'
  | 'operating_room';

/**
 * Physical examination finding categories.
 */
export type PhysicalFindingCategory =
  | 'general_appearance'  // Diaphoresis, distress, body habitus
  | 'vital_signs_visual'  // Tachypnea, accessory muscle use
  | 'skin'                // Cyanosis, jaundice, rashes
  | 'cardiovascular'      // JVD, peripheral edema
  | 'respiratory'         // Tripod position, pursed-lip breathing
  | 'neurological'        // Facial droop, gait abnormality
  | 'musculoskeletal'     // Joint swelling, deformity
  | 'abdominal';          // Distension, guarding

/**
 * Specific physical examination finding with video representation.
 */
export interface PhysicalFinding {
  /** Unique finding ID */
  id: string;
  
  /** Finding name */
  name: string;
  
  /** Category */
  category: PhysicalFindingCategory;
  
  /** Description */
  description: string;
  
  /** Clinical significance */
  significance: string;
  
  /** Associated conditions */
  associatedConditions: string[];
  
  /** Veo cameo prompt for generating this finding */
  veoCameoPrompt: string;
  
  /** Video URL (once generated) */
  videoUrl?: string;
  
  /** Sensitivity (how often present when condition exists) */
  sensitivity: number;
  
  /** Specificity (how often absent when condition doesn't exist) */
  specificity: number;
  
  /** Is this a "red flag" finding */
  isRedFlag: boolean;
}

/**
 * Standardized patient video configuration.
 */
export interface StandardizedPatientVideo {
  /** Video ID */
  id: string;
  
  /** Patient demographics */
  demographics: {
    age: number;
    gender: 'male' | 'female' | 'nonbinary';
    ethnicity?: string;
  };
  
  /** Clinical setting */
  setting: ClinicalSetting;
  
  /** Chief complaint */
  chiefComplaint: string;
  
  /** Physical findings to display */
  findings: PhysicalFinding[];
  
  /** Complete veo_cameos prompt */
  fullPrompt: string;
  
  /** Generated video URL */
  videoUrl?: string;
  
  /** Video duration (seconds) */
  duration: number;
  
  /** Generation status */
  status: 'pending' | 'generating' | 'ready' | 'failed';
  
  /** Generation metadata */
  metadata?: {
    generatedAt: string;
    model: string;
    cost?: number;
  };
}

// ============================================================================
// SPATIAL UNDERSTANDING (RADIOLOGY/PATHOLOGY)
// ============================================================================

/**
 * Imaging modality types.
 */
export type ImagingModality =
  | 'chest_xray'
  | 'abdominal_xray'
  | 'extremity_xray'
  | 'ct_head'
  | 'ct_chest'
  | 'ct_abdomen'
  | 'mri_brain'
  | 'mri_spine'
  | 'ultrasound'
  | 'ecg';

/**
 * Pathological finding on an image.
 */
export interface PathologicalFinding {
  /** Finding ID */
  id: string;
  
  /** Finding name (e.g., "Pneumothorax", "Fracture", "Mass") */
  name: string;
  
  /** Description */
  description: string;
  
  /** Bounding box or polygon coordinates */
  coordinates: {
    type: 'box' | 'polygon' | 'point';
    points: Array<{ x: number; y: number }>; // Normalized 0-1
  };
  
  /** Confidence score (for AI-generated findings) */
  confidence?: number;
  
  /** Clinical significance */
  significance: 'critical' | 'important' | 'incidental';
  
  /** Is this the primary pathology for the case */
  isPrimary: boolean;
}

/**
 * Interactive radiology/pathology image.
 */
export interface InteractiveImage {
  /** Image ID */
  id: string;
  
  /** Imaging modality */
  modality: ImagingModality;
  
  /** Image URL */
  imageUrl: string;
  
  /** Image dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  
  /** Pathological findings */
  findings: PathologicalFinding[];
  
  /** Heatmap overlay (AI-generated) */
  heatmap?: {
    /** Heatmap image URL (0-1 probability overlay) */
    imageUrl: string;
    
    /** Model used to generate heatmap */
    model: string;
    
    /** Threshold for "highlighting" */
    threshold: number;
  };
  
  /** Metadata */
  metadata?: {
    patientAge?: number;
    clinicalHistory?: string;
    technicalDetails?: string;
  };
}

/**
 * Point-and-click diagnostic interaction.
 */
export interface PointAndClickDiagnostic {
  /** Question ID */
  questionId: string;
  
  /** Interactive image */
  image: InteractiveImage;
  
  /** Student's click coordinates */
  studentClicks: Array<{
    x: number;
    y: number;
    timestamp: string;
  }>;
  
  /** Correct answer regions */
  correctRegions: PathologicalFinding[];
  
  /** Scoring config */
  scoring: {
    /** Max distance from finding center (normalized) */
    maxDistanceForCredit: number;
    
    /** Points per correct click */
    pointsPerFinding: number;
    
    /** Penalty for incorrect clicks */
    penaltyPerWrongClick: number;
  };
  
  /** Attempts allowed */
  maxAttempts: number;
  
  /** Current attempt number */
  currentAttempt: number;
  
  /** Hint system */
  hints: {
    /** Subtle hint (text) */
    subtle: string;
    
    /** Moderate hint (highlight quadrant) */
    moderate: {
      text: string;
      highlightRegion: 'upper_left' | 'upper_right' | 'lower_left' | 'lower_right' | 'central';
    };
    
    /** Explicit hint (show partial heatmap) */
    explicit: {
      text: string;
      revealHeatmapOpacity: number; // 0.3 for partial reveal
    };
  };
  
  /** Current hint level unlocked */
  currentHintLevel: 'none' | 'subtle' | 'moderate' | 'explicit';
}

// ============================================================================
// REVEAL-ON-HOVER SYSTEM
// ============================================================================

/**
 * Hover interaction state.
 */
export interface HoverInteraction {
  /** Is hovering enabled */
  isEnabled: boolean;
  
  /** Hover duration required to trigger reveal (ms) */
  hoverDurationMs: number;
  
  /** Current hover position */
  currentPosition?: {
    x: number;
    y: number;
  };
  
  /** Hover start time */
  hoverStartTime?: number;
  
  /** Has the hint been revealed */
  hintRevealed: boolean;
  
  /** Penalty for using hover hint */
  penaltyPoints?: number;
}

/**
 * Heatmap reveal configuration.
 */
export interface HeatmapReveal {
  /** Initial opacity (0 = hidden) */
  initialOpacity: number;
  
  /** Target opacity on reveal */
  revealOpacity: number;
  
  /** Transition duration (ms) */
  transitionDuration: number;
  
  /** Color scheme */
  colorScheme: {
    low: string;      // Low probability (e.g., blue)
    medium: string;   // Medium probability (e.g., yellow)
    high: string;     // High probability (e.g., red)
  };
  
  /** Blur radius (px) */
  blurRadius: number;
}

// ============================================================================
// COMPARATIVE ANATOMY (NORMAL VS ABNORMAL)
// ============================================================================

/**
 * Side-by-side normal/abnormal comparison.
 */
export interface ComparativeAnatomy {
  /** Comparison ID */
  id: string;
  
  /** Modality */
  modality: ImagingModality;
  
  /** Normal (reference) image */
  normalImage: {
    imageUrl: string;
    label: string;
    annotations?: string[];
  };
  
  /** Abnormal (pathological) image */
  abnormalImage: {
    imageUrl: string;
    label: string;
    findings: PathologicalFinding[];
    annotations?: string[];
  };
  
  /** Interactive toggle */
  toggleMode: 'side_by_side' | 'slider' | 'overlay' | 'blink';
  
  /** Teaching points */
  teachingPoints: string[];
}

// ============================================================================
// QUESTION TYPES
// ============================================================================

/**
 * Clinical eye question type.
 */
export type ClinicalEyeQuestionType =
  | 'identify_finding'      // Point-and-click to identify pathology
  | 'compare_images'        // Which image shows the abnormality
  | 'match_finding'         // Match finding to clinical presentation
  | 'sequence_diagnosis'    // Order images by diagnostic priority
  | 'interpret_video';      // Identify physical findings in patient video

/**
 * Clinical eye question.
 */
export interface ClinicalEyeQuestion {
  /** Question ID */
  id: string;
  
  /** Question type */
  type: ClinicalEyeQuestionType;
  
  /** Question stem */
  stem: string;
  
  /** Media (images/videos) */
  media: Array<InteractiveImage | StandardizedPatientVideo | ComparativeAnatomy>;
  
  /** Correct answer */
  correctAnswer: string | number | PathologicalFinding[];
  
  /** Scoring */
  scoring: {
    basePoints: number;
    timeBonus?: number;
    accuracyBonus?: number;
    hintPenalty?: number;
  };
  
  /** Explanation */
  explanation: string;
  
  /** Teaching points */
  teachingPoints: string[];
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard';
  
  /** PANCE relevance */
  panceRelevance: number;
}

// ============================================================================
// SPATIAL UNDERSTANDING API
// ============================================================================

/**
 * Spatial understanding API request (Gemini).
 */
export interface SpatialUnderstandingRequest {
  /** Image to analyze */
  imageUrl: string;
  
  /** Query */
  query: string;
  
  /** Model */
  model: 'gemini-pro-vision' | 'gemini-2.0-flash-exp';
  
  /** Return bounding boxes */
  returnBoundingBoxes: boolean;
  
  /** Return heatmap */
  returnHeatmap: boolean;
  
  /** Confidence threshold */
  confidenceThreshold: number;
}

/**
 * Spatial understanding API response.
 */
export interface SpatialUnderstandingResponse {
  /** Findings detected */
  findings: Array<{
    name: string;
    confidence: number;
    boundingBox?: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };
    description: string;
  }>;
  
  /** Heatmap (base64 encoded image) */
  heatmap?: string;
  
  /** Overall interpretation */
  interpretation: string;
}

// ============================================================================
// EXAMPLE CONFIGURATIONS
// ============================================================================

/**
 * Example: Pneumothorax chest X-ray.
 */
export const EXAMPLE_PNEUMOTHORAX_XRAY: InteractiveImage = {
  id: 'xray-pneumothorax-001',
  modality: 'chest_xray',
  imageUrl: 'https://cdn.panacea.app/images/pneumothorax-xray.jpg',
  dimensions: { width: 1024, height: 1024 },
  findings: [
    {
      id: 'finding-ptx-line',
      name: 'Pneumothorax Line',
      description: 'Visible pleural line with absent lung markings beyond',
      coordinates: {
        type: 'polygon',
        points: [
          { x: 0.65, y: 0.2 },
          { x: 0.7, y: 0.3 },
          { x: 0.68, y: 0.5 },
          { x: 0.63, y: 0.4 },
        ],
      },
      significance: 'critical',
      isPrimary: true,
    },
  ],
  heatmap: {
    imageUrl: 'https://cdn.panacea.app/heatmaps/pneumothorax-xray-heatmap.png',
    model: 'gemini-pro-vision',
    threshold: 0.7,
  },
};

/**
 * Example: Levine sign patient video.
 */
export const EXAMPLE_LEVINE_SIGN_VIDEO: StandardizedPatientVideo = {
  id: 'video-levine-sign-001',
  demographics: { age: 55, gender: 'male' },
  setting: 'emergency_department',
  chiefComplaint: 'Chest pain',
  findings: [
    {
      id: 'finding-levine-sign',
      name: 'Levine Sign',
      category: 'cardiovascular',
      description: 'Patient clutching fist to chest',
      significance: 'Highly suggestive of cardiac ischemia',
      associatedConditions: ['Acute Coronary Syndrome', 'Myocardial Infarction'],
      veoCameoPrompt: '55yo male in ED, clutching fist to center of chest, grimacing, diaphoretic',
      sensitivity: 0.75,
      specificity: 0.85,
      isRedFlag: true,
    },
  ],
  fullPrompt: '55yo male in ED bay, sitting on stretcher, clutching fist to center of chest (Levine sign), grimacing in pain, visible diaphoresis on forehead, cardiac monitor in background',
  duration: 5,
  status: 'ready',
};
