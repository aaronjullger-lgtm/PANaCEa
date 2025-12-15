// src/lib/unifiedSearch.ts
// Unified search that intelligently combines and ranks conditions and drugs
// Enhanced with de-duplication, clean display, and alias matching

import { searchConditions } from "./conditionSearch";
import type { ConditionSearchResult } from "./conditionSearch";
import { searchDrugs } from "./drugSearch";
import type { DrugSearchResult } from "@/pharm/drugTypes";
import { SPECIAL_TEST_REGISTRY, type SpecialTestMeta } from "../../specialTestRegistry";
import { PHYSIOLOGY_CONCEPT_REGISTRY, type PhysiologyConceptMeta } from "../../physiologyRegistry";
import { TREATMENT_REGISTRY, type TreatmentMeta } from "../../treatmentRegistry";

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
 * Calculate similarity score between query and target
 */
function similarityScore(query: string, target: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTarget = target.toLowerCase().trim();
  
  // Exact match
  if (normalizedTarget === normalizedQuery) return 3;
  
  // Starts with
  if (normalizedTarget.startsWith(normalizedQuery)) return 2.5;
  
  // Contains
  if (normalizedTarget.includes(normalizedQuery)) {
    const lengthBoost = normalizedQuery.length / Math.max(normalizedTarget.length, 1);
    return 2 + lengthBoost;
  }
  
  // Word boundary match (e.g., "ACL" matches in "ACL Tear")
  const wordBoundary = new RegExp(`\\b${normalizedQuery}\\b`, 'i');
  if (wordBoundary.test(normalizedTarget)) return 2.3;
  
  return 0;
}

/**
 * Search special tests
 */
function searchSpecialTestsInternal(query: string): UnifiedSearchResult[] {
  const results: UnifiedSearchResult[] = [];
  
  for (const test of SPECIAL_TEST_REGISTRY) {
    const cleanName = cleanDisplayName(test.name);
    const displayName = fixCapitalization(test.displayName || cleanName);
    const aliases = test.aliases || [];
    
    // Check name and aliases
    let bestScore = similarityScore(query, cleanName);
    let matchedAlias: string | undefined;
    
    for (const alias of aliases) {
      const aliasScore = similarityScore(query, alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        matchedAlias = alias;
      }
    }
    
    if (bestScore > 0.3) {
      results.push({
        type: 'special_test',
        id: test.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: test.name,
        displayName,
        subtitle: `Physical Exam Test • ${test.system}`,
        score: bestScore,
        matchedAlias,
        url: `/tests/${test.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      });
    }
  }
  
  return results;
}

/**
 * Search physiology concepts
 */
function searchPhysiologyInternal(query: string): UnifiedSearchResult[] {
  const results: UnifiedSearchResult[] = [];
  
  for (const concept of PHYSIOLOGY_CONCEPT_REGISTRY) {
    const cleanName = cleanDisplayName(concept.name);
    const displayName = fixCapitalization(concept.displayName || cleanName);
    const aliases = concept.aliases || [];
    
    // Check name and aliases
    let bestScore = similarityScore(query, cleanName);
    let matchedAlias: string | undefined;
    
    for (const alias of aliases) {
      const aliasScore = similarityScore(query, alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        matchedAlias = alias;
      }
    }
    
    if (bestScore > 0.3) {
      results.push({
        type: 'physiology',
        id: concept.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: concept.name,
        displayName,
        subtitle: `Physiology • ${concept.category}`,
        score: bestScore,
        matchedAlias,
        url: `/physiology/${concept.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      });
    }
  }
  
  return results;
}

/**
 * Search treatments
 */
function searchTreatmentsInternal(query: string): UnifiedSearchResult[] {
  const results: UnifiedSearchResult[] = [];
  
  for (const treatment of TREATMENT_REGISTRY) {
    const cleanName = cleanDisplayName(treatment.name);
    const displayName = fixCapitalization(treatment.displayName || cleanName);
    const aliases = treatment.aliases || [];
    
    // Check name and aliases
    let bestScore = similarityScore(query, cleanName);
    let matchedAlias: string | undefined;
    
    for (const alias of aliases) {
      const aliasScore = similarityScore(query, alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        matchedAlias = alias;
      }
    }
    
    if (bestScore > 0.3) {
      results.push({
        type: 'treatment',
        id: treatment.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: treatment.name,
        displayName,
        subtitle: `Treatment • ${treatment.category}`,
        score: bestScore,
        matchedAlias,
        url: `/treatments/${treatment.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      });
    }
  }
  
  return results;
}

/**
 * Unified search that combines conditions and drugs with intelligent ranking.
 * Enhanced with de-duplication, clean display names, and all content types.
 */
export async function unifiedSearch(
  query: string, 
  options: { groupByType?: boolean; limit?: number } = {}
): Promise<UnifiedSearchResult[] | GroupedSearchResults> {
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

  // Search all content types
  const conditionResults = searchConditions(trimmedQuery);
  const drugResults = await searchDrugs(trimmedQuery);
  const testResults = searchSpecialTestsInternal(trimmedQuery);
  const physiologyResults = searchPhysiologyInternal(trimmedQuery);
  const treatmentResults = searchTreatmentsInternal(trimmedQuery);

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

  // Add all other content types
  unifiedResults.push(...testResults);
  unifiedResults.push(...physiologyResults);
  unifiedResults.push(...treatmentResults);

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
