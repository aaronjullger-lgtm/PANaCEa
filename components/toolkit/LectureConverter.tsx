/**
 * Lecture Converter – Turn lecture text into a podcast script (Host A / Host B).
 *
 * Commuter Curriculum: paste slides or textbook excerpt, get a conversational
 * script for study on the go. TTS can be added separately.
 *
 * @see docs/AI_INTEGRATION_ROADMAP.md – Phase 2 #6, Labs #19
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Headphones, Loader2, ArrowLeft, Copy, Check, Sparkles } from 'lucide-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

interface LectureConverterProps {
  readonly onClose?: () => void;
  /** When false, hide the Back button (parent provides BackLink) */
  readonly showBackButton?: boolean;
}

const MIN_CHARS = 100;
const MAX_CHARS = 50000;

export function LectureConverter({
  onClose,
  showBackButton = true,
}: LectureConverterProps) {
  const { getToken } = useAuth();
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [targetMinutes, setTargetMinutes] = useState(10);
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [script, setScript] = useState('');
  const [summaryPoints, setSummaryPoints] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [includeSsml, setIncludeSsml] = useState(false);

  const canGenerate = text.trim().length >= MIN_CHARS && text.trim().length <= MAX_CHARS;

  const generate = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHARS || trimmed.length > MAX_CHARS) return;

    setStatus('generating');
    setErrorMessage(null);
    setScript('');

    const token = await getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(getApiEndpoint('/api/lecture/script'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: trimmed,
          topic: topic.trim() || undefined,
          targetMinutes,
          includeSsml,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        details?: string;
        data?: { script?: string; summary_points?: unknown[] };
      };

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data?.error || data?.details || 'Failed to generate script');
        return;
      }

      const scriptText = data?.data?.script;
      if (!scriptText) {
        setStatus('error');
        setErrorMessage('No script in response');
        return;
      }

      setScript(scriptText);
      setSummaryPoints(
        (Array.isArray(data?.data?.summary_points) ? data.data!.summary_points : []) as string[]
      );
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Network error');
    }
  }, [text, topic, targetMinutes, includeSsml, getToken]);

  const copyToClipboard = useCallback(() => {
    if (!script) return;
    void navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [script]);

  const reset = useCallback(() => {
    setStatus('idle');
    setScript('');
    setSummaryPoints([]);
    setErrorMessage(null);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        Paste lecture notes or slide text. Get a Host A / Host B podcast script for studying on the
        go.
      </p>

      <div role="group" aria-labelledby="lecture-topic-label">
        <span
          id="lecture-topic-label"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
        >
          Topic (optional)
        </span>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Cardiovascular Physiology"
          className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          aria-label="Lecture topic"
        />
      </div>

      <div role="group" aria-labelledby="lecture-text-label">
        <span
          id="lecture-text-label"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
        >
          Lecture text (min {MIN_CHARS} chars)
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your lecture slides, textbook excerpt, or notes here..."
          rows={8}
          className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-y font-sans text-sm"
          aria-label="Lecture content"
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {text.length} / {MAX_CHARS} characters
          {text.length > 0 && text.length < MIN_CHARS && (
            <span className="text-data-provisional ml-2">
              – add at least {MIN_CHARS - text.length} more
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={includeSsml}
            onChange={(e) => setIncludeSsml(e.target.checked)}
            className="rounded border-[var(--color-border)]"
          />
          <span>SSML for TTS</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <span>Target length:</span>
          <select
            value={targetMinutes}
            onChange={(e) => setTargetMinutes(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-1.5 text-sm"
          >
            {[5, 7, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={!canGenerate || status === 'generating'}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-all"
          >
            {status === 'generating' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Script
              </>
            )}
          </button>
          {status === 'ready' && (
            <button
              onClick={reset}
              className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
            >
              New
            </button>
          )}
          {onClose && showBackButton && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
      </div>

      {status === 'error' && errorMessage && (
        <div className="rounded-lg border border-[var(--color-data-fail)]/40 bg-[var(--color-data-fail)]/5 px-3 py-2 text-sm text-[var(--color-data-fail)]">
          {errorMessage}
        </div>
      )}

      {status === 'ready' && script && (
        <div className="space-y-4">
          {summaryPoints.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)]">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Key takeaways
              </p>
              <ul className="space-y-1.5">
                {summaryPoints.map((point, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]"
                  >
                    <span className="text-data-pass mt-0.5">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-primary)]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Generated script (Host A / Host B)
              </span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-data-pass" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 overflow-auto max-h-[400px] text-sm text-[var(--color-text-primary)] whitespace-pre-wrap font-sans">
              {script}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
