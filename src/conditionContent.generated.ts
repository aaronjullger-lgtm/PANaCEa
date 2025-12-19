// src/conditionContent.generated.ts
// This file MUST NOT import @google/genai or any server SDK.
// It only loads the pre-generated JSON created by the generator script.

import { getApiEndpoint, API_ENDPOINTS } from '../lib/utils/apiConfig';

export interface ConditionContent {
  overview?: string;
  keyPoints?: string[];
  redFlags?: string[];
  treatmentPearls?: string[];
  mediaIds?: string[];
  diagnostics?: { notes?: string };
  etiologyPathophysiology?: string;
  epidemiology?: string;
  riskFactors?: string[];
  clinicalPresentation?: string;
  symptoms?: string[];
  examFindings?: string[];
  treatment?: string[];
  management?: string[];
  complications?: string[];
  prognosis?: string;
  aliases?: string[];
}

// Lazy-load condition content to improve initial bundle size
let conditionContentCache: Record<string, ConditionContent> | null = null;

type ConditionContentPatch =
  | ConditionContent
  | string
  | undefined
  | null;

function mergeConditionContent(
  base: Record<string, ConditionContent>,
  patch: Record<string, ConditionContentPatch>
): Record<string, ConditionContent> {
  const merged: Record<string, ConditionContent> = { ...base };

  for (const [id, override] of Object.entries(patch)) {
    if (!override) continue;

    const baseEntry = merged[id] ?? {};

    if (typeof override === "string") {
      merged[id] = { ...baseEntry, overview: override };
    } else {
      merged[id] = { ...baseEntry, ...override };
    }
  }

  return merged;
}

/**
 * Lazily load and merge condition content
 */
export async function loadConditionContent(): Promise<Record<string, ConditionContent>> {
  if (conditionContentCache) {
    return conditionContentCache;
  }

  try {
    // Load from Database API
    // This ensures we use the most up-to-date content from the DB
    const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);
    const response = await fetch(apiUrl);
    
    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    
    if (response.ok && contentType?.includes('application/json')) {
      const data = await response.json();
      if (Object.keys(data).length > 0) {
        // Content loaded from database
        conditionContentCache = data;
        return data;
      }
    } else if (!contentType?.includes('application/json')) {
      console.warn('⚠ Database API unavailable - backend server may not be running');
    } else if (response.status === 503) {
      console.error('⚠ Database unavailable - check DATABASE_URL configuration');
    }
  } catch (error) {
    console.error('Failed to load content from database:', error instanceof Error ? error.message : 'Unknown error');
  }

  // No static file fallback - enforce database-first architecture
  // Return empty object to prevent crashes
  conditionContentCache = {};
  return {};
}

/**
 * @deprecated Legacy synchronous export for backward compatibility.
 * WARNING: This object is empty until loadConditionContent() is called.
 * 
 * Migration path:
 * - Replace: const data = CONDITION_CONTENT;
 * - With: const data = await loadConditionContent();
 * 
 * This synchronous export will be removed in a future version.
 */
export const CONDITION_CONTENT: Record<string, ConditionContent> = {};
