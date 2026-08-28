/**
 * Browser-Safe Condition Content Service
 *
 * This service provides condition content fetching via API calls,
 * safe for use in browser environments (no Prisma/fs imports).
 */

import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';
import type { SystemCode } from '../types';

export interface ConditionContentData {
  overview?: string;
  pathophysiology?: string;
  // These fields may be arrays OR strings from inconsistent DB data
  symptoms?: string[] | string;
  signs?: string[] | string;
  diagnostics?: unknown;
  treatment?: string[] | string;
  differentialDiagnosis?: string[] | string;
  complications?: string[] | string;
  prognosis?: string;
  classicTriad?: string[] | string;
  buzzwords?: string[] | string;
  clinicalPearls?: unknown;
  examFindings?: string[] | string;
  riskFactors?: string[] | string;
  firstLineTests?: string[] | string;
  goldStandardTest?: string;
  firstLineTreatment?: string;
  contraindications?: string[] | string;
  monitoring?: string[] | string;
  patientEducation?: string;
  aiConfidence?: number;
}

export interface LoadedConditionContent {
  found: boolean;
  conditionId?: string;
  condition?: string;
  system?: SystemCode;
  subcategory?: string;
  content?: ConditionContentData;
  message?: string;
}

// Cache for condition content to reduce API calls
const contentCache = new Map<string, { data: LoadedConditionContent; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Safely format array-like fields from the database
 * Handles inconsistent data: arrays, strings, null/undefined
 */
function safeArrayJoin(value: unknown, separator = ', '): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(separator);
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

/**
 * Check if a field has meaningful array-like content
 */
function hasArrayContent(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return false;
}

/**
 * Fetch condition content from the API (browser-safe)
 */
export async function fetchConditionContent(
  conditionName: string
): Promise<LoadedConditionContent> {
  const cacheKey = conditionName.toLowerCase();
  const now = Date.now();

  // Check cache first
  const cached = contentCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `/api/conditions/content?name=${encodeURIComponent(conditionName)}`
    );

    if (!response.ok) {
      console.warn(
        `[ConditionContentService] Failed to fetch content for ${conditionName}: ${response.status}`
      );
      return { found: false, message: `API error: ${response.status}` };
    }

    const data = unwrapApiEnvelope<LoadedConditionContent>(await response.json());

    // Cache the result
    contentCache.set(cacheKey, { data, timestamp: now });

    return data;
  } catch (error) {
    console.error(`[ConditionContentService] Error fetching ${conditionName}:`, error);
    return { found: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check if condition content has meaningful data for question generation
 */
export function hasCompleteContent(content: LoadedConditionContent): boolean {
  if (!content.found || !content.content) return false;

  const c = content.content;

  // Check for key content fields (using safe array check)
  const hasOverview = Boolean(c.overview && c.overview.length > 50);
  const hasSymptoms = hasArrayContent(c.symptoms);
  const hasTreatment = hasArrayContent(c.treatment);
  const hasPearls = Boolean(c.clinicalPearls);

  // Require at least 2 meaningful content areas
  const meaningfulAreas = [hasOverview, hasSymptoms, hasTreatment, hasPearls].filter(
    Boolean
  ).length;

  return meaningfulAreas >= 2;
}

/**
 * Build context string from condition content for Gemini prompts
 */
export function buildDatabaseContext(content: LoadedConditionContent): string {
  if (!content.found || !content.content) return '';

  const c = content.content;
  const parts: string[] = [];

  parts.push(
    `=== Database Content for ${content.condition || 'Unknown'} (${content.system || 'Unknown'}) ===`
  );

  if (c.overview) {
    parts.push(`\nOverview: ${c.overview}`);
  }

  if (c.pathophysiology) {
    parts.push(`\nPathophysiology: ${c.pathophysiology}`);
  }

  // Use safeArrayJoin for all array-like fields to handle string/array/null inconsistency
  if (hasArrayContent(c.symptoms)) {
    parts.push(`\nKey Symptoms: ${safeArrayJoin(c.symptoms)}`);
  }

  if (hasArrayContent(c.signs)) {
    parts.push(`\nClinical Signs: ${safeArrayJoin(c.signs)}`);
  }

  if (hasArrayContent(c.examFindings)) {
    parts.push(`\nExam Findings: ${safeArrayJoin(c.examFindings)}`);
  }

  if (hasArrayContent(c.classicTriad)) {
    parts.push(`\nClassic Triad: ${safeArrayJoin(c.classicTriad)}`);
  }

  if (hasArrayContent(c.buzzwords)) {
    parts.push(`\nBuzzwords: ${safeArrayJoin(c.buzzwords)}`);
  }

  if (hasArrayContent(c.riskFactors)) {
    parts.push(`\nRisk Factors: ${safeArrayJoin(c.riskFactors)}`);
  }

  if (hasArrayContent(c.firstLineTests)) {
    parts.push(`\nFirst-Line Tests: ${safeArrayJoin(c.firstLineTests)}`);
  }

  if (c.goldStandardTest) {
    parts.push(`\nGold Standard Test: ${c.goldStandardTest}`);
  }

  if (hasArrayContent(c.treatment)) {
    parts.push(`\nTreatment: ${safeArrayJoin(c.treatment)}`);
  }

  if (c.firstLineTreatment) {
    parts.push(`\nFirst-Line Treatment: ${c.firstLineTreatment}`);
  }

  if (hasArrayContent(c.differentialDiagnosis)) {
    parts.push(`\nDifferential Diagnosis: ${safeArrayJoin(c.differentialDiagnosis)}`);
  }

  if (hasArrayContent(c.complications)) {
    parts.push(`\nComplications: ${safeArrayJoin(c.complications)}`);
  }

  if (c.prognosis) {
    parts.push(`\nPrognosis: ${c.prognosis}`);
  }

  // Handle clinical pearls (could be array or object)
  if (c.clinicalPearls) {
    if (Array.isArray(c.clinicalPearls)) {
      const pearlsText = c.clinicalPearls.slice(0, 5).join('; ');
      parts.push(`\nClinical Pearls: ${pearlsText}`);
    } else if (typeof c.clinicalPearls === 'object') {
      const pearlsObj = c.clinicalPearls as Record<string, unknown>;
      if (pearlsObj.pearls && Array.isArray(pearlsObj.pearls)) {
        const pearlsText = pearlsObj.pearls.slice(0, 5).join('; ');
        parts.push(`\nClinical Pearls: ${pearlsText}`);
      }
    }
  }

  parts.push('\n=== End Database Content ===');

  return parts.join('\n');
}

/**
 * Clear the content cache (useful for testing or forcing refresh)
 */
export function clearContentCache(): void {
  contentCache.clear();
}
