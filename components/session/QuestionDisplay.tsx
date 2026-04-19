import React, { useEffect, useRef } from 'react';
import { sanitizeForRationale } from '@/lib/sanitizeHtml';

/** Regex to match <br> and <br/> for normalizing line breaks */
const BR_TAG_REGEX = /<br\s*\/?>/gi;

// Strip basic HTML tags from question text while preserving table HTML rendered separately
function stripSimpleHtmlTags(text: string): string {
  if (!text) return text;
  return text.replace(/<[^>]+>/g, '');
}

const QuestionDisplay: React.FC<{ text: string }> = React.memo(({ text }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Text highlighting logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      try {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          return;
        }

        const range = selection.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) {
          return;
        }

        const span = document.createElement('span');
        span.className = 'user-highlight';
        range.surroundContents(span);
        selection.removeAllRanges();
      } catch (highlightErr) {
        // Highlighting failed - clear selection (cross-element ranges can't be wrapped)
        console.debug('[QuestionDisplay] user-highlight failed', highlightErr);
        window.getSelection()?.removeAllRanges();
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
    };
  }, [text]);

  const hasTable = text.includes('<table');

  // ---------- TABLE BRANCH ----------
  if (hasTable) {
    // 1) Extract table HTML
    const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
    const tableHTML = tableMatch ? tableMatch[0] : '';

    // 2) Replace table with a sentinel
    const beforeAfter = text.replace(tableHTML, '|||TABLE|||');

    // 3) Normalize line breaks
    const normalized = beforeAfter
      .replace(/&lt;br\s*\/?&gt;/gi, '\n')
      .replace(BR_TAG_REGEX, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();

    const [beforeTableRaw = '', afterTableRaw = ''] = normalized.split('|||TABLE|||');

    // 4) Pull out the last sentence (the actual question) after the table
    const lastSentenceMatch = afterTableRaw.match(/[^.!?]+[.!?]+\s*$/);
    const lastSentenceRaw = lastSentenceMatch ? lastSentenceMatch[0].trim() : '';

    const vignetteAfterTableRaw = lastSentenceRaw
      ? afterTableRaw.replace(lastSentenceMatch![0], '').trim()
      : afterTableRaw.trim();

    const beforeTable = stripSimpleHtmlTags(beforeTableRaw);
    const vignetteAfterTable = stripSimpleHtmlTags(vignetteAfterTableRaw);
    const lastSentence = stripSimpleHtmlTags(lastSentenceRaw);

    return (
      <div
        ref={containerRef}
        id="question-container"
        tabIndex={-1}
        className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] rounded-xl p-6 space-y-4"
        style={{ fontSize: `calc(1em + var(--font-size-adj))`, boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
      >
        {/* Text before the table */}
        {beforeTable && <p className="whitespace-pre-wrap">{beforeTable}</p>}

        {/* Table */}
        <div
          className="my-2"
          dangerouslySetInnerHTML={{ __html: sanitizeForRationale(tableHTML) }}
        />

        {/* Any non-final text after the table */}
        {vignetteAfterTable && <p className="whitespace-pre-wrap">{vignetteAfterTable}</p>}

        {/* Final bolded question line */}
        {lastSentence && <p className="font-semibold whitespace-pre-wrap">{lastSentence}</p>}
      </div>
    );
  }

  // ---------- NON-TABLE BRANCH ----------
  const normalizedText = stripSimpleHtmlTags(
    text.replace(/&lt;br\s*\/?&gt;/gi, '\n').replace(BR_TAG_REGEX, '\n')
  );

  const lastSentenceMatch = normalizedText.match(/[^.!?]+[.!?]+\s*$/);

  if (!lastSentenceMatch) {
    return (
      <div
        ref={containerRef}
        id="question-container"
        tabIndex={-1}
        className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] whitespace-pre-wrap bg-[var(--color-bg-primary)] rounded-xl p-6"
        style={{ fontSize: `calc(1em + var(--font-size-adj))`, boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
      >
        {normalizedText}
      </div>
    );
  }

  const lastSentence = lastSentenceMatch[0].trim();
  const vignette = normalizedText.replace(lastSentenceMatch[0], '').trim();

  // Add visual enhancement (shadowed block/border) around question text for better focus
  return (
    <div
      ref={containerRef}
      id="question-container"
      tabIndex={-1}
      className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] rounded-xl p-6"
      style={{ fontSize: `calc(1em + var(--font-size-adj))`, boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
    >
      <p className="whitespace-pre-wrap">{vignette}</p>
      <p className="font-semibold mt-4 whitespace-pre-wrap">{lastSentence}</p>
    </div>
  );
});

export { QuestionDisplay };
export default QuestionDisplay;
