/**
 * SmartPDFViewer – PDF viewer with Adobe Embed API, citation highlights, and Ask the Tutor.
 *
 * - Renders PDF via Adobe PDF Embed SDK (script: documentcloud.adobe.com/view-sdk/main.js).
 * - Liquid Mode toggle (enableLinearization); highlights disabled when Liquid Mode is on.
 * - Citation overlay: accepts highlights as { page, bounds: [x,y,w,h] } (PDF coords, bottom-left)
 *   or { page, highlightBox: { top, left, width, height } } (percent). Converts PDF → viewport when needed.
 * - Ask the Tutor: on text selection, "Ask the Tutor" sends selected text to parent (e.g. Gemini Chat).
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MessageCircle, AlertTriangle } from 'lucide-react';
import type { AdobeDCViewPreviewConfig, AdobeDCViewerAPIs } from '@/types/adobe-pdf-embed';
import { pdfBoundsToPercent } from '@/lib/utils/pdfCoordinates';
import { InlineSpinner } from '@/components/loading';

const ADOBE_VIEW_SDK_URL = 'https://documentcloud.adobe.com/view-sdk/main.js';
const ADOBE_READY_EVENT = 'adobe_dc_view_sdk.ready';

/** PDF coords: [x, y, width, height] with bottom-left origin (72 DPI typical). */
export type CitationBounds = [number, number, number, number];

/** Pre-converted percentage box (top-left origin). */
export interface CitationHighlightBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Single citation: either raw PDF bounds or pre-converted highlightBox (percent). */
export interface CitationHighlight {
  page: number;
  /** PDF coords [x, y, w, h] – converted to percent using optional page dimensions. */
  bounds?: CitationBounds;
  /** Pre-converted percent (top, left, width, height). Used when present; otherwise bounds + pageDimensions. */
  highlightBox?: CitationHighlightBox;
}

/** Optional page dimensions for PDF→percent conversion (default 612×792). */
export interface PageDimensions {
  width?: number;
  height?: number;
}

export interface AdobeRequestHeader {
  key: string;
  value: string;
}

export interface SmartPDFViewerProps {
  /** URL of the PDF to display. */
  readonly pdfUrl: string;
  /** Display name for the file. */
  readonly fileName?: string;
  /** Adobe PDF Embed API client ID (required for non-demo domains). */
  readonly clientId: string;
  /** Citation highlights: page + bounds (PDF coords) or highlightBox (percent). */
  readonly highlights?: CitationHighlight[];
  /** Optional page dimensions for bounds→percent (default 612×792). */
  readonly pageDimensions?: PageDimensions;
  /**
   * Optional headers for PDF download (token-based auth).
   * Passed to Adobe previewFile via content.location.headers.
   */
  readonly requestHeaders?: AdobeRequestHeader[];
  /** Callback when user requests "Ask the Tutor" with selected text. */
  readonly onAskTutor?: (selectedText: string) => void;
  /** Citation location for Smart Overlay: jump to this page (and optional x,y) via gotoLocation (works in Liquid Mode reflow). */
  readonly citationLocation?: { page: number; x?: number; y?: number };
  /** Optional class for the outer container. */
  readonly className?: string;
  /** Min height for the sizing container (responsive). */
  readonly minHeight?: string;
  /** Height for the sizing container (e.g. "70vh"). */
  readonly height?: string;
}

const DEFAULT_PAGE_WIDTH = 612;
const DEFAULT_PAGE_HEIGHT = 792;

/** Normalize all highlights to { page, highlightBox } (percent). */
function normalizeHighlights(
  highlights: CitationHighlight[],
  pageDimensions: PageDimensions
): Array<{ page: number; highlightBox: CitationHighlightBox }> {
  const w = pageDimensions.width ?? DEFAULT_PAGE_WIDTH;
  const h = pageDimensions.height ?? DEFAULT_PAGE_HEIGHT;
  return highlights.map((item) => {
    if (item.highlightBox) {
      return { page: item.page, highlightBox: item.highlightBox };
    }
    if (item.bounds && item.bounds.length >= 4) {
      const [x, y, bw, bh] = item.bounds;
      return {
        page: item.page,
        highlightBox: pdfBoundsToPercent(x, y, bw, bh, w, h) as CitationHighlightBox,
      };
    }
    return {
      page: item.page,
      highlightBox: { top: 0, left: 0, width: 100, height: 5 },
    };
  });
}

export function SmartPDFViewer({
  pdfUrl,
  fileName = 'document.pdf',
  clientId,
  highlights = [],
  pageDimensions = {},
  requestHeaders,
  onAskTutor,
  citationLocation,
  className = '',
  minHeight = '400px',
  height = '70vh',
}: SmartPDFViewerProps) {
  const uniqueId = useId();
  const divId = `adobe-dc-view-${uniqueId.replaceAll(':', '-')}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [liquidMode, setLiquidMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [askBubbleType, setAskBubbleType] = useState<'hint' | 'sent' | null>(null);
  const viewerPromiseRef = useRef<Promise<AdobeDCViewerAPIs> | null>(null);
  const askBubbleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedHighlights = useMemo(
    () => normalizeHighlights(highlights, pageDimensions),
    [highlights, pageDimensions]
  );

  const currentPageHighlights = useMemo(() => {
    if (liquidMode || normalizedHighlights.length === 0) return [];
    return normalizedHighlights.filter((h) => h.page === currentPage);
  }, [liquidMode, normalizedHighlights, currentPage]);

  // Load Adobe View SDK script once
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const existing = document.querySelector(`script[src="${ADOBE_VIEW_SDK_URL}"]`);
    if (existing) {
      if (
        (globalThis as unknown as Window & { adobe_dc_view_sdk_ready?: boolean })
          .adobe_dc_view_sdk_ready
      ) {
        setSdkReady(true);
      } else {
        document.addEventListener(ADOBE_READY_EVENT, () => setSdkReady(true));
      }
      return;
    }
    const script = document.createElement('script');
    script.src = ADOBE_VIEW_SDK_URL;
    script.async = true;
    script.onload = () => {
      (
        globalThis as unknown as Window & { adobe_dc_view_sdk_ready?: boolean }
      ).adobe_dc_view_sdk_ready = true;
      setSdkReady(true);
    };
    script.onerror = () => setError('Failed to load Adobe PDF Embed SDK.');
    document.head.appendChild(script);
  }, []);

  // Initialize viewer when SDK is ready and container exists
  useEffect(() => {
    if (!sdkReady || !clientId || !containerRef.current) return;
    const AdobeDC = (globalThis as unknown as Window).AdobeDC;
    if (!AdobeDC) {
      setError('Adobe PDF Embed SDK not available.');
      return;
    }

    setError(null);
    const view = new AdobeDC.View({ clientId, divId });

    const previewConfig: AdobeDCViewPreviewConfig = {
      embedMode: 'SIZED_CONTAINER',
      showDownloadPDF: true,
      showPrintPDF: true,
      showPageControls: true,
      showAnnotationTools: true,
      enableLinearization: liquidMode,
    };

    const promise = view.previewFile(
      {
        content: {
          location: {
            url: pdfUrl,
            ...(requestHeaders && requestHeaders.length > 0 ? { headers: requestHeaders } : {}),
          },
        },
        metaData: { fileName },
      },
      previewConfig
    ) as Promise<AdobeDCViewerAPIs>;

    viewerPromiseRef.current = promise;
    promise
      .then(() => {
        setViewerReady(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load PDF.');
        setViewerReady(false);
      });

    return () => {
      viewerPromiseRef.current = null;
      setViewerReady(false);
    };
  }, [sdkReady, clientId, divId, pdfUrl, fileName, liquidMode, requestHeaders]);

  // Poll current page when viewer is ready
  useEffect(() => {
    if (!viewerReady || !viewerPromiseRef.current) return;
    const interval = setInterval(async () => {
      try {
        const viewer = viewerPromiseRef.current ? await viewerPromiseRef.current : undefined;
        if (!viewer?.getAPIs) return;
        const apis = await viewer.getAPIs();
        const page = await apis.getCurrentPage?.();
        if (typeof page === 'number') setCurrentPage(page);
      } catch {
        // ignore
      }
    }, 500);
    return () => clearInterval(interval);
  }, [viewerReady]);

  // Smart Overlay: when backend returns a citation (path/bounds), jump to that location (works in Liquid Mode)
  useEffect(() => {
    if (!viewerReady || !citationLocation || !viewerPromiseRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const viewer = await viewerPromiseRef.current;
        if (!viewer?.getAPIs || cancelled) return;
        const apis = await viewer.getAPIs();
        const { page, x, y } = citationLocation;
        await apis.gotoLocation?.(page, x, y);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerReady, citationLocation?.page, citationLocation?.x, citationLocation?.y]);

  useEffect(() => {
    return () => {
      if (askBubbleTimeoutRef.current) clearTimeout(askBubbleTimeoutRef.current);
    };
  }, []);

  const handleAskTutor = useCallback(async () => {
    if (!onAskTutor) return;
    if (askBubbleTimeoutRef.current) {
      clearTimeout(askBubbleTimeoutRef.current);
      askBubbleTimeoutRef.current = null;
    }
    try {
      const viewer = viewerPromiseRef.current ? await viewerPromiseRef.current : undefined;
      if (!viewer?.getAPIs) {
        setAskBubbleType('hint');
        askBubbleTimeoutRef.current = setTimeout(() => setAskBubbleType(null), 3000);
        return;
      }
      const apis = await viewer.getAPIs();
      const result = await apis.getSelectedContent?.();
      if (result?.data?.trim()) {
        onAskTutor(result.data.trim());
        setAskBubbleType('sent');
        askBubbleTimeoutRef.current = setTimeout(() => setAskBubbleType(null), 2000);
      } else {
        setAskBubbleType('hint');
        askBubbleTimeoutRef.current = setTimeout(() => setAskBubbleType(null), 3000);
      }
    } catch {
      setAskBubbleType('hint');
      askBubbleTimeoutRef.current = setTimeout(() => setAskBubbleType(null), 3000);
    }
  }, [onAskTutor]);

  return (
    <div
      className={`flex flex-col rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] ${className}`}
    >
      {/* Toolbar: Liquid Mode + Ask the Tutor */}
      <div className="flex items-center justify-between gap-3 p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={liquidMode}
            onChange={(e) => setLiquidMode(e.target.checked)}
            className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          <span className="text-sm text-[var(--color-text-primary)]">
            Liquid Mode (mobile-friendly)
          </span>
        </label>
        {onAskTutor && (
          <div className="relative">
            <button
              type="button"
              onClick={handleAskTutor}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              Ask the Tutor
            </button>
            {askBubbleType && (
              <div
                className="absolute right-0 top-full mt-1 px-2 py-1 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] shadow-lg z-10 whitespace-nowrap"
                aria-live="polite"
                aria-atomic="true"
              >
                {askBubbleType === 'sent'
                  ? 'Sent to tutor. Ask your question in the chat.'
                  : 'Select text in the PDF, then click "Ask the Tutor" to send it to the chat.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Liquid Mode: citation highlights not supported */}
      {liquidMode && highlights.length > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 bg-data-provisional/10 border-b border-data-provisional/20 text-data-provisional text-sm"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          <span>
            Citation highlights are disabled in Liquid Mode because layout and coordinates differ.
            Turn off Liquid Mode to see highlights.
          </span>
        </div>
      )}

      {error && (
        <div
          className="flex items-center gap-2 px-3 py-2 bg-[var(--color-data-fail)]/10 border-b border-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] text-sm"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {/* SizingContainer: responsive height per Adobe View Configurations */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full min-w-0"
        style={{ minHeight, height }}
      >
        {!sdkReady && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-secondary)]"
            role="status"
            aria-live="polite"
            aria-label="Loading PDF viewer"
          >
            <InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />
          </div>
        )}
        <div
          id={divId}
          className="w-full h-full"
          style={{ minHeight, height }}
          aria-label="PDF document viewer"
        />

        {/* Highlight overlay: only when not Liquid Mode and we have highlights for current page */}
        {viewerReady && currentPageHighlights.length > 0 && (
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            {currentPageHighlights.map((item, idx) => (
              <div
                key={`${item.page}-${idx}`}
                className="absolute border-2 border-data-provisional/80 bg-data-provisional/20 rounded-sm"
                style={{
                  top: `${item.highlightBox.top}%`,
                  left: `${item.highlightBox.left}%`,
                  width: `${item.highlightBox.width}%`,
                  height: `${item.highlightBox.height}%`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
