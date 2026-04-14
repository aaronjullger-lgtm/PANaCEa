/**
 * StudyCompanionPage
 *
 * Read, question, and cite against approved PDFs inside the shared workspace shell.
 */

'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Loader2, MessageCircle, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { SmartPDFViewer, type CitationHighlight } from '@/components/library';
import {
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSurface,
} from '@/components/workspace';
import { API_ENDPOINTS, buildApiUrl } from '@/lib/utils/apiConfig';

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
  const documentSelectId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [resources, setResources] = useState<StudyResource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingResources, setLoadingResources] = useState(true);
  const [resourceError, setResourceError] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<CitationHighlight[]>([]);
  const [citationsFallback, setCitationsFallback] = useState(false);
  const [selectedTextContext, setSelectedTextContext] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const selected = useMemo(
    () => resources.find((resource) => resource.id === selectedId) ?? null,
    [resources, selectedId]
  );

  const pdfUrl = useMemo(() => {
    if (!selectedId) return null;
    return buildApiUrl(API_ENDPOINTS.STUDY_RESOURCE_FILE(selectedId));
  }, [selectedId]);

  const requestHeaders = useMemo(() => {
    if (!token) return undefined;
    return [{ key: 'Authorization', value: `Bearer ${token}` }];
  }, [token]);

  const adobeClientId = import.meta.env.VITE_ADOBE_PDF_EMBED_CLIENT_ID;

  const clearConversation = useCallback((options?: { clearInput?: boolean }) => {
    setAnswer(null);
    setCitations([]);
    setCitationsFallback(false);
    setSelectedTextContext(null);
    setAskError(null);
    if (options?.clearInput) {
      setInput('');
    }
  }, []);

  const fetchResources = useCallback(async () => {
    setLoadingResources(true);
    setResourceError(null);

    try {
      const nextToken = await getToken();
      if (!nextToken) {
        setResourceError('Not signed in.');
        setResources([]);
        setSelectedId(null);
        return;
      }

      setToken(nextToken);

      const response = await fetch(buildApiUrl(API_ENDPOINTS.STUDY_RESOURCES), {
        headers: { Authorization: `Bearer ${nextToken}` },
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { data?: { resources?: StudyResource[] } };
      const list = data.data?.resources ?? [];
      setResources(list);
      setSelectedId((previous) => {
        if (previous && list.some((resource) => resource.id === previous)) {
          return previous;
        }
        return list[0]?.id ?? null;
      });
    } catch (error) {
      setResourceError(error instanceof Error ? error.message : 'Failed to load resources.');
      setResources([]);
      setSelectedId(null);
    } finally {
      setLoadingResources(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

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
      const activeToken = token ?? (await getToken());
      if (!activeToken) throw new Error('Not signed in.');
      setToken(activeToken);

      const userQuery = selectedTextContext
        ? `Selected text context:\n"""\n${selectedTextContext}\n"""\n\nQuestion:\n${trimmed}`
        : trimmed;

      const response = await fetch(buildApiUrl(API_ENDPOINTS.STUDY_CHAT), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceId: selectedId, userQuery }),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        answer?: string;
        citations?: Array<{
          page: number;
          highlightBox: { top: number; left: number; width: number; height: number };
        }>;
        citationsFallback?: boolean;
      };

      setAnswer(data.answer ?? null);
      setCitations(
        (data.citations ?? []).map((citation) => ({
          page: citation.page,
          highlightBox: citation.highlightBox,
        }))
      );
      setCitationsFallback(Boolean(data.citationsFallback));
    } catch (error) {
      setAskError(error instanceof Error ? error.message : 'Failed to ask tutor.');
    } finally {
      setIsAsking(false);
    }
  }, [getToken, input, isAsking, selectedId, selectedTextContext, token]);

  const onPdfAskTutor = useCallback((selectedText: string) => {
    setSelectedTextContext(selectedText);
    setInput((previous) =>
      previous.trim().length > 0
        ? previous
        : 'Explain this selection and why it matters clinically.'
    );
    requestAnimationFrame(() => inputRef.current?.focus?.());
  }, []);

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Study Companion',
            badgeTone: 'plum',
            title: 'Read, question, and cite directly against approved study documents.',
            subtitle:
              'Keep the PDF, the question, and the citation trail in one workspace so studying a document feels like active review instead of passive reading.',
            backLabel: 'Back to Study',
            onBack: onExit,
            status: selected?.title ?? `${resources.length} approved document${resources.length === 1 ? '' : 's'}`,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Approved PDFs"
            value={loadingResources ? '…' : resources.length}
            detail="Only approved educational resources are available in this workspace."
            icon={BookOpen}
          />
          <WorkspaceMetricCard
            label="Active document"
            value={selected ? 'Loaded' : 'Idle'}
            detail={selected?.title ?? 'Select a document to begin reading with citations.'}
            accent="#728ba6"
            icon={MessageCircle}
          />
          <WorkspaceMetricCard
            label="Citation mode"
            value="PDF-anchored"
            detail="Answers are returned alongside page-level highlight coordinates when available."
            accent="#9a7f9a"
            icon={Sparkles}
          />
          <WorkspaceMetricCard
            label="Text selection"
            value={selectedTextContext ? 'Captured' : 'Ready'}
            detail="Select text in the PDF to inject context directly into the next question."
            accent="#b39b6c"
            icon={Send}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Document-grounded review
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Use the companion to interrogate a document, not just summarize it.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                Ask questions that connect a passage to diagnosis, management, contraindications,
                or board-style reasoning. Selecting a paragraph before asking usually yields the
                sharpest answer.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Best habits in this view
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Select text before asking when the question depends on a specific excerpt.</li>
                <li>Use follow-up questions to test understanding, not just retrieve wording.</li>
                <li>When highlights fall back, treat boxes as approximate rather than exact.</li>
              </ul>
            </div>
          </div>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      {!adobeClientId ? (
        <WorkspaceReveal delay={0.1}>
          <WorkspaceSurface accent="#b39b6c" className="space-y-2">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--color-data-provisional)]" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Adobe PDF Embed client ID missing
                </p>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Set <span className="font-mono">VITE_ADOBE_PDF_EMBED_CLIENT_ID</span> to enable
                  the inline PDF viewer in this workspace.
                </p>
              </div>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      ) : null}

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Companion workspace"
          subtitle="Read on the left, ask on the right, and keep citations tied to the source document."
        >
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
            <WorkspaceSurface accent="#728ba6" padded={false} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-5">
                <div className="min-w-[16rem] flex-1 space-y-2">
                  <label
                    htmlFor={documentSelectId}
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
                  >
                    Document
                  </label>

                  {loadingResources ? (
                    <div className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading approved documents…
                    </div>
                  ) : (
                    <select
                      id={documentSelectId}
                      aria-label="Select study document"
                      value={selectedId ?? ''}
                      onChange={(event) => {
                        setSelectedId(event.target.value || null);
                        clearConversation({ clearInput: true });
                      }}
                      className="w-full rounded-[1rem] border border-white/10 bg-[var(--color-bg-primary)]/85 px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    >
                      {resources.length === 0 ? (
                        <option value="">No approved PDFs available</option>
                      ) : null}
                      {resources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.title}
                        </option>
                      ))}
                    </select>
                  )}

                  {resourceError ? (
                    <p className="text-sm text-[var(--color-data-fail)]">{resourceError}</p>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => clearConversation({ clearInput: true })}
                >
                  Clear chat
                </Button>
              </div>

              <div className="p-4">
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
                  <div className="flex min-h-[420px] h-[72vh] items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm text-[var(--color-text-secondary)]">
                    {loadingResources
                      ? 'Loading documents…'
                      : 'Select an approved document to begin.'}
                  </div>
                )}
              </div>
            </WorkspaceSurface>

            <WorkspaceSurface
              accent="#9a7f9a"
              padded={false}
              className="flex min-h-[72vh] flex-col overflow-hidden"
            >
              <div className="border-b border-white/8 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04]">
                    <MessageCircle className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Ask the textbook
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {selected?.title ?? 'No document selected'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {selectedTextContext ? (
                  <div className="rounded-[1rem] border border-white/8 bg-[var(--color-bg-primary)]/75 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        Selected text context
                      </p>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setSelectedTextContext(null)}
                      >
                        Clear
                      </Button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[var(--color-text-secondary)]">
                      {selectedTextContext}
                    </p>
                  </div>
                ) : null}

                {citationsFallback ? (
                  <div className="flex items-start gap-2 rounded-[1rem] border border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/10 p-3 text-sm text-[var(--color-data-provisional)]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      Citation boxes are approximate. Adobe Extract data may be missing or
                      unavailable for this document.
                    </div>
                  </div>
                ) : null}

                {askError ? (
                  <div className="rounded-[1rem] border border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10 p-3 text-sm text-[var(--color-data-fail)]">
                    {askError}
                  </div>
                ) : null}

                {answer ? (
                  <div className="rounded-[1rem] border border-white/8 bg-[var(--color-bg-primary)]/75 p-4 text-sm leading-7 text-[var(--color-text-primary)] whitespace-pre-wrap">
                    {answer}
                  </div>
                ) : !askError ? (
                  <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--color-text-secondary)]">
                    Ask a question and the answer will appear here with page-linked citation
                    highlights on the PDF.
                  </div>
                ) : null}

                {citations.length > 0 ? (
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Citations: {citations.map((citation) => `p.${citation.page}`).join(', ')}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-white/8 px-5 py-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask a question… (e.g. What are the diagnostic criteria?)"
                    className="flex-1 rounded-[1rem] border border-white/10 bg-[var(--color-bg-primary)]/85 px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleAskTutor();
                      }
                    }}
                    disabled={!selectedId || isAsking}
                  />

                  <Button
                    type="button"
                    loading={isAsking}
                    disabled={!selectedId || !input.trim() || isAsking}
                    onClick={() => void handleAskTutor()}
                    icon={isAsking ? undefined : Send}
                  >
                    {isAsking ? 'Asking…' : 'Ask'}
                  </Button>
                </div>
              </div>
            </WorkspaceSurface>
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
}

export default StudyCompanionPage;
