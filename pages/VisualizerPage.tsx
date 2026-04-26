/**
 * Visualizer Page - Generate anatomy visuals and overlay segmentation masks.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Layers3, Network, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
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

export const VisualizerPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { getToken } = useAuth();

  useEffect(() => {
    document.title = 'Visualizer | PANaCEa';
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse['data'] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

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
            accent="#728ba6"
            icon={Layers3}
          />
          <WorkspaceMetricCard
            label="Use case"
            value="Spatial recall"
            detail="Best when you need to reconnect a structure with where it lives."
            accent="#9a7f9a"
            icon={Network}
          />
          <WorkspaceMetricCard
            label="Output"
            value="Image + labels"
            detail="The visual stays paired with a reviewable set of structure names."
            accent="#b39b6c"
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
          title="Generation workspace"
          subtitle="Generate a visual, then review the output and structure labels inside the same study shell."
        >
          <WorkspaceSplit className="items-start">
            <WorkspaceSurface accent="#728ba6" className="space-y-5">
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
              <WorkspaceSurface accent="#9a7f9a" className="space-y-5">
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
