import {
  CONDITION_REGISTRY,
  buildConditionDefinition,
  type ConditionMeta,
} from "../../conditionRegistry.ts";
import type { SystemCode } from "../../types.ts";
import type { PharmacologyEntry } from "../types/pharmacology";
import { PHARMACOLOGY_REGISTRY } from "../services/pharmacologyRegistry";

export interface ConditionSearchFilters {
  system?: SystemCode;
  subcategory?: string;
}

interface BaseSearchResult {
  id: string;
  term: string;
  type: "condition" | "drug";
  score: number;
}

export interface ConditionSearchResult extends BaseSearchResult {
  type: "condition";
  condition: string;
  system: SystemCode;
  subcategory: string;
  aliases: string[];
}

export interface DrugSearchResult extends PharmacologyEntry, BaseSearchResult {
  type: "drug";
}

export type SearchResult = ConditionSearchResult | DrugSearchResult;

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function similarityScore(query: string, target: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  if (normalizedTarget.includes(normalizedQuery)) {
    const lengthBoost = normalizedQuery.length / Math.max(normalizedTarget.length, 1);
    return 2 + lengthBoost;
  }
  const distance = levenshtein(normalizedQuery, normalizedTarget);
  return 1 / (1 + distance);
}

function bestTermScore(query: string, term: string): number {
  const candidates = [term, ...term.split(/\s+|[-–—]/).filter(Boolean)];
  return candidates.reduce(
    (score, candidate) => Math.max(score, similarityScore(query, candidate)),
    0
  );
}

export function getSystemOptions(): SystemCode[] {
  return Array.from(new Set(CONDITION_REGISTRY.map((c) => c.system)));
}

export function getSubcategoryOptions(system?: SystemCode): string[] {
  const filtered = system
    ? CONDITION_REGISTRY.filter((c) => c.system === system)
    : CONDITION_REGISTRY;
  return Array.from(new Set(filtered.map((c) => c.subcategory)));
}

export function searchConditions(
  rawQuery: string,
  filters: ConditionSearchFilters = {}
): SearchResult[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const results: ConditionSearchResult[] = [];

  for (const meta of CONDITION_REGISTRY) {
    if (filters.system && meta.system !== filters.system) continue;
    if (filters.subcategory && meta.subcategory !== filters.subcategory) continue;

    const aliases = meta.aliases ?? [];
    const terms = [meta.condition, ...aliases];
    let bestScore = 0;

    for (const term of terms) {
      const score = bestTermScore(query, term);
      if (score > bestScore) bestScore = score;
    }

    if (bestScore > 0.1) {
      const id = buildConditionDefinition(meta).id;
      results.push({
        id,
        term: meta.condition,
        type: "condition",
        condition: meta.condition,
        system: meta.system,
        subcategory: meta.subcategory,
        aliases,
        score: bestScore,
      });
    }
  }

  const drugResults: DrugSearchResult[] = [];

  for (const entry of PHARMACOLOGY_REGISTRY) {
    const searchableFields = [entry.term, entry.class, entry.subclass].filter(
      Boolean
    ) as string[];

    let bestScore = 0;
    for (const term of searchableFields) {
      const score = bestTermScore(query, term);
      if (score > bestScore) bestScore = score;
    }

    if (bestScore > 0.1) {
      drugResults.push({
        ...entry,
        score: bestScore,
        term: entry.term,
        type: "drug",
      });
    }
  }

  return [...results, ...drugResults]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.term.localeCompare(b.term)
    )
    .slice(0, 30);
}

export function findConditionMetaById(id: string): ConditionMeta | undefined {
  return CONDITION_REGISTRY.find(
    (meta) => buildConditionDefinition(meta).id === id
  );
}
