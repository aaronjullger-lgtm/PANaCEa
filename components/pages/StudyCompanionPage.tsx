/**
 * StudyCompanionPage
 *
 * End-to-end Study Companion UI:
 * - Select an approved EducationalResource (PDF)
 * - Render PDF via SmartPDFViewer (Adobe Embed)
 * - Ask questions via POST /api/study/chat
 * - Overlay citation highlights returned by the backend
 * - Click-to-Ask: selecting text in the PDF can be injected into the query
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  Loader2,
  MessageCircle,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { API_ENDPOINTS, buildApiUrl } from '@/lib/utils/apiConfig';
import { SmartPDFViewer, type CitationHighlight } from '@/components/library';

interface StudyCompanionPageProps {
  onExit: () => void;
}

interface StudyResource {
  id: string;
  title: string;
  resourceType: string;
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  storagePath: string | null;
  adobeDataPath: string | null;
  updatedAt: string;
}

export function StudyCompanionPage({ onExit }: Readonly<StudyCompanionPageProps>) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const documentSelectIdRef = useRef(`study-companion-doc-${crypto.randomUUID()}`);

  const [resources, setResources] = useState<StudyResource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId]
  );

  const [loadingResources, setLoadingResources] = useState(true);
  const [resourceError, setResourceError] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<CitationHighlight[]>([]);
  const [citationsFallback, setCitationsFallback] = useState(false);
  const [selectedTextContext, setSelectedTextContext] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const pdfUrl = useMemo(() => {
    if (!selectedId) return null;
    return buildApiUrl(API_ENDPOINTS.STUDY_RESOURCE_FILE(selectedId));
  }, [selectedId]);

  const requestHeaders = useMemo(() => {
    if (!token) return undefined;
    return [{ key: 'Authorization', value: `Bearer ${token}` }];
  }, [token]);

  const adobeClientId = import.meta.env.VITE_ADOBE_PDF_EMBED_CLIENT_ID;

  const fetchResources = useCallback(async () => {
    setLoadingResources(true);
    setResourceError(null);
    try {
      const t = await getToken();
      if (!t) {
        setResourceError('Not signed in.');
        setResources([]);
        return;
      }
      setToken(t);

      const res = await fetch(buildApiUrl(API_ENDPOINTS.STUDY_RESOURCES), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { data?: { resources?: StudyResource[] } };
      const list = data.data?.resources ?? [];
      setResources(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0]!.id);
    } catch (e) {
      setResourceError(e instanceof Error ? e.message : 'Failed to load resources');
      setResources([]);
    } finally {
      setLoadingResources(false);
    }
  }, [getToken, selectedId]);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  const clearConversation = useCallback(() => {
    setAnswer(null);
    setCitations([]);
    setCitationsFallback(false);
    setSelectedTextContext(null);
    setAskError(null);
  }, []);

  const handleAskTutor = useCallback(async () => {
    if (!selectedId) return;
    const trimmed = input.trim();
    if (!trimmed || isAsking) return;

    setIsAsking(true);
    setAskError(null);
    setAnswer(null);
    setCitations([]);
    setCitationsFallback(false);

    try {
      const t = token ?? (await getToken());
      if (!t) throw new Error('Not signed in');
      setToken(t);

      const userQuery = selectedTextContext
        ? `Selected text context:\n"""\n${selectedTextContext}\n"""\n\nQuestion:\n${trimmed}`
        : trimmed;

      const res = await fetch(buildApiUrl(API_ENDPOINTS.STUDY_CHAT), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceId: selectedId, userQuery }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        answer?: string;
        citations?: Array<{ page: number; highlightBox: { top: number; left: number; width: number; height: number } }>;
        citationsFallback?: boolean;
      };

      setAnswer(data.answer ?? null);
      const nextCitations: CitationHighlight[] =
        (data.citations ?? []).map((c) => ({ page: c.page, highlightBox: c.highlightBox })) ?? [];
      setCitations(nextCitations);
      setCitationsFallback(Boolean(data.citationsFallback));
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Failed to ask tutor');
    } finally {
      setIsAsking(false);
    }
  }, [selectedId, input, isAsking, token, getToken, selectedTextContext]);

  const onPdfAskTutor = useCallback((selectedText: string) => {
    setSelectedTextContext(selectedText);
    // Prefill input with something actionable if blank
    setInput((prev) => (prev.trim().length > 0 ? prev : 'Explain this selection and why it matters clinically.'));
    requestAnimationFrame(() => inputRef.current?.focus?.());
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 py-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onExit}
          className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[var(--color-accent)]/10">
            <BookOpen className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Study Companion</h1>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Chat with an approved textbook and see citation highlights on the PDF.
            </p>
          </div>
        </div>
      </div>

      {!adobeClientId && (
        <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Missing Adobe PDF Embed client ID</p>
            <p className="text-xs opacity-90">
              Set <span className="font-mono">VITE_ADOBE_PDF_EMBED_CLIENT_ID</span> and reload to enable the PDF viewer.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: PDF */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <label
                htmlFor={documentSelectIdRef.current}
                className="text-xs font-medium text-[var(--color-text-secondary)]"
              >
                Document
              </label>
              <div className="mt-1">
                {loadingResources ? (
                  <span className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  <select
                    id={documentSelectIdRef.current}
                    aria-label="Select study document"
                    value={selectedId ?? ''}
                    onChange={(e) => {
                      setSelectedId(e.target.value || null);
                      clearConversation();
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
                  >
                    {resources.length === 0 && <option value="">No approved PDFs available</option>}
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                )}
                {resourceError && (
                  <p className="mt-2 text-xs text-[var(--color-data-fail)]">{resourceError}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearConversation}
              className="mt-5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            >
              Clear
            </button>
          </div>

          {pdfUrl && adobeClientId ? (
            <SmartPDFViewer
              pdfUrl={pdfUrl}
              fileName={selected?.originalFilename ?? selected?.title ?? 'document.pdf'}
              clientId={adobeClientId}
              highlights={citations}
              requestHeaders={requestHeaders}
              onAskTutor={onPdfAskTutor}
              height="72vh"
              minHeight="420px"
            />
          ) : (
            <div className="h-[72vh] min-h-[420px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
              {loadingResources ? 'Loading…' : 'Select a document to begin.'}
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 overflow-hidden flex flex-col h-[72vh] min-h-[420px]">
            <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[var(--color-accent)]" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Ask the textbook</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  {selected?.title ?? 'No document selected'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {selectedTextContext && (
                <div className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs">
                  <p className="font-semibold text-[var(--color-text-primary)] mb-1">Selected text context</p>
                  <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {selectedTextContext}
                  </p>
                </div>
              )}

              {citationsFallback && (
                <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    Citation boxes are approximate (fallback). Adobe Extract data may be missing or unavailable.
                  </div>
                </div>
              )}

              {askError && (
                <div className="p-2 rounded-lg border border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10 text-xs text-[var(--color-data-fail)]">
                  {askError}
                </div>
              )}

              {!answer && !askError && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  Ask a question and the answer will appear here with citation highlights on the PDF.
                </div>
              )}

              {answer && (
                <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                  {answer}
                </div>
              )}

              {citations.length > 0 && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  Citations: {citations.map((c) => `p.${c.page}`).join(', ')}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question… (e.g., What are the diagnostic criteria?)"
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleAskTutor();
                    }
                  }}
                  disabled={!selectedId || isAsking}
                />
                <button
                  type="button"
                  onClick={() => void handleAskTutor()}
                  disabled={!selectedId || !input.trim() || isAsking}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
                >
                  {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{isAsking ? 'Asking…' : 'Ask'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default StudyCompanionPage;

