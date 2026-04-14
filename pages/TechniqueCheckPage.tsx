/**
 * Technique Check – Upload a video of a physical exam maneuver for critique.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Sparkles, Upload, Video, WandSparkles } from 'lucide-react';
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

  useEffect(() => {
    document.title = 'Technique Check | PANaCEa';
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!file) {
      setVideoUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setVideoUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
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

      const response = await fetch('/api/technique-check/analyze', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data: AnalyzeResponse & { error?: string } = await response.json();
      if (!response.ok) {
        setError(data.error || 'Analysis failed.');
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }, [file, getToken, query]);

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Technique Coach',
            badgeTone: 'sage',
            title: 'Review physical exam technique without leaving the study workflow.',
            subtitle:
              'Upload a short maneuver clip, ask a targeted question, and get coaching feedback that is framed for skill refinement rather than generic video analysis.',
            backLabel: 'Back to Study',
            onBack,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Input"
            value="Short video"
            detail="Best for a single maneuver or positioning question captured clearly."
            icon={Video}
          />
          <WorkspaceMetricCard
            label="Prompting"
            value="Question-led"
            detail="Ask about one technique detail so the feedback stays actionable."
            accent="#728ba6"
            icon={WandSparkles}
          />
          <WorkspaceMetricCard
            label="Feedback"
            value="Critique + boxes"
            detail="Returns coaching text and, when available, highlighted regions."
            accent="#7a8f6e"
            icon={ShieldCheck}
          />
          <WorkspaceMetricCard
            label="Best for"
            value="Refinement"
            detail="Useful when you know the maneuver but want to sharpen execution details."
            accent="#b39b6c"
            icon={Sparkles}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Maneuver critique
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Ask about one exam behavior at a time so the critique is specific enough to
                practice immediately.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                This tool is strongest for targeted checks like hand placement, bracing, patient
                positioning, or where an instrument is contacting the body.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Keep clips useful
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Record a short, stable clip with the maneuver centered in frame.</li>
                <li>Ask one question about one technique issue at a time.</li>
                <li>Use the critique as coaching, then verify against formal instruction.</li>
              </ul>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Technique workspace"
          subtitle="Upload a clip, ask a focused question, and review the maneuver with feedback inside the shared shell."
        >
          <WorkspaceSplit className="items-start">
            <WorkspaceSurface accent="#728ba6" className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Video preview
                </h3>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Short, clean clips work best for positioning and hand-placement feedback.
                </p>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] shadow-[0_16px_40px_-24px_rgba(196,183,138,0.55)]">
                <Upload className="h-4 w-4" />
                Choose video
                <input type="file" accept="video/*" className="sr-only" onChange={handleFile} />
              </label>

              {file ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Selected: <span className="text-[var(--color-text-primary)]">{file.name}</span>
                </p>
              ) : null}

              {videoUrl ? (
                <div className="relative inline-block overflow-hidden rounded-[1.25rem] border border-white/8 bg-[var(--color-bg-primary)]/80 p-3">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="max-h-[26rem] rounded-xl"
                  />
                  {result?.boundingBoxes?.length ? (
                    <div className="pointer-events-none absolute inset-3">
                      {result.boundingBoxes.map((box, index) => (
                        <div
                          key={`${box.label}-${index}`}
                          className="absolute rounded border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/15"
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
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm text-[var(--color-text-secondary)]">
                  Your maneuver preview will appear here after upload.
                </div>
              )}
            </WorkspaceSurface>

            <WorkspaceSurface accent="#7a8f6e" className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Technique question
                </h3>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Keep the question narrow so the critique stays coachable.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="xs"
                    variant={query === preset ? 'accent' : 'outline'}
                    onClick={() => {
                      setQuery(preset);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    {preset}
                  </Button>
                ))}
              </div>

              <input
                type="text"
                placeholder="e.g. Is the otoscope held correctly for a pediatric exam?"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setResult(null);
                  setError(null);
                }}
                className="w-full rounded-[1.25rem] border border-white/10 bg-[var(--color-bg-primary)]/85 px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/20"
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
                disabled={!file || !query.trim()}
                onClick={analyze}
                icon={loading ? undefined : Video}
                className="w-full shadow-[0_20px_50px_-24px_rgba(122,143,110,0.55)]"
              >
                {loading ? 'Analyzing technique…' : 'Analyze technique'}
              </Button>
            </WorkspaceSurface>
          </WorkspaceSplit>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title="Coaching feedback"
          subtitle="Review the critique and any highlighted regions returned by the analysis."
        >
          {result?.critique ? (
            <WorkspaceSplit className="items-start xl:grid-cols-[1.1fr_0.9fr]">
              <WorkspaceSurface accent="#7a8f6e" className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Critique
                  </h3>
                  <p className="text-sm leading-7 text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {result.critique}
                  </p>
                </div>
              </WorkspaceSurface>

              <WorkspaceSurface accent="#728ba6" className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Highlight summary
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    Use the overlay to anchor the critique to what the model focused on in frame.
                  </p>
                </div>

                {result.boundingBoxes?.length ? (
                  <div className="space-y-2">
                    {result.boundingBoxes.map((box, index) => (
                      <div
                        key={`${box.label}-${index}`}
                        className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
                      >
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {box.label}
                        </span>
                        <span className="ml-2 text-[var(--color-text-muted)]">
                          ({Math.round(box.w * 100)}% x {Math.round(box.h * 100)}% area)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--color-text-secondary)]">
                    No bounding-box highlights were returned for this clip.
                  </div>
                )}
              </WorkspaceSurface>
            </WorkspaceSplit>
          ) : (
            <WorkspaceEmptyState
              icon={Video}
              title="Run a technique check to populate this coaching panel"
              description="Once a video is analyzed, the maneuver critique and any highlighted regions will appear here."
            />
          )}
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default TechniqueCheckPage;
