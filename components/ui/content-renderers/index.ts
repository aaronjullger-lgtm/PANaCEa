/**
 * Content Renderers
 *
 * Centralized exports for all content rendering components.
 * These components safely handle JSONB fields from the database.
 */

// MarkdownRenderer omitted from barrel — dynamically imported by ContentFieldRenderer.
// Import directly: '@/components/ui/content-renderers/MarkdownRenderer' when needed.

export { BulletListRenderer, ClinicalPearlsList, TreatmentStepsList } from './BulletListRenderer';

export {
  KeyValueRenderer,
  DiagnosticCriteriaRenderer,
  TreatmentProtocolRenderer,
} from './KeyValueRenderer';

export {
  ContentFieldRenderer,
  ClinicalPearlsRenderer,
  DifferentialDiagnosesRenderer,
  ClassicTriadRenderer,
} from './ContentFieldRenderer';

// Re-export types for convenience
export type { ContentFieldValue, FieldRenderType } from '@/types/medical-content';
