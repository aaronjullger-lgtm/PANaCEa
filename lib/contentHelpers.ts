/**
 * Content Helper Functions
 *
 * Utilities for validating database content completeness, building AI prompts,
 * and calculating search relevance scores.
 */

// FIXED: Import from client-safe types file instead of server-only conditionDataLoader
import type { ConditionData } from '../types/medical-content';

/**
 * Check if database content is complete enough for question generation
 */
export function hasCompleteContent(data: ConditionData): boolean {
  return !!(
    data.content.overview &&
    data.content.overview.length > 50 && // Meaningful overview
    (data.content.treatment?.length ?? 0) > 0 &&
    data.content.diagnostics
  );
}

/**
 * Build database context string for AI prompts
 */
export function buildDatabaseContext(data: any): string {
  const lines: string[] = [
    `Condition: ${data.name}`,
    `System: ${data.system}`,
    `Subcategory: ${data.subcategory}`,
  ];

  if (data.content.overview) {
    lines.push(`\nOverview: ${data.content.overview}`);
  }

  if (data.content.etiologyPathophysiology) {
    lines.push(`\nEtiology/Pathophysiology: ${data.content.etiologyPathophysiology}`);
  }

  if (data.content.symptoms && data.content.symptoms.length > 0) {
    lines.push(`\nKey Symptoms: ${data.content.symptoms.join(', ')}`);
  }

  if (data.content.diagnostics?.notes) {
    lines.push(`\nDiagnostics: ${data.content.diagnostics.notes}`);
  }

  if (data.content.treatment && data.content.treatment.length > 0) {
    lines.push(`\nTreatment: ${data.content.treatment.join('; ')}`);
  }

  if (data.content.complications && data.content.complications.length > 0) {
    lines.push(`\nComplications: ${data.content.complications.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Calculate relevance score for search results
 */
export function calculateRelevanceScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText === lowerQuery) return 3.0; // Exact match
  if (lowerText.startsWith(lowerQuery)) return 2.5; // Starts with
  if (lowerText.includes(lowerQuery)) return 2.0; // Contains

  // Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(lowerQuery, lowerText);
  return 1 / (1 + distance);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[a.length][b.length];
}
