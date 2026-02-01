/**
 * Media Matching Utility Functions
 *
 * This module provides utilities for matching media assets to medical conditions
 * using normalization, fuzzy matching, and tag extraction.
 */

/**
 * Normalizes text for comparison by lowercasing, trimming,
 * and removing punctuation, hyphens, and underscores.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, ' ') // Replace underscores, hyphens, spaces with single space
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Computes Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Edge cases
  if (m === 0) return n;
  if (n === 0) return m;

  // Create distance matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    if (row) row[0] = i;
  }

  // Initialize first row
  const firstRow = dp[0];
  if (firstRow) {
    for (let j = 0; j <= n; j++) {
      firstRow[j] = j;
    }
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    const currentRow = dp[i];
    const prevRow = dp[i - 1];
    if (!currentRow || !prevRow) continue;

    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deletion = (prevRow[j] ?? Infinity) + 1;
      const insertion = (currentRow[j - 1] ?? Infinity) + 1;
      const substitution = (prevRow[j - 1] ?? Infinity) + cost;
      currentRow[j] = Math.min(deletion, insertion, substitution);
    }
  }

  const lastRow = dp[m];
  return lastRow?.[n] ?? Math.max(m, n);
}

/**
 * Computes normalized Levenshtein-based similarity score in range [0, 1].
 * Higher scores indicate closer match.
 *
 * @param a First string to compare
 * @param b Second string to compare
 * @returns Similarity score between 0 and 1
 */
export function similarityScore(a: string, b: string): number {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);

  // Handle edge cases
  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);

  return 1 - distance / maxLength;
}

// Common trivial tokens to filter out from extracted tags
const TRIVIAL_TOKENS = new Set([
  'img',
  'image',
  'final',
  'v1',
  'v2',
  'v3',
  'copy',
  'new',
  'old',
  'test',
  'tmp',
  'temp',
  'draft',
  'edit',
  'edited',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
]);

/**
 * Extracts meaningful tags from a filename.
 * Tokenizes by underscores, hyphens, and spaces, removes extension,
 * normalizes tokens, and filters out trivial tokens.
 *
 * @param filename The filename to extract tags from
 * @returns Array of normalized, meaningful tags
 */
export function extractTags(filename: string): string[] {
  // Remove file extension
  const nameWithoutExtension = filename.replace(/\.[^.]+$/, '');

  // Split on underscores, hyphens, and spaces
  const tokens = nameWithoutExtension.split(/[_\-\s]+/);

  // Normalize and filter tokens
  return tokens
    .map((token) => normalize(token))
    .filter((token) => {
      // Filter out empty tokens
      if (!token || token.length === 0) return false;

      // Filter out trivial tokens
      if (TRIVIAL_TOKENS.has(token)) return false;

      // Filter out single character tokens
      if (token.length < 2) return false;

      return true;
    });
}

/**
 * Media asset types based on folder location.
 */
export type MediaType = 'ekg' | 'imaging' | 'labs' | 'diagram' | 'other';

/**
 * Detects the media type based on the folder path.
 *
 * @param filepath Full path to the media file
 * @returns The detected media type
 */
export function detectMediaTypeFromFolder(filepath: string): MediaType {
  const normalizedPath = filepath.toLowerCase().replace(/\\/g, '/');

  if (normalizedPath.includes('/ekg/')) {
    return 'ekg';
  }
  if (normalizedPath.includes('/imaging/')) {
    return 'imaging';
  }
  if (normalizedPath.includes('/labs/')) {
    return 'labs';
  }
  if (normalizedPath.includes('/diagrams/')) {
    return 'diagram';
  }

  return 'other';
}
