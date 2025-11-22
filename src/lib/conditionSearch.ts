import {
  CONDITION_REGISTRY,
  buildConditionDefinition,
  type ConditionMeta,
} from "../../conditionRegistry.ts";
import type { SystemCode } from "../../types.ts";

export interface ConditionSearchResult {
  id: string;
  condition: string;
  system: SystemCode;
  subcategory: string;
  aliases: string[];
  score: number;
}

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

export function searchConditions(
  rawQuery: string
): ConditionSearchResult[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const results: ConditionSearchResult[] = [];

  for (const meta of CONDITION_REGISTRY) {
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
        condition: meta.condition,
        system: meta.system,
        subcategory: meta.subcategory,
        aliases,
        score: bestScore,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.condition.localeCompare(b.condition))
    .slice(0, 30);
}

export function findConditionMetaById(id: string): ConditionMeta | undefined {
  return CONDITION_REGISTRY.find(
    (meta) => buildConditionDefinition(meta).id === id
  );
}
