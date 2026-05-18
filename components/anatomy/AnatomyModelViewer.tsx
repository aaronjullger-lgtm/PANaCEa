/**
 * AnatomyModelViewer Component
 *
 * A 3D model viewer for anatomical structures using on-demand Three.js.
 * Designed to display NIH 3D Print Exchange models with proper citations.
 *
 * Features:
 * - Interactive 3D model viewing with rotation, zoom, and pan
 * - Structure highlighting and selection
 * - Annotation display
 * - Citation generation
 * - Loading states with skeletons
 */

import React, { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Rotate3D,
  RotateCcw,
  Info,
  BookOpen,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';
import type {
  AnatomyModel,
  ModelAnnotation,
  ViewerConfig,
  AnatomySystem,
} from '../../types/anatomy-model';
import { DEFAULT_VIEWER_CONFIG } from '../../types/anatomy-model';
import { anatomyModelService } from '@/services/domain/anatomyModelService';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

const LazyAnatomyModelCanvas = React.lazy(async () => {
  const module = await import('./AnatomyModelCanvas');
  return { default: module.AnatomyModelCanvas };
});

const formatAssetSize = (bytes?: number): string => {
  if (!bytes) return 'file size pending';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Skeleton loader for when 3D libraries are loading
const ModelSkeleton = () => (
  <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-secondary)] rounded-xl">
    <div className="flex flex-col items-center gap-4">
      <div className="w-24 h-24 rounded-full bg-[var(--color-bg-tertiary)]/50 animate-pulse" />
      <div className="flex flex-col items-center gap-2">
        <div className="h-4 w-32 bg-[var(--color-bg-tertiary)]/50 rounded animate-pulse" />
        <div className="h-3 w-24 bg-[var(--color-bg-tertiary)]/50 rounded animate-pulse" />
      </div>
    </div>
  </div>
);

// On-demand preview. WebGL is intentionally loaded only after user intent.
const Model3DPlaceholder: React.FC<{
  model: AnatomyModel;
  onLoadModel: () => void;
  canLoadModel: boolean;
}> = ({ model, onLoadModel, canLoadModel }) => {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--color-bg-secondary)]">
      {model.thumbnailUrl ? (
        <img
          src={model.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-45 blur-[1px]"
          aria-hidden="true"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,color-mix(in_srgb,var(--atlas-accent-cyan)_20%,transparent),transparent_42%),linear-gradient(135deg,color-mix(in_srgb,var(--atlas-surface)_92%,transparent),color-mix(in_srgb,var(--atlas-bg)_96%,transparent))]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-8 top-1/2 h-px bg-[var(--atlas-scanner-line)] shadow-[0_0_28px_color-mix(in_srgb,var(--atlas-accent-cyan)_55%,transparent)]"
      />

      <div className="relative z-10 mx-auto max-w-sm px-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--atlas-border-glow)] bg-[var(--atlas-glass)] shadow-[0_0_40px_color-mix(in_srgb,var(--atlas-accent-cyan)_22%,transparent)]">
          <Rotate3D className="h-8 w-8 text-[var(--atlas-accent-cyan)]" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{model.name}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
          {model.structures.length} tagged structures. Load the WebGL scene when you need
          interactive spatial review.
        </p>
        <p className="mt-2 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          {formatAssetSize(model.assetSizeBytes)} · {model.citation.license}
        </p>
        <button
          type="button"
          onClick={onLoadModel}
          disabled={!canLoadModel}
          className="mt-5 rounded-lg border border-[var(--atlas-border-glow)] bg-[var(--atlas-accent-cyan)]/15 px-4 py-2 text-xs font-semibold text-[var(--atlas-accent-cyan)] transition-colors hover:bg-[var(--atlas-accent-cyan)]/24 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--atlas-accent-cyan)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {canLoadModel ? 'Load 3D atlas scene' : '3D file unavailable'}
        </button>
      </div>
    </div>
  );
};

// Structure list sidebar
const StructureList: React.FC<{
  model: AnatomyModel;
  selectedStructure: string | null;
  highlightedStructures: string[];
  onStructureSelect: (structure: string) => void;
  onStructureHighlight: (structure: string, active: boolean) => void;
}> = ({
  model,
  selectedStructure,
  highlightedStructures,
  onStructureSelect,
  onStructureHighlight,
}) => {
  return (
    <div className="bg-[var(--color-bg-secondary)]/50 rounded-xl p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3 flex items-center gap-2">
        <Layers className="w-4 h-4" />
        Structures ({model.structures.length})
      </h3>
      <div className="space-y-1">
        {model.structures.map((structure) => {
          const isSelected = selectedStructure === structure;
          const isHighlighted = highlightedStructures.includes(structure);

          return (
            <button
              type="button"
              key={structure}
              onClick={() => onStructureSelect(structure)}
              onMouseEnter={() => onStructureHighlight(structure, true)}
              onMouseLeave={() => onStructureHighlight(structure, false)}
              onFocus={() => onStructureHighlight(structure, true)}
              onBlur={() => onStructureHighlight(structure, false)}
              aria-pressed={isSelected}
              className={`
                w-full text-left px-3 py-2 rounded-lg text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--atlas-accent-cyan)]
                ${
                  isSelected
                    ? 'bg-[var(--color-data-pass)]/30 text-[var(--color-data-pass)] border border-[var(--color-data-pass)]/50'
                    : isHighlighted
                      ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]/50 hover:text-[var(--color-text-secondary)]'
                }
              `}
            >
              <span className="capitalize">{structure}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Citation panel
const CitationPanel: React.FC<{
  model: AnatomyModel;
  citationFormat: 'AMA' | 'APA' | 'MLA';
  onFormatChange: (format: 'AMA' | 'APA' | 'MLA') => void;
}> = ({ model, citationFormat, onFormatChange }) => {
  const [copied, setCopied] = useState(false);

  const citation = anatomyModelService.generateCitation(model, citationFormat);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [citation]);

  return (
    <div className="bg-[var(--color-bg-secondary)]/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Citation
        </h3>
        <div className="flex gap-1">
          {(['AMA', 'APA', 'MLA'] as const).map((format) => (
            <button
              type="button"
              key={format}
              onClick={() => onFormatChange(format)}
              aria-pressed={citationFormat === format}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${
                  citationFormat === format
                    ? 'bg-[var(--color-data-pass)] text-[var(--color-text-inverse)]'
                    : 'bg-[var(--color-bg-tertiary)]/50 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
                }
              `}
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-primary)]/50 rounded-lg p-3 pr-10 leading-relaxed">
          {citation}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--color-bg-tertiary)]/50 hover:bg-[var(--color-bg-tertiary)] transition-colors"
          aria-label="Copy anatomy model citation"
          title="Copy citation"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-[var(--color-data-pass)]" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          )}
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)]/50 rounded">
            {model.citation.license}
          </span>
          <a
            href={model.citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-data-pass)] hover:text-[var(--color-data-pass)]/80 underline"
          >
            View source<span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>
      </div>
    </div>
  );
};

// Main viewer component props
interface AnatomyModelViewerProps {
  modelId?: string;
  model?: AnatomyModel;
  initialSystem?: AnatomySystem;
  showControls?: boolean;
  showStructureList?: boolean;
  showCitation?: boolean;
  className?: string;
  onStructureSelect?: (structure: string) => void;
  config?: Partial<ViewerConfig>;
}

export const AnatomyModelViewer: React.FC<AnatomyModelViewerProps> = ({
  modelId,
  model: providedModel,
  initialSystem,
  showControls = true,
  showStructureList = true,
  showCitation = true,
  className = '',
  onStructureSelect,
  config: userConfig,
}) => {
  const [model, setModel] = useState<AnatomyModel | null>(providedModel || null);
  const [isLoading, setIsLoading] = useState(!providedModel);
  const [error, setError] = useState<string | null>(null);

  // Viewer state
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [highlightedStructures, setHighlightedStructures] = useState<string[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [citationFormat, setCitationFormat] = useState<'AMA' | 'APA' | 'MLA'>('AMA');
  const [isModelSceneLoaded, setIsModelSceneLoaded] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Config
  const config = { ...DEFAULT_VIEWER_CONFIG, ...userConfig };

  const containerRef = useRef<HTMLDivElement>(null);

  const canLoadModelScene = model?.format === 'glb' || model?.format === 'gltf';
  const hasAnnotations = Boolean(model?.annotations?.length);

  // Load model
  useEffect(() => {
    if (providedModel) {
      setModel(providedModel);
      setIsLoading(false);
      return;
    }

    if (modelId) {
      setIsLoading(true);
      anatomyModelService
        .getModel(modelId)
        .then((loadedModel) => {
          if (loadedModel) {
            setModel(loadedModel);
          } else {
            setError('Model not found');
          }
        })
        .catch((err) => {
          setError('Failed to load model');
          console.error('Model load error:', err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [modelId, providedModel]);

  useEffect(() => {
    setIsModelSceneLoaded(false);
  }, [model?.id]);

  // Handle structure selection
  const handleStructureSelect = useCallback(
    (structure: string) => {
      setSelectedStructure((prev) => (prev === structure ? null : structure));
      onStructureSelect?.(structure);
    },
    [onStructureSelect]
  );

  // Handle structure highlight
  const handleStructureHighlight = useCallback((structure: string, active: boolean) => {
    setHighlightedStructures((prev) =>
      active
        ? prev.includes(structure)
          ? prev
          : [...prev, structure]
        : prev.filter((s) => s !== structure)
    );
  }, []);

  // Reset view
  const handleResetView = useCallback(() => {
    setSelectedStructure(null);
    setHighlightedStructures([]);
    setWireframe(false);
    setAutoRotate(false);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(false));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => setIsFullscreen(Boolean(document.fullscreenElement)));
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={`w-full h-96 ${className}`}>
        <ModelSkeleton />
      </div>
    );
  }

  // Error state
  if (error || !model) {
    return (
      <div
        className={`w-full h-96 flex items-center justify-center bg-[var(--color-bg-secondary)]/50 rounded-xl ${className}`}
      >
        <div className="text-center">
          <Info className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)]">{error || 'No model selected'}</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Select an anatomy model to view
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`bg-[var(--color-bg-primary)] rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-inverse)]">{model.name}</h2>
          <p className="text-xs text-[var(--color-text-muted)] capitalize">{model.system} System</p>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWireframe((prev) => !prev)}
              aria-label="Toggle anatomy wireframe view"
              aria-pressed={wireframe}
              className={`p-2 rounded-lg transition-colors ${
                wireframe
                  ? 'bg-[var(--color-data-pass)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--atlas-accent-cyan)]`}
              title="Toggle wireframe"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setAutoRotate((prev) => !prev)}
              aria-label="Toggle anatomy auto rotation"
              aria-pressed={autoRotate}
              className={`p-2 rounded-lg transition-colors ${
                autoRotate
                  ? 'bg-[var(--color-data-pass)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--atlas-accent-cyan)]`}
              title="Toggle auto-rotate"
            >
              <Rotate3D className="w-4 h-4" />
            </button>
            {hasAnnotations ? (
              <button
                type="button"
                onClick={() => setShowAnnotations((prev) => !prev)}
                aria-label="Toggle anatomy annotations"
                aria-pressed={showAnnotations}
                className={`p-2 rounded-lg transition-colors ${
                  showAnnotations
                    ? 'bg-[var(--color-data-pass)] text-[var(--color-text-inverse)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
                } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--atlas-accent-cyan)]`}
                title="Toggle annotations"
              >
                {showAnnotations ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleResetView}
              aria-label="Reset anatomy model view"
              className="p-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--atlas-accent-cyan)]"
              title="Reset view"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={
                isFullscreen ? 'Exit anatomy fullscreen view' : 'Open anatomy fullscreen view'
              }
              className="p-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--atlas-accent-cyan)]"
              title="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex h-[500px]">
        {/* 3D Viewer */}
        <div className="flex-1 relative">
          {isModelSceneLoaded && canLoadModelScene ? (
            <ErrorBoundary variant="inline">
              <Suspense fallback={<ModelSkeleton />}>
                <LazyAnatomyModelCanvas
                  modelUrl={model.modelUrl}
                  modelName={model.name}
                  scale={model.scale}
                  defaultRotation={model.defaultRotation}
                  autoRotate={autoRotate}
                  wireframe={wireframe}
                  reducedMotion={Boolean(prefersReducedMotion)}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <Model3DPlaceholder
              model={model}
              canLoadModel={canLoadModelScene}
              onLoadModel={() => setIsModelSceneLoaded(true)}
            />
          )}

          {/* Selected structure info */}
          <AnimatePresence>
            {selectedStructure && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                className="absolute bottom-4 left-4 right-4 bg-[var(--color-bg-secondary)]/90 backdrop-blur-sm rounded-xl p-4"
              >
                <h4 className="text-sm font-semibold text-[var(--color-text-inverse)] capitalize mb-1">
                  {selectedStructure}
                </h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Keep this structure in focus while rotating the model or reviewing the citation.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        {showStructureList && (
          <div className="w-64 border-l border-[var(--color-border)] p-4 flex flex-col gap-4 overflow-y-auto">
            <StructureList
              model={model}
              selectedStructure={selectedStructure}
              highlightedStructures={highlightedStructures}
              onStructureSelect={handleStructureSelect}
              onStructureHighlight={handleStructureHighlight}
            />
          </div>
        )}
      </div>

      {/* Citation */}
      {showCitation && (
        <div className="px-4 pb-4">
          <CitationPanel
            model={model}
            citationFormat={citationFormat}
            onFormatChange={setCitationFormat}
          />
        </div>
      )}

      {/* Clinical relevance */}
      {model.clinicalRelevance && model.clinicalRelevance.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-[var(--color-bg-secondary)]/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              Clinical Relevance
            </h3>
            <ul className="space-y-1">
              {model.clinicalRelevance.map((item, idx) => (
                <li
                  key={idx}
                  className="text-xs text-[var(--color-text-muted)] flex items-start gap-2"
                >
                  <span className="text-[var(--color-data-pass)] mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnatomyModelViewer;
