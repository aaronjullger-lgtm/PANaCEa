/**
 * Text Formatting Utilities
 * Helper functions for cleaning and formatting text for display
 */

/**
 * Strip all Markdown formatting from text
 * Removes: **, __, *, _, ##, etc.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';
  
  return text
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
    .trim();
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
        
        const cleaned = typeof item === 'string' 
          ? stripMarkdown(item) 
          : stripMarkdown(String(item));
        
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
  const accents: Record<string, any> = {
    CV: {
      bg: 'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      hover: 'hover:border-red-300 dark:hover:border-red-700',
    },
    PULM: {
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      hover: 'hover:border-blue-300 dark:hover:border-blue-700',
    },
    NEURO: {
      bg: 'bg-purple-50 dark:bg-purple-900/10',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-300',
      hover: 'hover:border-purple-300 dark:hover:border-purple-700',
    },
    GI: {
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      hover: 'hover:border-amber-300 dark:hover:border-amber-700',
    },
    MSK: {
      bg: 'bg-orange-50 dark:bg-orange-900/10',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-700 dark:text-orange-300',
      hover: 'hover:border-orange-300 dark:hover:border-orange-700',
    },
    DERM: {
      bg: 'bg-pink-50 dark:bg-pink-900/10',
      border: 'border-pink-200 dark:border-pink-800',
      text: 'text-pink-700 dark:text-pink-300',
      hover: 'hover:border-pink-300 dark:hover:border-pink-700',
    },
    ENDO: {
      bg: 'bg-teal-50 dark:bg-teal-900/10',
      border: 'border-teal-200 dark:border-teal-800',
      text: 'text-teal-700 dark:text-teal-300',
      hover: 'hover:border-teal-300 dark:hover:border-teal-700',
    },
    HEME: {
      bg: 'bg-rose-50 dark:bg-rose-900/10',
      border: 'border-rose-200 dark:border-rose-800',
      text: 'text-rose-700 dark:text-rose-300',
      hover: 'hover:border-rose-300 dark:hover:border-rose-700',
    },
    ID: {
      bg: 'bg-green-50 dark:bg-green-900/10',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      hover: 'hover:border-green-300 dark:hover:border-green-700',
    },
    PSYCH: {
      bg: 'bg-indigo-50 dark:bg-indigo-900/10',
      border: 'border-indigo-200 dark:border-indigo-800',
      text: 'text-indigo-700 dark:text-indigo-300',
      hover: 'hover:border-indigo-300 dark:hover:border-indigo-700',
    },
    RENAL: {
      bg: 'bg-cyan-50 dark:bg-cyan-900/10',
      border: 'border-cyan-200 dark:border-cyan-800',
      text: 'text-cyan-700 dark:text-cyan-300',
      hover: 'hover:border-cyan-300 dark:hover:border-cyan-700',
    },
    GU: {
      bg: 'bg-violet-50 dark:bg-violet-900/10',
      border: 'border-violet-200 dark:border-violet-800',
      text: 'text-violet-700 dark:text-violet-300',
      hover: 'hover:border-violet-300 dark:hover:border-violet-700',
    },
    HEENT: {
      bg: 'bg-sky-50 dark:bg-sky-900/10',
      border: 'border-sky-200 dark:border-sky-800',
      text: 'text-sky-700 dark:text-sky-300',
      hover: 'hover:border-sky-300 dark:hover:border-sky-700',
    },
    REPRO: {
      bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/10',
      border: 'border-fuchsia-200 dark:border-fuchsia-800',
      text: 'text-fuchsia-700 dark:text-fuchsia-300',
      hover: 'hover:border-fuchsia-300 dark:hover:border-fuchsia-700',
    },
  };
  
  // Default slate for unknown systems
  return accents[system] || {
    bg: 'bg-slate-50 dark:bg-slate-900/10',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    hover: 'hover:border-slate-300 dark:hover:border-slate-700',
  };
}
