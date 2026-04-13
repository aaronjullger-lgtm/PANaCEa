/**
 * OpenFDA API Integration
 *
 * Free public API for drug labeling, adverse events (FAERS), and recall data.
 * No API key required (limited to 240 req/min, 120K req/day without key).
 *
 * Base URL: https://api.fda.gov
 * Docs: https://open.fda.gov/apis/
 *
 * Usage in PANaCEa:
 * - Enrich pharmacology questions with FDA-approved labeling data
 * - Cross-reference AI-generated drug info with official labeling
 * - Surface relevant adverse event data for clinical education
 * - Validate drug indications and contraindications
 *
 * @module lib/services/medical-apis/openfda
 */

const OPENFDA_BASE = 'https://api.fda.gov';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OpenFDADrugResult {
  brandName: string;
  genericName: string;
  manufacturer: string;
  route: string[];
  substance: string[];
  /** Key labeling sections */
  indications?: string;
  contraindications?: string;
  warnings?: string;
  adverseReactions?: string;
  drugInteractions?: string;
  dosage?: string;
  /** Pharmacology sections */
  mechanismOfAction?: string;
  pharmacodynamics?: string;
  pharmacokinetics?: string;
}

export interface AdverseEventResult {
  term: string;
  count: number;
}

interface OpenFDALabelResponse {
  results?: Array<{
    openfda?: {
      brand_name?: string[];
      generic_name?: string[];
      manufacturer_name?: string[];
      route?: string[];
      substance_name?: string[];
    };
    indications_and_usage?: string[];
    contraindications?: string[];
    warnings?: string[];
    adverse_reactions?: string[];
    drug_interactions?: string[];
    dosage_and_administration?: string[];
    mechanism_of_action?: string[];
    pharmacodynamics?: string[];
    clinical_pharmacology?: string[];
  }>;
}

interface OpenFDAEventResponse {
  results?: Array<{
    term: string;
    count: number;
  }>;
}

// ─── Core Functions ────────────────────────────────────────────────────────

/**
 * Search for drug labeling information from openFDA.
 *
 * @example
 * ```ts
 * const results = await searchOpenFDA('metoprolol');
 * // [{ brandName: 'Lopressor', genericName: 'metoprolol tartrate', ... }]
 * ```
 */
export async function searchOpenFDA(drugName: string, limit = 3): Promise<OpenFDADrugResult[]> {
  const query = encodeURIComponent(`openfda.generic_name:"${drugName}" OR openfda.brand_name:"${drugName}"`);
  const url = `${OPENFDA_BASE}/drug/label.json?search=${query}&limit=${limit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return []; // No results
      throw new Error(`OpenFDA API error ${res.status}`);
    }

    const data = (await res.json()) as OpenFDALabelResponse;
    return (data.results ?? []).map(mapLabelResult);
  } catch (err) {
    console.warn('[openfda] Search failed:', err);
    return [];
  }
}

/**
 * Look up comprehensive drug labeling by generic name.
 * Returns the first match with full labeling details.
 */
export async function lookupDrugLabel(genericName: string): Promise<OpenFDADrugResult | null> {
  const results = await searchOpenFDA(genericName, 1);
  return results[0] ?? null;
}

/**
 * Search FDA Adverse Event Reporting System (FAERS) for top adverse events.
 *
 * @example
 * ```ts
 * const events = await searchAdverseEvents('metoprolol', 10);
 * // [{ term: 'FATIGUE', count: 1234 }, { term: 'DIZZINESS', count: 987 }, ...]
 * ```
 */
export async function searchAdverseEvents(
  drugName: string,
  limit = 10
): Promise<AdverseEventResult[]> {
  const query = encodeURIComponent(`patient.drug.openfda.generic_name:"${drugName}"`);
  const url = `${OPENFDA_BASE}/drug/event.json?search=${query}&count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`OpenFDA events API error ${res.status}`);
    }

    const data = (await res.json()) as OpenFDAEventResponse;
    return (data.results ?? []).map((r) => ({
      term: r.term,
      count: r.count,
    }));
  } catch (err) {
    console.warn('[openfda] Adverse events search failed:', err);
    return [];
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function mapLabelResult(result: NonNullable<OpenFDALabelResponse['results']>[0]): OpenFDADrugResult {
  const fda = result.openfda ?? {};
  return {
    brandName: fda.brand_name?.[0] ?? 'Unknown',
    genericName: fda.generic_name?.[0] ?? 'Unknown',
    manufacturer: fda.manufacturer_name?.[0] ?? 'Unknown',
    route: fda.route ?? [],
    substance: fda.substance_name ?? [],
    indications: truncateSection(result.indications_and_usage),
    contraindications: truncateSection(result.contraindications),
    warnings: truncateSection(result.warnings),
    adverseReactions: truncateSection(result.adverse_reactions),
    drugInteractions: truncateSection(result.drug_interactions),
    dosage: truncateSection(result.dosage_and_administration),
    mechanismOfAction: truncateSection(result.mechanism_of_action),
    pharmacodynamics: truncateSection(result.pharmacodynamics),
    pharmacokinetics: truncateSection(result.clinical_pharmacology),
  };
}

/** Truncate long labeling sections to avoid oversized responses */
function truncateSection(sections?: string[], maxChars = 2000): string | undefined {
  if (!sections || sections.length === 0) return undefined;
  const combined = sections.join(' ');
  return combined.length > maxChars ? combined.slice(0, maxChars) + '...' : combined;
}
