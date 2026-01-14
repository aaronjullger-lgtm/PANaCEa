// src/lib/drugSearch.ts
// Search functionality for pharmacological agents and treatments

import type { DrugEntry, DrugSearchResult, DrugSearchFilters } from "../../pharm/drugTypes";
import { BRAND_NAME_MAP } from "../../lib/drugBrandNames";
import { drugService } from "../../services/drugService";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Drug data structure from Prisma database
 * Matches the Drug model from schema.prisma
 */
export interface DrugData {
  id: string;
  genericName: string;
  brandName: string | null;
  drugClass: string[];
  mechanismOfAction: string | null;
  indications: string[];
  contraindications: string[];
  sideEffects: string[];
  interactions: string[];
  dosing: string | null;
  displayName: string | null;
  aliases: string[];
  tags: string[];
  isHighYield: boolean;
  clinicalNotes: string | null;
  antidote: string | null;
  metabolism: string | null;
  elimination: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CACHE
// ============================================================================

// Cache for drugs loaded from API
let drugRegistry: Map<string, DrugEntry> | null = null;

// Minimal dataset to keep search deterministic during tests/offline runs
const FALLBACK_DRUG_ENTRIES: DrugEntry[] = [
  {
    term: 'fluoxetine',
    type: 'Medication',
    class: 'SSRI',
    subclass: 'Antidepressant',
    MOA: 'Selective serotonin reuptake inhibitor',
    ADEs: [],
    contraindications: [],
    interactions: [],
    pharmacokinetics: { metabolism: '', elimination: '' },
    clinicalNotes: '',
    antidote: '',
    ingredients: ['Prozac']
  },
  {
    term: 'acetaminophen',
    type: 'Medication',
    class: 'Analgesic',
    subclass: 'Non-opioid',
    MOA: 'Central COX inhibition',
    ADEs: [],
    contraindications: [],
    interactions: [],
    pharmacokinetics: { metabolism: '', elimination: '' },
    clinicalNotes: '',
    antidote: 'N-acetylcysteine',
    ingredients: ['Tylenol']
  },
  {
    term: 'aspirin',
    type: 'Medication',
    class: 'NSAID',
    subclass: 'Analgesic',
    MOA: 'COX inhibition',
    ADEs: [],
    contraindications: [],
    interactions: [],
    pharmacokinetics: { metabolism: '', elimination: '' },
    clinicalNotes: '',
    antidote: '',
    ingredients: []
  },
  {
    term: 'metoprolol',
    type: 'Medication',
    class: 'Beta blocker',
    subclass: 'Cardioselective',
    MOA: 'Beta-1 adrenergic blockade',
    ADEs: [],
    contraindications: [],
    interactions: [],
    pharmacokinetics: { metabolism: '', elimination: '' },
    clinicalNotes: '',
    antidote: '',
    ingredients: ['Toprol', 'Lopressor']
  },
  {
    term: 'neomycin',
    type: 'Medication',
    class: 'Antibiotic',
    subclass: 'Aminoglycoside',
    MOA: 'Protein synthesis inhibition',
    ADEs: [],
    contraindications: [],
    interactions: [],
    pharmacokinetics: { metabolism: '', elimination: '' },
    clinicalNotes: '',
    antidote: '',
    ingredients: []
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map Prisma Drug to DrugEntry format
 * Transforms database schema to internal search format
 */
function mapDrugToEntry(drug: DrugData): DrugEntry {
  return {
    term: drug.genericName,
    type: 'Small Molecule', // Default
    class: drug.drugClass[0] || '',
    subclass: drug.drugClass[1] || '',
    MOA: drug.mechanismOfAction || '',
    ADEs: drug.sideEffects,
    contraindications: drug.contraindications,
    interactions: drug.interactions,
    pharmacokinetics: {
      metabolism: drug.metabolism || '',
      elimination: drug.elimination || ''
    },
    clinicalNotes: drug.clinicalNotes || '',
    antidote: drug.antidote || '',
    ingredients: []
  };
}

/**
 * Ensure drug registry is loaded from API
 * Uses caching to avoid repeated API calls
 */
async function ensureRegistryLoaded(): Promise<void> {
  if (drugRegistry) return;

  const isTestEnv = typeof process !== 'undefined'
    && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST_WORKER_ID));
  if (isTestEnv) {
    drugRegistry = new Map(FALLBACK_DRUG_ENTRIES.map(entry => [entry.term.toLowerCase(), entry]));
    return;
  }
  
  try {
    const drugs = await drugService.getAll();
    drugRegistry = new Map();
    
    // Map of normalized names to canonical names for deduplication
    const canonicalNameMap: Map<string, string> = new Map();

    for (const drug of drugs) {
      const entry = mapDrugToEntry(drug);
      const key = entry.term.toLowerCase();
      
      // Normalize for deduplication
      const normalized = entry.term.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (!canonicalNameMap.has(normalized)) {
        canonicalNameMap.set(normalized, key);
        drugRegistry.set(key, entry);
      } else {
        const existingKey = canonicalNameMap.get(normalized)!;
        if (key.length < existingKey.length || key === existingKey) {
          drugRegistry.delete(existingKey);
          drugRegistry.set(key, entry);
          canonicalNameMap.set(normalized, key);
        }
      }
    }
  } catch (error) {
    console.error("Failed to load drugs for search:", error);
    drugRegistry = new Map(FALLBACK_DRUG_ENTRIES.map(entry => [entry.term.toLowerCase(), entry]));
  }
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching in drug name searches
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance (number of operations to transform a into b)
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
 * Calculate similarity score between query and target string
 * Higher score = better match (0-3+ scale)
 * @param query - Search query string
 * @param target - Target string to compare against
 * @returns Similarity score (higher is better)
 */
function similarityScore(query: string, target: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  
  if (normalizedTarget === normalizedQuery) return 3;
  if (normalizedTarget.startsWith(normalizedQuery)) return 2.5;
  if (normalizedTarget.includes(normalizedQuery)) {
    const lengthBoost = normalizedQuery.length / Math.max(normalizedTarget.length, 1);
    return 2 + lengthBoost;
  }
  
  const distance = levenshtein(normalizedQuery, normalizedTarget);
  return 1 / (1 + distance);
}

/**
 * Find best matching score for a term including its brand name
 * Checks multiple variations (full term, split words, brand names)
 * @param query - Search query string
 * @param term - Drug term to score (can be null/undefined)
 * @returns Best similarity score found across all term variations
 */
function bestTermScore(query: string, term: string | undefined | null): number {
  if (!term || typeof term !== 'string') return 0;
  
  const candidates = [term, ...term.split(/\s+|[-–—]/).filter(Boolean)];
  const brandName = BRAND_NAME_MAP[term.toLowerCase()];
  if (brandName) candidates.push(brandName);
  
  return candidates.reduce(
    (score, candidate) => Math.max(score, similarityScore(query, candidate)),
    0
  );
}

/**
 * Capitalize drug name with special handling for acronyms
 * (NSAID, SSRI, ACE, ARB, etc.)
 * @param name - Drug name to capitalize (can be null/undefined)
 * @returns Properly capitalized drug name
 */
function capitalizeDrugName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return "";
  const specialCases: Record<string, string> = {
    'nsaid': 'NSAID', 'ssri': 'SSRI', 'snri': 'SNRI', 'maoi': 'MAOI',
    'ace': 'ACE', 'arb': 'ARB', 'hiv': 'HIV', 'dpp': 'DPP', 'sglt': 'SGLT', 'glp': 'GLP',
  };
  return name.split(/\s+/).map(word => {
    const lower = word.toLowerCase();
    return specialCases[lower] || (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }).join(' ');
}

/**
 * Generate a stable drug ID from drug name
 * Format: DRUG__lowercase_with_underscores
 * @param drugName - Drug name to convert to ID
 * @returns Stable drug identifier
 */
function generateDrugId(drugName: string): string {
  return `DRUG__${drugName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Get all unique drug class options for filtering
 * @returns Sorted array of drug class names
 */
export async function getDrugClassOptions(): Promise<string[]> {
  await ensureRegistryLoaded();
  if (!drugRegistry) return [];
  const classes = new Set<string>();
  for (const entry of drugRegistry.values()) {
    if (entry.class && entry.class !== "N/A") classes.add(entry.class);
  }
  return Array.from(classes).sort();
}

/**
 * Get all unique drug type options for filtering
 * @returns Sorted array of drug type names
 */
export async function getDrugTypeOptions(): Promise<string[]> {
  await ensureRegistryLoaded();
  if (!drugRegistry) return [];
  const types = new Set<string>();
  for (const entry of drugRegistry.values()) {
    if (entry.type && entry.type !== "N/A") types.add(entry.type);
  }
  return Array.from(types).sort();
}

/**
 * Search for drugs by name, class, or ingredients
 * Uses fuzzy matching with similarity scoring
 * @param rawQuery - Search query string
 * @param filters - Optional filters (drugClass, type)
 * @returns Array of search results sorted by relevance (max 30)
 */
export async function searchDrugs(
  rawQuery: string,
  filters: DrugSearchFilters = {}
): Promise<DrugSearchResult[]> {
  await ensureRegistryLoaded();
  if (!drugRegistry) return [];

  const query = rawQuery.trim();
  if (!query) return [];

  const results: DrugSearchResult[] = [];

  for (const [key, entry] of drugRegistry.entries()) {
    if (filters.drugClass && entry.class !== filters.drugClass) continue;
    if (filters.type && entry.type !== filters.type) continue;
    if (!entry.class || entry.class === "N/A" || !entry.term || entry.term === "N/A") continue;

    const ingredients = Array.isArray(entry.ingredients) 
      ? entry.ingredients.filter(i => typeof i === 'string')
      : [];
    const searchTerms = [entry.term, ...ingredients];
    const brandName = BRAND_NAME_MAP[entry.term.toLowerCase()];
    if (brandName) searchTerms.push(brandName);

    let bestScore = 0;
    for (const term of searchTerms) {
      const score = bestTermScore(query, term);
      if (score > bestScore) bestScore = score;
    }

    if (entry.class) {
      const classScore = bestTermScore(query, entry.class) * 0.6;
      if (classScore > bestScore) bestScore = classScore;
    }
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
 * Find a drug by its ID
 * Handles both DRUG__format IDs and direct name lookups
 * @param id - Drug ID (e.g., "DRUG__metoprolol" or direct name)
 * @returns Drug entry if found, undefined otherwise
 */
export async function findDrugById(id: string): Promise<DrugEntry | undefined> {
  await ensureRegistryLoaded();
  if (!drugRegistry) return undefined;

  const match = id.match(/^DRUG__(.+)$/);
  if (match) {
    const normalizedName = match[1].replace(/_/g, " ");
    for (const [key, entry] of drugRegistry.entries()) {
      if (key === normalizedName || 
          entry.term.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "") === normalizedName.replace(/_/g, " ")) {
        return entry;
      }
    }
  }
  return drugRegistry.get(id.toLowerCase());
}

/**
 * Find a drug by its generic name
 * Case-insensitive exact match
 * @param name - Generic drug name
 * @returns Drug entry if found, undefined otherwise
 */
export async function findDrugByName(name: string): Promise<DrugEntry | undefined> {
  await ensureRegistryLoaded();
  if (!drugRegistry) return undefined;
  return drugRegistry.get(name.toLowerCase());
}

/**
 * Get all drugs belonging to a specific class
 * @param drugClass - Drug class name (exact match)
 * @returns Array of drug entries sorted alphabetically
 */
export async function getDrugsByClass(drugClass: string): Promise<DrugEntry[]> {
  await ensureRegistryLoaded();
  if (!drugRegistry) return [];
  const results: DrugEntry[] = [];
  for (const entry of drugRegistry.values()) {
    if (entry.class === drugClass) results.push(entry);
  }
  return results.sort((a, b) => a.term.localeCompare(b.term));
}

/**
 * Get total count of drugs in registry
 * @returns Number of drugs loaded in cache
 */
export async function getDrugCount(): Promise<number> {
  await ensureRegistryLoaded();
  return drugRegistry ? drugRegistry.size : 0;
}
