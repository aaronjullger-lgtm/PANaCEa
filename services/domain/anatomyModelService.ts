/**
 * Anatomy Model Service
 *
 * Database-first service for loading and managing 3D anatomy models.
 * Models are stored in PostgreSQL via Prisma and served from Supabase Storage.
 *
 * Architecture:
 * - Database: Anatomy3DModel table stores metadata, camera positions, clinical pearls
 * - Storage: GLB files hosted on Supabase Storage (never store blobs in DB)
 * - API: /api/anatomy/models and /api/anatomy/[id] endpoints
 */

import type {
  AnatomyModel,
  AnatomySystem,
  ModelCatalog,
  NIHCitation,
  ModelAnnotation,
} from '@/types/anatomy-model';

// Map database enum to type system
export type AnatomySystem3D =
  | 'SKELETAL'
  | 'MUSCULAR'
  | 'NERVOUS'
  | 'CARDIOVASCULAR'
  | 'RESPIRATORY'
  | 'DIGESTIVE'
  | 'REPRODUCTIVE'
  | 'ENDOCRINE'
  | 'LYMPHATIC'
  | 'INTEGUMENTARY'
  | 'URINARY';

// Database model type (matches Prisma schema)
export interface Anatomy3DModelDB {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  system: AnatomySystem3D;
  fileUrl: string;
  thumbnailUrl?: string;
  format: string;
  fileSize?: number;
  isCompressed: boolean;
  cameraPosition?: { x: number; y: number; z: number };
  cameraTarget?: { x: number; y: number; z: number };
  defaultZoom?: number;
  structures: string[];
  highlightableRegions?: Record<string, any>;
  clinicalPearls: string[];
  clinicalRelevance: string[];
  sourceId?: string;
  sourceName?: string;
  sourceUrl?: string;
  license?: string;
  author?: string;
  institution?: string;
  isHighYield: boolean;
  panceYield?: number;
  boardYieldFacts: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelatedCondition {
  id: string;
  name: string;
  displayName?: string;
  system: string;
  clinicalContext?: string;
  viewingHint?: string;
  highlightRegions?: string[];
}

export interface ModelWithRelations extends Anatomy3DModelDB {
  citation: NIHCitation;
  relatedConditions?: RelatedCondition[];
}

// Sample fallback models for when database is empty or unavailable
const FALLBACK_MODELS: Partial<Record<AnatomySystem, AnatomyModel[]>> = {
  cardiovascular: [
    {
      id: 'heart-basic',
      name: 'Human Heart - Basic Anatomy',
      description:
        'Detailed 3D model of the human heart showing all four chambers, valves, and major vessels.',
      system: 'cardiovascular',
      structures: [
        'left atrium',
        'right atrium',
        'left ventricle',
        'right ventricle',
        'aorta',
        'pulmonary artery',
      ],
      modelUrl: '/models/heart-basic.glb',
      format: 'glb',
      thumbnailUrl: '/thumbnails/heart-basic.png',
      citation: {
        source: 'NIH 3D Print Exchange',
        modelId: '3DPX-001234',
        title: 'Human Heart Model',
        author: 'NIH 3D Print Exchange',
        institution: 'National Institutes of Health',
        license: 'Public Domain',
        url: 'https://3d.nih.gov/entries/3DPX-001234',
        dateAccessed: new Date().toISOString().split('T')[0],
        citationText:
          'NIH 3D Print Exchange. Human Heart Model. https://3d.nih.gov/entries/3DPX-001234.',
      },
      clinicalRelevance: ['Coronary artery disease', 'Valve pathology', 'Cardiac surgery planning'],
      relatedConditions: ['myocardial-infarction', 'heart-failure'],
      scale: 1,
      defaultRotation: [0, 0, 0],
      highlightableStructures: ['left atrium', 'right atrium', 'left ventricle', 'right ventricle'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

class AnatomyModelService {
  private modelCache: Map<string, AnatomyModel> = new Map();
  private catalogCache: ModelCatalog | null = null;
  private catalogCacheTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch models from the API with optional filters
   */
  async fetchModelsFromAPI(
    options: {
      system?: string;
      highYieldOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ models: Anatomy3DModelDB[]; total: number; systems: any[] }> {
    try {
      const params = new URLSearchParams();
      if (options.system) params.set('system', options.system);
      if (options.highYieldOnly) params.set('highYield', 'true');
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.offset) params.set('offset', options.offset.toString());

      const response = await fetch(`/api/anatomy/models?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch models');
      }

      return {
        models: data.data.models || [],
        total: data.data.pagination?.total || 0,
        systems: data.data.filters?.systems || [],
      };
    } catch (error) {
      console.error('Error fetching models from API:', error);
      return { models: [], total: 0, systems: [] };
    }
  }

  /**
   * Get all available models by system (database-first with fallback)
   */
  async getModelCatalog(): Promise<ModelCatalog> {
    // Check cache
    if (this.catalogCache && Date.now() - this.catalogCacheTime < this.CACHE_TTL) {
      return this.catalogCache;
    }

    try {
      const { models, systems } = await this.fetchModelsFromAPI({ limit: 100 });

      if (models.length === 0) {
        // Return fallback if database is empty
        return this.getFallbackCatalog();
      }

      // Group models by system
      const groupedSystems: Partial<Record<AnatomySystem, AnatomyModel[]>> = {};

      for (const model of models) {
        const systemKey = model.system.toLowerCase() as AnatomySystem;
        if (!groupedSystems[systemKey]) {
          groupedSystems[systemKey] = [];
        }
        groupedSystems[systemKey]!.push(this.dbModelToAnatomyModel(model));
      }

      const catalog: ModelCatalog = {
        systems: groupedSystems as Record<AnatomySystem, AnatomyModel[]>,
        totalModels: models.length,
        lastUpdated: new Date().toISOString(),
      };

      // Cache the catalog
      this.catalogCache = catalog;
      this.catalogCacheTime = Date.now();

      return catalog;
    } catch (error) {
      console.error('Error getting model catalog:', error);
      return this.getFallbackCatalog();
    }
  }

  /**
   * Get fallback catalog when database is unavailable
   */
  private getFallbackCatalog(): ModelCatalog {
    let totalModels = 0;
    for (const models of Object.values(FALLBACK_MODELS)) {
      if (models) totalModels += models.length;
    }

    return {
      systems: FALLBACK_MODELS as Record<AnatomySystem, AnatomyModel[]>,
      totalModels,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Convert database model to AnatomyModel type
   */
  private dbModelToAnatomyModel(dbModel: Anatomy3DModelDB): AnatomyModel {
    return {
      id: dbModel.id,
      name: dbModel.displayName || dbModel.name,
      description: dbModel.description || '',
      system: dbModel.system.toLowerCase() as AnatomySystem,
      structures: dbModel.structures || [],
      modelUrl: dbModel.fileUrl,
      format: dbModel.format as 'glb' | 'gltf' | 'obj',
      thumbnailUrl: dbModel.thumbnailUrl,
      citation: {
        source: (dbModel.sourceName || 'NIH 3D Print Exchange') as
          | 'NIH 3D Print Exchange'
          | 'NLM Visible Human'
          | 'Custom',
        modelId: dbModel.sourceId,
        title: dbModel.displayName || dbModel.name,
        author: dbModel.author,
        institution: dbModel.institution || 'National Institutes of Health',
        license: dbModel.license || 'Public Domain',
        url: dbModel.sourceUrl || 'https://3d.nih.gov',
        dateAccessed: new Date().toISOString().split('T')[0],
        citationText: `${dbModel.sourceName || 'NIH 3D Print Exchange'}. ${dbModel.displayName || dbModel.name}. ${dbModel.sourceUrl || 'https://3d.nih.gov'}.`,
      },
      clinicalRelevance: dbModel.clinicalRelevance || [],
      relatedConditions: [], // Will be populated from junction table
      scale: 1,
      defaultRotation: [0, 0, 0],
      highlightableStructures: dbModel.structures || [],
      annotations: [],
      createdAt: dbModel.createdAt,
      updatedAt: dbModel.updatedAt,
    };
  }

  /**
   * Get a specific model by ID (database-first)
   */
  async getModel(modelId: string): Promise<AnatomyModel | null> {
    // Check cache first
    if (this.modelCache.has(modelId)) {
      return this.modelCache.get(modelId)!;
    }

    try {
      const response = await fetch(`/api/anatomy/${modelId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return this.getFallbackModel(modelId);
        }
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        return this.getFallbackModel(modelId);
      }

      const model = this.dbModelToAnatomyModel(data.data.model);

      // Add related conditions if available
      if (data.data.relatedConditions) {
        model.relatedConditions = data.data.relatedConditions.map((c: RelatedCondition) => c.id);
      }

      // Cache the model
      this.modelCache.set(modelId, model);

      return model;
    } catch (error) {
      console.error('Error getting model:', error);
      return this.getFallbackModel(modelId);
    }
  }

  /**
   * Get fallback model by ID
   */
  private getFallbackModel(modelId: string): AnatomyModel | null {
    for (const models of Object.values(FALLBACK_MODELS)) {
      if (models) {
        const model = models.find((m) => m.id === modelId);
        if (model) {
          this.modelCache.set(modelId, model);
          return model;
        }
      }
    }
    return null;
  }

  /**
   * Get models for a specific system
   */
  async getModelsBySystem(system: AnatomySystem): Promise<AnatomyModel[]> {
    try {
      const { models } = await this.fetchModelsFromAPI({
        system: system.toUpperCase(),
        limit: 50,
      });

      if (models.length === 0) {
        return FALLBACK_MODELS[system] || [];
      }

      return models.map((m) => this.dbModelToAnatomyModel(m));
    } catch (error) {
      console.error('Error getting models by system:', error);
      return FALLBACK_MODELS[system] || [];
    }
  }

  /**
   * Get models related to a specific condition
   */
  async getModelsForCondition(conditionId: string): Promise<AnatomyModel[]> {
    try {
      // The API will need to support condition filtering
      // For now, search through cached models
      const catalog = await this.getModelCatalog();
      const relatedModels: AnatomyModel[] = [];

      for (const models of Object.values(catalog.systems)) {
        if (models) {
          for (const model of models) {
            if (model.relatedConditions?.includes(conditionId)) {
              relatedModels.push(model);
            }
          }
        }
      }

      return relatedModels;
    } catch (error) {
      console.error('Error getting models for condition:', error);
      return [];
    }
  }

  /**
   * Generate a properly formatted citation for a model
   */
  generateCitation(model: AnatomyModel, format: 'AMA' | 'APA' | 'MLA' = 'AMA'): string {
    const { citation } = model;
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    switch (format) {
      case 'AMA':
        return `${citation.author || citation.institution}. ${citation.title}. ${citation.source}. ${citation.url}. Accessed ${date}.`;

      case 'APA':
        return `${citation.author || citation.institution}. (${new Date().getFullYear()}). ${citation.title}. ${citation.source}. Retrieved ${date}, from ${citation.url}`;

      case 'MLA':
        return `"${citation.title}." ${citation.source}, ${citation.institution}, ${citation.url}. Accessed ${date}.`;

      default:
        return citation.citationText?.replace('[DATE]', date) || '';
    }
  }

  /**
   * Get annotations for a specific structure within a model
   */
  async getStructureAnnotations(
    modelId: string,
    structureName: string
  ): Promise<ModelAnnotation[]> {
    const model = await this.getModel(modelId);
    if (!model || !model.annotations) {
      return [];
    }

    return model.annotations.filter((a) => a.structureName === structureName);
  }

  /**
   * Search models by keyword
   */
  async searchModels(query: string): Promise<AnatomyModel[]> {
    const catalog = await this.getModelCatalog();
    const results: AnatomyModel[] = [];
    const queryLower = query.toLowerCase();

    for (const models of Object.values(catalog.systems)) {
      if (models) {
        for (const model of models) {
          if (
            model.name.toLowerCase().includes(queryLower) ||
            model.description.toLowerCase().includes(queryLower) ||
            model.structures.some((s) => s.toLowerCase().includes(queryLower))
          ) {
            results.push(model);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get high-yield models only
   */
  async getHighYieldModels(): Promise<AnatomyModel[]> {
    try {
      const { models } = await this.fetchModelsFromAPI({ highYieldOnly: true, limit: 50 });
      return models.map((m) => this.dbModelToAnatomyModel(m));
    } catch (error) {
      console.error('Error getting high-yield models:', error);
      return [];
    }
  }

  /**
   * Preload a model into cache
   */
  async preloadModel(modelId: string): Promise<void> {
    await this.getModel(modelId);
  }

  /**
   * Clear the model cache
   */
  clearCache(): void {
    this.modelCache.clear();
    this.catalogCache = null;
    this.catalogCacheTime = 0;
  }

  /**
   * Get available systems with model counts
   */
  async getSystemCounts(): Promise<{ system: string; count: number }[]> {
    try {
      const { systems } = await this.fetchModelsFromAPI({ limit: 1 });
      return systems;
    } catch (error) {
      console.error('Error getting system counts:', error);
      return [];
    }
  }
}

// Export singleton instance
export const anatomyModelService = new AnatomyModelService();
export default anatomyModelService;
