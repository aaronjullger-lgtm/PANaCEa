/**
 * 3D Anatomy Model Types
 * 
 * Type definitions for the NIH 3D Print Exchange and other model sources
 * for the anatomy model viewer feature.
 */

// Supported 3D model file formats
export type ModelFormat = 'glb' | 'gltf' | 'obj' | 'stl' | 'fbx';

// Body systems for anatomy models
export type AnatomySystem = 
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'nervous'
  | 'musculoskeletal'
  | 'integumentary'
  | 'endocrine'
  | 'lymphatic'
  | 'reproductive'
  | 'urinary';

// Citation information for NIH models
export interface NIHCitation {
  source: 'NIH 3D Print Exchange' | 'NLM Visible Human' | 'Custom';
  modelId: string;
  title: string;
  author?: string;
  institution?: string;
  license: string;
  url: string;
  dateAccessed: string;
  citationText: string;
}

// 3D Model metadata
export interface AnatomyModel {
  id: string;
  name: string;
  description: string;
  system: AnatomySystem;
  structures: string[]; // List of anatomical structures in the model
  
  // Model files
  modelUrl: string;
  format: ModelFormat;
  thumbnailUrl?: string;
  
  // Citation
  citation: NIHCitation;
  
  // Educational content
  clinicalRelevance?: string[];
  relatedConditions?: string[];
  annotations?: ModelAnnotation[];
  
  // Model properties
  scale: number;
  defaultRotation: [number, number, number];
  highlightableStructures: string[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Annotations for specific points on the model
export interface ModelAnnotation {
  id: string;
  structureName: string;
  position: [number, number, number]; // x, y, z coordinates
  label: string;
  description: string;
  clinicalNote?: string;
}

// Model viewer state
export interface ModelViewerState {
  modelId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Camera/view state
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  zoom: number;
  
  // Interaction state
  selectedStructure: string | null;
  highlightedStructures: string[];
  visibleAnnotations: string[];
  
  // Display settings
  wireframe: boolean;
  showAnnotations: boolean;
  autoRotate: boolean;
  backgroundColor: string;
}

// Available models catalog
export interface ModelCatalog {
  systems: {
    [K in AnatomySystem]: AnatomyModel[];
  };
  totalModels: number;
  lastUpdated: string;
}

// Viewer configuration
export interface ViewerConfig {
  enableRotation: boolean;
  enableZoom: boolean;
  enablePan: boolean;
  showStats: boolean;
  antialias: boolean;
  shadowMap: boolean;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
}

// Export defaults
export const DEFAULT_VIEWER_CONFIG: ViewerConfig = {
  enableRotation: true,
  enableZoom: true,
  enablePan: true,
  showStats: false,
  antialias: true,
  shadowMap: true,
  ambientLightIntensity: 0.6,
  directionalLightIntensity: 0.8,
};

export const DEFAULT_VIEWER_STATE: Omit<ModelViewerState, 'modelId'> = {
  isLoading: false,
  error: null,
  cameraPosition: [0, 0, 5],
  cameraTarget: [0, 0, 0],
  zoom: 1,
  selectedStructure: null,
  highlightedStructures: [],
  visibleAnnotations: [],
  wireframe: false,
  showAnnotations: true,
  autoRotate: false,
  backgroundColor: '#1a1a2e',
};

// NIH 3D Print Exchange base URLs
export const NIH_3D_BASE_URL = 'https://3d.nih.gov';
export const NIH_MODEL_API = 'https://3d.nih.gov/api/v2';
