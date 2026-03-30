/**
 * Technique Check – Upload video of physical exam maneuver; get critique and optional bounding boxes.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Video, Upload } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

interface BoundingBox {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AnalyzeResponse {
  critique: string;
  boundingBoxes?: BoundingBox[];
}

const PRESETS = [
  'Is the otoscope held correctly for a pediatric exam?',
  'Is the hand position correct for bracing during otoscopy?',
  'Is the stethoscope diaphragm placement appropriate for auscultation?',
];

export const TechniqueCheckPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { getToken } = useAuth();
  useEffect(() => { document.title = 'Technique Check | PANaCEa'; }, []);
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError(null);
    setResult(null);
  }, []);

  const analyze = useCallback(async () => {
    if (!file || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('video', file);
      formData.append('query', query.trim());
      const res = await fetch('/api/technique-check/analyze', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data: AnalyzeResponse & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error || 'Analysis failed');
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [file, query, getToken]);

  const videoUrl = file ? URL.createObjectURL(file) : null;

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

        <motion.div
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6"
        >
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-2">
            <Video className="w-6 h-6" />
            Technique Check
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            Upload a short video of yourself performing a maneuver. Get a critique and optional region highlights (e.g. hand position).
          </p>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Video</span>
              <div className="mt-1 flex items-center gap-2">
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-sm font-medium text-[var(--color-text-inverse)] cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Choose video
                  <input type="file" accept="video/*" className="sr-only" onChange={handleFile} />
                </label>
                {file && <span className="text-sm text-[var(--color-text-muted)] truncate">{file.name}</span>}
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Question</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setQuery(p)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50"
                  >
                    {p.slice(0, 40)}…
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="e.g. Is the otoscope held correctly for a pediatric exam?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>

            {error && <p className="text-sm text-[var(--color-data-fail)]" role="alert">{error}</p>}

            <button
              type="button"
              onClick={analyze}
              disabled={loading || !file || !query.trim()}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
              Analyze technique
            </button>
          </div>

          {videoUrl && (
            <div className="mt-6 relative inline-block">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="max-h-64 rounded-lg border border-[var(--color-border)]"
              />
              {result?.boundingBoxes && result.boundingBoxes.length > 0 && videoRef.current && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ maxHeight: '16rem' }}
                >
                  {result.boundingBoxes.map((box, i) => (
                    <div
                      key={i}
                      className="absolute border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/20 rounded"
                      style={{
                        left: `${box.x * 100}%`,
                        top: `${box.y * 100}%`,
                        width: `${box.w * 100}%`,
                        height: `${box.h * 100}%`,
                      }}
                      title={box.label}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {result?.critique && (
            <div className="mt-4 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Critique</h3>
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{result.critique}</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
