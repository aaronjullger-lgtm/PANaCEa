/**
 * My Library Page
 *
 * Lists the user's knowledge caches (Gemini Context Caching), allows setting
 * an active cache for the Tutor, uploading new files, and deleting caches.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Info,
  Library,
  MessageSquare,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/loading';
import {
  WorkspaceEmptyState,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { API_ENDPOINTS, buildApiUrl, getApiBaseUrl } from '@/lib/utils/apiConfig';
import { usePreferences } from '@/hooks/usePreferences';

export interface KnowledgeCacheItem {
  id: string;
  displayName: string;
  geminiCacheName: string;
  expiresAt: string;
  source: string;
  createdAt: string;
}

interface MyLibraryPageProps {
  onExit: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.error === 'string') return payload.error;
  if (typeof payload.message === 'string') return payload.message;
  return fallback;
}

function parseKnowledgeCaches(payload: unknown): KnowledgeCacheItem[] {
  if (!isRecord(payload)) return [];
  const root = isRecord(payload.data) ? payload.data : payload;
  const caches = Array.isArray(root.caches) ? root.caches : [];

  return caches.flatMap((cache) => {
    if (!isRecord(cache)) return [];
    if (
      typeof cache.id !== 'string' ||
      typeof cache.displayName !== 'string' ||
      typeof cache.geminiCacheName !== 'string' ||
      typeof cache.expiresAt !== 'string' ||
      typeof cache.source !== 'string' ||
      typeof cache.createdAt !== 'string'
    ) {
      return [];
    }

    return [{
      id: cache.id,
      displayName: cache.displayName,
      geminiCacheName: cache.geminiCacheName,
      expiresAt: cache.expiresAt,
      source: cache.source,
      createdAt: cache.createdAt,
    }];
  });
}

function parseUploadResult(payload: unknown): { fileUri: string; mimeType?: string } | null {
  if (!isRecord(payload) || typeof payload.fileUri !== 'string') return null;
  return {
    fileUri: payload.fileUri,
    mimeType: typeof payload.mimeType === 'string' ? payload.mimeType : undefined,
  };
}

export function MyLibraryPage({ onExit }: Readonly<MyLibraryPageProps>) {
  const { getToken } = useAuth();
  const { preferences, updatePreferences } = usePreferences();
  const [caches, setCaches] = useState<KnowledgeCacheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [libraryQuestion, setLibraryQuestion] = useState('');
  const [libraryAnswer, setLibraryAnswer] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [veoPrompt, setVeoPrompt] = useState('');
  const [veoLoading, setVeoLoading] = useState(false);
  const [veoError, setVeoError] = useState<string | null>(null);
  const [veoResult, setVeoResult] = useState<{ videoUrl?: string; jobId?: string } | null>(null);

  const activeCacheName = (preferences.customSettings as Record<string, unknown> | undefined)
    ?.activeKnowledgeCacheName as string | undefined;
  const activeCacheDisplayName = (preferences.customSettings as Record<string, unknown> | undefined)
    ?.activeKnowledgeCacheDisplayName as string | undefined;

  const fetchCaches = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setError('Not signed in');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.KNOWLEDGE_CACHES), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(getErrorMessage(data, `HTTP ${response.status}`));
      }

      const list = parseKnowledgeCaches(await response.json());
      setCaches(list);

      const currentActive = (preferences.customSettings as Record<string, unknown> | undefined)
        ?.activeKnowledgeCacheName;
      if (
        currentActive &&
        typeof currentActive === 'string' &&
        !list.some((cache) => cache.geminiCacheName === currentActive)
      ) {
        const custom = (preferences.customSettings as Record<string, unknown>) ?? {};
        const next = { ...custom };
        delete next.activeKnowledgeCacheName;
        delete next.activeKnowledgeCacheDisplayName;
        await updatePreferences({ customSettings: next });
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Failed to load caches');
      setCaches([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, preferences.customSettings, updatePreferences]);

  useEffect(() => {
    void fetchCaches();
  }, [fetchCaches]);

  const setActiveCache = useCallback(
    async (geminiCacheName: string | null, displayName?: string) => {
      const custom = (preferences.customSettings as Record<string, unknown>) ?? {};
      await updatePreferences({
        customSettings: {
          ...custom,
          activeKnowledgeCacheName: geminiCacheName ?? undefined,
          activeKnowledgeCacheDisplayName: displayName ?? undefined,
        },
      });
    },
    [preferences.customSettings, updatePreferences]
  );

  const clearActive = useCallback(() => {
    const custom = (preferences.customSettings as Record<string, unknown>) ?? {};
    const next = { ...custom };
    delete next.activeKnowledgeCacheName;
    delete next.activeKnowledgeCacheDisplayName;
    void updatePreferences({ customSettings: next });
  }, [preferences.customSettings, updatePreferences]);

  const handleDelete = useCallback(
    async (geminiCacheName: string) => {
      const token = await getToken();
      if (!token) return;
      setDeletingName(geminiCacheName);
      try {
        const url = getApiBaseUrl() + API_ENDPOINTS.KNOWLEDGE_CACHE_DELETE(geminiCacheName);
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(getErrorMessage(data, `HTTP ${response.status}`));
        }
        if (activeCacheName === geminiCacheName) clearActive();
        await fetchCaches();
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : 'Delete failed');
      } finally {
        setDeletingName(null);
      }
    },
    [activeCacheName, clearActive, fetchCaches, getToken]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      const token = await getToken();
      if (!token) return;
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const displayName = uploadDisplayName.trim() || file.name.replace(/\.[^.]+$/, '');
        const uploadResponse = await fetch(buildApiUrl(API_ENDPOINTS.KNOWLEDGE_UPLOAD), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!uploadResponse.ok) {
          const data = await uploadResponse.json().catch(() => null);
          throw new Error(getErrorMessage(data, `Upload failed: ${uploadResponse.status}`));
        }
        const uploadData = parseUploadResult(await uploadResponse.json());
        if (!uploadData) {
          throw new Error('Upload response was missing file metadata');
        }
        const cacheResponse = await fetch(buildApiUrl(API_ENDPOINTS.KNOWLEDGE_CACHE), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            displayName,
            fileUri: uploadData.fileUri,
            ttlSeconds: 3600,
            mimeType: uploadData.mimeType,
          }),
        });
        if (!cacheResponse.ok) {
          const data = await cacheResponse.json().catch(() => null);
          throw new Error(getErrorMessage(data, `Create cache failed: ${cacheResponse.status}`));
        }
        setUploadDisplayName('');
        await fetchCaches();
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [fetchCaches, getToken, uploadDisplayName]
  );

  const onFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleUpload(file);
    event.target.value = '';
  };

  const veoPresets = [
    'Cinematic shot, medical education. Elderly male demonstrating shuffling gait with reduced arm swing.',
    'Medical education. Patient demonstrating Parkinsonian gait, short steps, festination.',
    'Clinical context. Seizure vs syncope: brief tonic-clonic movement then recovery.',
  ];

  const handleVeoGenerate = useCallback(async () => {
    const prompt = veoPrompt.trim() || veoPresets[0];
    if (!prompt) return;

    const token = await getToken();
    if (!token) return;
    setVeoLoading(true);
    setVeoError(null);
    setVeoResult(null);
    try {
      const response = await fetch(buildApiUrl('/api/veo/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, durationSeconds: 5 }),
      });
      const data = (await response.json()) as {
        videoUrl?: string;
        jobId?: string;
        error?: string;
        hint?: string;
      };
      if (!response.ok) {
        if (response.status === 501) {
          setVeoError('Video generation is not currently available. Please try again later.');
        } else {
          setVeoError(data.error || data.hint || 'Generation failed');
        }
        return;
      }
      setVeoResult(data);
    } catch (issue) {
      setVeoError(issue instanceof Error ? issue.message : 'Request failed');
    } finally {
      setVeoLoading(false);
    }
  }, [getToken, veoPrompt, veoPresets]);

  const formatExpiry = (iso: string) => {
    const expiry = new Date(iso);
    const now = new Date();
    const minutes = Math.round((expiry.getTime() - now.getTime()) / 60000);
    if (minutes < 60) return `Expires in ${minutes} min`;
    return `Expires ${expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Study Companion',
            badgeTone: 'sage',
            title: 'Ground the tutor in your own documents.',
            subtitle:
              'Upload PDFs, choose the active source for tutoring, and keep document-grounded chat inside the same premium workspace as the rest of your study flow.',
            status: activeCacheName
              ? `Active source: ${activeCacheDisplayName || 'Selected document'}`
              : 'No active source selected',
            backLabel: 'Back to Study',
            onBack: onExit,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Cached documents"
            value={caches.length}
            detail="Grounded context caches currently available in this workspace."
            icon={Library}
          />
          <WorkspaceMetricCard
            label="Tutor grounding"
            value={activeCacheName ? 'On' : 'Off'}
            detail={
              activeCacheName
                ? 'Tutor answers can reference your selected document.'
                : 'Select an active document to enable grounded answers.'
            }
            accent="#7a8f6e"
            icon={Sparkles}
          />
          <WorkspaceMetricCard
            label="Upload state"
            value={uploading ? 'Busy' : 'Ready'}
            detail="PDF uploads create a one-hour context cache for the tutor."
            accent="#728ba6"
            icon={Upload}
          />
          <WorkspaceMetricCard
            label="Library chat"
            value={activeCacheName ? 'Available' : 'Waiting'}
            detail="Ask targeted questions against the active document below."
            accent="#9a7f9a"
            icon={MessageSquare}
          />
        </div>
      </WorkspaceReveal>

      {error ? (
        <WorkspaceReveal delay={0.08}>
          <WorkspaceSurface accent="#a67f7f">
            <p className="text-sm text-[var(--color-text-primary)]">{error}</p>
          </WorkspaceSurface>
        </WorkspaceReveal>
      ) : null}

      <WorkspaceReveal delay={0.1}>
        <WorkspaceSplit className="items-start">
          <div className="space-y-6">
            <WorkspaceSection
              title="Document workspace"
              subtitle="Upload a PDF, assign a display name, and choose which source the tutor should use right now."
            >
              <WorkspaceSurface accent="#c4b78a" className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="my-library-display-name"
                    className="block text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    Display name
                  </label>
                  <input
                    id="my-library-display-name"
                    type="text"
                    placeholder="Optional display name"
                    value={uploadDisplayName}
                    onChange={(event) => setUploadDisplayName(event.target.value)}
                    className="workspace-field w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl">
                    <span className="inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-inverse)] shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)]">
                      {uploading ? (
                        <InlineSpinner size="sm" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Choose PDF
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      disabled={uploading}
                      onChange={onFileSelect}
                      className="sr-only"
                      aria-label="Choose PDF file to upload"
                    />
                  </label>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    PDF only, max 50MB. Cache expires after about one hour.
                  </p>
                </div>
              </WorkspaceSurface>
            </WorkspaceSection>

            <WorkspaceSection
              title="Cached documents"
              subtitle="Switch the active source, review expiry, or remove stale documents."
              action={
                activeCacheName ? (
                  <Button type="button" size="sm" variant="outline" onClick={clearActive}>
                    Clear active
                  </Button>
                ) : null
              }
            >
              {loading ? (
                <WorkspaceSurface accent="#728ba6">
                  <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
                    <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
                  </div>
                </WorkspaceSurface>
              ) : caches.length === 0 ? (
                <WorkspaceEmptyState
                  icon={BookOpen}
                  title="No cached documents yet"
                  description="Upload your first PDF above to create a tutor-ready source."
                />
              ) : (
                <div className="space-y-3">
                  {caches.map((cache) => (
                    <WorkspaceSurface
                      key={cache.id}
                      accent={
                        activeCacheName === cache.geminiCacheName ? '#7a8f6e' : '#728ba6'
                      }
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {cache.displayName}
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {formatExpiry(cache.expiresAt)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {activeCacheName === cache.geminiCacheName ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-data-pass)]/30 bg-[var(--color-data-pass)]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-data-pass)]">
                              <Check className="h-3.5 w-3.5" />
                              Active
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setActiveCache(cache.geminiCacheName, cache.displayName)}
                            >
                              Set active
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(cache.geminiCacheName)}
                            disabled={deletingName === cache.geminiCacheName}
                          >
                            {deletingName === cache.geminiCacheName ? (
                              <InlineSpinner size="sm" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Remove
                          </Button>
                        </div>
                      </div>
                    </WorkspaceSurface>
                  ))}
                </div>
              )}
            </WorkspaceSection>
          </div>

          <div className="space-y-6">
            <WorkspaceSection
              title="How this works"
              subtitle="Use this space as a document-grounded companion for tutoring, review, and multimodal study tools."
            >
              <WorkspaceSurface accent="#9a7f9a" className="space-y-4">
                <div className="workspace-subsurface rounded-[1.25rem] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4 text-[var(--color-accent)]" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Context caching
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    Upload a PDF, set it active, and the tutor can answer from that material rather
                    than relying only on generic clinical knowledge.
                  </p>
                </div>

                <div className="workspace-subsurface rounded-[1.25rem] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--color-data-pass)]" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Active source
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    {activeCacheName
                      ? `The tutor is currently grounded in ${activeCacheDisplayName || 'your selected document'}.`
                      : 'No active source selected yet. Pick one from the document list when you are ready.'}
                  </p>
                </div>
              </WorkspaceSurface>
            </WorkspaceSection>

            <WorkspaceSection
              title="Clinical motion clips"
              subtitle="Generate short movement-oriented videos for neurology and MSK review."
            >
              <WorkspaceSurface accent="#b39b6c" className="space-y-4">
                <div className="space-y-2">
                  {veoPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setVeoPrompt(preset)}
                      className="workspace-subsurface-interactive w-full rounded-[1.1rem] px-4 py-3 text-left text-sm text-[var(--color-text-secondary)]"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Or enter your own motion clip prompt"
                  value={veoPrompt}
                  onChange={(event) => setVeoPrompt(event.target.value)}
                  className="workspace-field w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                />

                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={handleVeoGenerate}
                  disabled={veoLoading}
                >
                  {veoLoading ? (
                    <InlineSpinner size="sm" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  Generate clip
                </Button>

                {veoError ? (
                  <p className="text-sm text-[var(--color-data-fail)]" role="alert">
                    {veoError}
                  </p>
                ) : null}

                {veoResult?.videoUrl ? (
                  <video
                    src={veoResult.videoUrl}
                    controls
                    className="w-full rounded-[1.25rem] border border-[color:color-mix(in_srgb,var(--color-text-primary)_8%,transparent)]"
                  />
                ) : null}

                {veoResult?.jobId && !veoResult.videoUrl ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Generation started (job: {veoResult.jobId}). Poll for completion once the async
                    endpoint is wired.
                  </p>
                ) : null}
              </WorkspaceSurface>
            </WorkspaceSection>
          </div>
        </WorkspaceSplit>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.14}>
        <WorkspaceSection
          title="Chat with your active library"
          subtitle="Ask targeted questions against the currently selected document and keep the answer grounded in that source."
        >
          {!activeCacheName ? (
            <WorkspaceEmptyState
              icon={MessageSquare}
              title="Choose an active document first"
              description="Set an active source above, then ask focused questions against that document here."
            />
          ) : (
            <WorkspaceSurface accent="#728ba6" className="space-y-4">
              {libraryError ? (
                <div className="rounded-[1.1rem] border border-[var(--color-data-fail)]/25 bg-[var(--color-data-fail)]/10 p-4 text-sm text-[var(--color-data-fail)]">
                  {libraryError}
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <label className="block">
                  <span className="sr-only">Ask a question about your active library document</span>
                  <input
                    type="text"
                    value={libraryQuestion}
                    onChange={(event) => setLibraryQuestion(event.target.value)}
                    placeholder="Ask a question about your active document…"
                    className="workspace-field w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  />
                </label>

                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={!libraryQuestion.trim() || libraryLoading}
                  onClick={async () => {
                    const question = libraryQuestion.trim();
                    if (!question) return;
                    if (!activeCacheName) {
                      setLibraryError('Set an active library first.');
                      return;
                    }
                    setLibraryLoading(true);
                    setLibraryAnswer('');
                    setLibraryError(null);
                    try {
                      const prompt = `You are a clinical tutor helping a PA student study from their uploaded document.

Use ONLY the content of the cached document as your primary source. If the question cannot be answered from that document, say so briefly.

Student's question:
${question}

Provide a concise, clinically focused answer (3-6 sentences).`;
                      const { callGeminiTextStreaming } = await import('@/services/ai/geminiService');
                      await callGeminiTextStreaming('gemini-2.0-flash-exp', prompt, 0.7, {
                        getToken,
                        cachedContent: activeCacheName,
                        onChunk: (chunk) => {
                          setLibraryAnswer((previous) => previous + chunk);
                        },
                        onComplete: () => {
                          setLibraryLoading(false);
                        },
                        onError: () => {
                          setLibraryError(
                            "Sorry, I couldn't answer that right now. Please try again in a moment."
                          );
                          setLibraryLoading(false);
                        },
                      });
                    } catch {
                      setLibraryError(
                        "Sorry, I couldn't answer that right now. Please try again in a moment."
                      );
                      setLibraryLoading(false);
                    }
                  }}
                >
                  {libraryLoading ? (
                    <InlineSpinner size="sm" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  Ask library
                </Button>
              </div>

              {libraryLoading || libraryAnswer ? (
                <div className="workspace-subsurface rounded-[1.25rem] p-4">
                  {libraryLoading && !libraryAnswer ? (
                    <p className="text-sm text-[var(--color-text-secondary)]">Thinking…</p>
                  ) : null}
                  {libraryAnswer ? (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--color-text-primary)]">
                      {libraryAnswer}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </WorkspaceSurface>
          )}
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
}

export default MyLibraryPage;
