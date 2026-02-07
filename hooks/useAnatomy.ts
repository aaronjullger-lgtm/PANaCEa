/**
 * useAnatomy Hook
 *
 * State management for 3D anatomy model viewer.
 * Handles model selection, camera controls, highlighting, and interactions.
 *
 * Architecture: Separates 3D state logic from rendering components.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// Types for 3D viewer state
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
  fov: number;
}

export interface HighlightRegion {
  id: string;
  name: string;
  color?: string;
  opacity?: number;
}

export interface ViewerSettings {
  autoRotate: boolean;
  rotationSpeed: number;
  wireframe: boolean;
  showAnnotations: boolean;
  showGrid: boolean;
  backgroundColor: string;
  ambientLightIntensity: number;
  directionalLightIntensity: number;
}

export interface Anatomy3DModel {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  system: string;
  fileUrl: string;
  thumbnailUrl?: string;
  format: string;
  structures: string[];
  clinicalPearls: string[];
  clinicalRelevance: string[];
  cameraPosition?: { x: number; y: number; z: number };
  cameraTarget?: { x: number; y: number; z: number };
  defaultZoom?: number;
  sourceName?: string;
  sourceUrl?: string;
  license?: string;
}

export interface UseAnatomyOptions {
  initialModel?: Anatomy3DModel | null;
  defaultCameraPosition?: [number, number, number];
  defaultCameraTarget?: [number, number, number];
  defaultZoom?: number;
  onModelLoad?: (model: Anatomy3DModel) => void;
  onStructureSelect?: (structure: string | null) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_CAMERA: CameraState = {
  position: [0, 2, 5],
  target: [0, 0, 0],
  zoom: 1,
  fov: 50,
};

const DEFAULT_SETTINGS: ViewerSettings = {
  autoRotate: false,
  rotationSpeed: 1,
  wireframe: false,
  showAnnotations: true,
  showGrid: false,
  backgroundColor: 'var(--color-bg-primary)',
  ambientLightIntensity: 0.6,
  directionalLightIntensity: 0.8,
};

export function useAnatomy(options: UseAnatomyOptions = {}) {
  const {
    initialModel = null,
    defaultCameraPosition = DEFAULT_CAMERA.position,
    defaultCameraTarget = DEFAULT_CAMERA.target,
    defaultZoom = DEFAULT_CAMERA.zoom,
    onModelLoad,
    onStructureSelect,
    onError,
  } = options;

  // Model state
  const [currentModel, setCurrentModel] = useState<Anatomy3DModel | null>(initialModel);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  // Camera state
  const [camera, setCamera] = useState<CameraState>({
    ...DEFAULT_CAMERA,
    position: defaultCameraPosition,
    target: defaultCameraTarget,
    zoom: defaultZoom,
  });

  // Selection state
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [highlightedRegions, setHighlightedRegions] = useState<HighlightRegion[]>([]);
  const [hoveredStructure, setHoveredStructure] = useState<string | null>(null);

  // Viewer settings
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);

  // Interaction state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null); // Three.js scene reference

  // Load model from API
  const loadModel = useCallback(
    async (modelId: string) => {
      setIsLoading(true);
      setError(null);
      setLoadProgress(0);

      try {
        const response = await fetch(`/api/anatomy/${modelId}`);

        if (!response.ok) {
          throw new Error(`Failed to load model: ${response.statusText}`);
        }

        const data = (await response.json()) as { model: Anatomy3DModel };
        setCurrentModel(data.model);

        // Apply model's default camera if available
        const model = data.model;
        if (model.cameraPosition) {
          setCamera((prev) => ({
            ...prev,
            position: [
              model.cameraPosition!.x,
              model.cameraPosition!.y,
              model.cameraPosition!.z,
            ],
          }));
        }

        if (model.cameraTarget) {
          setCamera((prev) => ({
            ...prev,
            target: [
              model.cameraTarget!.x,
              model.cameraTarget!.y,
              model.cameraTarget!.z,
            ],
          }));
        }

        if (model.defaultZoom != null) {
          setCamera((prev) => ({
            ...prev,
            zoom: model.defaultZoom ?? prev.zoom,
          }));
        }

        onModelLoad?.(model);
        setLoadProgress(100);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error loading model');
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [onModelLoad, onError]
  );

  // Camera controls
  const zoomIn = useCallback((factor = 0.1) => {
    setCamera((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom + factor, 3),
    }));
  }, []);

  const zoomOut = useCallback((factor = 0.1) => {
    setCamera((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom - factor, 0.3),
    }));
  }, []);

  const resetCamera = useCallback(() => {
    if (currentModel?.cameraPosition && currentModel?.cameraTarget) {
      setCamera({
        position: [
          currentModel.cameraPosition.x,
          currentModel.cameraPosition.y,
          currentModel.cameraPosition.z,
        ],
        target: [
          currentModel.cameraTarget.x,
          currentModel.cameraTarget.y,
          currentModel.cameraTarget.z,
        ],
        zoom: currentModel.defaultZoom || 1,
        fov: 50,
      });
    } else {
      setCamera({
        position: defaultCameraPosition,
        target: defaultCameraTarget,
        zoom: defaultZoom,
        fov: 50,
      });
    }
  }, [currentModel, defaultCameraPosition, defaultCameraTarget, defaultZoom]);

  const setCameraPosition = useCallback((position: [number, number, number]) => {
    setCamera((prev) => ({ ...prev, position }));
  }, []);

  const setCameraTarget = useCallback((target: [number, number, number]) => {
    setCamera((prev) => ({ ...prev, target }));
  }, []);

  // Structure selection
  const selectStructure = useCallback(
    (structureName: string | null) => {
      setSelectedStructure(structureName);
      onStructureSelect?.(structureName);
    },
    [onStructureSelect]
  );

  const toggleStructureHighlight = useCallback((structureName: string, color?: string) => {
    setHighlightedRegions((prev) => {
      const exists = prev.find((r) => r.name === structureName);
      if (exists) {
        return prev.filter((r) => r.name !== structureName);
      }
      return [
        ...prev,
        { id: structureName, name: structureName, color: color || 'var(--color-data-pass)' },
      ];
    });
  }, []);

  const clearHighlights = useCallback(() => {
    setHighlightedRegions([]);
  }, []);

  // Settings controls
  const toggleAutoRotate = useCallback(() => {
    setSettings((prev) => ({ ...prev, autoRotate: !prev.autoRotate }));
  }, []);

  const toggleWireframe = useCallback(() => {
    setSettings((prev) => ({ ...prev, wireframe: !prev.wireframe }));
  }, []);

  const toggleAnnotations = useCallback(() => {
    setSettings((prev) => ({ ...prev, showAnnotations: !prev.showAnnotations }));
  }, []);

  const toggleGrid = useCallback(() => {
    setSettings((prev) => ({ ...prev, showGrid: !prev.showGrid }));
  }, []);

  const updateSettings = useCallback((updates: Partial<ViewerSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Screenshot
  const takeScreenshot = useCallback((): string | null => {
    if (!sceneRef.current?.gl) return null;

    try {
      return sceneRef.current.gl.domElement.toDataURL('image/png');
    } catch (err) {
      console.error('Screenshot error:', err);
      return null;
    }
  }, []);

  // Citation generation
  const generateCitation = useCallback(
    (format: 'AMA' | 'APA' | 'MLA' = 'AMA'): string => {
      if (!currentModel) return '';

      const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const source = currentModel.sourceName || 'NIH 3D Print Exchange';
      const url = currentModel.sourceUrl || 'https://3d.nih.gov';

      switch (format) {
        case 'AMA':
          return `${source}. ${currentModel.name}. ${source}. ${url}. Accessed ${date}.`;
        case 'APA':
          return `${source}. (${new Date().getFullYear()}). ${currentModel.name}. ${source}. Retrieved ${date}, from ${url}`;
        case 'MLA':
          return `"${currentModel.name}." ${source}, ${url}. Accessed ${date}.`;
        default:
          return `${source}. ${currentModel.name}. ${url}. Accessed ${date}.`;
      }
    },
    [currentModel]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          resetCamera();
          break;
        case 'a':
        case 'A':
          e.preventDefault();
          toggleAutoRotate();
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          toggleWireframe();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (selectedStructure) {
            selectStructure(null);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    zoomIn,
    zoomOut,
    resetCamera,
    toggleAutoRotate,
    toggleWireframe,
    toggleFullscreen,
    selectedStructure,
    selectStructure,
  ]);

  // Derived state
  const hasModel = useMemo(() => currentModel !== null, [currentModel]);
  const availableStructures = useMemo(() => currentModel?.structures || [], [currentModel]);
  const clinicalPearls = useMemo(() => currentModel?.clinicalPearls || [], [currentModel]);

  return {
    // Model state
    currentModel,
    setCurrentModel,
    isLoading,
    error,
    loadProgress,
    loadModel,
    hasModel,

    // Camera
    camera,
    setCamera,
    zoomIn,
    zoomOut,
    resetCamera,
    setCameraPosition,
    setCameraTarget,

    // Selection
    selectedStructure,
    selectStructure,
    highlightedRegions,
    toggleStructureHighlight,
    clearHighlights,
    hoveredStructure,
    setHoveredStructure,
    availableStructures,

    // Settings
    settings,
    updateSettings,
    toggleAutoRotate,
    toggleWireframe,
    toggleAnnotations,
    toggleGrid,

    // Viewer state
    isFullscreen,
    toggleFullscreen,
    isDragging,
    setIsDragging,

    // Refs
    containerRef,
    sceneRef,

    // Utilities
    takeScreenshot,
    generateCitation,
    clinicalPearls,
  };
}

export type UseAnatomyReturn = ReturnType<typeof useAnatomy>;
export default useAnatomy;
