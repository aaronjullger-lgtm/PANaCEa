/**
 * API Endpoint: /api/causal-chain/generate
 * POST: Generate a mechanistic causal reasoning chain for a question explanation.
 *
 * Request: { questionId, questionText, correctAnswer, condition, studentAnswer?, system? }
 * Response: { data: CausalChain } | { error: string }
 *
 * Research basis (tier1.md Item 4):
 * - Woods, Brooks & Norman (2005): Causal mechanism explanations outperform
 *   controls on diagnostic tasks — especially difficult cases with irrelevant findings
 * - Chi et al. (1994): Self-explanation via causal chains d = 0.63–0.95
 *
 * Uses the unified ai-service layer for Gemini calls and the causalChainService
 * for prompt building, JSON extraction, and validation.
 *
 * @module functions/api/causal-chain/generate
 * Sprint: Tier 1 Research Implementation — Item 4
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { callAIMultiProvider, GeminiModel, type GeminiError } from '../_shared/ai-service';

// ─── Validation Schema ─────────────────────────────────────────────

const CausalChainRequestSchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
  questionText: z.string().min(10, 'questionText must be at least 10 characters'),
  correctAnswer: z.string().min(1, 'correctAnswer is required'),
  condition: z.string().min(1, 'condition is required'),
  studentAnswer: z.string().optional(),
  system: z.string().optional(),
});

// ─── Prompt Builder (mirrors causalChainService.buildCausalChainPrompt) ──

function buildPrompt(input: z.infer<typeof CausalChainRequestSchema>): string {
  const studentContext = input.studentAnswer
    ? `\nThe student incorrectly chose: "${input.studentAnswer}"\nInclude a branch point showing where the causal chain for "${input.studentAnswer}" diverges from the correct chain.`
    : '\nInclude a branch point showing where the chain diverges for the most commonly confused differential diagnosis.';

  return `Generate a causal reasoning chain for the following clinical question explanation.

Question: ${input.questionText}
Correct Answer: ${input.correctAnswer}
Condition: ${input.condition}
${input.system ? `Organ System: ${input.system}` : ''}
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

CRITICAL: Each mechanism must contain a MECHANISTIC explanation. Do not simply list facts.

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

// ─── JSON Extraction ───────────────────────────────────────────────

/**
 * Robustly extracts JSON from a Gemini response that may be wrapped in
 * prose, markdown fences, or both.
 */
function extractJSON(raw: string): unknown {
  const trimmed = raw.trim();

  // Strategy 1: Extract from ```json ... ``` fences
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

// ─── Validation ────────────────────────────────────────────────────

const VALID_LINK_TYPES = [
  'causes', 'leads_to', 'results_in', 'treated_by',
  'prevented_by', 'diagnosed_by', 'exacerbated_by', 'inhibited_by',
] as const;

const MAX_CHAIN_LINKS = 6;
const MIN_CHAIN_LINKS = 3;
const MAX_BRANCH_LINKS = 3;

interface ValidatedLink {
  order: number;
  entity: string;
  mechanism: string;
  consequence: string;
  linkType: string;
}

function isValidLink(link: unknown): link is ValidatedLink {
  if (!link || typeof link !== 'object') return false;
  const l = link as Record<string, unknown>;
  return (
    typeof l.order === 'number' &&
    typeof l.entity === 'string' && l.entity.length > 0 &&
    typeof l.mechanism === 'string' && l.mechanism.length > 0 &&
    typeof l.consequence === 'string' && l.consequence.length > 0 &&
    typeof l.linkType === 'string' &&
    (VALID_LINK_TYPES as readonly string[]).includes(l.linkType)
  );
}

function isValidBranchPoint(bp: unknown, maxLinkIndex: number): boolean {
  if (!bp || typeof bp !== 'object') return false;
  const b = bp as Record<string, unknown>;
  return (
    typeof b.afterLink === 'number' &&
    b.afterLink >= 0 && b.afterLink < maxLinkIndex &&
    typeof b.condition === 'string' && b.condition.length > 0 &&
    typeof b.differentialDiagnosis === 'string' && b.differentialDiagnosis.length > 0 &&
    Array.isArray(b.alternativePath) &&
    b.alternativePath.length > 0 &&
    b.alternativePath.length <= MAX_BRANCH_LINKS &&
    b.alternativePath.every(isValidLink)
  );
}

function validateChainResponse(
  raw: unknown,
  input: z.infer<typeof CausalChainRequestSchema>,
  model: string
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  // Validate links
  if (!Array.isArray(data.links) || data.links.length < MIN_CHAIN_LINKS) return null;
  const links = data.links.slice(0, MAX_CHAIN_LINKS).filter(isValidLink);
  if (links.length < MIN_CHAIN_LINKS) return null;

  // Re-index
  const reindexedLinks = links.map((link, i) => ({ ...link, order: i }));

  // Validate branch points
  const branchPoints: unknown[] = [];
  if (Array.isArray(data.branchPoints)) {
    for (const bp of data.branchPoints) {
      if (isValidBranchPoint(bp, reindexedLinks.length)) {
        branchPoints.push(bp);
      }
    }
  }

  const clinicalCorrelation = typeof data.clinicalCorrelation === 'string'
    ? data.clinicalCorrelation
    : `This causal chain explains the pathophysiology of ${input.condition}.`;

  return {
    id: `cc_${input.questionId}_${Date.now()}`,
    questionId: input.questionId,
    links: reindexedLinks,
    branchPoints,
    clinicalCorrelation,
    condition: input.condition,
    generatedAt: new Date().toISOString(),
    geminiModelVersion: model,
    reviewStatus: 'auto',
  };
}

// ─── CORS Preflight ────────────────────────────────────────────────

export const onRequestOptions = withCors();

// ─── POST Handler ──────────────────────────────────────────────────

export const onRequestPost = aiEndpoint(
  CausalChainRequestSchema,
  async (context) => {
    const { env, validated } = context as {
      env: { GEMINI_API_KEY: string; DATABASE_URL?: string; [k: string]: any };
      validated: z.infer<typeof CausalChainRequestSchema>;
    };

    const model = GeminiModel.FLASH_2_5;
    const prompt = buildPrompt(validated);

    try {
      const result = await callAIMultiProvider(context as any, {
        langchainTask: 'session-analysis',
        model,
        systemInstruction:
          'You are a medical education AI specializing in mechanistic causal reasoning. ' +
          'Generate precise pathophysiological causal chains that connect underlying causes ' +
          'to clinical findings, diagnosis, and treatment. Each mechanism must explain HOW ' +
          'and WHY, not just list facts. Respond ONLY with valid JSON.',
        prompt,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
        endpoint: '/api/causal-chain/generate',
      });

      if (result.blocked) {
        return { status: 400, error: `Content blocked: ${result.blockReason}` };
      }

      if (!result.text) {
        return { status: 500, error: 'No response generated. Please try again.' };
      }

      // Parse and validate the chain
      let parsed: unknown;
      try {
        parsed = extractJSON(result.text);
      } catch {
        return { status: 500, error: 'Failed to parse AI response as JSON' };
      }

      const chain = validateChainResponse(parsed, validated, model);
      if (!chain) {
        return {
          status: 500,
          error: 'Generated chain failed validation (insufficient links or invalid structure)',
        };
      }

      return { data: chain };
    } catch (error) {
      const geminiError = error as GeminiError;
      if (geminiError.status) {
        return {
          status: geminiError.status === 429 ? 429 : geminiError.retryable ? 503 : 500,
          error: geminiError.error,
        };
      }
      console.error('[causal-chain/generate] Error:', error);
      return { status: 500, error: 'Failed to generate causal chain. Please try again.' };
    }
  },
  { source: 'body', requestsPerMinute: 20 }
);
