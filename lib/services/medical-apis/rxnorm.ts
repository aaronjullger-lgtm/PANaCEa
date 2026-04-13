/**
 * RxNorm API Integration
 *
 * Free NLM API for drug name normalization, interaction checking,
 * and clinical content validation. No API key required.
 *
 * Base URL: https://rxnav.nlm.nih.gov/REST
 * Rate limit: 20 requests/second
 * Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
 *
 * Usage in PANaCEa:
 * - Validate drug names in AI-generated questions
 * - Check drug-drug interactions in clinical scenarios
 * - Normalize drug names to RxNorm canonical form
 * - Enrich drug content with RxCUI identifiers
 *
 * @module lib/services/medical-apis/rxnorm
 */

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RxNormConcept {
  rxcui: string;
  name: string;
  tty: string; // Term type (e.g., SBD, SCD, IN, BN)
}

export interface DrugInteraction {
  severity: 'high' | 'moderate' | 'low' | 'unknown';
  description: string;
  source: string;
  drug1: string;
  drug2: string;
}

export interface DrugValidationResult {
  isValid: boolean;
  normalizedName: string | null;
  rxcui: string | null;
  suggestions: string[];
  tty?: string;
}

export interface InteractionCheckResult {
  hasInteractions: boolean;
  interactions: DrugInteraction[];
  drugCount: number;
}

// ─── Core API Functions ────────────────────────────────────────────────────

/**
 * Look up the RxCUI (RxNorm Concept Unique Identifier) for a drug name.
 * Returns null if not found.
 *
 * @example
 * ```ts
 * const rxcui = await getRxCUI('metoprolol');
 * // '6918'
 * ```
 */
export async function getRxCUI(drugName: string): Promise<string | null> {
  const url = `${RXNORM_BASE}/rxcui.json?name=${encodeURIComponent(drugName)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { idGroup?: { rxnormId?: string[] } };
    const ids = data.idGroup?.rxnormId;
    return ids && ids.length > 0 ? ids[0] : null;
  } catch {
    return null;
  }
}

/**
 * Search for drugs by approximate name. Returns candidate matches.
 *
 * @example
 * ```ts
 * const results = await searchDrug('metoprol');
 * // [{ rxcui: '6918', name: 'metoprolol', tty: 'IN' }, ...]
 * ```
 */
export async function searchDrug(query: string, maxResults = 5): Promise<RxNormConcept[]> {
  const url = `${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(query)}&maxEntries=${maxResults}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as {
      approximateGroup?: {
        candidate?: Array<{ rxcui: string; name?: string; rank?: string; score?: string }>;
      };
    };

    const candidates = data.approximateGroup?.candidate ?? [];

    // Fetch full details for each candidate
    const concepts: RxNormConcept[] = [];
    for (const c of candidates.slice(0, maxResults)) {
      const props = await getRxCUIProperties(c.rxcui);
      if (props) {
        concepts.push(props);
      }
    }

    return concepts;
  } catch {
    return [];
  }
}

/**
 * Get properties (name, term type) for a given RxCUI.
 */
export async function getRxCUIProperties(rxcui: string): Promise<RxNormConcept | null> {
  const url = `${RXNORM_BASE}/rxcui/${rxcui}/properties.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      properties?: { rxcui: string; name: string; tty: string };
    };
    if (!data.properties) return null;
    return {
      rxcui: data.properties.rxcui,
      name: data.properties.name,
      tty: data.properties.tty,
    };
  } catch {
    return null;
  }
}

/**
 * Validate a drug name against RxNorm.
 * Returns whether the name is valid, the normalized form, and suggestions if invalid.
 *
 * @example
 * ```ts
 * const result = await validateDrugName('metaprolol'); // misspelled
 * // { isValid: false, normalizedName: null, suggestions: ['metoprolol', ...] }
 *
 * const result2 = await validateDrugName('metoprolol');
 * // { isValid: true, normalizedName: 'metoprolol', rxcui: '6918' }
 * ```
 */
export async function validateDrugName(drugName: string): Promise<DrugValidationResult> {
  // Try exact match first
  const rxcui = await getRxCUI(drugName);
  if (rxcui) {
    const props = await getRxCUIProperties(rxcui);
    return {
      isValid: true,
      normalizedName: props?.name ?? drugName,
      rxcui,
      suggestions: [],
      tty: props?.tty,
    };
  }

  // No exact match — try approximate search for suggestions
  const candidates = await searchDrug(drugName, 3);
  return {
    isValid: false,
    normalizedName: null,
    rxcui: null,
    suggestions: candidates.map((c) => c.name),
  };
}

/**
 * Check drug-drug interactions for a list of RxCUIs.
 *
 * @example
 * ```ts
 * const result = await checkInteractions(['6918', '321988']); // metoprolol + warfarin
 * // { hasInteractions: true, interactions: [...] }
 * ```
 */
export async function checkInteractions(rxcuis: string[]): Promise<InteractionCheckResult> {
  if (rxcuis.length < 2) {
    return { hasInteractions: false, interactions: [], drugCount: rxcuis.length };
  }

  const url = `${RXNORM_BASE}/interaction/list.json?rxcuis=${rxcuis.join('+')}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { hasInteractions: false, interactions: [], drugCount: rxcuis.length };
    }

    const data = await res.json() as {
      fullInteractionTypeGroup?: Array<{
        fullInteractionType?: Array<{
          interactionPair?: Array<{
            severity?: string;
            description?: string;
            interactionConcept?: Array<{
              sourceConceptItem?: { name?: string };
            }>;
          }>;
          comment?: string;
        }>;
        sourceName?: string;
      }>;
    };

    const interactions: DrugInteraction[] = [];

    for (const group of data.fullInteractionTypeGroup ?? []) {
      const source = group.sourceName ?? 'unknown';
      for (const type of group.fullInteractionType ?? []) {
        for (const pair of type.interactionPair ?? []) {
          const concepts = pair.interactionConcept ?? [];
          const drug1 = concepts[0]?.sourceConceptItem?.name ?? 'unknown';
          const drug2 = concepts[1]?.sourceConceptItem?.name ?? 'unknown';

          interactions.push({
            severity: normalizeSeverity(pair.severity),
            description: pair.description ?? type.comment ?? 'Interaction detected',
            source,
            drug1,
            drug2,
          });
        }
      }
    }

    return {
      hasInteractions: interactions.length > 0,
      interactions,
      drugCount: rxcuis.length,
    };
  } catch {
    return { hasInteractions: false, interactions: [], drugCount: rxcuis.length };
  }
}

/**
 * Validate drug names in a clinical question and return validation report.
 * High-level function for question generation pipeline integration.
 *
 * @example
 * ```ts
 * const report = await validateQuestionDrugs([
 *   'metoprolol succinate',
 *   'lisinopril',
 *   'metformin',
 * ]);
 * // { allValid: true, results: [...], interactions: [...] }
 * ```
 */
export async function validateQuestionDrugs(drugNames: string[]): Promise<{
  allValid: boolean;
  results: Array<{ drug: string; validation: DrugValidationResult }>;
  interactions: InteractionCheckResult | null;
}> {
  // Validate each drug name
  const results = await Promise.all(
    drugNames.map(async (drug) => ({
      drug,
      validation: await validateDrugName(drug.trim()),
    }))
  );

  const allValid = results.every((r) => r.validation.isValid);

  // Check interactions if we have 2+ valid drugs
  let interactions: InteractionCheckResult | null = null;
  const validRxcuis = results
    .filter((r) => r.validation.rxcui)
    .map((r) => r.validation.rxcui!);

  if (validRxcuis.length >= 2) {
    interactions = await checkInteractions(validRxcuis);
  }

  return { allValid, results, interactions };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeSeverity(raw?: string): DrugInteraction['severity'] {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase();
  if (lower.includes('high') || lower === 'n/a') return 'high';
  if (lower.includes('moderate')) return 'moderate';
  if (lower.includes('low')) return 'low';
  return 'unknown';
}
