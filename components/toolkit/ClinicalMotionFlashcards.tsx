/**
 * Clinical Motion Flashcards – Veo-powered video generation
 *
 * Modes: Single clip | Side-by-side (Normal vs Pathological) | Guess the Sign (active recall)
 * Atlas caching: cached presets return instantly; uncached trigger async generation.
 *
 * @see docs/VEO_CLINICAL_MOTION_SPEC.md
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Bell,
  LayoutGrid,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

const PRESETS = [
  { id: 'parkinsonian_gait', label: 'Parkinsonian Gait', desc: 'Shuffling, reduced arm swing' },
  {
    id: 'cerebellar_ataxia',
    label: 'Cerebellar Ataxia',
    desc: 'Wide-based, heel-to-shin dysmetria',
  },
  { id: 'antalgic_gait', label: 'Antalgic Gait', desc: 'Limp, shortened stance phase' },
  { id: 'hemiplegic_gait', label: 'Hemiplegic Gait', desc: 'Circumduction, foot drop' },
  { id: 'tonic_clonic_seizure', label: 'Tonic-Clonic Seizure', desc: 'Rhythmic jerking' },
  { id: 'syncope_presyncope', label: 'Syncope / Presyncope', desc: 'Gradual loss of tone' },
  { id: 'resting_tremor', label: 'Resting Tremor', desc: 'Pill-rolling tremor' },
  { id: 'waddling_gait', label: 'Waddling Gait', desc: 'Trendelenburg, bilateral hip weakness' },
  { id: 'steppage_gait', label: 'Steppage Gait', desc: 'High-stepping, foot drop' },
  { id: 'normal_gait', label: 'Normal Gait', desc: 'Reference for comparison' },
] as const;

const GAIT_OPTIONS = [
  'Parkinsonian Gait',
  'Cerebellar Ataxia',
  'Antalgic Gait',
  'Hemiplegic Gait',
  'Normal Gait',
  'Waddling Gait',
  'Steppage Gait',
];

type ViewMode = 'single' | 'sidebyside' | 'guess';

interface ClinicalMotionFlashcardsProps {
  readonly onClose?: () => void;
}

export function ClinicalMotionFlashcards({ onClose }: ClinicalMotionFlashcardsProps) {
  const { getToken } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [selectedPreset, setSelectedPreset] = useState<string>('parkinsonian_gait');
  const [customPrompt, setCustomPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'polling' | 'ready' | 'error'>(
    'idle'
  );
  const [operationName, setOperationName] = useState<string | null>(null);
  const [pollUrl, setPollUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [normalVideoUrl, setNormalVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [guessAnswer, setGuessAnswer] = useState<string | null>(null);
  const [guessCorrect, setGuessCorrect] = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startGeneration = useCallback(async () => {
    const token = await getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    setStatus('generating');
    setErrorMessage(null);
    setVideoUrl(null);
    setVideoBase64(null);
    setGuessAnswer(null);
    setGuessCorrect(null);

    const body: { preset?: string; prompt?: string } = customPrompt.trim()
      ? { prompt: customPrompt.trim() }
      : { preset: selectedPreset };

    try {
      const res = await fetch(getApiEndpoint('/api/veo/generate'), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        data?: {
          error?: string;
          details?: string;
          status?: string;
          videoUrl?: string;
          operationName?: string;
          pollUrl?: string;
          preset?: string;
        };
        error?: string;
      };
      type VeoPayload = {
        error?: string;
        details?: string;
        status?: string;
        videoUrl?: string;
        operationName?: string;
        pollUrl?: string;
        preset?: string;
      };
      const payload = (data.data ?? data) as VeoPayload;

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(
          payload?.error || data.error || payload?.details || 'Failed to start generation'
        );
        return;
      }

      // Cache hit: return immediately with video
      if (payload.status === 'ready' && payload.videoUrl) {
        setVideoUrl(payload.videoUrl);
        setStatus('ready');
        return;
      }

      const op = payload.operationName;
      if (!op) {
        setStatus('error');
        setErrorMessage('No operation ID returned');
        return;
      }

      setOperationName(op);
      setPollUrl(
        payload.pollUrl ??
          `/api/veo/status?operation=${encodeURIComponent(op)}${payload.preset ? `&preset=${encodeURIComponent(payload.preset)}` : ''}`
      );
      setStatus('polling');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Network error');
    }
  }, [getToken, selectedPreset, customPrompt]);

  const pollStatus = useCallback(async () => {
    if (!pollUrl) return;

    const token = await getToken();
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = pollUrl.startsWith('http')
      ? pollUrl
      : getApiEndpoint('/api/veo/status') +
        (pollUrl.includes('?') ? pollUrl.slice(pollUrl.indexOf('?')) : '');
    const res = await fetch(url, { headers });
    const data = (await res.json()) as {
      data?: {
        status?: string;
        videoUrl?: string;
        videoBase64?: string;
        error?: string;
        pollIntervalSeconds?: number;
      };
    };
    type PollPayload = {
      status?: string;
      videoUrl?: string;
      videoBase64?: string;
      error?: string;
      pollIntervalSeconds?: number;
    };
    const payload = (data.data ?? data) as PollPayload;

    if (payload?.status === 'ready') {
      setStatus('ready');
      if (payload.videoUrl) setVideoUrl(payload.videoUrl);
      if (payload.videoBase64) setVideoBase64(payload.videoBase64);
      if (payload.error) setErrorMessage(payload.error);
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (payload?.status === 'failed') {
      setStatus('error');
      setErrorMessage(payload?.error || 'Generation failed');
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const delayMs = (payload?.pollIntervalSeconds ?? 12) * 1000;
    pollRef.current = setTimeout(pollStatus, delayMs);
  }, [pollUrl, getToken]);

  React.useEffect(() => {
    if (status === 'polling' && pollUrl) {
      pollRef.current = setTimeout(pollStatus, 8000);
      return () => {
        if (pollRef.current) clearTimeout(pollRef.current);
      };
    }
    return undefined;
  }, [status, pollUrl, pollStatus]);

  const loadNormalForComparison = useCallback(async () => {
    const token = await getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(getApiEndpoint('/api/veo/generate'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ preset: 'normal_gait' }),
    });
    const data = (await res.json()) as { data?: { status?: string; videoUrl?: string } };
    type NormalPayload = { status?: string; videoUrl?: string };
    const payload = (data.data ?? data) as NormalPayload;
    if (payload?.status === 'ready' && payload?.videoUrl) {
      setNormalVideoUrl(payload.videoUrl);
    }
  }, [getToken]);

  const reset = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setStatus('idle');
    setOperationName(null);
    setPollUrl(null);
    setVideoUrl(null);
    setVideoBase64(null);
    setNormalVideoUrl(null);
    setErrorMessage(null);
    setGuessAnswer(null);
    setGuessCorrect(null);
  }, []);

  const videoSrc = videoUrl || videoBase64;
  const isGenerating = status === 'generating' || status === 'polling';
  const selectedLabel = PRESETS.find((p) => p.id === selectedPreset)?.label ?? selectedPreset;
  const showGuessReveal = viewMode === 'guess' && guessAnswer !== null;

  const handleGuessSubmit = (choice: string) => {
    setGuessAnswer(choice);
    setGuessCorrect(choice === selectedLabel);
  };

  return (
    <div className="space-y-4">
      {/* Safety disclaimer */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-data-provisional/10 border border-data-provisional/30">
        <AlertTriangle className="w-5 h-5 text-data-provisional flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[var(--color-text-primary)]">
          AI-generated for education only. Verify with clinical reference. Do not use for diagnostic
          accuracy.
        </p>
      </div>

      {/* View mode toggle */}
      <div className="flex flex-wrap gap-2">
        {(['single', 'sidebyside', 'guess'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === mode
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/50'
            }`}
          >
            {mode === 'single' && <LayoutGrid className="w-4 h-4" />}
            {mode === 'sidebyside' && <LayoutGrid className="w-4 h-4" />}
            {mode === 'guess' && <HelpCircle className="w-4 h-4" />}
            {mode === 'single' && 'Single'}
            {mode === 'sidebyside' && 'Compare'}
            {mode === 'guess' && 'Guess the Sign'}
          </button>
        ))}
      </div>

      {/* Preset selector */}
      <div role="group" aria-labelledby="clinical-motion-label">
        <span
          id="clinical-motion-label"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
        >
          Pathology (preset or custom)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 max-h-48 overflow-y-auto">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedPreset(p.id);
                setCustomPrompt('');
              }}
              className={`text-left p-3 rounded-lg border text-sm transition-all ${
                selectedPreset === p.id && !customPrompt
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/50'
              }`}
            >
              <span className="font-medium block">{p.label}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{p.desc}</span>
            </button>
          ))}
        </div>
        <input
          id="clinical-motion-custom-prompt"
          type="text"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Or enter a custom prompt..."
          aria-label="Custom pathology prompt"
          className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {/* Generate button */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={startGeneration}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-all"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Request Clip
            </>
          )}
        </button>
        {(status === 'ready' || status === 'error') && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            New
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
      </div>

      {/* Async notification: generating in background */}
      <AnimatePresence>
        {status === 'polling' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
          >
            <Bell className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">
                We&apos;re generating this clip.
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                It&apos;ll be ready in ~1–2 minutes. Keep studying other cards in the meantime.
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Polling for completion…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {status === 'error' && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video result */}
      <AnimatePresence>
        {status === 'ready' && videoSrc && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Guess the Sign: show choices first, hide label until answered */}
            {viewMode === 'guess' && !showGuessReveal && (
              <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)]">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
                  What gait abnormality is shown?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {GAIT_OPTIONS.filter((o) => o !== 'Normal Gait').map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleGuessSubmit(opt)}
                      className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors text-left"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Side-by-side: load normal if needed */}
            {viewMode === 'sidebyside' && !normalVideoUrl && (
              <button
                type="button"
                onClick={loadNormalForComparison}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Load Normal Gait for comparison
              </button>
            )}

            <div
              className={`grid gap-4 ${viewMode === 'sidebyside' && normalVideoUrl ? 'grid-cols-1 md:grid-cols-2' : ''}`}
            >
              {viewMode === 'sidebyside' && normalVideoUrl && (
                <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-secondary)]">
                  <p className="p-2 text-center text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)]">
                    Normal
                  </p>
                  <div className="aspect-video bg-[var(--color-bg-primary)]">
                    <video
                      src={normalVideoUrl}
                      controls
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-secondary)]">
                <div className="p-2 text-center text-xs font-medium bg-[var(--color-bg-tertiary)]">
                  {viewMode === 'guess' && showGuessReveal ? (
                    <span className={guessCorrect ? 'text-data-pass' : 'text-rose-500'}>
                      {guessCorrect
                        ? `✓ Correct: ${selectedLabel}`
                        : `Correct: ${selectedLabel} (you chose: ${guessAnswer})`}
                    </span>
                  ) : viewMode === 'sidebyside' ? (
                    'Pathological'
                  ) : viewMode === 'guess' ? (
                    'What gait abnormality?'
                  ) : (
                    selectedLabel
                  )}
                </div>
                <div className="aspect-video bg-[var(--color-bg-primary)]">
                  <video
                    src={videoSrc}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              AI-generated for education. Verify with clinical reference.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
