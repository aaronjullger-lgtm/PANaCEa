/**
 * Visualizer Page - Generate anatomy image (Firefly) and segment (Gemini); overlay clickable masks.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ImageIcon } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { BackLink } from '@/components/navigation/BackLink';
import { ROUTES } from '@/config/routes';

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

export const VisualizerPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { getToken } = useAuth();
  useEffect(() => { document.title = 'Visualizer | PANaCEa'; }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse['data'] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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
      const json = (await res.json()) as {
        error?: string;
        details?: string;
        data?: { imageBase64?: string; imageMime?: string; masks?: MaskItem[] };
      };
      if (!res.ok) {
        setError(json.error || json.details || 'Generation failed');
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
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

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
        <BackLink to={ROUTES.STUDY} className="mb-6" />

        <motion.div initial={{ y: 10 }} animate={{ y: 0 }} className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <ImageIcon className="w-8 h-8" />
            Anatomy Visualizer
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Generate an anatomy image (Firefly) and segment regions (Gemini). Click regions for
            labels.
          </p>
        </motion.div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          {!result && !loading && (
            <button
              type="button"
              onClick={generate}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium hover:opacity-90"
            >
              <ImageIcon className="w-5 h-5" />
              Generate anatomy image
            </button>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin" />
              Generating…
            </div>
          )}
          {error && (
            <p className="py-4 text-[var(--color-data-fail)]" role="alert">
              {error}
            </p>
          )}
          {result && (
            <motion.div initial={false} animate={{}} className="mt-4">
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
                  <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
                    Segments
                  </h3>
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
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">{hoveredLabel}</p>
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
