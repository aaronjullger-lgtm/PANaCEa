/**
 * Infographic Matching Utility Functions
 *
 * This module provides specialized utilities for matching infographic assets
 * to medical conditions using normalization, fuzzy matching, and tag extraction.
 *
 * Re-exports core utilities from mediaMatcherUtils and adds infographic-specific
 * functions like bracket tag parsing.
 */

import { similarityScore as baseSimilarityScore } from './mediaMatcherUtils.js';

// Re-export core utilities from mediaMatcherUtils
export { normalize, similarityScore, extractTags } from './mediaMatcherUtils.js';

/**
 * Parses bracket-enclosed tags from a filename.
 * Supports format: "CHF[echo-edema].png" → ["echo", "edema"]
 *
 * @param filename The filename to parse tags from
 * @returns Array of tags extracted from brackets
 */
export function parseBracketTags(filename: string): string[] {
  const tags: string[] = [];

  // Match content inside square brackets
  const bracketRegex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = bracketRegex.exec(filename)) !== null) {
    const bracketContent = match[1];
    if (bracketContent === undefined) continue;

    // Split by hyphens and dashes within brackets
    const innerTags = bracketContent
      .split(/[-_]/)
      .map((tag) => tag.toLowerCase().trim().replace(/[^\w]/g, ''));

    // Filter out empty strings
    tags.push(...innerTags.filter((t) => t.length > 0));
  }

  return tags;
}

/**
 * Normalizes text for exact comparison by removing all whitespace and special characters.
 * More aggressive normalization than the base normalize function.
 *
 * @param text Text to normalize
 * @returns Normalized string with no spaces
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, ''); // Remove everything except alphanumeric
}

/**
 * Checks if one string contains another as a substring after normalization.
 *
 * @param haystack The string to search in
 * @param needle The string to search for
 * @returns Score based on substring match (0 if no match, 0.5-0.9 based on coverage)
 */
export function substringScore(haystack: string, needle: string): number {
  const normalizedHaystack = normalizeForMatch(haystack);
  const normalizedNeedle = normalizeForMatch(needle);

  if (normalizedHaystack.length === 0 || normalizedNeedle.length === 0) {
    return 0;
  }

  // Check if needle is contained in haystack
  if (normalizedHaystack.includes(normalizedNeedle)) {
    // Score based on how much of the haystack the needle covers
    const coverage = normalizedNeedle.length / normalizedHaystack.length;
    return 0.5 + coverage * 0.4; // Returns 0.5-0.9
  }

  // Check if haystack is contained in needle (reverse containment)
  if (normalizedNeedle.includes(normalizedHaystack)) {
    const coverage = normalizedHaystack.length / normalizedNeedle.length;
    return 0.5 + coverage * 0.35; // Returns 0.5-0.85
  }

  return 0;
}

/**
 * Extracts the base name from a filename (without extension and bracket tags).
 *
 * @param filename The filename to process
 * @returns The base name without extension and bracket content
 */
export function extractBaseName(filename: string): string {
  // Remove file extension
  let baseName = filename.replace(/\.[^.]+$/, '');

  // Remove bracket content
  baseName = baseName.replace(/\[[^\]]*\]/g, '');

  // Clean up any trailing/leading dashes or underscores
  baseName = baseName.replace(/^[-_]+|[-_]+$/g, '');

  return baseName;
}

/**
 * Computes a combined match score using multiple strategies.
 * Priority order:
 * 1. Exact ID match (score = 1.0)
 * 2. Exact normalized name match (score = 1.0)
 * 3. Substring inclusion score (0.5-0.9)
 * 4. Similarity score fallback (0-1)
 *
 * @param filename Infographic filename
 * @param conditionId Condition identifier
 * @param conditionName Condition name
 * @returns Combined match score between 0 and 1
 */
export function computeMatchScore(
  filename: string,
  conditionId: string,
  conditionName: string
): number {
  const baseName = extractBaseName(filename);
  const normalizedFilename = normalizeForMatch(baseName);
  const normalizedId = normalizeForMatch(conditionId);
  const normalizedName = normalizeForMatch(conditionName);

  // Priority 1: Exact ID match
  if (normalizedFilename === normalizedId) {
    return 1.0;
  }

  // Priority 2: Exact normalized name match
  if (normalizedFilename === normalizedName) {
    return 1.0;
  }

  // Priority 3: Substring inclusion
  const substrIdScore = substringScore(baseName, conditionId);
  const substrNameScore = substringScore(baseName, conditionName);
  const maxSubstrScore = Math.max(substrIdScore, substrNameScore);

  if (maxSubstrScore >= 0.5) {
    return maxSubstrScore;
  }

  // Priority 4: Similarity score fallback
  const idSimilarity = baseSimilarityScore(baseName, conditionId);
  const nameSimilarity = baseSimilarityScore(baseName, conditionName);

  return Math.max(idSimilarity, nameSimilarity);
}
