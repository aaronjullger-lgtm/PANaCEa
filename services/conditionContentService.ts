/**
 * Browser-Safe Condition Content Service
 * 
 * This service provides condition content fetching via API calls,
 * safe for use in browser environments (no Prisma/fs imports).
 */

import type { SystemCode } from '../types';

export interface ConditionContentData {
  overview?: string;
  pathophysiology?: string;
  symptoms?: string[];
  signs?: string[];
  diagnostics?: unknown;
  treatment?: string[];
  differentialDiagnosis?: string[];
  complications?: string[];
  prognosis?: string;
  classicTriad?: string[];
  buzzwords?: string[];
  clinicalPearls?: unknown;
  examFindings?: string[];
  riskFactors?: string[];
  firstLineTests?: string[];
  goldStandardTest?: string;
  firstLineTreatment?: string;
  contraindications?: string[];
  monitoring?: string[];
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
 * Fetch condition content from the API (browser-safe)
 */
export async function fetchConditionContent(conditionName: string): Promise<LoadedConditionContent> {
  const cacheKey = conditionName.toLowerCase();
  const now = Date.now();
  
  // Check cache first
  const cached = contentCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const response = await fetch(`/api/conditions/content?name=${encodeURIComponent(conditionName)}`);
    
    if (!response.ok) {
      console.warn(`[ConditionContentService] Failed to fetch content for ${conditionName}: ${response.status}`);
      return { found: false, message: `API error: ${response.status}` };
    }
    
    const data: LoadedConditionContent = await response.json();
    
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
  
  // Check for key content fields
  const hasOverview = Boolean(c.overview && c.overview.length > 50);
  const hasSymptoms = Boolean(c.symptoms && c.symptoms.length > 0);
  const hasTreatment = Boolean(c.treatment && c.treatment.length > 0);
  const hasPearls = Boolean(c.clinicalPearls);
  
  // Require at least 2 meaningful content areas
  const meaningfulAreas = [hasOverview, hasSymptoms, hasTreatment, hasPearls].filter(Boolean).length;
  
  return meaningfulAreas >= 2;
}

/**
 * Build context string from condition content for Gemini prompts
 */
export function buildDatabaseContext(content: LoadedConditionContent): string {
  if (!content.found || !content.content) return '';
  
  const c = content.content;
  const parts: string[] = [];
  
  parts.push(`=== Database Content for ${content.condition} (${content.system}) ===`);
  
  if (c.overview) {
    parts.push(`\nOverview: ${c.overview}`);
  }
  
  if (c.pathophysiology) {
    parts.push(`\nPathophysiology: ${c.pathophysiology}`);
  }
  
  if (c.symptoms && c.symptoms.length > 0) {
    parts.push(`\nKey Symptoms: ${c.symptoms.join(', ')}`);
  }
  
  if (c.signs && c.signs.length > 0) {
    parts.push(`\nClinical Signs: ${c.signs.join(', ')}`);
  }
  
  if (c.examFindings && c.examFindings.length > 0) {
    parts.push(`\nExam Findings: ${c.examFindings.join(', ')}`);
  }
  
  if (c.classicTriad && c.classicTriad.length > 0) {
    parts.push(`\nClassic Triad: ${c.classicTriad.join(', ')}`);
  }
  
  if (c.buzzwords && c.buzzwords.length > 0) {
    parts.push(`\nBuzzwords: ${c.buzzwords.join(', ')}`);
  }
  
  if (c.riskFactors && c.riskFactors.length > 0) {
    parts.push(`\nRisk Factors: ${c.riskFactors.join(', ')}`);
  }
  
  if (c.firstLineTests && c.firstLineTests.length > 0) {
    parts.push(`\nFirst-Line Tests: ${c.firstLineTests.join(', ')}`);
  }
  
  if (c.goldStandardTest) {
    parts.push(`\nGold Standard Test: ${c.goldStandardTest}`);
  }
  
  if (c.treatment && c.treatment.length > 0) {
    parts.push(`\nTreatment: ${c.treatment.join(', ')}`);
  }
  
  if (c.firstLineTreatment) {
    parts.push(`\nFirst-Line Treatment: ${c.firstLineTreatment}`);
  }
  
  if (c.differentialDiagnosis && c.differentialDiagnosis.length > 0) {
    parts.push(`\nDifferential Diagnosis: ${c.differentialDiagnosis.join(', ')}`);
  }
  
  if (c.complications && c.complications.length > 0) {
    parts.push(`\nComplications: ${c.complications.join(', ')}`);
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
