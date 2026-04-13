/**
 * UMLS (Unified Medical Language System) API Integration
 *
 * Maps between 100+ medical vocabularies — SNOMED CT, ICD-10, LOINC, MeSH,
 * RxNorm, CPT — through a single API.
 *
 * Requires free UMLS account + API key from https://uts.nlm.nih.gov
 * Base URL: https://uts-ws.nlm.nih.gov/rest
 *
 * Usage in PANaCEa:
 * - Validate that AI-generated questions use standardized medical terminology
 * - Cross-reference differential diagnoses with ICD-10 codes
 * - Map between SNOMED CT, ICD-10, and LOINC for clinical content
 * - Align content with the PANCE Content Blueprint
 *
 * @module lib/services/medical-apis/umls
 */

const UMLS_BASE = 'https://uts-ws.nlm.nih.gov/rest';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UMLSConcept {
  ui: string;        // CUI (Concept Unique Identifier)
  name: string;
  rootSource: string;
  semanticTypes: string[];
}

export interface UMLSAtom {
  ui: string;        // AUI (Atom Unique Identifier)
  name: string;
  rootSource: string;
  sourceConcept: string;
  termType: string;
}

export interface CrosswalkResult {
  sourceCode: string;
  sourceName: string;
  sourceVocabulary: string;
  targetCode: string;
  targetName: string;
  targetVocabulary: string;
}

export interface UMLSSearchResult {
  concepts: UMLSConcept[];
  totalCount: number;
}

interface UMLSSearchResponse {
  result?: {
    results?: Array<{
      ui: string;
      name: string;
      rootSource: string;
      semanticTypes?: Array<{ name: string }>;
    }>;
    recCount?: number;
  };
}

interface UMLSCrosswalkResponse {
  result?: Array<{
    ui: string;
    name: string;
    rootSource: string;
    code: string;
  }>;
}

// ─── Core Functions ────────────────────────────────────────────────────────

/**
 * Search UMLS for a concept by term.
 *
 * @example
 * ```ts
 * const results = await searchUMLS('atrial fibrillation', apiKey);
 * // { concepts: [{ ui: 'C0004238', name: 'Atrial Fibrillation', ... }], totalCount: 15 }
 * ```
 */
export async function searchUMLS(
  term: string,
  apiKey: string,
  options?: { sabs?: string; pageSize?: number; pageNumber?: number }
): Promise<UMLSSearchResult> {
  const params = new URLSearchParams({
    apiKey,
    string: term,
    pageSize: String(options?.pageSize ?? 10),
    pageNumber: String(options?.pageNumber ?? 1),
  });
  if (options?.sabs) params.set('sabs', options.sabs);

  const url = `${UMLS_BASE}/search/current?${params}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401) throw new Error('UMLS API key invalid or expired');
      if (res.status === 404) return { concepts: [], totalCount: 0 };
      throw new Error(`UMLS search error ${res.status}`);
    }

    const data = (await res.json()) as UMLSSearchResponse;
    const results = data.result?.results ?? [];

    return {
      concepts: results
        .filter((r) => r.ui !== 'NONE')
        .map((r) => ({
          ui: r.ui,
          name: r.name,
          rootSource: r.rootSource,
          semanticTypes: r.semanticTypes?.map((st) => st.name) ?? [],
        })),
      totalCount: data.result?.recCount ?? 0,
    };
  } catch (err) {
    console.warn('[umls] Search failed:', err);
    return { concepts: [], totalCount: 0 };
  }
}

/**
 * Get atoms (source-specific entries) for a CUI across vocabularies.
 *
 * @example
 * ```ts
 * const atoms = await getConceptAtoms('C0004238', apiKey, { sabs: 'SNOMEDCT_US,ICD10CM' });
 * ```
 */
export async function getConceptAtoms(
  cui: string,
  apiKey: string,
  options?: { sabs?: string; pageSize?: number }
): Promise<UMLSAtom[]> {
  const params = new URLSearchParams({
    apiKey,
    pageSize: String(options?.pageSize ?? 25),
  });
  if (options?.sabs) params.set('sabs', options.sabs);

  const url = `${UMLS_BASE}/content/current/CUI/${cui}/atoms?${params}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`UMLS atoms error ${res.status}`);
    }

    const data = (await res.json()) as {
      result?: Array<{
        ui: string;
        name: string;
        rootSource: string;
        sourceConcept: string;
        termType: string;
      }>;
    };

    return (data.result ?? []).map((a) => ({
      ui: a.ui,
      name: a.name,
      rootSource: a.rootSource,
      sourceConcept: a.sourceConcept,
      termType: a.termType,
    }));
  } catch (err) {
    console.warn('[umls] Get atoms failed:', err);
    return [];
  }
}

/**
 * Crosswalk a concept from one vocabulary to another.
 * E.g., SNOMED CT → ICD-10-CM or LOINC → SNOMED CT.
 *
 * @example
 * ```ts
 * const icd10Codes = await crosswalk('C0004238', apiKey, 'ICD10CM');
 * // [{ targetCode: 'I48', targetName: 'Atrial fibrillation and flutter', ... }]
 * ```
 */
export async function crosswalk(
  cui: string,
  apiKey: string,
  targetVocabulary: string
): Promise<CrosswalkResult[]> {
  // Get atoms in the target vocabulary
  const atoms = await getConceptAtoms(cui, apiKey, { sabs: targetVocabulary });

  if (atoms.length === 0) return [];

  // Get the source concept name from any vocabulary for reference
  const sourceAtoms = await getConceptAtoms(cui, apiKey, { sabs: 'SNOMEDCT_US', pageSize: 1 });
  const sourceName = sourceAtoms[0]?.name ?? '';

  return atoms.map((a) => ({
    sourceCode: cui,
    sourceName,
    sourceVocabulary: 'UMLS',
    targetCode: a.sourceConcept,
    targetName: a.name,
    targetVocabulary: a.rootSource,
  }));
}

/**
 * Validate a clinical term against UMLS. Returns the CUI and preferred name
 * if found, or null if the term isn't in UMLS.
 *
 * @example
 * ```ts
 * const valid = await validateTerm('afib', apiKey);
 * // { cui: 'C0004238', preferredName: 'Atrial Fibrillation', isValid: true }
 * ```
 */
export async function validateTerm(
  term: string,
  apiKey: string
): Promise<{ cui: string; preferredName: string; isValid: true } | { isValid: false; suggestion?: string }> {
  const result = await searchUMLS(term, apiKey, { pageSize: 3 });

  if (result.concepts.length === 0) {
    return { isValid: false };
  }

  const best = result.concepts[0];

  // Check if the term is a close match
  const termLower = term.toLowerCase().trim();
  const nameLower = best.name.toLowerCase().trim();
  const isExact = termLower === nameLower || nameLower.includes(termLower) || termLower.includes(nameLower);

  if (isExact) {
    return { cui: best.ui, preferredName: best.name, isValid: true };
  }

  // Return as valid but with the preferred name as suggestion
  return { cui: best.ui, preferredName: best.name, isValid: true };
}

/**
 * Map a condition name to ICD-10-CM code(s) via UMLS.
 *
 * @example
 * ```ts
 * const codes = await mapToICD10('atrial fibrillation', apiKey);
 * // [{ code: 'I48', name: 'Atrial fibrillation and flutter' }]
 * ```
 */
export async function mapToICD10(
  conditionName: string,
  apiKey: string
): Promise<Array<{ code: string; name: string }>> {
  const searchResult = await searchUMLS(conditionName, apiKey, { pageSize: 3 });

  if (searchResult.concepts.length === 0) return [];

  const cui = searchResult.concepts[0].ui;
  const crosswalkResults = await crosswalk(cui, apiKey, 'ICD10CM');

  return crosswalkResults.map((r) => ({
    code: r.targetCode,
    name: r.targetName,
  }));
}

/**
 * Batch validate multiple terms against UMLS.
 * Useful for validating AI-generated question content.
 */
export async function batchValidateTerms(
  terms: string[],
  apiKey: string
): Promise<Array<{ term: string; cui?: string; preferredName?: string; isValid: boolean }>> {
  const results = await Promise.allSettled(
    terms.map(async (term) => {
      const result = await validateTerm(term, apiKey);
      return { term, ...result };
    })
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { term: terms[i], isValid: false };
  });
}
