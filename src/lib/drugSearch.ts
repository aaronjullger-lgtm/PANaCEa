// src/lib/drugSearch.ts
// Search functionality for pharmacological agents and treatments

import type { DrugEntry, DrugSearchResult, DrugSearchFilters } from "../../pharm/drugTypes.ts";

// Import the drug data from JSON
// Note: This will be loaded at build time by Vite
import drugDataJson from "../../pharm/drugData.json";

// Cast the imported JSON to our expected type
const drugData = drugDataJson as Record<string, DrugEntry>;

// Build a lookup for efficient searching
const drugRegistry: Map<string, DrugEntry> = new Map();

// Initialize the registry
for (const [key, entry] of Object.entries(drugData)) {
  drugRegistry.set(key.toLowerCase(), entry);
}

/**
 * Levenshtein distance for fuzzy matching
 */
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

/**
 * Calculate similarity score between query and target
 */
function similarityScore(query: string, target: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  
  // Exact match gets highest score
  if (normalizedTarget === normalizedQuery) {
    return 3;
  }
  
  // Contains match gets high score
  if (normalizedTarget.includes(normalizedQuery)) {
    const lengthBoost = normalizedQuery.length / Math.max(normalizedTarget.length, 1);
    return 2 + lengthBoost;
  }
  
  // Starts with match gets good score
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return 2.5;
  }
  
  // Fuzzy match based on Levenshtein distance
  const distance = levenshtein(normalizedQuery, normalizedTarget);
  return 1 / (1 + distance);
}

/**
 * Get the best score across multiple terms
 */
function bestTermScore(query: string, term: string | undefined | null): number {
  if (!term || typeof term !== 'string') return 0;
  const candidates = [term, ...term.split(/\s+|[-–—]/).filter(Boolean)];
  return candidates.reduce(
    (score, candidate) => Math.max(score, similarityScore(query, candidate)),
    0
  );
}

/**
 * Generate a stable ID for a drug entry
 */
function generateDrugId(drugName: string): string {
  return `DRUG__${drugName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
}

/**
 * Get list of unique drug classes
 */
export function getDrugClassOptions(): string[] {
  const classes = new Set<string>();
  for (const entry of drugRegistry.values()) {
    if (entry.class && entry.class !== "N/A") {
      classes.add(entry.class);
    }
  }
  return Array.from(classes).sort();
}

/**
 * Get list of unique drug types
 */
export function getDrugTypeOptions(): string[] {
  const types = new Set<string>();
  for (const entry of drugRegistry.values()) {
    if (entry.type && entry.type !== "N/A") {
      types.add(entry.type);
    }
  }
  return Array.from(types).sort();
}

/**
 * Search for drugs by name, class, or ingredients
 */
export function searchDrugs(
  rawQuery: string,
  filters: DrugSearchFilters = {}
): DrugSearchResult[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const results: DrugSearchResult[] = [];

  for (const [key, entry] of drugRegistry.entries()) {
    // Apply filters
    if (filters.drugClass && entry.class !== filters.drugClass) continue;
    if (filters.type && entry.type !== filters.type) continue;

    // Skip invalid entries
    if (!entry.class || entry.class === "N/A" || !entry.term || entry.term === "N/A") continue;

    // Build list of searchable terms - safely handle missing/invalid ingredients
    const ingredients = Array.isArray(entry.ingredients) 
      ? entry.ingredients.filter(i => typeof i === 'string')
      : [];
    const searchTerms = [entry.term, ...ingredients];

    let bestScore = 0;

    // Score against drug name and ingredients
    for (const term of searchTerms) {
      const score = bestTermScore(query, term);
      if (score > bestScore) bestScore = score;
    }

    // Also check if query matches the class name
    if (entry.class) {
      const classScore = bestTermScore(query, entry.class) * 0.8; // Slightly lower weight for class matches
      if (classScore > bestScore) bestScore = classScore;
    }

    // Also check subclass
    if (entry.subclass) {
      const subclassScore = bestTermScore(query, entry.subclass) * 0.7;
      if (subclassScore > bestScore) bestScore = subclassScore;
    }

    if (bestScore > 0.15) {
      const safeIngredients = Array.isArray(entry.ingredients)
        ? entry.ingredients.filter(i => typeof i === 'string' && i.toLowerCase() !== entry.term.toLowerCase())
        : [];
      results.push({
        id: generateDrugId(entry.term),
        drugName: entry.term,
        drugClass: entry.class,
        subclass: entry.subclass || "",
        type: entry.type,
        aliases: safeIngredients,
        score: bestScore,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.drugName.localeCompare(b.drugName))
    .slice(0, 30);
}

/**
 * Find a drug entry by its ID or name
 */
export function findDrugById(id: string): DrugEntry | undefined {
  // Extract drug name from ID format: DRUG__drug_name
  const match = id.match(/^DRUG__(.+)$/);
  if (match) {
    const normalizedName = match[1].replace(/_/g, " ");
    // Try to find by normalized name
    for (const [key, entry] of drugRegistry.entries()) {
      if (key === normalizedName || 
          entry.term.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "") === normalizedName.replace(/_/g, " ")) {
        return entry;
      }
    }
  }
  
  // Direct lookup by name
  return drugRegistry.get(id.toLowerCase());
}

/**
 * Find a drug entry by its name
 */
export function findDrugByName(name: string): DrugEntry | undefined {
  return drugRegistry.get(name.toLowerCase());
}

/**
 * Get all drugs in a specific class
 */
export function getDrugsByClass(drugClass: string): DrugEntry[] {
  const results: DrugEntry[] = [];
  for (const entry of drugRegistry.values()) {
    if (entry.class === drugClass) {
      results.push(entry);
    }
  }
  return results.sort((a, b) => a.term.localeCompare(b.term));
}

/**
 * Get the total count of drugs in the registry
 */
export function getDrugCount(): number {
  return drugRegistry.size;
}
