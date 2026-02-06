/**
 * AI Tutor System Type Definitions
 * 
 * Integrates Google AI Studio's ask_the_manual (Grounding API) for a
 * sophisticated clinical knowledge retrieval system backed by uploaded
 * textbooks, lectures, and study materials.
 * 
 * This system provides:
 * - RAG (Retrieval-Augmented Generation) with clinical textbooks
 * - Context-aware tutoring during OSCE sessions
 * - Citation-backed explanations
 * - Progressive hint system
 * 
 * @module ai-tutor-system
 */

// ============================================================================
// KNOWLEDGE BASE MANAGEMENT
// ============================================================================

/**
 * Clinical resource types that can be uploaded to ask_the_manual.
 */
export type ClinicalResourceType =
  | 'textbook'          // Full medical textbook (Harrison's, Cecil, etc.)
  | 'lecture_notes'     // Course lecture slides/notes
  | 'study_guide'       // PANCE/PANRE review materials
  | 'clinical_guideline'// Practice guidelines (AHA, ATS, etc.)
  | 'case_collection'   // Clinical case compilations
  | 'journal_article'   // Research papers
  | 'reference_manual'; // Drug references, procedure manuals

/**
 * Medical specialty for resource categorization.
 */
export type MedicalSpecialty =
  | 'internal_medicine'
  | 'emergency_medicine'
  | 'surgery'
  | 'pediatrics'
  | 'obstetrics_gynecology'
  | 'psychiatry'
  | 'family_medicine'
  | 'cardiology'
  | 'pulmonology'
  | 'neurology'
  | 'general';

/**
 * A clinical knowledge resource uploaded to ask_the_manual.
 */
export interface ClinicalResource {
  /** Unique resource identifier */
  id: string;
  
  /** Resource title */
  title: string;
  
  /** Authors */
  authors: string[];
  
  /** Edition/version */
  edition?: string;
  
  /** Publication year */
  year?: number;
  
  /** Resource type */
  type: ClinicalResourceType;
  
  /** Primary specialty */
  specialty: MedicalSpecialty;
  
  /** File format */
  format: 'pdf' | 'txt' | 'rtf' | 'docx';
  
  /** File URL (Cloud Storage) */
  fileUrl: string;
  
  /** File size in bytes */
  fileSize: number;
  
  /** Gemini corpus ID (after upload to ask_the_manual) */
  corpusId?: string;
  
  /** Upload status */
  uploadStatus: 'pending' | 'processing' | 'indexed' | 'failed';
  
  /** Indexing completion percentage */
  indexingProgress?: number;
  
  /** Page count (for pagination) */
  pageCount?: number;
  
  /** Tags for filtering */
  tags: string[];
  
  /** PANCE blueprint relevance (0-100) */
  panceRelevance?: number;
  
  /** Citation format */
  citation: string;
  
  /** Timestamps */
  uploadedAt: string;
  indexedAt?: string;
  
  /** Usage statistics */
  stats?: {
    totalQueries: number;
    avgRelevanceScore: number;
    lastAccessedAt?: string;
  };
}

/**
 * Knowledge base collection (curated resource sets).
 */
export interface KnowledgeBaseCollection {
  id: string;
  name: string;
  description: string;
  resourceIds: string[];
  specialty: MedicalSpecialty;
  isPanceOptimized: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// TUTOR QUERY SYSTEM
// ============================================================================

/**
 * Tutor query context types.
 */
export type TutorQueryContext =
  | 'osce_active'        // During patient encounter
  | 'post_osce_review'   // After encounter completion
  | 'question_explanation'// Explaining a test question
  | 'condition_research' // Learning about a condition
  | 'procedure_guidance' // Step-by-step procedure help
  | 'diagnostic_reasoning'// Differential diagnosis help
  | 'general_study';     // Open-ended study session

/**
 * Hint level for progressive disclosure.
 */
export type HintLevel = 'subtle' | 'moderate' | 'explicit' | 'answer';

/**
 * Tutor query request.
 */
export interface TutorQuery {
  /** Query ID */
  id: string;
  
  /** User's question */
  question: string;
  
  /** Query context */
  context: TutorQueryContext;
  
  /** Hint level requested */
  hintLevel: HintLevel;
  
  /** Related case/question ID (if applicable) */
  relatedCaseId?: string;
  relatedQuestionId?: string;
  
  /** Clinical scenario context (for contextual tutoring) */
  clinicalContext?: {
    patientAge?: number;
    patientSex?: string;
    chiefComplaint?: string;
    vitals?: Record<string, string | number>;
    symptoms?: string[];
    workupOrdered?: string[];
  };
  
  /** Resource filters */
  resourceFilters?: {
    resourceIds?: string[];       // Specific resources
    collectionIds?: string[];     // Resource collections
    types?: ClinicalResourceType[];
    specialties?: MedicalSpecialty[];
    minPanceRelevance?: number;
  };
  
  /** User ID (for personalization) */
  userId: string;
  
  /** Session ID (for conversation continuity) */
  sessionId?: string;
  
  /** Previous queries in this session */
  conversationHistory?: Array<{
    question: string;
    answer: string;
    timestamp: string;
  }>;
  
  /** Timestamp */
  timestamp: string;
}

/**
 * Citation from a clinical resource.
 */
export interface Citation {
  /** Resource ID */
  resourceId: string;
  
  /** Resource title */
  resourceTitle: string;
  
  /** Page/section reference */
  pageReference?: string;
  
  /** Exact text excerpt */
  excerpt: string;
  
  /** Relevance score (0-1) */
  relevanceScore: number;
  
  /** Full citation string */
  citationString: string;
}

/**
 * Tutor response with grounded knowledge.
 */
export interface TutorResponse {
  /** Response ID */
  id: string;
  
  /** Query ID */
  queryId: string;
  
  /** AI-generated answer */
  answer: string;
  
  /** Citations supporting the answer */
  citations: Citation[];
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Hint level provided */
  hintLevel: HintLevel;
  
  /** Follow-up suggestions */
  followUpQuestions?: string[];
  
  /** Related topics for further study */
  relatedTopics?: string[];
  
  /** Teaching points extracted from citations */
  teachingPoints?: string[];
  
  /** Mnemonic/memory aids (if available) */
  mnemonics?: string[];
  
  /** PANCE blueprint alignment */
  panceAlignment?: {
    organ_system: string;
    task: string;
    relevance: number;
  };
  
  /** Latency metrics */
  latency: {
    retrievalMs: number;
    generationMs: number;
    totalMs: number;
  };
  
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// PROGRESSIVE HINT SYSTEM
// ============================================================================

/**
 * Progressive hint sequence for a diagnostic scenario.
 */
export interface ProgressiveHintSequence {
  /** Scenario ID */
  scenarioId: string;
  
  /** Hints ordered by disclosure level */
  hints: {
    subtle: string[];      // "Think about the patient's risk factors"
    moderate: string[];    // "What cardiac causes could present this way?"
    explicit: string[];    // "Consider acute coronary syndrome"
    answer: string;        // "This is an ST-elevation myocardial infarction"
  };
  
  /** Current hint level */
  currentLevel: HintLevel;
  
  /** Number of hints used */
  hintsUsed: number;
}

/**
 * Hint request during OSCE.
 */
export interface HintRequest {
  sessionId: string;
  caseId: string;
  question: string;
  currentLevel: HintLevel;
  nextLevel: HintLevel;
  timestamp: string;
}

// ============================================================================
// CONTEXTUAL TUTORING
// ============================================================================

/**
 * Contextual tutor intervention during OSCE.
 */
export interface ContextualIntervention {
  /** Intervention type */
  type: 'hint' | 'correction' | 'encouragement' | 'teaching_point';
  
  /** Trigger condition */
  trigger: {
    event: 'time_elapsed' | 'wrong_action' | 'missed_critical_finding' | 'student_request';
    threshold?: number;
  };
  
  /** Intervention message */
  message: string;
  
  /** Supporting citations */
  citations?: Citation[];
  
  /** Suggested next action */
  suggestedAction?: string;
  
  /** Timestamp */
  timestamp: string;
}

/**
 * Post-OSCE debrief with AI tutor.
 */
export interface OSCEDebrief {
  /** Session ID */
  sessionId: string;
  
  /** Case details */
  case: {
    diagnosis: string;
    chiefComplaint: string;
    keyFindings: string[];
  };
  
  /** Student performance */
  performance: {
    correctDiagnosis: boolean;
    essentialQuestionsAsked: string[];
    criticalFindingsMissed: string[];
    timeToAction: number;
  };
  
  /** AI tutor analysis */
  analysis: {
    strengths: string[];
    areasForImprovement: string[];
    teachingPoints: string[];
    citations: Citation[];
  };
  
  /** Recommended study resources */
  recommendedResources: ClinicalResource[];
  
  /** Next case recommendations */
  nextCaseRecommendations: string[];
  
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// API INTERFACES
// ============================================================================

/**
 * ask_the_manual API request format.
 */
export interface AskTheManualRequest {
  /** User query */
  query: string;
  
  /** Corpus IDs to search */
  corpusIds: string[];
  
  /** Max results */
  maxResults?: number;
  
  /** Minimum relevance score (0-1) */
  minRelevanceScore?: number;
  
  /** Context for semantic search */
  context?: string;
  
  /** Generation config */
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
  };
}

/**
 * ask_the_manual API response format.
 */
export interface AskTheManualResponse {
  /** Generated answer */
  answer: string;
  
  /** Grounding attributions */
  groundingAttributions: Array<{
    sourceId: {
      corpusId: string;
      documentId: string;
    };
    content: {
      text: string;
    };
    retrievalScore: number;
  }>;
  
  /** Safety ratings */
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}

// ============================================================================
// EXAMPLE CONFIGURATIONS
// ============================================================================

/**
 * Example: PANCE review collection.
 */
export const EXAMPLE_PANCE_COLLECTION: KnowledgeBaseCollection = {
  id: 'pance-review-2026',
  name: 'PANCE Review 2026',
  description: 'Comprehensive review materials optimized for PANCE blueprint',
  resourceIds: [
    'resource-davis-pance-review',
    'resource-kaplan-pance-prep',
    'resource-rosh-review-qbank',
    'resource-pance-content-blueprint',
  ],
  specialty: 'general',
  isPanceOptimized: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-05T00:00:00Z',
};

/**
 * Example: Core textbook collection.
 */
export const EXAMPLE_CORE_TEXTBOOKS: KnowledgeBaseCollection = {
  id: 'core-medical-textbooks',
  name: 'Core Medical Textbooks',
  description: 'Essential medical textbooks for clinical reasoning',
  resourceIds: [
    'resource-harrisons-principles-21e',
    'resource-current-medical-diagnosis-treatment-2026',
    'resource-oxford-handbook-clinical-medicine-11e',
    'resource-tintinalli-emergency-medicine-9e',
  ],
  specialty: 'general',
  isPanceOptimized: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-05T00:00:00Z',
};

/**
 * Example: Specialty-specific collection (Cardiology).
 */
export const EXAMPLE_CARDIOLOGY_COLLECTION: KnowledgeBaseCollection = {
  id: 'cardiology-essentials',
  name: 'Cardiology Essentials',
  description: 'Comprehensive cardiology references',
  resourceIds: [
    'resource-braunwalds-heart-disease-12e',
    'resource-aha-guidelines-2025',
    'resource-ecg-interpretation-dubin',
  ],
  specialty: 'cardiology',
  isPanceOptimized: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-05T00:00:00Z',
};
