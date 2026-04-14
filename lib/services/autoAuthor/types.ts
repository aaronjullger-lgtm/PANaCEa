/**
 * Auto-Author Types
 *
 * Defines interfaces for AI-generated medical content.
 */

export interface GeneratedConditionContent {
  overview: string;
  clinicalPearls: string[];
  symptoms: string[];
  riskFactors: string[];
  diagnosis: string;
  treatment: string;
  // Extended fields
  etiologyPathophysiology?: string;
  epidemiology?: string;
  examFindings?: string[];
  complications?: string[];
  prognosis?: string;
  differentialDiagnosis?: string[];
}

export interface GeneratedLabContent {
  description: string;
  typicalNormalRange?: string;
  commonAbnormalities: string[];
  indications: string[];
}

export interface GeneratedImagingContent {
  description: string;
  bestFor: string[];
  limitations: string[];
  radiationRisk: boolean;
}

export interface GeneratedTreatmentContent {
  description: string;
  mechanismOfAction: string;
  commonIndications: string[];
  seriousSideEffects: string[];
}

export interface GeneratedPhysiologyContent {
  description: string;
  mechanism: string;
  clinicalSignificance: string;
}

export interface ContentGenerationOptions {
  conditionName: string;
  system: string;
  subcategory?: string;
  temperature?: number;
  includeExtendedFields?: boolean;
}

export interface ContentGenerationResult<T = any> {
  success: boolean;
  content?: T;
  error?: string;
  tokensUsed?: number;
  modelUsed?: string;
  provider?: string;
  latencyMs?: number;
}

export interface AutoAuthorStats {
  total: number;
  generated: number;
  skipped: number;
  failed: number;
  validationFailed: number;
  errors: Array<{ entity: string; error: string }>;
}
