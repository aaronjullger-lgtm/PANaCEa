/**
 * Medical Content Type Definitions
 *
 * Shared types for medical content that are safe to import in both client and server code.
 * This file MUST NOT import any server-only dependencies like @prisma/client.
 */

/**
 * Condition data structure returned by conditionDataLoader
 */
export interface ConditionData {
  id: string;
  conditionId: string;
  system: string;
  subcategory?: string | null;
  condition: string;
  relatedSystems?: string[];
  content: any;
  status?: string;
  meta?: Record<string, any>;
}

/**
 * Medical content status enum
 */
export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';

/**
 * Medical Content Display Interface - Used by library components
 * Represents a medical condition with all its clinical information
 */
export interface MedicalContentDisplay {
  id: string;
  condition: string;
  system: string;
  subcategory?: string | null;

  // Yield and priority
  pance_yield?: number | null;
  high_yield?: boolean;

  // Clinical presentation
  classic_patient?: string | null;
  buzzwords?: string[];
  classic_triad?: string[];
  symptoms?: string | string[];
  signs?: string | string[];

  // Diagnostics
  gold_standard_dx?: string | null;
  gold_standard?: string | null;
  best_initial_test?: string | null;
  diagnostics?: string | string[];

  // Treatment
  first_line_rx?: string | null;
  treatment?: string | string[];
  rx_mechanism?: string | null;
  rx_side_effects?: string | null;

  // Additional content
  overview?: string | null;
  epidemiology?: string | null;
  etiology?: string | null;
  pathophysiology?: string | null;
  complications?: string | string[] | null;
  prognosis?: string | null;
  clinical_pearls?: string[];

  // Metadata
  content?: Record<string, unknown>;
  status?: ContentStatus;
  created_at?: string | Date;
  updated_at?: string | Date;

  // Additional clinical fields for library components
  physicalExam?: string | string[] | null;
  patient_education?: string | null;
  riskFactors?: string | string[] | null;
  prevention?: string | null;
  disposition?: string | null;
  mnemonic?: string | null;
  differentialDiagnosis?: string | string[] | null;
  conditionId?: string | null;
  relatedSystems?: string[] | null;
  synonyms?: string[] | null;
}

/**
 * Content Field Value Type
 * Represents any value that can appear in a medical content field
 */
export type ContentFieldValue =
  | string
  | string[]
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>;

/**
 * Field Render Type
 * Determines how a content field should be rendered
 */
export type FieldRenderType = 'empty' | 'markdown' | 'bullet-list' | 'steps' | 'key-value';

/**
 * Determines the appropriate render type for a content field value
 *
 * @param value - The content field value to analyze
 * @returns The appropriate render type for the value
 */
export function getFieldRenderType(value: ContentFieldValue): FieldRenderType {
  // Empty values
  if (value === null || value === undefined || value === '') {
    return 'empty';
  }

  // String arrays -> bullet list
  if (Array.isArray(value)) {
    if (value.length === 0) return 'empty';
    if (value.every((item) => typeof item === 'string')) {
      return 'bullet-list';
    }
    return 'key-value'; // Mixed array, render as key-value
  }

  // Plain strings -> markdown
  if (typeof value === 'string') {
    return 'markdown';
  }

  // Numbers and booleans -> convert to string via markdown
  if (typeof value === 'number' || typeof value === 'boolean') {
    return 'markdown';
  }

  // Objects
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Check for step-based structure (treatment protocols, etc.)
    if ('steps' in obj && Array.isArray(obj.steps)) {
      return 'steps';
    }

    // Check for first_line treatment structure
    if ('first_line' in obj) {
      return 'steps';
    }

    // Default object -> key-value pairs
    return 'key-value';
  }

  return 'markdown'; // Fallback
}
