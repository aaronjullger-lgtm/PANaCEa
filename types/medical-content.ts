/**
 * Medical Content Display Types
 *
 * Type-safe interfaces for rendering medical content from the database.
 * Handles JSONB field parsing and nested content structures.
 */

/**
 * Age demographic information stored as JSONB
 */
export interface AgeDemographic {
  min?: number;
  max?: number;
  notes?: string;
  peak?: string;
}

/**
 * Nested content structure stored in the content JSONB field
 */
export interface NestedContent {
  definition?: string;
  epidemiology?: string;
  diagnosis?: {
    gold_standard?: string;
    initial_test?: string;
    best_initial_test?: string;
    labs?: string[];
    imaging?: string[];
    physical_exam?: string[];
  };
  treatment?: {
    first_line?: string;
    alternatives?: string[];
    mechanism?: string;
    side_effects?: string[];
    duration?: string;
  };
  pearls?: string[];
  complications?: string[];
  prognosis?: string;
  [key: string]: unknown; // Allow additional dynamic fields
}

/**
 * Complete medical content structure matching database schema
 * Includes proper typing for all JSONB fields
 */
export interface MedicalContentDisplay {
  id: string;
  conditionId: string;
  system: string;
  subcategory: string;
  condition: string;

  // Status and versioning
  status: string;
  version: number;
  createdAt: Date | string;
  createdBy: string;
  updatedAt: Date | string;
  updatedBy: string;
  publishedAt?: Date | string | null;
  publishedBy?: string | null;
  approvedAt?: Date | string | null;
  approvedBy?: string | null;

  // Primary text content fields
  overview?: string | null;
  pathophysiology?: string | null;
  epidemiology?: string | null;
  etiology?: string | null;
  symptoms?: string | null;
  physicalExam?: string | null;
  diagnostics?: string | null;
  treatment?: string | null;
  complications?: string | null;
  prognosis?: string | null;
  riskFactors?: string | null;
  differentialDiagnosis?: string | null;

  // Clinical context fields
  classic_patient?: string | null;
  patient_education?: string | null;
  prevention?: string | null;
  disposition?: string | null;
  guidelines?: string | null;

  // Diagnostic fields
  gold_standard_dx?: string | null;
  best_initial_test?: string | null;

  // Treatment fields
  first_line_rx?: string | null;
  rx_mechanism?: string | null;
  rx_side_effects?: string | null;

  // Metadata fields
  image_query?: string | null;
  mnemonic?: string | null;
  pance_yield?: number | null;
  gender_bias?: string | null;

  // Array fields
  relatedSystems?: string[];
  buzzwords?: string[];

  // JSONB fields (need safe parsing)
  clinical_pearls?: string[] | null;
  classic_triad?: string[] | null;
  differentials?: string[] | null;
  synonyms?: string[] | null;
  age_demographic?: AgeDemographic | null;

  // Complex nested content JSONB
  content?: NestedContent | null;
}

/**
 * Utility type for field values that can be in various formats
 */
export type ContentFieldValue = string | string[] | Record<string, unknown> | null | undefined;

/**
 * Type guard to check if a value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Type guard to check if a value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Field renderer type for determining how to display content
 */
export type FieldRenderType =
  | 'markdown' // Plain text/markdown string
  | 'bullet-list' // Array of strings to render as bullets
  | 'key-value' // Object with key-value pairs
  | 'steps' // Ordered treatment steps
  | 'empty'; // Null/undefined value

/**
 * Determines the appropriate render type for a field value
 */
export function getFieldRenderType(value: ContentFieldValue): FieldRenderType {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'string') return 'markdown';
  if (isStringArray(value)) return 'bullet-list';
  if (isPlainObject(value)) {
    // Check if it's a treatment steps object
    if ('first_line' in value || 'steps' in value) return 'steps';
    return 'key-value';
  }
  return 'empty';
}

export default MedicalContentDisplay;
