// ─── RxNorm ───────────────────────────────────────────────────────────────

export interface RxNormDrug {
  rxcui: string;
  name: string;
  synonym: string;
  tty: string;
}

export interface DrugInteraction {
  sourceDrug: RxNormDrug;
  targetDrug: RxNormDrug;
  description: string;
  severity: 'mild' | 'moderate' | 'severe';
  source: string;
}

export interface DrugInteractionResult {
  interactions: DrugInteraction[];
  sourceDrugRxcui: string;
  targetDrugRxcui: string;
}

// ─── UMLS ─────────────────────────────────────────────────────────────────

export interface UMLSConcept {
  cui: string;
  name: string;
  preferredTerm: boolean;
  vocabulary: string;
  semanticTypes: string[];
  definition?: string;
}

export interface UMLSSearchResult {
  results: UMLSConcept[];
  totalResults: number;
}

export interface UMLSCrossReference {
  sourceCode: string;
  sourceVocabulary: string;
  targetCode: string;
  targetVocabulary: string;
  targetName: string;
}

export interface UMLSAuthTicket {
  ticket: string;
  expiresAt: number;
}

// ─── OpenFDA ──────────────────────────────────────────────────────────────

export interface OpenFDADrugLabel {
  id: string;
  brandName: string;
  genericName: string;
  substanceName: string[];
  activeIngredients: { name: string; strength: string }[];
  indicationsAndUsage: string;
  dosageAndAdministration: string;
  warnings: string[];
  adverseReactions: string;
  contraindications: string;
  drugInteractions: string;
  boxedWarning?: string;
}

export interface OpenFDAAdverseEvent {
  safetyreportid: string;
  receivedate: string;
  seriousness: string;
  patientsex: string;
  patientonsetage: string;
  reactionmeddrapt: string[];
  suspectproducts: { prodct: string }[];
}

export interface OpenFDARecall {
  recall_number: string;
  product_description: string;
  recall_reason: string;
  recall_initiation_date: string;
  classification: string;
  product_type: string;
}

export interface OpenFDAQueryResult<T> {
  meta: {
    results: { skip: number; limit: number; total: number };
  };
  results: T[];
}

// ─── Hybrid Search ────────────────────────────────────────────────────────

export interface HybridSearchOptions {
  limit?: number;
  lexicalWeight?: number;
  semanticWeight?: number;
  rrfK?: number;
  contentType?: string;
  system?: string;
}

export interface RankedResult {
  id: string;
  content: string;
  rank: number;
  score: number;
  source: 'lexical' | 'semantic';
}

export interface HybridSearchResult {
  id: string;
  content: string;
  score: number;
  sources: Array<'lexical' | 'semantic'>;
  metadata?: Record<string, unknown>;
}
