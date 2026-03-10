/**
 * My Library Page
 *
 * Lists the user's knowledge caches (Gemini Context Caching), allows setting
 * an active cache for the Tutor, uploading new files, and deleting caches.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  Check,
  Trash2,
  Upload,
  Loader2,
  Library,
  Sparkles,
  Info,
  Video,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
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
      const res = await fetch(buildApiUrl(API_ENDPOINTS.KNOWLEDGE_CACHES), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { caches: KnowledgeCacheItem[] };
      const list = data.caches ?? [];
      setCaches(list);
      // Clear active if it's no longer in the non-expired list (expired or deleted)
      const activeName = (preferences.customSettings as Record<string, unknown> | undefined)
        ?.activeKnowledgeCacheName;
      if (
        activeName &&
        typeof activeName === 'string' &&
        !list.some((c) => c.geminiCacheName === activeName)
      ) {
        const custom = (preferences.customSettings as Record<string, unknown>) ?? {};
        const next = { ...custom };
        delete next.activeKnowledgeCacheName;
        delete next.activeKnowledgeCacheDisplayName;
        await updatePreferences({ customSettings: next });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load caches');
      setCaches([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

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
        const res = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        if (activeCacheName === geminiCacheName) clearActive();
        await fetchCaches();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      } finally {
        setDeletingName(null);
      }
    },
    [getToken, activeCacheName, clearActive, fetchCaches]
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
        const uploadRes = await fetch(buildApiUrl(API_ENDPOINTS.KNOWLEDGE_UPLOAD), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data.error || `Upload failed: ${uploadRes.status}`);
        }
        const uploadData = (await uploadRes.json()) as { fileUri: string; mimeType?: string };
        const cacheRes = await fetch(buildApiUrl(API_ENDPOINTS.KNOWLEDGE_CACHE), {
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
        if (!cacheRes.ok) {
          const data = await cacheRes.json().catch(() => ({}));
          throw new Error(data.error || `Create cache failed: ${cacheRes.status}`);
        }
        setUploadDisplayName('');
        await fetchCaches();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [getToken, uploadDisplayName, fetchCaches]
  );

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    e.target.value = '';
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
      const res = await fetch(buildApiUrl('/api/veo/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, durationSeconds: 5 }),
      });
      const data = (await res.json()) as { videoUrl?: string; jobId?: string; error?: string; hint?: string };
      if (!res.ok) {
        if (res.status === 501) {
          setVeoError('Video generation coming soon. Configure Veo (Vertex AI) to enable.');
        } else {
          setVeoError(data.error || data.hint || 'Generation failed');
        }
        return;
      }
      setVeoResult(data);
    } catch (e) {
      setVeoError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setVeoLoading(false);
    }
  }, [veoPrompt, getToken]);

  const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const min = Math.round((d.getTime() - now.getTime()) / 60000);
    if (min < 60) return `Expires in ${min} min`;
    return `Expires ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onExit}
          className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Library className="w-8 h-8 text-[var(--color-accent)]" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">My Library</h1>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Upload PDFs to create a cached knowledge base. Set one as active to have the Tutor use it
        when answering your questions.
      </p>

      <details className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none text-sm font-medium text-[var(--color-text-primary)] [&::-webkit-details-marker]:hidden">
          <Info className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
          What&apos;s My Library?
        </summary>
        <div className="px-4 pb-3 pt-0 text-sm text-[var(--color-text-secondary)] space-y-2">
          <p>
            My Library uses <strong>context caching</strong> so the AI Tutor can answer from your
            own materials (e.g. a textbook PDF). Upload a PDF, set it as active, then use &quot;Ask
            Tutor&quot; in quiz explanations—answers will be grounded in that document. Caches
            expire after about an hour; you can re-upload or create a new cache anytime.
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            PDF only, max 50MB. Your active choice is saved in your preferences.
          </p>
        </div>
      </details>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-data-fail/10 text-data-fail text-sm border border-data-fail/30">
          {error}
        </div>
      )}

      {/* Active cache indicator */}
      {activeCacheName && (
        <div className="mb-4 p-3 rounded-xl bg-data-pass/10 border border-data-pass/30 flex items-center justify-between gap-2">
          <span className="text-sm text-[var(--color-text-primary)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-data-pass" />
            Tutor is using your active library.
          </span>
          <button
            type="button"
            onClick={clearActive}
            className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]"
          >
            Clear active
          </button>
        </div>
      )}

      {/* Upload */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <label
          htmlFor="my-library-display-name"
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
        >
          Add a document
        </label>
        <input
          id="my-library-display-name"
          type="text"
          placeholder="Display name (optional)"
          value={uploadDisplayName}
          onChange={(e) => setUploadDisplayName(e.target.value)}
          className="w-full mb-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
        />
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent)] cursor-pointer hover:bg-[var(--color-accent)]/30 transition-colors">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">{uploading ? 'Uploading…' : 'Choose PDF'}</span>
            <input
              type="file"
              accept="application/pdf"
              disabled={uploading}
              onChange={onFileSelect}
              className="sr-only"
              aria-label="Choose PDF file to upload"
            />
          </label>
          {uploading && <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />}
        </div>
      </div>

      {/* Clinical motion clips (Gait & Movement) */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <Video className="w-4 h-4 text-[var(--color-accent)]" />
          Clinical motion clips
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          Generate short clinical videos (e.g. gait, movement) for neurology and musculoskeletal review.
        </p>
        <div className="space-y-2 mb-3">
          {veoPresets.map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setVeoPrompt(preset)}
              className="block w-full text-left px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50 truncate"
            >
              {preset.slice(0, 60)}…
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Or enter your own prompt"
          value={veoPrompt}
          onChange={(e) => setVeoPrompt(e.target.value)}
          className="w-full mb-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
        />
        <button
          type="button"
          onClick={handleVeoGenerate}
          disabled={veoLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-sm font-medium text-[var(--color-text-inverse)] disabled:opacity-50"
        >
          {veoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
          Generate clip
        </button>
        {veoError && (
          <p className="mt-2 text-sm text-data-fail" role="alert">
            {veoError}
          </p>
        )}
        {veoResult?.videoUrl && (
          <div className="mt-3">
            <video src={veoResult.videoUrl} controls className="w-full rounded-lg border border-[var(--color-border)]" />
          </div>
        )}
        {veoResult?.jobId && !veoResult.videoUrl && (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Generation started (job: {veoResult.jobId}). Poll for completion when async endpoint is wired.
          </p>
        )}
      </div>

      {/* List */}
      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Your cached documents
        </h2>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
          </div>
        )}
        {!loading && caches.length === 0 && (
          <div className="py-12 rounded-xl border border-dashed border-[var(--color-border)] text-center text-[var(--color-text-secondary)]">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No documents yet. Upload a PDF above to create your first cache.</p>
          </div>
        )}
        {!loading && caches.length > 0 && (
          <ul className="space-y-2">
            {caches.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--color-text-primary)] truncate">
                    {c.displayName}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {formatExpiry(c.expiresAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeCacheName === c.geminiCacheName ? (
                    <span className="flex items-center gap-1 text-xs text-data-pass font-medium">
                      <Check className="w-4 h-4" /> Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveCache(c.geminiCacheName, c.displayName)}
                      className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                    >
                      Set active
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(c.geminiCacheName)}
                    disabled={deletingName === c.geminiCacheName}
                    className="p-2 rounded-md text-[var(--color-text-secondary)] hover:bg-data-fail/10 hover:text-data-fail disabled:opacity-50"
                    aria-label={`Delete ${c.displayName}`}
                  >
                    {deletingName === c.geminiCacheName && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {deletingName !== c.geminiCacheName && <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chat with your Library */}
      <div className="mt-8 pt-6 border-t border-[var(--color-border)]/60">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Chat with your Library
        </h2>
        {!activeCacheName ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Set an active document above to start chatting. The Tutor will answer using that
            document as its primary source.
          </p>
        ) : (
          <div className="space-y-3">
            {libraryError && (
              <div className="p-3 rounded-lg bg-data-fail/10 text-data-fail text-xs border border-data-fail/30">
                {libraryError}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={libraryQuestion}
                onChange={(e) => setLibraryQuestion(e.target.value)}
                placeholder="Ask a question about your active document..."
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <button
                type="button"
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
                        setLibraryAnswer((prev) => prev + chunk);
                      },
                      onComplete: () => {
                        setLibraryLoading(false);
                      },
                      onError: (err) => {
                        console.error('Library chat error:', err);
                        setLibraryError(
                          "Sorry, I couldn't answer that right now. Please try again in a moment."
                        );
                        setLibraryLoading(false);
                      },
                    });
                  } catch (err) {
                    console.error('Library chat error:', err);
                    setLibraryError(
                      "Sorry, I couldn't answer that right now. Please try again in a moment."
                    );
                    setLibraryLoading(false);
                  }
                }}
                disabled={!libraryQuestion.trim() || libraryLoading}
                className="self-start px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-semibold hover:bg-[var(--color-accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {libraryLoading ? 'Thinking…' : 'Ask'}
              </button>
            </div>
            {(libraryLoading || libraryAnswer) && (
              <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                {libraryLoading && !libraryAnswer && (
                  <p className="text-xs text-[var(--color-text-secondary)]">Thinking…</p>
                )}
                {libraryAnswer && (
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
                    {libraryAnswer}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default MyLibraryPage;
