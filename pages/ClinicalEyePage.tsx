/**
 * Clinical Eye Page - Analyze medical images (e.g. ECGs) with Gemini code execution.
 * Upload image, enter prompt, view reasoning + final answer; optional SVG overlay for bounding box.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Upload, Loader2, Eye } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

interface AnalyzeResponse {
  data: {
    text: string;
    reasoning?: string[];
    boundingBox?: { box_2d: number[]; label: string };
    usageMetadata?: { totalTokenCount?: number };
  };
}

export const ClinicalEyePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { getToken } = useAuth();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse['data'] | null>(null);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        setImageMime(match[1] || 'image/png');
        setImageBase64(match[2] ?? '');
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const analyze = useCallback(async () => {
    if (!imageBase64 || !prompt.trim()) {
      setError('Please upload an image and enter a prompt.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/clinical-eye/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageMime,
          prompt: prompt.trim(),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        details?: string;
        data?: AnalyzeResponse['data'];
      };
      if (!res.ok) {
        setError(json.error || json.details || 'Analysis failed');
        return;
      }
      setResult(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [imageBase64, imageMime, prompt, getToken]);

  const box = result?.boundingBox;
  const box2d = box?.box_2d;
  const hasBox = Array.isArray(box2d) && box2d.length >= 4;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-6 px-4">
      <div className="mx-auto" style={{ maxWidth: 'var(--content-max-width, 72rem)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Eye className="w-8 h-8" />
            Clinical Eye
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Upload a medical image (ECG, X-ray, etc.) and ask for analysis. The model can run code
            for precise measurements.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Image</h2>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-[var(--color-border)] rounded-lg cursor-pointer hover:bg-[var(--color-bg-primary)] transition-colors">
              <Upload className="w-10 h-10 text-[var(--color-text-muted)] mb-2" />
              <span className="text-sm text-[var(--color-text-muted)]">Click or drop image</span>
              <input
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={onFileChange}
              />
            </label>
            {imageBase64 && (
              <div className="mt-3 relative inline-block max-w-full">
                <img
                  id="clinical-eye-img"
                  src={`data:${imageMime};base64,${imageBase64}`}
                  alt="Upload for analysis"
                  className="max-h-64 rounded-lg object-contain border border-[var(--color-border)]"
                />
                {hasBox && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    style={{ left: 0, top: 0 }}
                  >
                    <rect
                      x={box2d[1] ?? 0}
                      y={box2d[0] ?? 0}
                      width={(box2d[3] ?? 0) - (box2d[1] ?? 0)}
                      height={(box2d[2] ?? 0) - (box2d[0] ?? 0)}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth={20}
                    />
                  </svg>
                )}
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Prompt</h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Calculate the ST elevation in Lead V2 in millimeters."
              className="w-full h-28 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none focus:ring-2 focus:ring-[var(--color-accent)]"
              maxLength={4096}
            />
            <button
              onClick={analyze}
              disabled={loading || !imageBase64 || !prompt.trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[var(--color-accent)] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                'Analyze'
              )}
            </button>
            {error && (
              <p className="mt-3 text-sm text-data-fail" role="alert">
                {error}
              </p>
            )}
          </motion.section>
        </div>

        {result && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Result</h2>
            {result.reasoning && result.reasoning.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
                  Reasoning / code trace
                </h3>
                <pre className="text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] p-3 rounded-lg overflow-auto max-h-40 whitespace-pre-wrap">
                  {result.reasoning.join('\n')}
                </pre>
              </div>
            )}
            <div className="prose prose-invert max-w-none">
              <p className="text-[var(--color-text-primary)] whitespace-pre-wrap">{result.text}</p>
            </div>
            {result.boundingBox?.label && (
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Label: {result.boundingBox.label}
              </p>
            )}
          </motion.section>
        )}
      </div>
    </div>
  );
};
