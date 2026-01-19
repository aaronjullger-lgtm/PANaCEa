/**
 * Concept Dependency Service
 *
 * Maps prerequisite relationships between medical concepts, detects knowledge gaps
 * from answer patterns, builds personalized concept trees, and identifies
 * "keystone concepts" that unlock multiple topics.
 *
 * This service creates an intelligent understanding of how medical knowledge
 * is structured and how concepts relate to each other, enabling:
 *
 * 1. Prerequisite identification - What do you need to know first?
 * 2. Knowledge gap detection - Where are the holes in understanding?
 * 3. Keystone concept identification - Which concepts unlock the most?
 * 4. Learning path optimization - What order maximizes efficiency?
 *
 * @module conceptDependencyService
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * A directed edge in the knowledge graph representing a prerequisite relationship
 */
export interface ConceptDependency {
  prerequisiteId: string; // The concept that should be learned first
  prerequisiteName: string;
  dependentId: string; // The concept that depends on the prerequisite
  dependentName: string;
  strength: number; // How strongly required (0-100)
  relationshipType: DependencyType;
  evidence: string[]; // Why this dependency exists
}

export type DependencyType =
  | 'hard_prerequisite' // Must know A to understand B
  | 'soft_prerequisite' // Helps to know A for B
  | 'builds_upon' // B is advanced version of A
  | 'applies_to' // B is clinical application of A (basic science)
  | 'differentiates_from' // Need to know A to distinguish from B
  | 'mechanism_of' // A explains mechanism of B
  | 'treatment_for' // A is treatment approach for B
  | 'complication_of'; // A can lead to or complicate B

/**
 * A concept node with its dependency metadata
 */
export interface ConceptNode {
  conceptId: string;
  name: string;
  system: string;
  category: 'basic_science' | 'clinical' | 'diagnostic' | 'therapeutic';

  // Dependency metrics
  prerequisites: ConceptDependency[]; // What you need to know first
  dependents: ConceptDependency[]; // What this concept enables
  keystoneScore: number; // How many concepts this unlocks (0-100)
  foundationalScore: number; // How foundational is this (0-100)

  // Student-specific state
  masteryEstimate: number; // Current estimated mastery (0-100)
  prerequisitesMet: boolean; // Are all hard prerequisites mastered?
  readyToLearn: boolean; // Ready for optimal learning?
  blockedBy: string[]; // Prerequisites not yet mastered
}

/**
 * A knowledge gap identified from error patterns
 */
export interface KnowledgeGap {
  conceptId: string;
  conceptName: string;
  system: string;
  gapType: GapType;
  severity: 'critical' | 'significant' | 'moderate' | 'minor';
  evidence: GapEvidence[];
  blocksConceptIds: string[]; // Concepts blocked by this gap
  blocksCount: number; // How many concepts are blocked
  remediationPriority: number; // 0-100, higher = fix first
  suggestedResources: string[];
}

export type GapType =
  | 'missing_foundation' // Never learned prerequisite
  | 'partial_understanding' // Knows some but not enough
  | 'shallow_encoding' // Memorized but doesn't understand
  | 'application_failure' // Knows theory, can't apply
  | 'integration_failure' // Can't connect concepts
  | 'procedural_gap'; // Knows what but not how

export interface GapEvidence {
  questionId: string;
  timestamp: Date;
  errorPattern: string;
  conceptsTested: string[];
  indicatesGap: string;
}

/**
 * A keystone concept that unlocks many others
 */
export interface KeystoneConcept {
  conceptId: string;
  conceptName: string;
  system: string;

  // Impact metrics
  directUnlocks: string[]; // Concepts directly dependent
  indirectUnlocks: string[]; // Concepts transitively dependent
  totalImpact: number; // Total concepts affected

  // Learning priority
  currentMastery: number;
  potentialGain: number; // Learning impact if mastered
  recommendedPriority: number; // 0-100
}

/**
 * Optimized learning path for a student
 */
export interface LearningPath {
  userId: string;
  generatedAt: Date;

  // Path structure
  stages: LearningStage[];
  totalConcepts: number;
  estimatedHours: number;

  // Progress tracking
  currentStage: number;
  completedConcepts: string[];

  // Optimization info
  optimizationStrategy: 'breadth_first' | 'depth_first' | 'keystone_priority' | 'gap_priority';
  efficiencyScore: number; // How efficient is this path (0-100)
}

export interface LearningStage {
  stageNumber: number;
  title: string;
  description: string;
  concepts: string[];
  estimatedHours: number;
  prerequisitesRequired: string[];
  unlocksNext: string[];
}

// ============================================================================
// Constants - Medical Knowledge Structure
// ============================================================================

/**
 * Core medical concept dependencies
 * This is a simplified version - in production, this would come from the database
 * or be generated from MedicalContent relationships
 */
const CORE_DEPENDENCIES: Array<{
  prerequisite: string;
  dependent: string;
  type: DependencyType;
  strength: number;
}> = [
  // Cardiovascular foundation → conditions
  {
    prerequisite: 'cardiac_anatomy',
    dependent: 'heart_failure',
    type: 'hard_prerequisite',
    strength: 90,
  },
  {
    prerequisite: 'cardiac_anatomy',
    dependent: 'myocardial_infarction',
    type: 'hard_prerequisite',
    strength: 95,
  },
  {
    prerequisite: 'cardiac_physiology',
    dependent: 'arrhythmias',
    type: 'hard_prerequisite',
    strength: 90,
  },
  {
    prerequisite: 'coronary_circulation',
    dependent: 'angina',
    type: 'hard_prerequisite',
    strength: 85,
  },
  {
    prerequisite: 'coronary_circulation',
    dependent: 'myocardial_infarction',
    type: 'mechanism_of',
    strength: 95,
  },

  // Respiratory foundation → conditions
  {
    prerequisite: 'pulmonary_anatomy',
    dependent: 'pneumonia',
    type: 'hard_prerequisite',
    strength: 80,
  },
  {
    prerequisite: 'pulmonary_physiology',
    dependent: 'copd',
    type: 'hard_prerequisite',
    strength: 85,
  },
  { prerequisite: 'pulmonary_physiology', dependent: 'asthma', type: 'mechanism_of', strength: 90 },
  {
    prerequisite: 'gas_exchange',
    dependent: 'respiratory_failure',
    type: 'hard_prerequisite',
    strength: 95,
  },

  // Renal foundation → conditions
  {
    prerequisite: 'renal_anatomy',
    dependent: 'acute_kidney_injury',
    type: 'hard_prerequisite',
    strength: 85,
  },
  {
    prerequisite: 'renal_physiology',
    dependent: 'chronic_kidney_disease',
    type: 'mechanism_of',
    strength: 90,
  },
  {
    prerequisite: 'fluid_balance',
    dependent: 'electrolyte_disorders',
    type: 'hard_prerequisite',
    strength: 95,
  },
  {
    prerequisite: 'acid_base_balance',
    dependent: 'metabolic_acidosis',
    type: 'mechanism_of',
    strength: 95,
  },

  // Endocrine foundation → conditions
  {
    prerequisite: 'glucose_metabolism',
    dependent: 'diabetes_mellitus',
    type: 'hard_prerequisite',
    strength: 95,
  },
  {
    prerequisite: 'thyroid_physiology',
    dependent: 'hypothyroidism',
    type: 'mechanism_of',
    strength: 90,
  },
  {
    prerequisite: 'thyroid_physiology',
    dependent: 'hyperthyroidism',
    type: 'mechanism_of',
    strength: 90,
  },
  {
    prerequisite: 'adrenal_physiology',
    dependent: 'cushings_syndrome',
    type: 'mechanism_of',
    strength: 85,
  },

  // Neurology foundation → conditions
  { prerequisite: 'neuroanatomy', dependent: 'stroke', type: 'hard_prerequisite', strength: 90 },
  {
    prerequisite: 'cerebrovascular_anatomy',
    dependent: 'stroke',
    type: 'mechanism_of',
    strength: 95,
  },
  {
    prerequisite: 'neurotransmitters',
    dependent: 'parkinsons',
    type: 'mechanism_of',
    strength: 85,
  },
  {
    prerequisite: 'neuromuscular_junction',
    dependent: 'myasthenia_gravis',
    type: 'mechanism_of',
    strength: 90,
  },

  // GI foundation → conditions
  {
    prerequisite: 'gi_anatomy',
    dependent: 'appendicitis',
    type: 'hard_prerequisite',
    strength: 85,
  },
  { prerequisite: 'gi_physiology', dependent: 'gerd', type: 'mechanism_of', strength: 80 },
  { prerequisite: 'hepatic_function', dependent: 'cirrhosis', type: 'mechanism_of', strength: 90 },
  {
    prerequisite: 'biliary_anatomy',
    dependent: 'cholelithiasis',
    type: 'hard_prerequisite',
    strength: 85,
  },

  // Hematology foundation → conditions
  { prerequisite: 'hematopoiesis', dependent: 'anemia', type: 'hard_prerequisite', strength: 90 },
  { prerequisite: 'coagulation_cascade', dependent: 'dvt', type: 'mechanism_of', strength: 90 },
  {
    prerequisite: 'coagulation_cascade',
    dependent: 'pulmonary_embolism',
    type: 'mechanism_of',
    strength: 85,
  },
  { prerequisite: 'coagulation_cascade', dependent: 'dic', type: 'mechanism_of', strength: 95 },

  // Infectious disease foundation
  { prerequisite: 'immunology_basics', dependent: 'sepsis', type: 'mechanism_of', strength: 85 },
  {
    prerequisite: 'bacterial_pathogenesis',
    dependent: 'pneumonia',
    type: 'mechanism_of',
    strength: 80,
  },
  {
    prerequisite: 'viral_pathogenesis',
    dependent: 'influenza',
    type: 'mechanism_of',
    strength: 75,
  },

  // Pharmacology connections
  {
    prerequisite: 'diabetes_mellitus',
    dependent: 'insulin_therapy',
    type: 'treatment_for',
    strength: 90,
  },
  {
    prerequisite: 'heart_failure',
    dependent: 'ace_inhibitors',
    type: 'treatment_for',
    strength: 85,
  },
  {
    prerequisite: 'arrhythmias',
    dependent: 'antiarrhythmics',
    type: 'treatment_for',
    strength: 90,
  },
  {
    prerequisite: 'hypertension',
    dependent: 'antihypertensives',
    type: 'treatment_for',
    strength: 85,
  },

  // Differential diagnosis links
  {
    prerequisite: 'angina',
    dependent: 'myocardial_infarction',
    type: 'differentiates_from',
    strength: 90,
  },
  { prerequisite: 'asthma', dependent: 'copd', type: 'differentiates_from', strength: 85 },
  {
    prerequisite: 'hypothyroidism',
    dependent: 'hyperthyroidism',
    type: 'differentiates_from',
    strength: 80,
  },

  // Complication chains
  {
    prerequisite: 'diabetes_mellitus',
    dependent: 'diabetic_neuropathy',
    type: 'complication_of',
    strength: 85,
  },
  {
    prerequisite: 'diabetes_mellitus',
    dependent: 'diabetic_retinopathy',
    type: 'complication_of',
    strength: 85,
  },
  { prerequisite: 'hypertension', dependent: 'stroke', type: 'complication_of', strength: 80 },
  {
    prerequisite: 'cirrhosis',
    dependent: 'hepatic_encephalopathy',
    type: 'complication_of',
    strength: 90,
  },
];

/**
 * System-to-foundational-concepts mapping
 */
const SYSTEM_FOUNDATIONS: Record<string, string[]> = {
  cardiovascular: ['cardiac_anatomy', 'cardiac_physiology', 'coronary_circulation', 'ecg_basics'],
  pulmonary: ['pulmonary_anatomy', 'pulmonary_physiology', 'gas_exchange', 'ventilation_perfusion'],
  renal: ['renal_anatomy', 'renal_physiology', 'fluid_balance', 'acid_base_balance'],
  endocrine: [
    'endocrine_overview',
    'glucose_metabolism',
    'thyroid_physiology',
    'adrenal_physiology',
  ],
  neurology: ['neuroanatomy', 'neurophysiology', 'neurotransmitters', 'cerebrovascular_anatomy'],
  gastrointestinal: ['gi_anatomy', 'gi_physiology', 'hepatic_function', 'biliary_anatomy'],
  musculoskeletal: ['msk_anatomy', 'bone_physiology', 'joint_mechanics', 'muscle_physiology'],
  hematology: ['hematopoiesis', 'coagulation_cascade', 'immunology_basics', 'blood_typing'],
  infectious: [
    'microbiology_basics',
    'bacterial_pathogenesis',
    'viral_pathogenesis',
    'immunology_basics',
  ],
  dermatology: ['skin_anatomy', 'wound_healing', 'immune_skin_response'],
  psychiatry: ['neurotransmitters', 'neuroanatomy', 'psychology_basics'],
  reproductive: ['reproductive_anatomy', 'hormonal_regulation', 'embryology_basics'],
};

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  CONCEPT_GRAPH: 'panceai_concept_graph',
  KNOWLEDGE_GAPS: 'panceai_knowledge_gaps',
  LEARNING_PATH: 'panceai_learning_path',
  MASTERY_ESTIMATES: 'panceai_mastery_estimates',
} as const;

// ============================================================================
// Core Service Class
// ============================================================================

class ConceptDependencyService {
  private conceptNodes: Map<string, ConceptNode> = new Map();
  private knowledgeGaps: KnowledgeGap[] = [];
  private currentLearningPath: LearningPath | null = null;
  private masteryEstimates: Map<string, number> = new Map();

  constructor() {
    this.initializeGraph();
    this.loadFromStorage();
  }

  /**
   * Initialize the concept graph from core dependencies
   */
  private initializeGraph(): void {
    // Create nodes for all concepts mentioned in dependencies
    const conceptIds = new Set<string>();
    for (const dep of CORE_DEPENDENCIES) {
      conceptIds.add(dep.prerequisite);
      conceptIds.add(dep.dependent);
    }

    for (const conceptId of conceptIds) {
      if (!this.conceptNodes.has(conceptId)) {
        this.conceptNodes.set(conceptId, this.createConceptNode(conceptId));
      }
    }

    // Add dependencies to nodes
    for (const dep of CORE_DEPENDENCIES) {
      const prereqNode = this.conceptNodes.get(dep.prerequisite)!;
      const dependentNode = this.conceptNodes.get(dep.dependent)!;

      const dependency: ConceptDependency = {
        prerequisiteId: dep.prerequisite,
        prerequisiteName: this.formatConceptName(dep.prerequisite),
        dependentId: dep.dependent,
        dependentName: this.formatConceptName(dep.dependent),
        strength: dep.strength,
        relationshipType: dep.type,
        evidence: [],
      };

      prereqNode.dependents.push(dependency);
      dependentNode.prerequisites.push(dependency);
    }

    // Calculate keystone and foundational scores
    this.calculateGraphMetrics();
  }

  private createConceptNode(conceptId: string): ConceptNode {
    // Determine category from naming convention
    let category: ConceptNode['category'] = 'clinical';
    if (
      conceptId.includes('anatomy') ||
      conceptId.includes('physiology') ||
      conceptId.includes('basics')
    ) {
      category = 'basic_science';
    } else if (
      conceptId.includes('therapy') ||
      conceptId.includes('treatment') ||
      conceptId.includes('inhibitors')
    ) {
      category = 'therapeutic';
    } else if (conceptId.includes('diagnosis') || conceptId.includes('test')) {
      category = 'diagnostic';
    }

    // Determine system from foundations mapping or name
    let system = 'general';
    for (const [sys, foundations] of Object.entries(SYSTEM_FOUNDATIONS)) {
      if (foundations.includes(conceptId) || conceptId.toLowerCase().includes(sys.slice(0, 4))) {
        system = sys;
        break;
      }
    }

    return {
      conceptId,
      name: this.formatConceptName(conceptId),
      system,
      category,
      prerequisites: [],
      dependents: [],
      keystoneScore: 0,
      foundationalScore: 0,
      masteryEstimate: 50,
      prerequisitesMet: true,
      readyToLearn: true,
      blockedBy: [],
    };
  }

  private formatConceptName(conceptId: string): string {
    return conceptId
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Calculate keystone and foundational scores for all nodes
   */
  private calculateGraphMetrics(): void {
    for (const node of this.conceptNodes.values()) {
      // Keystone score = how many concepts this unlocks (direct + indirect)
      const unlockCount = this.countTransitiveDependents(node.conceptId);
      node.keystoneScore = Math.min(100, unlockCount * 5);

      // Foundational score = how many prerequisites does this have?
      // Fewer prerequisites = more foundational
      const prereqCount = this.countTransitivePrerequisites(node.conceptId);
      node.foundationalScore = Math.max(0, 100 - prereqCount * 10);
    }
  }

  private countTransitiveDependents(conceptId: string, visited: Set<string> = new Set()): number {
    if (visited.has(conceptId)) return 0;
    visited.add(conceptId);

    const node = this.conceptNodes.get(conceptId);
    if (!node) return 0;

    let count = node.dependents.length;
    for (const dep of node.dependents) {
      count += this.countTransitiveDependents(dep.dependentId, visited);
    }

    return count;
  }

  private countTransitivePrerequisites(
    conceptId: string,
    visited: Set<string> = new Set()
  ): number {
    if (visited.has(conceptId)) return 0;
    visited.add(conceptId);

    const node = this.conceptNodes.get(conceptId);
    if (!node) return 0;

    let count = node.prerequisites.length;
    for (const prereq of node.prerequisites) {
      count += this.countTransitivePrerequisites(prereq.prerequisiteId, visited);
    }

    return count;
  }

  // ==========================================================================
  // Public API - Knowledge Gap Detection
  // ==========================================================================

  /**
   * Detect knowledge gaps from an incorrect answer
   */
  recordIncorrectAnswer(
    questionId: string,
    conditionId: string | null,
    conceptsTested: string[],
    errorPattern: string,
    responseTimeMs: number,
    wasGuessing: boolean
  ): KnowledgeGap[] {
    const newGaps: KnowledgeGap[] = [];

    for (const conceptId of conceptsTested) {
      const node = this.conceptNodes.get(conceptId);
      if (!node) continue;

      // Check if this reveals a foundational gap
      const missingPrereqs = this.findMissingPrerequisites(conceptId);

      if (missingPrereqs.length > 0) {
        // The error might be due to missing prerequisites
        for (const prereqId of missingPrereqs) {
          const existingGap = this.knowledgeGaps.find((g) => g.conceptId === prereqId);

          if (existingGap) {
            existingGap.evidence.push({
              questionId,
              timestamp: new Date(),
              errorPattern,
              conceptsTested,
              indicatesGap: `Error on ${conceptId} suggests gap in prerequisite ${prereqId}`,
            });
            existingGap.blocksCount = this.countTransitiveDependents(prereqId);
            this.updateGapSeverity(existingGap);
          } else {
            const newGap = this.createKnowledgeGap(prereqId, 'missing_foundation', [
              {
                questionId,
                timestamp: new Date(),
                errorPattern,
                conceptsTested,
                indicatesGap: `Error on ${conceptId} suggests missing foundation in ${prereqId}`,
              },
            ]);
            this.knowledgeGaps.push(newGap);
            newGaps.push(newGap);
          }
        }
      }

      // Also track direct concept gap
      const directGap = this.knowledgeGaps.find((g) => g.conceptId === conceptId);

      if (directGap) {
        directGap.evidence.push({
          questionId,
          timestamp: new Date(),
          errorPattern,
          conceptsTested,
          indicatesGap: `Direct error on ${conceptId}`,
        });
        this.updateGapSeverity(directGap);
      } else if (!wasGuessing) {
        // Only add as gap if not pure guessing
        const gapType = this.inferGapType(responseTimeMs, errorPattern, node);
        const newGap = this.createKnowledgeGap(conceptId, gapType, [
          {
            questionId,
            timestamp: new Date(),
            errorPattern,
            conceptsTested,
            indicatesGap: `Error pattern: ${errorPattern}`,
          },
        ]);
        this.knowledgeGaps.push(newGap);
        newGaps.push(newGap);
      }
    }

    this.recalculateGapPriorities();
    this.saveToStorage();

    return newGaps;
  }

  /**
   * Record correct answer - may reduce gaps
   */
  recordCorrectAnswer(conceptsTested: string[]): void {
    for (const conceptId of conceptsTested) {
      // Increase mastery estimate
      const current = this.masteryEstimates.get(conceptId) || 50;
      this.masteryEstimates.set(conceptId, Math.min(100, current + 5));

      // Check if gap should be removed
      const gapIndex = this.knowledgeGaps.findIndex((g) => g.conceptId === conceptId);
      if (gapIndex >= 0) {
        const gap = this.knowledgeGaps[gapIndex];
        // Need multiple correct answers to remove a gap
        if (gap.severity === 'minor') {
          this.knowledgeGaps.splice(gapIndex, 1);
        } else {
          // Reduce severity
          this.demoteGapSeverity(gap);
        }
      }
    }

    this.updateNodeReadiness();
    this.saveToStorage();
  }

  private findMissingPrerequisites(conceptId: string): string[] {
    const node = this.conceptNodes.get(conceptId);
    if (!node) return [];

    const missing: string[] = [];

    for (const prereq of node.prerequisites) {
      if (prereq.relationshipType === 'hard_prerequisite') {
        const prereqMastery = this.masteryEstimates.get(prereq.prerequisiteId) || 50;
        if (prereqMastery < 60) {
          missing.push(prereq.prerequisiteId);
        }
      }
    }

    return missing;
  }

  private inferGapType(responseTimeMs: number, errorPattern: string, node: ConceptNode): GapType {
    // Very fast wrong answer = never learned or guessing
    if (responseTimeMs < 10000) {
      return 'missing_foundation';
    }

    // Long time + wrong = probably partial understanding
    if (responseTimeMs > 90000) {
      return 'partial_understanding';
    }

    // Check error pattern for clues
    if (errorPattern.includes('application')) {
      return 'application_failure';
    }

    if (errorPattern.includes('connect') || errorPattern.includes('relate')) {
      return 'integration_failure';
    }

    if (node.category === 'therapeutic' || node.category === 'diagnostic') {
      return 'procedural_gap';
    }

    // Default to partial understanding
    return 'partial_understanding';
  }

  private createKnowledgeGap(
    conceptId: string,
    gapType: GapType,
    evidence: GapEvidence[]
  ): KnowledgeGap {
    const node = this.conceptNodes.get(conceptId);
    const blocksCount = this.countTransitiveDependents(conceptId);
    const blocksConceptIds = node?.dependents.map((d) => d.dependentId) || [];

    return {
      conceptId,
      conceptName: this.formatConceptName(conceptId),
      system: node?.system || 'general',
      gapType,
      severity: 'moderate',
      evidence,
      blocksConceptIds,
      blocksCount,
      remediationPriority: 0,
      suggestedResources: this.getSuggestedResources(conceptId, gapType),
    };
  }

  private getSuggestedResources(conceptId: string, gapType: GapType): string[] {
    const resources: string[] = [];

    switch (gapType) {
      case 'missing_foundation':
        resources.push('Start with the basic science overview');
        resources.push('Watch introductory video lectures');
        resources.push('Review anatomy and physiology first');
        break;
      case 'partial_understanding':
        resources.push('Re-read main topic explanation');
        resources.push('Practice with easier questions first');
        resources.push('Create summary notes');
        break;
      case 'application_failure':
        resources.push('Work through clinical case studies');
        resources.push('Practice application questions');
        resources.push('Review worked examples');
        break;
      case 'integration_failure':
        resources.push('Create concept maps');
        resources.push('Practice differential diagnosis');
        resources.push('Review related conditions together');
        break;
      case 'procedural_gap':
        resources.push('Review step-by-step protocols');
        resources.push('Practice clinical algorithms');
        resources.push('Watch procedural videos');
        break;
      default:
        resources.push('Review topic thoroughly');
        resources.push('Practice more questions');
    }

    return resources;
  }

  private updateGapSeverity(gap: KnowledgeGap): void {
    const evidenceCount = gap.evidence.length;
    const recentEvidence = gap.evidence.filter(
      (e) => Date.now() - e.timestamp.getTime() < 7 * 86400000
    ).length;

    if (evidenceCount >= 5 || recentEvidence >= 3) {
      gap.severity = 'critical';
    } else if (evidenceCount >= 3 || recentEvidence >= 2) {
      gap.severity = 'significant';
    } else if (evidenceCount >= 2) {
      gap.severity = 'moderate';
    } else {
      gap.severity = 'minor';
    }
  }

  private demoteGapSeverity(gap: KnowledgeGap): void {
    const severityOrder: KnowledgeGap['severity'][] = [
      'critical',
      'significant',
      'moderate',
      'minor',
    ];
    const currentIndex = severityOrder.indexOf(gap.severity);
    if (currentIndex < severityOrder.length - 1) {
      gap.severity = severityOrder[currentIndex + 1];
    }
  }

  private recalculateGapPriorities(): void {
    for (const gap of this.knowledgeGaps) {
      // Priority based on: severity, blocks count, gap type
      let priority = 0;

      // Severity weight
      const severityWeights: Record<KnowledgeGap['severity'], number> = {
        critical: 40,
        significant: 30,
        moderate: 20,
        minor: 10,
      };
      priority += severityWeights[gap.severity];

      // Blocks count weight (0-30)
      priority += Math.min(30, gap.blocksCount * 3);

      // Gap type weight
      const gapTypeWeights: Record<GapType, number> = {
        missing_foundation: 30,
        partial_understanding: 15,
        shallow_encoding: 10,
        application_failure: 20,
        integration_failure: 15,
        procedural_gap: 20,
      };
      priority += gapTypeWeights[gap.gapType];

      gap.remediationPriority = Math.min(100, priority);
    }

    // Sort by priority
    this.knowledgeGaps.sort((a, b) => b.remediationPriority - a.remediationPriority);
  }

  // ==========================================================================
  // Public API - Keystone Concepts
  // ==========================================================================

  /**
   * Get the most impactful keystone concepts for the student to learn
   */
  getKeystoneConcepts(limit = 10): KeystoneConcept[] {
    const keystones: KeystoneConcept[] = [];

    for (const node of this.conceptNodes.values()) {
      if (node.keystoneScore < 20) continue; // Not impactful enough

      const currentMastery = this.masteryEstimates.get(node.conceptId) || 50;
      if (currentMastery >= 80) continue; // Already mastered

      const directUnlocks = node.dependents.map((d) => d.dependentId);
      const indirectUnlocks: string[] = [];

      for (const dep of node.dependents) {
        const transitive = this.getTransitiveDependents(dep.dependentId);
        indirectUnlocks.push(...transitive.filter((id) => !directUnlocks.includes(id)));
      }

      const totalImpact = directUnlocks.length + indirectUnlocks.length;
      const potentialGain = (totalImpact * (100 - currentMastery)) / 100;

      keystones.push({
        conceptId: node.conceptId,
        conceptName: node.name,
        system: node.system,
        directUnlocks,
        indirectUnlocks: [...new Set(indirectUnlocks)],
        totalImpact,
        currentMastery,
        potentialGain,
        recommendedPriority: Math.round((potentialGain / totalImpact) * 100),
      });
    }

    return keystones.sort((a, b) => b.potentialGain - a.potentialGain).slice(0, limit);
  }

  private getTransitiveDependents(conceptId: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(conceptId)) return [];
    visited.add(conceptId);

    const node = this.conceptNodes.get(conceptId);
    if (!node) return [];

    const dependents: string[] = [];
    for (const dep of node.dependents) {
      dependents.push(dep.dependentId);
      dependents.push(...this.getTransitiveDependents(dep.dependentId, visited));
    }

    return dependents;
  }

  // ==========================================================================
  // Public API - Learning Path Generation
  // ==========================================================================

  /**
   * Generate an optimized learning path based on current gaps and goals
   */
  generateLearningPath(
    strategy:
      | 'breadth_first'
      | 'depth_first'
      | 'keystone_priority'
      | 'gap_priority' = 'gap_priority'
  ): LearningPath {
    const stages: LearningStage[] = [];
    const processedConcepts: Set<string> = new Set();
    const stageNumber = 0;

    switch (strategy) {
      case 'gap_priority':
        // Start with highest priority gaps
        this.buildGapPriorityPath(stages, processedConcepts, stageNumber);
        break;
      case 'keystone_priority':
        // Start with keystone concepts
        this.buildKeystonePriorityPath(stages, processedConcepts, stageNumber);
        break;
      case 'breadth_first':
        // Cover all systems broadly
        this.buildBreadthFirstPath(stages, processedConcepts, stageNumber);
        break;
      case 'depth_first':
        // Master one system at a time
        this.buildDepthFirstPath(stages, processedConcepts, stageNumber);
        break;
    }

    const totalConcepts = stages.reduce((sum, s) => sum + s.concepts.length, 0);
    const estimatedHours = stages.reduce((sum, s) => sum + s.estimatedHours, 0);

    this.currentLearningPath = {
      userId: 'current',
      generatedAt: new Date(),
      stages,
      totalConcepts,
      estimatedHours,
      currentStage: 0,
      completedConcepts: [],
      optimizationStrategy: strategy,
      efficiencyScore: this.calculateEfficiencyScore(stages),
    };

    this.saveToStorage();
    return this.currentLearningPath;
  }

  private buildGapPriorityPath(
    stages: LearningStage[],
    processed: Set<string>,
    stageNum: number
  ): void {
    // Stage 1: Critical gaps and their prerequisites
    const criticalGaps = this.knowledgeGaps.filter((g) => g.severity === 'critical');
    if (criticalGaps.length > 0) {
      const concepts = this.getPrerequisitesFirst(
        criticalGaps.map((g) => g.conceptId),
        processed
      );
      if (concepts.length > 0) {
        stages.push({
          stageNumber: ++stageNum,
          title: 'Critical Gaps',
          description: 'Address critical knowledge gaps first to unblock other learning',
          concepts,
          estimatedHours: concepts.length * 2,
          prerequisitesRequired: [],
          unlocksNext: this.getDirectDependents(concepts),
        });
        concepts.forEach((c) => processed.add(c));
      }
    }

    // Stage 2: Significant gaps
    const significantGaps = this.knowledgeGaps.filter((g) => g.severity === 'significant');
    if (significantGaps.length > 0) {
      const concepts = this.getPrerequisitesFirst(
        significantGaps.map((g) => g.conceptId),
        processed
      );
      if (concepts.length > 0) {
        stages.push({
          stageNumber: ++stageNum,
          title: 'Significant Gaps',
          description: 'Shore up significant knowledge gaps',
          concepts,
          estimatedHours: concepts.length * 1.5,
          prerequisitesRequired: stages[0]?.concepts || [],
          unlocksNext: this.getDirectDependents(concepts),
        });
        concepts.forEach((c) => processed.add(c));
      }
    }

    // Stage 3: Moderate gaps
    const moderateGaps = this.knowledgeGaps.filter(
      (g) => g.severity === 'moderate' || g.severity === 'minor'
    );
    if (moderateGaps.length > 0) {
      const concepts = this.getPrerequisitesFirst(
        moderateGaps.map((g) => g.conceptId),
        processed
      );
      if (concepts.length > 0) {
        stages.push({
          stageNumber: ++stageNum,
          title: 'Polish & Refine',
          description: 'Address remaining gaps for comprehensive coverage',
          concepts,
          estimatedHours: concepts.length * 1,
          prerequisitesRequired: stages[stages.length - 1]?.concepts || [],
          unlocksNext: this.getDirectDependents(concepts),
        });
        concepts.forEach((c) => processed.add(c));
      }
    }
  }

  private buildKeystonePriorityPath(
    stages: LearningStage[],
    processed: Set<string>,
    stageNum: number
  ): void {
    const keystones = this.getKeystoneConcepts(20);

    // Group by impact tiers
    const highImpact = keystones.filter((k) => k.totalImpact >= 10);
    const mediumImpact = keystones.filter((k) => k.totalImpact >= 5 && k.totalImpact < 10);
    const lowImpact = keystones.filter((k) => k.totalImpact < 5);

    for (const [tier, label, desc] of [
      [highImpact, 'High-Impact Foundations', 'These concepts unlock the most other topics'],
      [mediumImpact, 'Building Blocks', 'Important concepts that enable multiple conditions'],
      [lowImpact, 'Refinement', 'Smaller impact but still valuable keystones'],
    ] as const) {
      if (tier.length > 0) {
        const concepts = this.getPrerequisitesFirst(
          tier.map((k) => k.conceptId),
          processed
        );
        if (concepts.length > 0) {
          stages.push({
            stageNumber: ++stageNum,
            title: label,
            description: desc,
            concepts,
            estimatedHours: concepts.length * 1.5,
            prerequisitesRequired: stages[stages.length - 1]?.concepts || [],
            unlocksNext: tier.flatMap((k) => k.directUnlocks),
          });
          concepts.forEach((c) => processed.add(c));
        }
      }
    }
  }

  private buildBreadthFirstPath(
    stages: LearningStage[],
    processed: Set<string>,
    stageNum: number
  ): void {
    // Cover foundations across all systems first
    const foundations: string[] = [];
    for (const foundationList of Object.values(SYSTEM_FOUNDATIONS)) {
      foundations.push(...foundationList.slice(0, 2)); // First 2 from each system
    }

    const uniqueFoundations = [...new Set(foundations)].filter((f) => !processed.has(f));
    if (uniqueFoundations.length > 0) {
      stages.push({
        stageNumber: ++stageNum,
        title: 'Cross-System Foundations',
        description: 'Build foundational knowledge across all organ systems',
        concepts: uniqueFoundations,
        estimatedHours: uniqueFoundations.length * 2,
        prerequisitesRequired: [],
        unlocksNext: this.getDirectDependents(uniqueFoundations),
      });
      uniqueFoundations.forEach((c) => processed.add(c));
    }

    // Then clinical conditions across all systems
    const clinicalConcepts = Array.from(this.conceptNodes.values())
      .filter((n) => n.category === 'clinical' && !processed.has(n.conceptId))
      .map((n) => n.conceptId)
      .slice(0, 30);

    if (clinicalConcepts.length > 0) {
      stages.push({
        stageNumber: ++stageNum,
        title: 'Core Clinical Conditions',
        description: 'Learn key clinical conditions across all systems',
        concepts: clinicalConcepts,
        estimatedHours: clinicalConcepts.length * 1.5,
        prerequisitesRequired: uniqueFoundations,
        unlocksNext: this.getDirectDependents(clinicalConcepts),
      });
      clinicalConcepts.forEach((c) => processed.add(c));
    }
  }

  private buildDepthFirstPath(
    stages: LearningStage[],
    processed: Set<string>,
    stageNum: number
  ): void {
    // Focus on one system at a time, starting with weakest
    const systemMastery = this.calculateSystemMastery();
    const sortedSystems = Object.entries(systemMastery)
      .sort(([, a], [, b]) => a - b)
      .map(([system]) => system);

    for (const system of sortedSystems.slice(0, 3)) {
      // Focus on 3 weakest systems
      const systemConcepts = Array.from(this.conceptNodes.values())
        .filter((n) => n.system === system && !processed.has(n.conceptId))
        .sort((a, b) => b.foundationalScore - a.foundationalScore)
        .map((n) => n.conceptId);

      if (systemConcepts.length > 0) {
        // Split into foundation and clinical stages
        const foundations = systemConcepts.filter((c) => {
          const node = this.conceptNodes.get(c);
          return node?.category === 'basic_science';
        });

        const clinical = systemConcepts.filter((c) => {
          const node = this.conceptNodes.get(c);
          return node?.category !== 'basic_science';
        });

        if (foundations.length > 0) {
          stages.push({
            stageNumber: ++stageNum,
            title: `${this.formatConceptName(system)} Foundations`,
            description: `Master the foundational science of the ${system} system`,
            concepts: foundations,
            estimatedHours: foundations.length * 2,
            prerequisitesRequired: [],
            unlocksNext: clinical,
          });
          foundations.forEach((c) => processed.add(c));
        }

        if (clinical.length > 0) {
          stages.push({
            stageNumber: ++stageNum,
            title: `${this.formatConceptName(system)} Conditions`,
            description: `Apply foundations to clinical conditions`,
            concepts: clinical,
            estimatedHours: clinical.length * 1.5,
            prerequisitesRequired: foundations,
            unlocksNext: [],
          });
          clinical.forEach((c) => processed.add(c));
        }
      }
    }
  }

  private getPrerequisitesFirst(conceptIds: string[], processed: Set<string>): string[] {
    const result: string[] = [];
    const toProcess = [...conceptIds];

    while (toProcess.length > 0) {
      const conceptId = toProcess.shift()!;
      if (processed.has(conceptId) || result.includes(conceptId)) continue;

      const node = this.conceptNodes.get(conceptId);
      if (!node) continue;

      // Check if all prerequisites are processed
      const unmetPrereqs = node.prerequisites
        .filter((p) => p.relationshipType === 'hard_prerequisite')
        .filter((p) => !processed.has(p.prerequisiteId) && !result.includes(p.prerequisiteId))
        .map((p) => p.prerequisiteId);

      if (unmetPrereqs.length > 0) {
        // Add prerequisites first
        toProcess.unshift(conceptId); // Re-add current to process later
        toProcess.unshift(...unmetPrereqs);
      } else {
        result.push(conceptId);
      }
    }

    return result;
  }

  private getDirectDependents(conceptIds: string[]): string[] {
    const dependents: Set<string> = new Set();
    for (const conceptId of conceptIds) {
      const node = this.conceptNodes.get(conceptId);
      if (node) {
        for (const dep of node.dependents) {
          dependents.add(dep.dependentId);
        }
      }
    }
    return [...dependents];
  }

  private calculateSystemMastery(): Record<string, number> {
    const systemMastery: Record<string, { total: number; count: number }> = {};

    for (const [conceptId, mastery] of this.masteryEstimates) {
      const node = this.conceptNodes.get(conceptId);
      if (!node) continue;

      if (!systemMastery[node.system]) {
        systemMastery[node.system] = { total: 0, count: 0 };
      }
      systemMastery[node.system].total += mastery;
      systemMastery[node.system].count++;
    }

    const result: Record<string, number> = {};
    for (const [system, data] of Object.entries(systemMastery)) {
      result[system] = data.count > 0 ? data.total / data.count : 50;
    }

    return result;
  }

  private calculateEfficiencyScore(stages: LearningStage[]): number {
    if (stages.length === 0) return 50;

    // Score based on:
    // 1. Prerequisite ordering (are prereqs before dependents?)
    // 2. Gap coverage (are gaps addressed?)
    // 3. Keystone coverage (are high-impact concepts included?)

    let score = 70; // Base score

    // Check prerequisite ordering
    const processed: Set<string> = new Set();
    let orderingViolations = 0;
    for (const stage of stages) {
      for (const conceptId of stage.concepts) {
        const node = this.conceptNodes.get(conceptId);
        if (node) {
          for (const prereq of node.prerequisites) {
            if (
              prereq.relationshipType === 'hard_prerequisite' &&
              !processed.has(prereq.prerequisiteId)
            ) {
              orderingViolations++;
            }
          }
        }
        processed.add(conceptId);
      }
    }
    score -= orderingViolations * 5;

    // Check gap coverage
    const stageConcepts = new Set(stages.flatMap((s) => s.concepts));
    const coveredGaps = this.knowledgeGaps.filter((g) => stageConcepts.has(g.conceptId));
    const gapCoverageRatio =
      this.knowledgeGaps.length > 0 ? coveredGaps.length / this.knowledgeGaps.length : 1;
    score += gapCoverageRatio * 15;

    // Check keystone coverage
    const keystones = this.getKeystoneConcepts(10);
    const coveredKeystones = keystones.filter((k) => stageConcepts.has(k.conceptId));
    const keystoneCoverageRatio =
      keystones.length > 0 ? coveredKeystones.length / keystones.length : 1;
    score += keystoneCoverageRatio * 15;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private updateNodeReadiness(): void {
    for (const node of this.conceptNodes.values()) {
      const mastery = this.masteryEstimates.get(node.conceptId) || 50;
      node.masteryEstimate = mastery;

      const blockedBy: string[] = [];
      for (const prereq of node.prerequisites) {
        if (prereq.relationshipType === 'hard_prerequisite') {
          const prereqMastery = this.masteryEstimates.get(prereq.prerequisiteId) || 50;
          if (prereqMastery < 60) {
            blockedBy.push(prereq.prerequisiteId);
          }
        }
      }

      node.blockedBy = blockedBy;
      node.prerequisitesMet = blockedBy.length === 0;
      node.readyToLearn = blockedBy.length === 0 && mastery < 80;
    }
  }

  // ==========================================================================
  // Public API - Getters
  // ==========================================================================

  getKnowledgeGaps(): KnowledgeGap[] {
    return [...this.knowledgeGaps];
  }

  getCriticalGaps(): KnowledgeGap[] {
    return this.knowledgeGaps.filter(
      (g) => g.severity === 'critical' || g.severity === 'significant'
    );
  }

  getConceptNode(conceptId: string): ConceptNode | undefined {
    return this.conceptNodes.get(conceptId);
  }

  getAllConceptNodes(): ConceptNode[] {
    return Array.from(this.conceptNodes.values());
  }

  getPrerequisitesFor(conceptId: string): ConceptDependency[] {
    const node = this.conceptNodes.get(conceptId);
    return node?.prerequisites || [];
  }

  getDependentsOf(conceptId: string): ConceptDependency[] {
    const node = this.conceptNodes.get(conceptId);
    return node?.dependents || [];
  }

  getCurrentLearningPath(): LearningPath | null {
    return this.currentLearningPath;
  }

  getReadyConcepts(): ConceptNode[] {
    return Array.from(this.conceptNodes.values()).filter((n) => n.readyToLearn);
  }

  // ==========================================================================
  // Storage Management
  // ==========================================================================

  private loadFromStorage(): void {
    try {
      // Load mastery estimates
      const masteryStr = localStorage.getItem(STORAGE_KEYS.MASTERY_ESTIMATES);
      if (masteryStr) {
        const mastery: Record<string, number> = JSON.parse(masteryStr);
        for (const [key, value] of Object.entries(mastery)) {
          this.masteryEstimates.set(key, value);
        }
      }

      // Load knowledge gaps
      const gapsStr = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE_GAPS);
      if (gapsStr) {
        this.knowledgeGaps = JSON.parse(gapsStr).map((g: KnowledgeGap) => ({
          ...g,
          evidence: g.evidence.map((e) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          })),
        }));
      }

      // Load learning path
      const pathStr = localStorage.getItem(STORAGE_KEYS.LEARNING_PATH);
      if (pathStr) {
        this.currentLearningPath = JSON.parse(pathStr);
        if (this.currentLearningPath) {
          this.currentLearningPath.generatedAt = new Date(this.currentLearningPath.generatedAt);
        }
      }

      // Update node readiness based on loaded mastery
      this.updateNodeReadiness();
    } catch (e) {
      console.warn('[ConceptDependencyService] Failed to load from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      // Save mastery estimates
      const mastery: Record<string, number> = {};
      for (const [key, value] of this.masteryEstimates) {
        mastery[key] = value;
      }
      localStorage.setItem(STORAGE_KEYS.MASTERY_ESTIMATES, JSON.stringify(mastery));

      // Save knowledge gaps
      localStorage.setItem(STORAGE_KEYS.KNOWLEDGE_GAPS, JSON.stringify(this.knowledgeGaps));

      // Save learning path
      if (this.currentLearningPath) {
        localStorage.setItem(STORAGE_KEYS.LEARNING_PATH, JSON.stringify(this.currentLearningPath));
      }
    } catch (e) {
      console.warn('[ConceptDependencyService] Failed to save to storage:', e);
    }
  }

  clearAllData(): void {
    this.knowledgeGaps = [];
    this.currentLearningPath = null;
    this.masteryEstimates.clear();

    localStorage.removeItem(STORAGE_KEYS.KNOWLEDGE_GAPS);
    localStorage.removeItem(STORAGE_KEYS.LEARNING_PATH);
    localStorage.removeItem(STORAGE_KEYS.MASTERY_ESTIMATES);

    // Re-initialize with default readiness
    this.updateNodeReadiness();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const conceptDependencyService = new ConceptDependencyService();

// Export class for testing
export { ConceptDependencyService };
