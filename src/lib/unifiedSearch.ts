// src/lib/unifiedSearch.ts
// Unified search that intelligently combines and ranks conditions and drugs
// Enhanced with de-duplication, clean display, and alias matching

import { searchConditions } from "./conditionSearch";
import type { ConditionSearchResult } from "./conditionSearch";
import { searchDrugs } from "./drugSearch";
import type { DrugSearchResult } from "@/pharm/drugTypes";

export type UnifiedSearchResultType = "condition" | "drug" | "special_test" | "physiology" | "treatment";

export interface UnifiedSearchResult {
  type: UnifiedSearchResultType;
  id: string;
  name: string;
  displayName?: string; // Clean name without parentheses
  subtitle: string;
  score: number;
  matchedAlias?: string; // If search matched an alias
  url?: string; // Link to detail page
  // Original data for type-specific rendering
  conditionData?: ConditionSearchResult;
  drugData?: DrugSearchResult;
}

export interface GroupedSearchResults {
  conditions: UnifiedSearchResult[];
  pharmacology: UnifiedSearchResult[];
  concepts: UnifiedSearchResult[];
  procedures: UnifiedSearchResult[];
  diagnostics: UnifiedSearchResult[];
}

/**
 * Scoring boost for conditions to prioritize them over drugs
 * Conditions are generally more clinically relevant when searching
 */
const CONDITION_BOOST = 1.5;

/**
 * Extract clean display name (remove parentheses and their contents)
 */
function cleanDisplayName(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Fix capitalization issues (e.g., "Mrna" -> "mRNA")
 */
function fixCapitalization(name: string): string {
  const fixes: Record<string, string> = {
    'mrna': 'mRNA',
    'dna': 'DNA',
    'rna': 'RNA',
    'hiv': 'HIV',
    'aids': 'AIDS',
    'covid': 'COVID',
    'aki': 'AKI',
    'ckd': 'CKD',
    'copd': 'COPD',
    'gerd': 'GERD',
    'nsaid': 'NSAID',
    'nsaids': 'NSAIDs',
    'ace': 'ACE',
    'arb': 'ARB',
    'ssri': 'SSRI',
    'snri': 'SNRI',
  };
  
  let result = name;
  for (const [wrong, correct] of Object.entries(fixes)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    result = result.replace(regex, correct);
  }
  
  return result;
}

/**
 * Unified search that combines conditions and drugs with intelligent ranking.
 * Enhanced with de-duplication and clean display names.
 */
export function unifiedSearch(
  query: string, 
  options: { groupByType?: boolean; limit?: number } = {}
): UnifiedSearchResult[] | GroupedSearchResults {
  const { groupByType = false, limit = 30 } = options;
  const trimmedQuery = query.trim();
  
  if (!trimmedQuery) {
    return groupByType ? {
      conditions: [],
      pharmacology: [],
      concepts: [],
      procedures: [],
      diagnostics: [],
    } : [];
  }

  // Search both conditions and drugs
  const conditionResults = searchConditions(trimmedQuery);
  const drugResults = searchDrugs(trimmedQuery);

  // Convert to unified format
  const unifiedResults: UnifiedSearchResult[] = [];
  const seenConditions = new Set<string>();

  // Add conditions with boosted scores and de-duplication
  for (const condition of conditionResults) {
    // Extract base condition name (without variants like "General", "Shock States")
    const baseName = condition.condition
      .replace(/\s*\((General|Shock States|Prerenal|Intrinsic|Postrenal)\)/gi, '')
      .trim();
    
    // Skip if we've seen this base condition
    const dedupeKey = `${condition.system}__${condition.subcategory}__${baseName}`;
    if (seenConditions.has(dedupeKey)) {
      continue;
    }
    seenConditions.add(dedupeKey);
    
    // Clean the display name
    const cleanName = cleanDisplayName(condition.condition);
    const displayName = fixCapitalization(cleanName);
    
    // Check if query matched an alias
    const aliases = condition.aliases || [];
    const normalizedQuery = trimmedQuery.toLowerCase();
    const matchedAlias = aliases.find(alias => 
      alias.toLowerCase().includes(normalizedQuery) || 
      normalizedQuery.includes(alias.toLowerCase())
    );
    
    unifiedResults.push({
      type: "condition",
      id: condition.id,
      name: condition.condition,
      displayName,
      subtitle: `${condition.system} • ${condition.subcategory}`,
      score: condition.score * CONDITION_BOOST,
      matchedAlias,
      url: `/conditions/${condition.id}`,
      conditionData: condition,
    });
  }

  // Add drugs with clean names
  for (const drug of drugResults) {
    const displayName = fixCapitalization(drug.drugName);
    
    unifiedResults.push({
      type: "drug",
      id: drug.id,
      name: drug.drugName,
      displayName,
      subtitle: `${drug.drugClass}${drug.subclass ? ` • ${drug.subclass}` : ""}`,
      score: drug.score,
      url: `/drugs/${drug.id}`,
      drugData: drug,
    });
  }

  // Sort by score (descending) and then by name
  unifiedResults.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.01) {
      return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    }
    return b.score - a.score;
  });

  // Apply limit
  const limitedResults = unifiedResults.slice(0, limit);
  
  if (!groupByType) {
    return limitedResults;
  }
  
  // Group results by category
  const grouped: GroupedSearchResults = {
    conditions: [],
    pharmacology: [],
    concepts: [],
    procedures: [],
    diagnostics: [],
  };
  
  for (const result of limitedResults) {
    if (result.type === 'condition') {
      grouped.conditions.push(result);
    } else if (result.type === 'drug') {
      grouped.pharmacology.push(result);
    } else if (result.type === 'physiology') {
      grouped.concepts.push(result);
    } else if (result.type === 'special_test' || result.type === 'treatment') {
      grouped.procedures.push(result);
    }
  }
  
  return grouped;
}

export { cleanDisplayName, fixCapitalization };
