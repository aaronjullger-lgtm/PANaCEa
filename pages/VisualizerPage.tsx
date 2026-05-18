/**
 * Visualizer Page - Generate anatomy visuals and overlay segmentation masks.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, ImageIcon, Layers3, Network, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { AnatomyModelViewer } from '@/components/anatomy/AnatomyModelViewer';
import { NIH_ANATOMY_MODELS } from '@/lib/anatomy/nihAnatomyAssets';
import type { AnatomySystem } from '@/types/anatomy-model';
import {
  WorkspaceEmptyState,
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';

interface MaskItem {
  mask?: string;
  label?: string;
}

interface GenerateResponse {
  data: {
    imageBase64: string;
    imageMime: string;
    masks: MaskItem[];
  };
}

interface EditResponse {
  data: {
    imageBase64: string;
    imageMime: string;
    thoughtSignature?: string;
  };
}

type VisualizerMode = 'generate' | 'edit';
type AtlasSystemFilter = 'all' | AnatomySystem;
const SUPPORTED_ATLAS_SYSTEM_COUNT = 10;

const formatAssetSize = (bytes?: number): string => {
  if (!bytes) return 'Size pending';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const VisualizerPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { getToken } = useAuth();

  useEffect(() => {
    document.title = 'Visualizer | PANaCEa';
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse['data'] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [selectedAtlasModelId, setSelectedAtlasModelId] = useState(NIH_ANATOMY_MODELS[0]?.id ?? '');
  const [atlasSystemFilter, setAtlasSystemFilter] = useState<AtlasSystemFilter>('all');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Edit mode state
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editMime, setEditMime] = useState<string>('image/png');
  const [editPrompt, setEditPrompt] = useState('');
  const [thoughtSignature, setThoughtSignature] = useState<string | undefined>(undefined);
  const [editResult, setEditResult] = useState<EditResponse['data'] | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = await getToken();
      const response = await fetch('/api/visualizer/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });

      const json = (await response.json()) as {
        error?: string;
        details?: string;
        data?: { imageBase64?: string; imageMime?: string; masks?: MaskItem[] };
      };

      if (!response.ok) {
        setError(json.error || json.details || 'Generation failed.');
        return;
      }

      const raw = json.data;
      setResult(
        raw
          ? {
              imageBase64: raw.imageBase64 ?? '',
              imageMime: raw.imageMime ?? 'image/png',
              masks: raw.masks ?? [],
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const runEdit = useCallback(async () => {
    if (!editImage || !editPrompt.trim()) return;
    setLoading(true);
    setError(null);
    setEditResult(null);
    try {
      const token = await getToken();
      const base64 = editImage.replace(/^data:[^;]+;base64,/, '');
      const res = await fetch('/api/visualizer/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: editMime,
          userPrompt: editPrompt.trim(),
          thoughtSignature: thoughtSignature ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || json.details || 'Edit failed');
        return;
      }
      setEditResult(json.data);
      if (json.data?.thoughtSignature) setThoughtSignature(json.data.thoughtSignature);
      setEditImage(json.data?.imageBase64 ?? editImage);
      setEditMime(json.data?.imageMime ?? editMime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [editImage, editMime, editPrompt, thoughtSignature, getToken]);

  const handleEditFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setEditImage(dataUrl);
      setEditMime(file.type || 'image/png');
      setEditResult(null);
      setThoughtSignature(undefined);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (!result?.imageBase64 || !canvasRef.current || !imgRef.current) return;

    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;

    const drawMasks = () => {
      if (disposed) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      result.masks.forEach((maskItem) => {
        if (!maskItem.mask) return;

        const maskImage = new Image();
        maskImage.crossOrigin = 'anonymous';
        maskImage.src = maskItem.mask.startsWith('data:')
          ? maskItem.mask
          : `data:image/png;base64,${maskItem.mask}`;
        maskImage.onload = () => {
          if (disposed) return;
          ctx.globalAlpha = 0.4;
          ctx.drawImage(maskImage, 0, 0);
          ctx.globalAlpha = 1;
        };
      });
    };

    if (img.complete) {
      drawMasks();
    } else {
      img.onload = drawMasks;
    }

    return () => {
      disposed = true;
      img.onload = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [result]);

  const imageSrc =
    result?.imageBase64 && result.imageBase64.startsWith('data:')
      ? result.imageBase64
      : result?.imageBase64
        ? `data:${result.imageMime};base64,${result.imageBase64}`
        : null;

  const atlasSystems = useMemo(
    () => Array.from(new Set(NIH_ANATOMY_MODELS.map((model) => model.system))),
    []
  );
  const uncoveredAtlasSystems = Math.max(0, SUPPORTED_ATLAS_SYSTEM_COUNT - atlasSystems.length);

  const visibleAtlasModels = useMemo(
    () =>
      atlasSystemFilter === 'all'
        ? NIH_ANATOMY_MODELS
        : NIH_ANATOMY_MODELS.filter((model) => model.system === atlasSystemFilter),
    [atlasSystemFilter]
  );

  const selectedAtlasModel =
    NIH_ANATOMY_MODELS.find((model) => model.id === selectedAtlasModelId) ??
    NIH_ANATOMY_MODELS[0] ??
    null;

  const handleAtlasSystemFilter = useCallback(
    (system: AtlasSystemFilter) => {
      setAtlasSystemFilter(system);

      const nextModels =
        system === 'all'
          ? NIH_ANATOMY_MODELS
          : NIH_ANATOMY_MODELS.filter((model) => model.system === system);

      if (!nextModels.some((model) => model.id === selectedAtlasModelId) && nextModels[0]) {
        setSelectedAtlasModelId(nextModels[0].id);
      }
    },
    [selectedAtlasModelId]
  );

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Anatomy Visualizer',
            badgeTone: 'plum',
            title: 'Generate anatomy visuals built for recall.',
            subtitle:
              'Create a fresh anatomy image and review segmented regions — designed for learning, not one-off generation.',
            backLabel: 'Back to Study',
            onBack,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Generation"
            value="One click"
            detail="Creates a new anatomy visual without leaving the study flow."
            icon={Sparkles}
          />
          <WorkspaceMetricCard
            label="Overlay"
            value="Segmented"
            detail="Applies region masks so structures can be reviewed visually."
            accent="var(--atlas-accent-blue)"
            icon={Layers3}
          />
          <WorkspaceMetricCard
            label="Use case"
            value="Spatial recall"
            detail="Best when you need to reconnect a structure with where it lives."
            accent="var(--atlas-accent-violet)"
            icon={Network}
          />
          <WorkspaceMetricCard
            label="3D atlas"
            value={`${NIH_ANATOMY_MODELS.length} scenes`}
            detail={`${atlasSystems.length} organ systems covered; WebGL still loads only when requested.`}
            accent="var(--atlas-accent-cyan)"
            icon={ImageIcon}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Spatial learning
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Use the visualizer when a concept is stuck because you can explain it verbally but
                can’t place it anatomically.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                This tool works best as a reinforcement layer for anatomy-heavy topics, not as a
                replacement for formal reference images.
              </p>
            </div>

            <div className="workspace-subsurface rounded-[1.25rem] p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Strong use cases
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Refresh anatomy before a systems block or practical-style drill.</li>
                <li>Reconnect structures you can name but can’t visually locate.</li>
                <li>Use mask labels as a fast self-quiz after generation.</li>
              </ul>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="3D anatomy atlas scenes"
          subtitle="Inspect licensed NIH 3D models for spatial orientation. WebGL loads only after you request an interactive scene."
        >
          <WorkspaceSurface accent="var(--atlas-accent-cyan)" className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Licensed organ-system atlas library
                </p>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Choose a system, inspect the source metadata, then load WebGL only when the model
                  is worth interactive spatial review.
                </p>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">
                  {atlasSystems.length} of {SUPPORTED_ATLAS_SYSTEM_COUNT} supported systems have
                  compact atlas coverage.{' '}
                  {uncoveredAtlasSystems
                    ? 'Integumentary remains deferred until a lighter licensed skin model is available.'
                    : 'All supported systems have an on-demand scene.'}
                </p>
              </div>

              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter 3D anatomy atlas scenes by organ system"
              >
                <Button
                  type="button"
                  size="xs"
                  variant={atlasSystemFilter === 'all' ? 'accent' : 'outline'}
                  onClick={() => handleAtlasSystemFilter('all')}
                  aria-pressed={atlasSystemFilter === 'all'}
                  icon={Filter}
                >
                  All
                </Button>

                {atlasSystems.map((system) => (
                  <Button
                    key={system}
                    type="button"
                    size="xs"
                    variant={atlasSystemFilter === system ? 'accent' : 'outline'}
                    onClick={() => handleAtlasSystemFilter(system)}
                    aria-pressed={atlasSystemFilter === system}
                    className="capitalize"
                  >
                    {system}
                  </Button>
                ))}
              </div>
            </div>

            <div
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
              aria-label="Available 3D anatomy atlas scenes"
            >
              {visibleAtlasModels.map((model) => {
                const isSelected = selectedAtlasModelId === model.id;

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedAtlasModelId(model.id)}
                    aria-pressed={isSelected}
                    className={`rounded-[1rem] border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--atlas-accent-cyan)] ${
                      isSelected
                        ? 'border-[var(--atlas-border-glow)] bg-[var(--atlas-accent-cyan)]/12 shadow-[0_0_32px_color-mix(in_srgb,var(--atlas-accent-cyan)_12%,transparent)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40 hover:border-[var(--atlas-border-glow)] hover:bg-[var(--color-bg-tertiary)]/50'
                    }`}
                  >
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      {model.system} atlas
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-[var(--color-text-primary)]">
                      {model.name.replace(' - NIH 3D Atlas Model', '')}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-[var(--color-text-secondary)]">
                      {model.structures.length} structure labels ·{' '}
                      {formatAssetSize(model.assetSizeBytes)} · {model.citation.license}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedAtlasModel ? (
              <AnatomyModelViewer
                key={selectedAtlasModel.id}
                model={selectedAtlasModel}
                showStructureList
                showCitation
              />
            ) : (
              <WorkspaceEmptyState
                icon={Network}
                title="No anatomy atlas model selected"
                description="Choose a licensed NIH 3D model to start spatial anatomy review."
              />
            )}
          </WorkspaceSurface>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title="Generation workspace"
          subtitle="Generate a visual, then review the output and structure labels inside the same study shell."
        >
          <WorkspaceSplit className="items-start">
            <WorkspaceSurface accent="var(--atlas-accent-blue)" className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Anatomy image
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    Generate a new visual whenever you need a fresh spatial anchor.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  loading={loading}
                  onClick={generate}
                  icon={loading ? undefined : ImageIcon}
                >
                  {loading ? 'Generating…' : result ? 'Generate another' : 'Generate image'}
                </Button>
              </div>

              {error ? (
                <p className="text-sm text-[var(--color-data-fail)]" role="alert">
                  {error}
                </p>
              ) : null}

              {imageSrc ? (
                <div className="workspace-subsurface relative inline-block max-w-full rounded-[1.25rem] p-3">
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Generated anatomy"
                    className="max-h-[34rem] rounded-xl object-contain"
                  />
                  <canvas
                    ref={canvasRef}
                    className="pointer-events-none absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] rounded-xl"
                  />
                </div>
              ) : (
                <div className="workspace-dashed-state rounded-[1.25rem] p-8 text-sm text-[var(--color-text-secondary)]">
                  The generated anatomy image will appear here.
                </div>
              )}
            </WorkspaceSurface>

            {result?.masks.length ? (
              <WorkspaceSurface accent="var(--atlas-accent-violet)" className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Segmented regions
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    Hover labels as a lightweight self-check after you inspect the image.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {result.masks.map((maskItem, index) => {
                    const label = maskItem.label ?? `Region ${index + 1}`;
                    return (
                      <Button
                        key={`${label}-${index}`}
                        type="button"
                        size="xs"
                        variant={hoveredLabel === label ? 'accent' : 'outline'}
                        onMouseEnter={() => setHoveredLabel(label)}
                        onMouseLeave={() => setHoveredLabel(null)}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>

                <div className="workspace-subsurface rounded-[1.25rem] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Active focus
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                    {hoveredLabel ?? 'Hover a structure label to keep the current focus visible.'}
                  </p>
                </div>
              </WorkspaceSurface>
            ) : (
              <WorkspaceEmptyState
                icon={Layers3}
                title="Generate a visual to unlock segmented labels"
                description="When an image is created, its available region labels will appear here for quick anatomy review."
              />
            )}
          </WorkspaceSplit>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default VisualizerPage;
