/**
 * Clinical Eye Page - Analyze medical images with guided reasoning.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, ScanSearch, ShieldCheck, Sparkles, Upload } from 'lucide-react';
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

interface AnalyzeResponse {
  data: {
    text: string;
    reasoning?: string[];
    boundingBox?: { box_2d: number[]; label: string };
    usageMetadata?: { totalTokenCount?: number };
  };
}

const PROMPT_PRESETS = [
  'Describe the primary abnormality and why it matters clinically.',
  'Estimate the ST elevation in lead V2 in millimeters.',
  'Highlight the finding that most changes next-step management.',
];

export const ClinicalEyePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { getToken } = useAuth();

  useEffect(() => {
    document.title = 'Clinical Eye | PANaCEa';
  }, []);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse['data'] | null>(null);

  const imageSrc = imageBase64 ? `data:${imageMime};base64,${imageBase64}` : null;
  const box = result?.boundingBox?.box_2d;
  const hasBox = Array.isArray(box) && box.length >= 4;
  const highlightedBox = hasBox ? box : null;

  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
      const response = await fetch('/api/clinical-eye/analyze', {
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

      const json = (await response.json()) as {
        error?: string;
        details?: string;
        data?: AnalyzeResponse['data'];
      };

      if (!response.ok) {
        setError(json.error || json.details || 'Analysis failed.');
        return;
      }

      setResult(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }, [getToken, imageBase64, imageMime, prompt]);

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Vision Assist',
            badgeTone: 'steel',
            title: 'Analyze clinical images with guided, study-oriented reasoning.',
            subtitle:
              'Upload an ECG, radiograph, rash photo, or other clinical image and prompt the model to explain what matters most for a student preparing for the PANCE.',
            backLabel: 'Back to Study',
            onBack,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Input"
            value="Clinical images"
            detail="ECGs, X-rays, skin findings, and other visual prompts work best."
            icon={Eye}
          />
          <WorkspaceMetricCard
            label="Output"
            value="Reasoned read"
            detail="Get a concise interpretation plus an optional highlighted region."
            accent="#728ba6"
            icon={ScanSearch}
          />
          <WorkspaceMetricCard
            label="Best for"
            value="Image questions"
            detail="Use it when a visual clue is the main blocker in your reasoning."
            accent="#b39b6c"
            icon={Sparkles}
          />
          <WorkspaceMetricCard
            label="Guardrail"
            value="Review-first"
            detail="Treat this as study guidance, then verify with trusted clinical references."
            accent="#7a8f6e"
            icon={ShieldCheck}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Image interpretation
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Ask focused questions that force the model to explain what you should notice, not
                just what it sees.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                The strongest prompts are specific, clinically grounded, and tied to a decision:
                what abnormality is present, how large it is, or why it changes management.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Prompt patterns that work well
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Ask for the most clinically important abnormality first.</li>
                <li>Request a measurement or localization when precision matters.</li>
                <li>Tie the readout to a likely diagnosis or next step in care.</li>
              </ul>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Analysis workspace"
          subtitle="Upload an image, refine the prompt, and run the analysis inside the shared study shell."
        >
          <WorkspaceSplit className="items-start">
            <WorkspaceSurface accent="#728ba6" className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Upload image
                </h3>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Use PNG, JPEG, or WEBP for the cleanest results.
                </p>
              </div>

              <label className="flex min-h-[16rem] cursor-pointer flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-white/12 bg-white/[0.03] p-6 text-center transition-all duration-300 hover:border-[var(--color-accent)]/35 hover:bg-white/[0.05]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  <Upload className="h-6 w-6 text-[var(--color-text-secondary)]" />
                </div>
                <p className="mt-4 text-sm font-medium text-[var(--color-text-primary)]">
                  Drop in an image or click to browse
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  PNG, JPG, WEBP
                </p>
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onFileChange}
                />
              </label>

              {imageSrc ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Preview
                  </p>
                  <div className="relative inline-block max-w-full rounded-[1.25rem] border border-white/8 bg-[var(--color-bg-primary)]/80 p-3">
                    <img
                      src={imageSrc}
                      alt="Clinical image for analysis"
                      className="max-h-[22rem] rounded-xl object-contain"
                    />
                    {highlightedBox ? (
                      <svg
                        className="pointer-events-none absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)]"
                        viewBox="0 0 1000 1000"
                        preserveAspectRatio="none"
                      >
                        <rect
                          x={highlightedBox[1] ?? 0}
                          y={highlightedBox[0] ?? 0}
                          width={(highlightedBox[3] ?? 0) - (highlightedBox[1] ?? 0)}
                          height={(highlightedBox[2] ?? 0) - (highlightedBox[0] ?? 0)}
                          fill="none"
                          stroke="var(--color-accent)"
                          strokeWidth={20}
                        />
                      </svg>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </WorkspaceSurface>

            <WorkspaceSurface accent="#b39b6c" className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Ask a focused question
                </h3>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Keep prompts specific enough that the answer can teach one high-yield point.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {PROMPT_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="xs"
                    variant={prompt === preset ? 'accent' : 'outline'}
                    onClick={() => {
                      setPrompt(preset);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    {preset}
                  </Button>
                ))}
              </div>

              <textarea
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setResult(null);
                  setError(null);
                }}
                placeholder="e.g. Estimate the ST elevation in lead V2 and explain why it matters."
                className="min-h-[12rem] w-full rounded-[1.25rem] border border-white/10 bg-[var(--color-bg-primary)]/85 px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/20"
                maxLength={4096}
              />

              {error ? (
                <p className="text-sm text-[var(--color-data-fail)]" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                size="lg"
                loading={loading}
                disabled={!imageBase64 || !prompt.trim()}
                onClick={analyze}
                icon={loading ? undefined : ScanSearch}
                className="w-full shadow-[0_20px_50px_-24px_rgba(196,183,138,0.55)]"
              >
                {loading ? 'Analyzing image…' : 'Analyze image'}
              </Button>
            </WorkspaceSurface>
          </WorkspaceSplit>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title="Findings"
          subtitle="Review the interpretation, reasoning trace, and any highlighted area from the analysis."
        >
          {result ? (
            <WorkspaceSplit className="items-start xl:grid-cols-[0.9fr_1.1fr]">
              <WorkspaceSurface accent="#728ba6" className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Summary
                  </h3>
                  <p className="text-sm leading-7 text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {result.text}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  {result.boundingBox?.label ? (
                    <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5">
                      Highlight: {result.boundingBox.label}
                    </span>
                  ) : null}
                  {result.usageMetadata?.totalTokenCount ? (
                    <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5">
                      Tokens: {result.usageMetadata.totalTokenCount}
                    </span>
                  ) : null}
                </div>
              </WorkspaceSurface>

              <WorkspaceSurface accent="#9a7f9a" className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Reasoning trace
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    Use this to understand the interpretive path, not as a substitute for source
                    verification.
                  </p>
                </div>

                {result.reasoning && result.reasoning.length > 0 ? (
                  <pre className="max-h-[24rem] overflow-auto rounded-[1.25rem] border border-white/8 bg-[var(--color-bg-primary)]/75 p-4 text-xs leading-6 text-[var(--color-text-primary)] whitespace-pre-wrap">
                    {result.reasoning.join('\n')}
                  </pre>
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
                    No step-by-step reasoning trace was returned for this analysis.
                  </div>
                )}
              </WorkspaceSurface>
            </WorkspaceSplit>
          ) : (
            <WorkspaceEmptyState
              icon={ScanSearch}
              title="Run an image analysis to populate this panel"
              description="Once you upload an image and submit a prompt, the interpretation and reasoning trace will appear here."
            />
          )}
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default ClinicalEyePage;
