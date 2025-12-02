// src/lib/drugSearch.ts
// Search functionality for pharmacological agents and treatments

import type { DrugEntry, DrugSearchResult, DrugSearchFilters } from "../../pharm/drugTypes";
import { BRAND_NAME_MAP } from "../../lib/drugBrandNames";

// Import the drug data from JSON
// Note: This will be loaded at build time by Vite
import drugDataJson from "../../pharm/drugData.json";

// Cast the imported JSON to our expected type
const drugData = drugDataJson as Record<string, DrugEntry>;

// Build a lookup for efficient searching
const drugRegistry: Map<string, DrugEntry> = new Map();

// Map of normalized names to canonical names for deduplication
const canonicalNameMap: Map<string, string> = new Map();

// Build reverse lookup for brand names
const brandToGenericMap: Map<string, string> = new Map();
for (const [generic, brand] of Object.entries(BRAND_NAME_MAP)) {
  brandToGenericMap.set(brand.toLowerCase(), generic);
}

// Initialize the registry with deduplication
for (const [key, entry] of Object.entries(drugData)) {
  const normalized = entry.term.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Check if this is a duplicate (e.g., "aspirin" and "Acetylsalicylic Acid")
  if (!canonicalNameMap.has(normalized)) {
    canonicalNameMap.set(normalized, key);
    drugRegistry.set(key.toLowerCase(), entry);
  } else {
    // If duplicate found, keep the shorter/simpler name
    const existingKey = canonicalNameMap.get(normalized)!;
    if (key.length < existingKey.length || key.toLowerCase() === key) {
      // Replace with simpler name
      drugRegistry.delete(existingKey.toLowerCase());
      drugRegistry.set(key.toLowerCase(), entry);
      canonicalNameMap.set(normalized, key);
    }
  }
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
  
  // Starts with match gets higher score (checked before includes)
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return 2.5;
  }
  
  // Contains match gets high score
  if (normalizedTarget.includes(normalizedQuery)) {
    const lengthBoost = normalizedQuery.length / Math.max(normalizedTarget.length, 1);
    return 2 + lengthBoost;
  }
  
  // Fuzzy match based on Levenshtein distance
  const distance = levenshtein(normalizedQuery, normalizedTarget);
  return 1 / (1 + distance);
}

/**
 * Get the best score across multiple terms, including brand names
 */
function bestTermScore(query: string, term: string | undefined | null): number {
  if (!term || typeof term !== 'string') return 0;
  
  const candidates = [term, ...term.split(/\s+|[-–—]/).filter(Boolean)];
  
  // Also check brand name if this is a generic drug
  const brandName = BRAND_NAME_MAP[term.toLowerCase()];
  if (brandName) {
    candidates.push(brandName);
  }
  
  return candidates.reduce(
    (score, candidate) => Math.max(score, similarityScore(query, candidate)),
    0
  );
}

/**
 * Properly capitalize a drug name for display
 */
function capitalizeDrugName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return "";
  
  // Handle special cases
  const specialCases: Record<string, string> = {
    'nsaid': 'NSAID',
    'ssri': 'SSRI',
    'snri': 'SNRI',
    'maoi': 'MAOI',
    'ace': 'ACE',
    'arb': 'ARB',
    'hiv': 'HIV',
    'dpp': 'DPP',
    'sglt': 'SGLT',
    'glp': 'GLP',
  };
  
  return name
    .split(/\s+/)
    .map(word => {
      const lower = word.toLowerCase();
      if (specialCases[lower]) {
        return specialCases[lower];
      }
      // Capitalize first letter, keep rest as-is for abbreviations
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
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
 * Search for drugs by name, class, or ingredients (including brand names)
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
    
    // Add brand name as searchable term if available
    const brandName = BRAND_NAME_MAP[entry.term.toLowerCase()];
    if (brandName) {
      searchTerms.push(brandName);
    }

    let bestScore = 0;

    // Score against drug name, ingredients, and brand name
    for (const term of searchTerms) {
      const score = bestTermScore(query, term);
      if (score > bestScore) bestScore = score;
    }

    // Also check if query matches the class name (lower weight)
    if (entry.class) {
      const classScore = bestTermScore(query, entry.class) * 0.6; // Lower weight for class matches
      if (classScore > bestScore) bestScore = classScore;
    }

    // Also check subclass (even lower weight)
    if (entry.subclass) {
      const subclassScore = bestTermScore(query, entry.subclass) * 0.5;
      if (subclassScore > bestScore) bestScore = subclassScore;
    }

    if (bestScore > 0.15) {
      const safeIngredients = Array.isArray(entry.ingredients)
        ? entry.ingredients.filter(i => typeof i === 'string' && i.toLowerCase() !== entry.term.toLowerCase())
        : [];
      results.push({
        id: generateDrugId(entry.term),
        drugName: capitalizeDrugName(entry.term),
        drugClass: capitalizeDrugName(entry.class),
        subclass: entry.subclass ? capitalizeDrugName(entry.subclass) : "",
        type: capitalizeDrugName(entry.type),
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
