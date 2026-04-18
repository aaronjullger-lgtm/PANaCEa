/**
 * Sprint 7 (AI Gateway migration): Replaced direct `@google/generative-ai` SDK
 * usage with `gateway.callText()` using task='generation', tier='balanced'
 * (gemini-2.5-flash — matches the prior model binding).
 *
 * The constructor now accepts a `GatewayContext` instead of a raw API key so
 * the same telemetry + fallback + cost pipeline services Edge, Node, and dev
 * routes. Callers should pass `toGatewayContext(authenticatedContext)` or
 * `buildNodeGatewayContext()` depending on runtime.
 */
import { gateway, GatewayError, type GatewayContext } from '../../ai/aiGateway';
import { type MedicalContentData } from '../content/types';
import { logger } from '../../logger';
import type { ABAssignmentMap } from '../../middleware/abTestMiddleware';

const LOG_SCOPE = 'QuestionGenerationService';
const generationLogger = logger.scope(LOG_SCOPE);
const ENDPOINT = 'lib/services/question/generationService';

export interface GroundingSource {
  uri: string;
  title: string;
}

/** A/B-testable generation strategies */
export type GenerationStrategy = 'single-pass' | 'self-refine' | 'rag-grounded';

interface GatewayResultShape {
  text?: string | null;
  blocked?: boolean;
  groundingMetadata?: unknown;
  raw?: unknown;
}

export class QuestionGenerationService {
  private ctx: GatewayContext;

  constructor(ctx: GatewayContext) {
    this.ctx = ctx;
  }

  /**
   * Resolve the generation strategy from A/B test assignments.
   * Falls back to 'rag-grounded' (the default grounded-model approach).
   */
  resolveGenerationStrategy(abAssignments?: ABAssignmentMap): GenerationStrategy {
    const genExp = abAssignments?.['question_generation_strategy'];
    if (!genExp) return 'rag-grounded';
    const strategy = genExp.config.strategy as string | undefined;
    if (strategy === 'single-pass' || strategy === 'self-refine' || strategy === 'rag-grounded') {
      return strategy;
    }
    return 'rag-grounded';
  }

  /**
   * Generate a review question based on medical content.
   *
   * @param abAssignments - Optional A/B test assignments. If the
   *   'question_generation_strategy' experiment is active, uses the
   *   variant's config.strategy to select the generation approach.
   */
  async generateReviewQuestion(
    content: MedicalContentData,
    difficulty: string = 'medium',
    abAssignments?: ABAssignmentMap
  ): Promise<any> {
    // Pass findings-only for vignette-building; withhold condition/overview from vignette text
    const findingsContext = [
      content.symptoms ? `Symptoms: ${String(content.symptoms).slice(0, 400)}` : '',
      content.diagnostics ? `Lab/Imaging Patterns: ${String(content.diagnostics).slice(0, 400)}` : '',
      content.classic_patient ? `Classic Patient (describe findings, do not name): ${String(content.classic_patient).slice(0, 200)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = `Generate a PANCE-style follow-up review question based on these clinical findings.

Findings for vignette (RAW PATIENT DATA ONLY - never state the diagnosis):
${findingsContext || 'Use typical findings for a common condition.'}

Context for answer accuracy (do NOT include in vignette text):
- Gold Standard Dx: ${content.gold_standard_dx || 'N/A'}
- Treatment: ${content.treatment || 'N/A'}
- First Line Rx: ${content.first_line_rx || 'N/A'}
- Clinical Pearls: ${JSON.stringify(content.clinical_pearls || [])}

CRITICAL - RAW PATIENT DATA: NEVER state the diagnosis or condition name in the vignette. Provide raw patient data only (demographics, symptoms, labs, vitals).

This is a spaced repetition review. Create a DIFFERENT clinical vignette than typical, but test the SAME core concepts. Vary demographics; use different presenting symptoms; test diagnostic/treatment knowledge from a new angle.

Gold standard vs. initial: For "best initial step" or "next test" questions, include the gold standard as a distractor; rationale must clarify why wrong for this step. Next best step: For "next step" questions, state what has already been done first, then ask for the immediate next action. Pertinent negatives: Include at least 2 that rule out top differentials. Pharmacological contraindications: For therapeutics, include comorbidity that contraindicates first-line (e.g. HTN + gout; otitis + penicillin allergy).

Requirements:
1. Clinical vignette: 2-4 sentences with realistic patient scenario
2. Question stem: Clear, PANCE-appropriate
3. 5 answer options (A, B, C, D, E) with one correct and four plausible distractors (PANCE-style)
4. STANDARDIZED RATIONALE (5-section object): "rationale" MUST be an object with bottomLine, whyCorrect, whyIncorrectA/B/C/D/E, clinicalPearl, highYieldImageOrTable ("N/A" or brief description). Do NOT use "explanation" string.

Return ONLY valid JSON (no markdown):
{
  "vignette": "Clinical scenario...",
  "question": "What is the most appropriate next step?",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
  "correctAnswer": "A",
  "rationale": {
    "bottomLine": "The diagnosis is X, and the treatment is Y.",
    "whyCorrect": "Walk through vignette steps.",
    "whyIncorrectA": "Incorrect because... Correct for [different scenario].",
    "whyIncorrectB": "Incorrect because... Correct for [different scenario].",
    "whyIncorrectC": "Incorrect because... Correct for [different scenario].",
    "whyIncorrectD": "Incorrect because... Correct for [different scenario].",
    "whyIncorrectE": "Incorrect because... Correct for [different scenario].",
    "clinicalPearl": "Remember: [key takeaway].",
    "highYieldImageOrTable": "N/A"
  },
  "difficulty": "medium"
}`;

    try {
      const strategy = this.resolveGenerationStrategy(abAssignments);
      generationLogger.debug('Generation strategy selected', { strategy });

      let result: GatewayResultShape;

      if (strategy === 'single-pass') {
        // Direct generation without grounding — fastest path
        result = await gateway.callText(this.ctx, {
          mode: 'text',
          task: 'generation',
          tier: 'balanced',
          endpoint: ENDPOINT,
          userPrompt: prompt,
        });
      } else if (strategy === 'self-refine') {
        // Two-pass: generate then self-critique and refine
        result = await gateway.callText(this.ctx, {
          mode: 'text',
          task: 'generation',
          tier: 'balanced',
          endpoint: ENDPOINT,
          userPrompt: prompt,
        });
        if (result.blocked) {
          generationLogger.warn('Self-refine draft blocked by safety filter');
          return null;
        }
        let parsed = this.parseResponse(result.text ?? '');
        if (parsed) {
          parsed = await this.selfRefine(parsed, prompt);
        }
        return parsed;
      } else {
        // rag-grounded (default): google-search grounded evidence-backed generation
        result = await gateway.callText(this.ctx, {
          mode: 'text',
          task: 'generation',
          tier: 'balanced',
          endpoint: ENDPOINT,
          userPrompt: prompt,
          tools: [{ googleSearch: {} }],
        });
      }

      if (result.blocked) {
        generationLogger.warn('Generation blocked by safety filter', { strategy });
        return null;
      }

      const text = result.text ?? '';
      const parsed = this.parseResponse(text);

      if (parsed && strategy === 'rag-grounded') {
        // Extract grounding sources from response metadata (with raw fallback)
        const groundingSources = this.extractGroundingSources(result);
        if (groundingSources.length > 0) {
          parsed.rationale = parsed.rationale || {};
          parsed.rationale.groundingSources = groundingSources;
        }
      }

      return parsed;
    } catch (error) {
      if (error instanceof GatewayError) {
        generationLogger.warn('Grounded generation failed via gateway, falling back to standard', {
          code: error.code,
          message: error.message,
        });
      } else {
        generationLogger.warn('Grounded generation failed, falling back to standard', { error });
      }
      // Fallback: ungrounded single-pass
      try {
        const fallback = await gateway.callText(this.ctx, {
          mode: 'text',
          task: 'generation',
          tier: 'balanced',
          endpoint: ENDPOINT,
          userPrompt: prompt,
        });
        if (fallback.blocked) return null;
        return this.parseResponse(fallback.text ?? '');
      } catch (fallbackError) {
        generationLogger.error('Generation failed completely', { error: fallbackError });
        return null;
      }
    }
  }

  /**
   * Self-refine strategy: critique and improve a generated question.
   * Uses a second LLM call to identify weaknesses and produce a refined version.
   */
  private async selfRefine(draft: any, originalPrompt: string): Promise<any> {
    const critiquePrompt = `You are a PANCE question quality reviewer. Critique this generated question and improve it.

ORIGINAL PROMPT CONTEXT:
${originalPrompt.slice(0, 500)}

GENERATED QUESTION:
${JSON.stringify(draft, null, 2)}

Evaluate for:
1. Clinical accuracy — are the findings, diagnosis, and treatment correct?
2. Distractor quality — are incorrect options plausible but clearly wrong?
3. Rationale completeness — does it explain why each option is correct/incorrect?
4. PANCE appropriateness — does it match the style and difficulty of PANCE questions?

If the question is already high quality, return the original JSON unchanged.
If improvements are needed, return ONLY the improved JSON (no markdown).

Return ONLY valid JSON with the same structure as the input.`;

    try {
      const result = await gateway.callText(this.ctx, {
        mode: 'text',
        task: 'generation',
        tier: 'balanced',
        endpoint: `${ENDPOINT}#selfRefine`,
        userPrompt: critiquePrompt,
      });
      if (result.blocked) return draft;
      const refined = this.parseResponse(result.text ?? '');
      if (refined && refined.vignette && refined.options) {
        return refined;
      }
      return draft;
    } catch (err) {
      if (err instanceof GatewayError) {
        generationLogger.warn('self-refine gateway error, falling back to draft', {
          code: err.code,
          message: err.message,
        });
      } else {
        generationLogger.warn('self-refine failed, falling back to draft', { error: err });
      }
      return draft;
    }
  }

  /**
   * Extract Google Search grounding sources from the gateway response.
   * Prefer the normalized `groundingMetadata` field, fall back to the raw
   * candidate shape for older response envelopes.
   */
  private extractGroundingSources(result: GatewayResultShape): GroundingSource[] {
    try {
      const metadata = result.groundingMetadata as
        | { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> }
        | undefined;

      let chunks = metadata?.groundingChunks ?? [];
      if (chunks.length === 0) {
        const rawCandidates =
          (result.raw as { candidates?: Array<{ groundingMetadata?: { groundingChunks?: any[] } }> } | undefined)
            ?.candidates ?? [];
        chunks = rawCandidates[0]?.groundingMetadata?.groundingChunks ?? [];
      }

      const sources: GroundingSource[] = [];
      const seen = new Set<string>();

      for (const chunk of chunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && title && !seen.has(uri)) {
          seen.add(uri);
          sources.push({ uri, title });
        }
      }

      return sources.slice(0, 5); // Cap at 5 sources
    } catch (err) {
      generationLogger.debug('grounding source extraction failed', { error: err });
      return [];
    }
  }

  private parseResponse(text: string): any {
    try {
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
      else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
      if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
      jsonText = jsonText.trim();
      return JSON.parse(jsonText);
    } catch (error) {
      generationLogger.error('Failed to parse JSON', { error });
      return null;
    }
  }
}
