/**
 * Content Renderers
 * 
 * Centralized exports for all content rendering components.
 * These components safely handle JSONB fields from the database.
 */

export { MarkdownRenderer } from './MarkdownRenderer';

export { 
  BulletListRenderer, 
  ClinicalPearlsList, 
  TreatmentStepsList 
} from './BulletListRenderer';

export { 
  KeyValueRenderer, 
  DiagnosticCriteriaRenderer, 
  TreatmentProtocolRenderer 
} from './KeyValueRenderer';

export { 
  ContentFieldRenderer,
  ClinicalPearlsRenderer,
  DifferentialDiagnosesRenderer,
  ClassicTriadRenderer,
} from './ContentFieldRenderer';

// Re-export types for convenience
export type { ContentFieldValue, FieldRenderType } from '@/types/medical-content';
