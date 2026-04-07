/**
 * Causal Reasoning Chain Service
 *
 * Generates mechanistic causal chains for post-answer explanations using
 * Gemini structured output. Each chain connects underlying cause →
 * pathophysiology → clinical finding → diagnosis → treatment rationale.
 *
 * Research basis (tier1.md Item 4):
 * - Woods, Brooks & Norman (2005, 2007): Causal mechanism explanations
 *   significantly outperform controls on diagnostic tasks immediately
 *   and one week later — especially for difficult cases with irrelevant
 *   findings and unfamiliar terminology.
 * - Chi et al. (1994): Self-explanation via causal chains produces
 *   effect sizes d = 0.63–0.95 compared to passive reading.
 * - Schmidt, Norman & Boshuizen (1990): Biomedical causal knowledge is
 *   the substrate that eventually becomes encapsulated into expert
 *   diagnostic reasoning.
 *
 * Design decisions:
 * - Chains are capped at 6 links (Miller's 7±2 heuristic / CLT)
 * - One branch point per chain for the most commonly confused differential
 * - Chains are cached by questionId — same question produces same chain
 * - Clinical correlation sentence ties the chain back to the patient
 *
 * @module lib/services/causalChainService
 * Sprint: Tier 1 Research Implementation — Item 4
 */

import type {
  CausalChain,
  CausalLink,
  BranchPoint,
  CausalChainGenerationRequest,
  CausalChainGenerationResult,
  CausalLinkType,
} from '@/types/causalChain';

// ─── Constants ──────────────────────────────────────────────────────

/** Maximum links in a primary chain (CLT constraint) */
const MAX_CHAIN_LINKS = 6;

/** Minimum links for a meaningful chain */
const MIN_CHAIN_LINKS = 3;

/** Maximum links in a branch point alternative path */
const MAX_BRANCH_LINKS = 3;

/** Valid link types for validation */
const VALID_LINK_TYPES: CausalLinkType[] = [
  'causes', 'leads_to', 'results_in', 'treated_by',
  'prevented_by', 'diagnosed_by', 'exacerbated_by', 'inhibited_by',
];

/** Cache entry with chain and creation timestamp */
interface CacheEntry {
  chain: CausalChain;
  timestamp: number;
}

/** In-memory cache for generated chains (keyed by questionId) */
const chainCache = new Map<string, CacheEntry>();

/** Cache TTL — 24 hours in milliseconds */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Gemini Prompt ──────────────────────────────────────────────────

/**
 * Builds the Gemini prompt for causal chain generation.
 * Follows the structured prompting pattern from tier1.md.
 */
export function buildCausalChainPrompt(request: CausalChainGenerationRequest): string {
  const studentContext = request.studentAnswer
    ? `\nThe student incorrectly chose: "${request.studentAnswer}"\nInclude a branch point showing where the causal chain for "${request.studentAnswer}" diverges from the correct chain.`
    : '\nInclude a branch point showing where the chain diverges for the most commonly confused differential diagnosis.';

  return `Generate a causal reasoning chain for the following clinical question explanation.

Question: ${request.questionText}
Correct Answer: ${request.correctAnswer}
Condition: ${request.condition}
${request.system ? `Organ System: ${request.system}` : ''}
${studentContext}

INSTRUCTIONS:
1. Build a MECHANISTIC chain from underlying cause → pathophysiology →
   clinical finding → diagnosis → treatment rationale
2. Each link must have: entity (the biological entity/process), mechanism
   (HOW it causes the next step), consequence (the downstream result),
   and linkType (one of: causes, leads_to, results_in, treated_by,
   prevented_by, diagnosed_by, exacerbated_by, inhibited_by)
3. Each link MUST explain WHY, not just WHAT
4. Include 4-6 links in the primary chain
5. Include exactly one branch point showing where the chain diverges for
   the most commonly confused differential diagnosis
6. End with a clinical correlation sentence connecting the chain to the
   patient's actual presentation

EXAMPLE for Rheumatic Heart Disease:
Primary chain:
- Link 0: entity="Group A Strep pharyngitis", mechanism="M protein molecular mimicry cross-reacts with cardiac myosin", consequence="Autoimmune myocardial inflammation", linkType="causes"
- Link 1: entity="Autoimmune myocardial inflammation", mechanism="Inflammatory infiltrate disrupts cardiac conduction system and valve tissue", consequence="Valve fibrosis and new-onset heart block", linkType="leads_to"
- Link 2: entity="Valve fibrosis", mechanism="Mitral valve leaflet thickening causes incomplete closure during systole", consequence="Mitral regurgitation murmur", linkType="results_in"
- Link 3: entity="Mitral regurgitation", mechanism="Diagnosed by echocardiography showing valve dysfunction plus evidence of prior strep (elevated ASO titers)", consequence="Clinical diagnosis via modified Jones criteria", linkType="diagnosed_by"
- Link 4: entity="Rheumatic heart disease", mechanism="Penicillin eradicates residual strep; anti-inflammatory therapy reduces ongoing valve damage", consequence="Secondary prophylaxis prevents recurrence", linkType="treated_by"

Branch point (after link 0):
- differentialDiagnosis: "Infective endocarditis"
- condition: "If bacteria directly seed the valve rather than triggering autoimmunity"
- alternativePath: entity="Bacteremia", mechanism="Organisms adhere to damaged endocardium forming vegetations", consequence="Valve destruction with embolic phenomena (Janeway lesions, Osler nodes)", linkType="causes"

Clinical correlation: "This patient's new murmur and elevated ASO titer following pharyngitis reflect the autoimmune valve damage pathway, distinguishing rheumatic heart disease from direct infectious endocarditis."

CRITICAL: Each mechanism must contain a MECHANISTIC explanation. Do not simply list facts. The student should understand WHY each step leads to the next.

Respond in JSON matching this exact schema:
{
  "links": [
    { "order": 0, "entity": "...", "mechanism": "...", "consequence": "...", "linkType": "..." }
  ],
  "branchPoints": [
    {
      "afterLink": 0,
      "alternativePath": [
        { "order": 0, "entity": "...", "mechanism": "...", "consequence": "...", "linkType": "..." }
      ],
      "condition": "...",
      "differentialDiagnosis": "..."
    }
  ],
  "clinicalCorrelation": "..."
}`;
}

// ─── Validation ─────────────────────────────────────────────────────

/** Validates a single causal link has required fields and valid types */
function isValidLink(link: unknown): link is CausalLink {
  if (!link || typeof link !== 'object') return false;
  const l = link as Record<string, unknown>;
  return (
    typeof l.order === 'number' &&
    typeof l.entity === 'string' && l.entity.length > 0 &&
    typeof l.mechanism === 'string' && l.mechanism.length > 0 &&
    typeof l.consequence === 'string' && l.consequence.length > 0 &&
    typeof l.linkType === 'string' && VALID_LINK_TYPES.includes(l.linkType as CausalLinkType)
  );
}

/** Validates a branch point structure */
function isValidBranchPoint(bp: unknown): bp is BranchPoint {
  if (!bp || typeof bp !== 'object') return false;
  const b = bp as Record<string, unknown>;
  return (
    typeof b.afterLink === 'number' &&
    typeof b.condition === 'string' && b.condition.length > 0 &&
    typeof b.differentialDiagnosis === 'string' && b.differentialDiagnosis.length > 0 &&
    Array.isArray(b.alternativePath) &&
    b.alternativePath.length > 0 &&
    b.alternativePath.length <= MAX_BRANCH_LINKS &&
    b.alternativePath.every(isValidLink)
  );
}

/**
 * Validates and sanitizes a parsed causal chain from Gemini output.
 * Enforces link count limits, validates types, and ensures chain coherence.
 */
export function validateCausalChain(
  raw: unknown,
  request: CausalChainGenerationRequest,
  modelVersion: string = 'gemini-2.5-flash'
): CausalChain | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  // Validate links array
  if (!Array.isArray(data.links) || data.links.length < MIN_CHAIN_LINKS) return null;

  // Cap at MAX_CHAIN_LINKS
  const links = data.links.slice(0, MAX_CHAIN_LINKS).filter(isValidLink);
  if (links.length < MIN_CHAIN_LINKS) return null;

  // Re-index links after filtering
  const reindexedLinks = links.map((link, i) => ({ ...link, order: i }));

  // Validate branch points (optional but expected)
  const branchPoints: BranchPoint[] = [];
  if (Array.isArray(data.branchPoints)) {
    for (const bp of data.branchPoints) {
      if (isValidBranchPoint(bp)) {
        // Ensure branch references a valid link index
        const typedBp = bp as BranchPoint;
        if (typedBp.afterLink >= 0 && typedBp.afterLink < reindexedLinks.length) {
          branchPoints.push(typedBp);
        }
      }
    }
  }

  // Validate clinical correlation
  const clinicalCorrelation = typeof data.clinicalCorrelation === 'string'
    ? data.clinicalCorrelation
    : `This causal chain explains the pathophysiology of ${request.condition}.`;

  // Construct the validated chain
  const chain: CausalChain = {
    id: `cc_${request.questionId}_${Date.now()}`,
    questionId: request.questionId,
    links: reindexedLinks,
    branchPoints,
    clinicalCorrelation,
    condition: request.condition,
    generatedAt: new Date().toISOString(),
    geminiModelVersion: modelVersion,
    reviewStatus: 'auto',
  };

  return chain;
}

// ─── Cache Management ───────────────────────────────────────────────

/** Get a cached chain if it exists and hasn't expired */
export function getCachedChain(questionId: string): CausalChain | null {
  const entry = chainCache.get(questionId);
  if (!entry) return null;

  if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.chain;
  }

  // Expired — clean up
  chainCache.delete(questionId);
  return null;
}

/** Store a chain in cache */
export function cacheChain(chain: CausalChain): void {
  chainCache.set(chain.questionId, { chain, timestamp: Date.now() });

  // Evict oldest entries if cache exceeds 200 chains
  if (chainCache.size > 200) {
    const entries = Array.from(chainCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toEvict = entries.slice(0, 50);
    for (const [key] of toEvict) {
      chainCache.delete(key);
    }
  }
}

// ─── JSON Extraction ────────────────────────────────────────────────

/**
 * Robustly extracts JSON from a Gemini response that may be wrapped in
 * prose, markdown fences, or both. Tries three strategies:
 * 1. Extract content inside ```json ... ``` fences (handles surrounding prose)
 * 2. Find the first { ... } or [ ... ] block via brace matching
 * 3. Try parsing the entire trimmed response as-is
 */
export function extractJSON(raw: string): unknown {
  const trimmed = raw.trim();

  // Strategy 1: Extract from ```json ... ``` fences (anywhere in the response)
  const fenceMatch = trimmed.match(/```json?\s*\n?([\s\S]*?)\n?\s*```/i);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Strategy 2: Find the first top-level { } block via brace counting
  const firstBrace = trimmed.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(firstBrace, i + 1));
      }
    }
  }

  // Strategy 3: Try the whole string
  return JSON.parse(trimmed);
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Generates a causal chain for a given question.
 *
 * This is a client-side service that prepares the prompt and validates
 * the response. The actual Gemini API call happens through the edge
 * function endpoint. For client-side use, this provides the prompt
 * template and response validation; the caller handles the API request.
 *
 * @param request - The question context for chain generation
 * @returns The generation result with chain or error
 */
export async function generateCausalChain(
  request: CausalChainGenerationRequest,
  apiCall: (prompt: string) => Promise<string>
): Promise<CausalChainGenerationResult> {
  // Check cache first
  const cached = getCachedChain(request.questionId);
  if (cached) {
    return { success: true, chain: cached, cached: true };
  }

  try {
    const prompt = buildCausalChainPrompt(request);
    const rawResponse = await apiCall(prompt);

    // Parse JSON from Gemini response — handles prose wrapping, ```json blocks, etc.
    let parsed: unknown;
    try {
      parsed = extractJSON(rawResponse);
    } catch {
      return {
        success: false,
        error: 'Failed to parse Gemini response as JSON',
        cached: false,
      };
    }

    // Validate and construct the chain
    const chain = validateCausalChain(parsed, request);
    if (!chain) {
      return {
        success: false,
        error: 'Generated chain failed validation (insufficient links or invalid structure)',
        cached: false,
      };
    }

    // Cache the valid chain
    cacheChain(chain);

    return { success: true, chain, cached: false };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown generation error',
      cached: false,
    };
  }
}

/**
 * Extracts a simplified chain summary for use in expert-level display.
 * Returns a one-line string: "Entity A → Entity B → Entity C → Outcome"
 */
export function getChainSummary(chain: CausalChain): string {
  if (chain.links.length === 0) return chain.clinicalCorrelation;

  const entities = chain.links.map((l) => l.entity);
  const lastConsequence = chain.links[chain.links.length - 1].consequence;

  return [...entities, lastConsequence].join(' → ');
}
