/**
 * Causal Reasoning Chain Types
 *
 * Data structures for mechanistic causal explanations that connect
 * underlying cause → pathophysiology → clinical finding → diagnosis → treatment.
 *
 * Research basis:
 * - Woods, Brooks & Norman (2005, 2007): Causal mechanism explanations
 *   outperform declarative facts for diagnostic reasoning transfer
 * - Schmidt, Norman & Boshuizen (1990): Knowledge encapsulation theory —
 *   biomedical causal knowledge is the substrate for expert diagnostic reasoning
 * - Chi et al. (1994): Self-explanation via causal chains produces d = 0.63–0.95
 * - Delarazan et al. (2024): Causal relationships override temporal/presentation
 *   order in memory organization
 *
 * @module types/causalChain
 * Sprint: Tier 1 Research Implementation — Item 4
 */

// ─── Link Types ─────────────────────────────────────────────────────

/** The mechanistic relationship between two entities in the chain */
export type CausalLinkType =
  | 'causes'
  | 'leads_to'
  | 'results_in'
  | 'treated_by'
  | 'prevented_by'
  | 'diagnosed_by'
  | 'exacerbated_by'
  | 'inhibited_by';

// ─── Core Interfaces ────────────────────────────────────────────────

/** A single link in a causal reasoning chain */
export interface CausalLink {
  /** Position in the chain (0-indexed) */
  order: number;
  /** The biological entity, process, or clinical finding */
  entity: string;
  /** Mechanistic explanation of HOW this entity leads to the consequence */
  mechanism: string;
  /** The downstream result of this entity's action */
  consequence: string;
  /** The type of causal relationship */
  linkType: CausalLinkType;
}

/** A branch point where the chain diverges for differential diagnosis */
export interface BranchPoint {
  /** Which link index this branches from */
  afterLink: number;
  /** The alternative causal path (e.g., different diagnosis) */
  alternativePath: CausalLink[];
  /** The condition that triggers this branch (e.g., "if left untreated") */
  condition: string;
  /** The differential diagnosis this branch represents */
  differentialDiagnosis: string;
}

/** A complete causal reasoning chain for a question explanation */
export interface CausalChain {
  /** Unique identifier */
  id: string;
  /** The question this chain explains */
  questionId: string;
  /** The primary causal chain (4-6 links) */
  links: CausalLink[];
  /** Branch points where the chain diverges for differentials */
  branchPoints: BranchPoint[];
  /** One-line clinical correlation connecting the chain to the patient presentation */
  clinicalCorrelation: string;
  /** The condition/diagnosis this chain explains */
  condition: string;
  /** Timestamp of generation */
  generatedAt: string;
  /** Which Gemini model generated this */
  geminiModelVersion: string;
  /** Review status for clinical accuracy */
  reviewStatus: 'auto' | 'expert-reviewed' | 'flagged';
}

// ─── Display Levels ─────────────────────────────────────────────────

/**
 * Display levels that align with the expertise-adaptive scaffolding system.
 * Maps to ExpertiseLevel from the desirableDifficulties service:
 * - NOVICE → 'full': all mechanisms visible
 * - DEVELOPING → 'collapsed': click to expand
 * - COMPETENT → 'skeleton': entity → consequence only
 * - EXPERT → 'pearl': one-line clinical correlation only
 */
export type CausalChainDisplayLevel = 'full' | 'collapsed' | 'skeleton' | 'pearl';

// ─── Generation Request/Response ────────────────────────────────────

/** Request payload for generating a causal chain via Gemini */
export interface CausalChainGenerationRequest {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  condition: string;
  /** Optional: the incorrect answer the student chose, for targeted branch point */
  studentAnswer?: string;
  /** Optional: the organ system for domain-specific prompting */
  system?: string;
}

/** Response from the causal chain generation service */
export interface CausalChainGenerationResult {
  success: boolean;
  chain?: CausalChain;
  error?: string;
  /** Whether this was served from cache */
  cached: boolean;
}
