import { GoogleGenerativeAI } from '@google/generative-ai';
import { type MedicalContentData } from '../content/types';
import { logger } from '../../logger';
import type { ABAssignmentMap } from '../../middleware/abTestMiddleware';

const LOG_SCOPE = 'QuestionGenerationService';
const generationLogger = logger.scope(LOG_SCOPE);

export interface GroundingSource {
  uri: string;
  title: string;
}

/** A/B-testable generation strategies */
export type GenerationStrategy = 'single-pass' | 'self-refine' | 'rag-grounded';

export class QuestionGenerationService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private groundedModel: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    // Model with Google Search grounding enabled for evidence-backed generation
    this.groundedModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} } as any],
    });
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

      let result: any;
      let response: any;

      if (strategy === 'single-pass') {
        // Direct generation without grounding — fastest path
        result = await this.model.generateContent(prompt);
        response = result.response;
      } else if (strategy === 'self-refine') {
        // Two-pass: generate then self-critique and refine
        result = await this.model.generateContent(prompt);
        response = result.response;
        let parsed = this.parseResponse(response.text());
        if (parsed) {
          parsed = await this.selfRefine(parsed, prompt);
        }
        return parsed;
      } else {
        // rag-grounded (default): use grounded model for evidence-backed generation
        result = await this.groundedModel.generateContent(prompt);
        response = result.response;
      }

      const text = response.text();
      const parsed = this.parseResponse(text);

      if (parsed && strategy === 'rag-grounded') {
        // Extract grounding sources from response metadata
        const groundingSources = this.extractGroundingSources(response);
        if (groundingSources.length > 0) {
          parsed.rationale = parsed.rationale || {};
          parsed.rationale.groundingSources = groundingSources;
        }
      }

      return parsed;
    } catch (error) {
      // Fallback to ungrounded model if search grounding fails
      generationLogger.warn('Grounded generation failed, falling back to standard', { error });
      try {
        const result = await this.model.generateContent(prompt);
        const text = result.response.text();
        return this.parseResponse(text);
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
      const result = await this.model.generateContent(critiquePrompt);
      const refined = this.parseResponse(result.response.text());
      if (refined && refined.vignette && refined.options) {
        return refined;
      }
      return draft;
    } catch (err) {
      console.warn('[generationService] self-refine failed, falling back to draft', err);
      return draft;
    }
  }

  /**
   * Extract Google Search grounding sources from the Gemini response.
   * These provide evidence citations (URIs + titles) from real web sources.
   */
  private extractGroundingSources(response: any): GroundingSource[] {
    try {
      const candidates = response?.candidates || [];
      const firstCandidate = candidates[0];
      const groundingMetadata = firstCandidate?.groundingMetadata;
      if (!groundingMetadata?.groundingChunks) return [];

      const sources: GroundingSource[] = [];
      const seen = new Set<string>();

      for (const chunk of groundingMetadata.groundingChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && title && !seen.has(uri)) {
          seen.add(uri);
          sources.push({ uri, title });
        }
      }

      return sources.slice(0, 5); // Cap at 5 sources
    } catch (err) {
      console.debug('[generationService] grounding source extraction failed', err);
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
