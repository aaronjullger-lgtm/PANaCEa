/**
 * Instant Calc – Spark-generated ephemeral calculator in a sandboxed iframe.
 */

import React, { useState, useCallback } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { InlineSpinner } from '@/components/loading';

interface InstantCalcViewProps {
  onBack: () => void;
}

interface SparkResponse {
  html?: string;
  js?: string;
  bundleUrl?: string;
  sandboxConfig?: { allowScripts?: boolean };
  error?: string;
  hint?: string;
}

export const InstantCalcView: React.FC<InstantCalcViewProps> = ({ onBack }) => {
  const { getToken } = useAuth();
  const [prompt, setPrompt] = useState('TIMI Risk Score calculator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [iframeContent, setIframeContent] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setUnavailable(false);
    setIframeContent(null);
    setIframeUrl(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/spark/instant-calc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data: SparkResponse = await res.json();
      if (res.status === 501) {
        setUnavailable(true);
        setError(data.error || data.hint || 'Instant Calc unavailable.');
        return;
      }
      if (!res.ok) {
        setError(data.error || 'Request failed');
        return;
      }
      if (data.bundleUrl) {
        setIframeUrl(data.bundleUrl);
      } else if (data.html) {
        const scriptClose = '</scr' + 'ipt>';
        const fullHtml = data.js
          ? `${data.html}<script>${data.js}${scriptClose}`
          : data.html;
        setIframeContent(fullHtml);
      } else {
        setError('No content returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [prompt, getToken]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
            Instant Calc
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Generate a small calculator from a description (e.g. TIMI Risk Score). Rendered in a sandbox.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="e.g. TIMI Risk Score calculator"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] disabled:opacity-50"
            >
              {loading ? <InlineSpinner size="sm" /> : <Sparkles className="w-4 h-4" />}
              Generate
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-[var(--color-data-fail)]" role="alert">{error}</p>}
          {unavailable && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Use the calculators below from the list.
            </p>
          )}
        </div>

        {(iframeUrl || iframeContent) && (
          <div
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden"
            style={{ minHeight: '320px' }}
          >
            {iframeUrl ? (
              <iframe
                title="Instant Calc"
                sandbox="allow-scripts"
                src={iframeUrl}
                className="w-full min-h-[320px] border-0"
                style={{ minHeight: '320px' }}
              />
            ) : (
              <iframe
                title="Instant Calc"
                sandbox="allow-scripts"
                srcDoc={iframeContent ?? undefined}
                className="w-full min-h-[320px] border-0"
                style={{ minHeight: '320px' }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
