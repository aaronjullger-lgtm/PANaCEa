/**
 * Anatomy Components Index
 * 
 * Central export for 3D anatomy model viewing components
 */

export { AnatomyModelViewer, default as AnatomyModelViewerDefault } from './AnatomyModelViewer';
export { default as InteractiveDiagram } from './InteractiveDiagram';

// Re-export types and service for convenience
export type {
  AnatomyModel,
  AnatomySystem,
  ModelAnnotation,
  NIHCitation,
  ViewerConfig,
  ModelCatalog,
} from '../../types/anatomy-model';

export { anatomyModelService } from '../../services/anatomyModelService';
