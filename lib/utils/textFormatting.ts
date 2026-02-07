/**
 * Text Formatting Utilities
 * Helper functions for cleaning and formatting text for display
 */

/** Format a percentage for UI: 0 or 1 decimal place, never raw floats like 51.333333% */
export function formatPercentForDisplay(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`;
}

/**
 * Strip all Markdown formatting from text
 * Removes: **, __, *, _, ##, etc.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';

  return (
    text
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove list markers
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Truncate text with ellipsis if longer than maxLength
 */
export function truncateText(text: string, maxLength: number = 30): string {
  if (!text) return '';

  const cleaned = stripMarkdown(text);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Try to break at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Extract short, meaningful snippets from various content types
 * Returns array of bite-sized info pills
 */
export function extractSnippets(
  content: any,
  maxSnippets: number = 3,
  maxLength: number = 30
): string[] {
  if (!content) return [];

  const snippets: string[] = [];

  // Priority order for fields to extract
  const fieldPriority = [
    'classic_triad',
    'clinical_pearls',
    'buzzwords',
    'gold_standard_dx',
    'first_line_rx',
    'best_initial_test',
    'mnemonic',
    'classic_patient',
  ];

  for (const field of fieldPriority) {
    if (snippets.length >= maxSnippets) break;

    const value = content[field];
    if (!value) continue;

    // Handle arrays (classic_triad, clinical_pearls, buzzwords)
    if (Array.isArray(value)) {
      for (const item of value) {
        if (snippets.length >= maxSnippets) break;

        const cleaned =
          typeof item === 'string' ? stripMarkdown(item) : stripMarkdown(String(item));

        // Only include if it's reasonably short
        if (cleaned.length > 0 && cleaned.length <= maxLength * 1.5) {
          snippets.push(truncateText(cleaned, maxLength));
        }
      }
    }
    // Handle strings
    else if (typeof value === 'string') {
      const cleaned = stripMarkdown(value);
      if (cleaned.length > 0 && cleaned.length <= maxLength * 1.5) {
        snippets.push(truncateText(cleaned, maxLength));
      }
    }
  }

  return snippets;
}

/**
 * Get system color accent for visual differentiation
 */
export function getSystemAccent(system: string): {
  bg: string;
  border: string;
  text: string;
  hover: string;
} {
  const baseAccent = {
    bg: 'bg-[var(--color-bg-tertiary)]/60',
    border: 'border-[var(--color-border)]',
    text: 'text-[var(--color-text-secondary)]',
    hover: 'hover:border-[var(--color-border-strong)]',
  };

  const accents: Record<string, typeof baseAccent> = {
    CV: { ...baseAccent },
    PULM: { ...baseAccent },
    NEURO: { ...baseAccent },
    GI: { ...baseAccent },
    MSK: { ...baseAccent },
    DERM: { ...baseAccent },
    ENDO: { ...baseAccent },
    HEME: { ...baseAccent },
    ID: { ...baseAccent },
    PSYCH: { ...baseAccent },
    RENAL: { ...baseAccent },
    GU: { ...baseAccent },
    HEENT: { ...baseAccent },
    REPRO: { ...baseAccent },
  };

  return accents[system] || baseAccent;
}
