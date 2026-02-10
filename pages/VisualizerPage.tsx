/**
 * Visualizer Page - Generate anatomy image (Firefly) and segment (Gemini); overlay clickable masks.
 * Edit mode: conversational image editing (Nano Banana) with thoughtSignature for consistency.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, ImageIcon, Pencil } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

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
  const [mode, setMode] = useState<VisualizerMode>('generate');
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
      const res = await fetch('/api/visualizer/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || json.details || 'Generation failed');
        return;
      }
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
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
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      result.masks.forEach((m, i) => {
        if (!m.mask) return;
        try {
          const maskImg = new Image();
          maskImg.crossOrigin = 'anonymous';
          maskImg.src = m.mask.startsWith('data:') ? m.mask : `data:image/png;base64,${m.mask}`;
          maskImg.onload = () => {
            ctx.globalAlpha = 0.4;
            ctx.drawImage(maskImg, 0, 0);
            ctx.globalAlpha = 1;
          };
        } catch {
          // ignore invalid mask
        }
      });
    };
  }, [result]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <ImageIcon className="w-8 h-8" />
            Anatomy Visualizer
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Generate an anatomy image (Firefly) and segment regions (Gemini), or edit an existing image (conversational edit).
          </p>
        </motion.div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('generate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'generate'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Generate
          </button>
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'edit'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)]'
            }`}
          >
            <Pencil className="w-4 h-4" />
            Edit existing image
          </button>
        </div>

        {mode === 'edit' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 mb-6"
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Conversational image edit</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Upload a diagram (e.g. heart), then describe the edit (e.g. &quot;Show ventricular wall thickening&quot;). Send the previous turn signature for consistency.
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-sm text-[var(--color-text-primary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:text-[var(--color-text-inverse)]"
                  onChange={handleEditFile}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Edit prompt</span>
                <input
                  type="text"
                  placeholder="e.g. Show ventricular wall thickening"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                />
              </label>
              <button
                type="button"
                onClick={runEdit}
                disabled={loading || !editImage || !editPrompt.trim()}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                Apply edit
              </button>
            </div>
            {(editResult?.imageBase64 || editImage) && (
              <div className="mt-4">
                <img
                  src={editResult?.imageBase64 ?? editImage ?? ''}
                  alt="Edited"
                  className="max-h-64 rounded-lg border border-[var(--color-border)] object-contain"
                />
              </div>
            )}
          </motion.div>
        )}

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          {mode === 'generate' && !result && !loading && (
            <button
              type="button"
              onClick={generate}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:opacity-90"
            >
              <ImageIcon className="w-5 h-5" />
              Generate anatomy image
            </button>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin" />
              {mode === 'edit' ? 'Editing…' : 'Generating…'}
            </div>
          )}
          {error && (
            <p className="py-4 text-red-500" role="alert">
              {error}
            </p>
          )}
          {mode === 'generate' && result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4"
            >
              <div className="relative inline-block max-w-full">
                <img
                  ref={imgRef}
                  src={result.imageBase64}
                  alt="Generated anatomy"
                  className="max-h-[70vh] rounded-lg object-contain border border-[var(--color-border)]"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
                  style={{ left: 0, top: 0 }}
                />
              </div>
              {result.masks.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">Segments</h3>
                  <ul className="flex flex-wrap gap-2">
                    {result.masks.map((m, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            hoveredLabel === m.label
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20'
                              : 'border-[var(--color-border)] hover:bg-[var(--color-bg-primary)]'
                          }`}
                          onMouseEnter={() => setHoveredLabel(m.label ?? null)}
                          onMouseLeave={() => setHoveredLabel(null)}
                        >
                          {m.label ?? `Region ${i + 1}`}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {hoveredLabel && (
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                      {hoveredLabel}
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={generate}
                className="mt-4 text-sm text-[var(--color-accent)] hover:underline"
              >
                Generate another
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
