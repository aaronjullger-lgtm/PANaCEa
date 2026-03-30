/**
 * Lecture Converter (Commuter Curriculum) – PDF to podcast.
 * Modes: Lecture script (Q&A Dr. Smith / Sarah) or Deep Dive conversation (Alex / Jordan).
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, FileText, Headphones, Mic } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

interface ScriptSegment {
  speaker: string;
  text: string;
}

interface GenerateResponse {
  script: ScriptSegment[];
  audioBase64?: string;
  mode?: string;
  error?: string;
  message?: string;
}

export const LectureConverterPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { getToken } = useAuth();
  useEffect(() => { document.title = 'Lecture Converter | PANaCEa'; }, []);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'lecture' | 'deep-dive'>('lecture');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const generate = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      if (mode === 'deep-dive' && topic.trim()) {
        formData.append('topic', topic.trim());
      }
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json: GenerateResponse = await res.json();
      if (!res.ok) {
        setError(json.error || json.message || 'Generation failed');
        return;
      }
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [file, mode, topic, getToken]);

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
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            Lecture Converter
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            Turn a PDF into a podcast: Q&A style (Dr. Smith / Sarah) or a Deep Dive conversation (Alex / Jordan).
          </p>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">PDF file</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="mt-1 block w-full text-sm text-[var(--color-text-primary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:text-[var(--color-text-inverse)]"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFile(f || null);
                  setError(null);
                }}
              />
            </label>

            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Mode</span>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'lecture'}
                    onChange={() => setMode('lecture')}
                    className="text-[var(--color-accent)]"
                  />
                  <span className="text-sm text-[var(--color-text-primary)]">Lecture script (Q&A)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'deep-dive'}
                    onChange={() => setMode('deep-dive')}
                    className="text-[var(--color-accent)]"
                  />
                  <span className="text-sm text-[var(--color-text-primary)]">Deep Dive conversation</span>
                </label>
              </div>
            </div>

            {mode === 'deep-dive' && (
              <label className="block">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Topic (optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Cardiovascular percentage allocation changes"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
                />
              </label>
            )}

            {error && (
              <p className="text-sm text-[var(--color-data-fail)]" role="alert">
                {error}
              </p>
            )}

            <button
              onClick={generate}
              disabled={loading || !file}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Generate podcast
                </>
              )}
            </button>
          </div>
        </motion.div>

        {result?.script && result.script.length > 0 && (
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6"
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Script
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {result.script.map((seg, i) => (
                <div key={`${seg.speaker}-${i}`} className="text-sm">
                  <span className="font-medium text-[var(--color-accent)]">{seg.speaker}:</span>{' '}
                  <span className="text-[var(--color-text-primary)]">{seg.text}</span>
                </div>
              ))}
            </div>
            {result.audioBase64 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                  <Headphones className="w-4 h-4" />
                  Play
                </h3>
                <audio
                  controls
                  className="w-full"
                  src={`data:audio/mpeg;base64,${result.audioBase64}`}
                  aria-label="Generated podcast audio"
                />
              </div>
            )}
            {result.mode === 'deep-dive' && !result.audioBase64 && result.message && (
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{result.message}</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
