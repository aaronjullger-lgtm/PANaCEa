// src/lib/unifiedSearch.ts
// Unified search that intelligently combines and ranks conditions and drugs

import { searchConditions } from "./conditionSearch";
import { searchDrugs } from "./drugSearch";
import type { ConditionSearchResult } from "./conditionSearch";
import type { DrugSearchResult } from "../../pharm/drugTypes";

export type UnifiedSearchResultType = "condition" | "drug";

export interface UnifiedSearchResult {
  type: UnifiedSearchResultType;
  id: string;
  name: string;
  subtitle: string;
  score: number;
  // Original data for type-specific rendering
  conditionData?: ConditionSearchResult;
  drugData?: DrugSearchResult;
}

/**
 * Scoring boost for conditions to prioritize them over drugs
 * Conditions are generally more clinically relevant when searching
 */
const CONDITION_BOOST = 1.5;

/**
 * Unified search that combines conditions and drugs with intelligent ranking.
 * Conditions receive a scoring boost to appear higher in results by default.
 */
export function unifiedSearch(query: string): UnifiedSearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  // Search both conditions and drugs
  const conditionResults = searchConditions(trimmedQuery);
  const drugResults = searchDrugs(trimmedQuery);

  // Convert to unified format
  const unifiedResults: UnifiedSearchResult[] = [];

  // Add conditions with boosted scores
  for (const condition of conditionResults) {
    unifiedResults.push({
      type: "condition",
      id: condition.id,
      name: condition.condition,
      subtitle: `${condition.system} • ${condition.subcategory}`,
      score: condition.score * CONDITION_BOOST,
      conditionData: condition,
    });
  }

  // Add drugs
  for (const drug of drugResults) {
    unifiedResults.push({
      type: "drug",
      id: drug.id,
      name: drug.drugName,
      subtitle: `${drug.drugClass}${drug.subclass ? ` • ${drug.subclass}` : ""}`,
      score: drug.score,
      drugData: drug,
    });
  }

  // Sort by score (descending) and then by name
  unifiedResults.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.01) {
      return a.name.localeCompare(b.name);
    }
    return b.score - a.score;
  });

  // Return top 20 results
  return unifiedResults.slice(0, 20);
}
