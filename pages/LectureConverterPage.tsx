/**
 * Lecture Converter (Commuter Curriculum) – PDF to podcast.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Headphones, Mic, Radio, Route, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    document.title = 'Lecture Converter | PANaCEa';
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'lecture' | 'deep-dive'>('lecture');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const generate = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF file.');
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

      const response = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json: GenerateResponse = await response.json();

      if (!response.ok) {
        setError(json.error || json.message || 'Generation failed.');
        return;
      }

      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }, [file, getToken, mode, topic]);

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Commuter Curriculum',
            badgeTone: 'amber',
            title: 'Turn dense PDFs into audio-friendly study material.',
            subtitle:
              'Convert notes or lecture PDFs into either a guided Q&A script or a deeper discussion format so review can continue during walks, drives, or cleanup time.',
            backLabel: 'Back to Study',
            onBack,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Input"
            value="PDF lecture"
            detail="Feed it a single PDF when you want to compress a block into audio review."
            icon={FileText}
          />
          <WorkspaceMetricCard
            label="Modes"
            value="2 formats"
            detail="Choose a guided lecture script or a more conversational deep dive."
            accent="#728ba6"
            icon={Radio}
          />
          <WorkspaceMetricCard
            label="Output"
            value="Script + audio"
            detail="Review the script directly and play audio whenever it is returned."
            accent="#b39b6c"
            icon={Headphones}
          />
          <WorkspaceMetricCard
            label="Best for"
            value="Commute blocks"
            detail="Ideal when you need passive review without fully leaving the curriculum."
            accent="#9a7f9a"
            icon={Route}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Audio transformation
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Use this when a topic needs repetition in a lower-friction format, not when you
                need precise note-taking.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                The lecture mode is tighter and more structured; the deep-dive mode is better when
                a topic deserves more context or a conversational walk-through.
              </p>
            </div>

            <div className="workspace-subsurface rounded-[1.25rem] p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Choose the right mode
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Use `Lecture script` for a concise review before quizzes.</li>
                <li>Use `Deep dive` when the topic still feels conceptually thin.</li>
                <li>Add an optional topic to steer the conversation toward what matters most.</li>
              </ul>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Conversion workspace"
          subtitle="Upload a PDF, choose the listening format, and review the generated study output in the same workspace."
        >
          <WorkspaceSplit className="items-start">
            <WorkspaceSurface accent="#b39b6c" className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Source and mode
                </h3>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Keep the input narrow so the output stays teachable and easy to replay.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  PDF source
                </span>
                <div className="workspace-dashed-state rounded-[1.25rem] p-4">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="block w-full text-sm text-[var(--color-text-primary)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--color-text-inverse)]"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] ?? null;
                      setFile(nextFile);
                      setResult(null);
                      setError(null);
                    }}
                  />
                  {file ? (
                    <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                      Selected: <span className="text-[var(--color-text-primary)]">{file.name}</span>
                    </p>
                  ) : null}
                </div>
              </label>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Listening mode</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={mode === 'lecture' ? 'accent' : 'outline'}
                    onClick={() => {
                      setMode('lecture');
                      setResult(null);
                      setError(null);
                    }}
                  >
                    Lecture script
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'deep-dive' ? 'accent' : 'outline'}
                    onClick={() => {
                      setMode('deep-dive');
                      setResult(null);
                      setError(null);
                    }}
                  >
                    Deep dive
                  </Button>
                </div>
              </div>

              {mode === 'deep-dive' ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    Topic focus (optional)
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Cardiovascular percentage allocation changes"
                    value={topic}
                    onChange={(event) => {
                      setTopic(event.target.value);
                      setResult(null);
                      setError(null);
                    }}
                    className="workspace-field w-full rounded-[1.25rem] px-4 py-3 text-sm outline-none transition focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/20"
                  />
                </label>
              ) : null}

              {error ? (
                <p className="text-sm text-[var(--color-data-fail)]" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                size="lg"
                loading={loading}
                disabled={!file}
                onClick={generate}
                icon={loading ? undefined : Mic}
                className="w-full shadow-[0_20px_50px_-24px_rgba(196,183,138,0.55)]"
              >
                {loading ? 'Generating podcast…' : 'Generate podcast'}
              </Button>
            </WorkspaceSurface>

            {result?.script?.length ? (
              <WorkspaceSurface accent="#728ba6" className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Generated output
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    Review the script, then play the audio when it is available.
                  </p>
                </div>

                <div className="workspace-subsurface max-h-[24rem] space-y-3 overflow-auto rounded-[1.25rem] p-4">
                  {result.script.map((segment, index) => (
                    <div key={`${segment.speaker}-${index}`} className="text-sm leading-7">
                      <span className="font-semibold text-[var(--color-accent)]">
                        {segment.speaker}:
                      </span>{' '}
                      <span className="text-[var(--color-text-primary)]">{segment.text}</span>
                    </div>
                  ))}
                </div>

                {result.audioBase64 ? (
                  <div className="workspace-subsurface space-y-3 rounded-[1.25rem] p-4">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Audio playback
                    </p>
                    <audio
                      controls
                      className="w-full"
                      src={`data:audio/mpeg;base64,${result.audioBase64}`}
                      aria-label="Generated podcast audio"
                    />
                  </div>
                ) : result.message ? (
                  <div className="workspace-dashed-state rounded-[1.25rem] p-4 text-sm text-[var(--color-text-secondary)]">
                    {result.message}
                  </div>
                ) : null}
              </WorkspaceSurface>
            ) : (
              <WorkspaceEmptyState
                icon={Sparkles}
                title="Generate a podcast-ready script to fill this pane"
                description="Once the PDF is converted, the script and any returned audio will appear here for review."
              />
            )}
          </WorkspaceSplit>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default LectureConverterPage;
