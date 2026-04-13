import { GoogleGenerativeAI } from '@google/generative-ai';
import { type MedicalContentData } from '../content/types';
import { logger } from '../../logger';

const LOG_SCOPE = 'QuestionGenerationService';

export interface GroundingSource {
  uri: string;
  title: string;
}

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
   * Generate a review question based on medical content
   */
  async generateReviewQuestion(
    content: MedicalContentData,
    difficulty: string = 'medium'
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
      // Use grounded model for evidence-backed generation
      const result = await this.groundedModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      const parsed = this.parseResponse(text);

      if (parsed) {
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
      logger.warn(LOG_SCOPE, 'Grounded generation failed, falling back to standard', error);
      try {
        const result = await this.model.generateContent(prompt);
        const text = result.response.text();
        return this.parseResponse(text);
      } catch (fallbackError) {
        logger.error(LOG_SCOPE, 'Generation failed completely', fallbackError);
        return null;
      }
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
    } catch {
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
      logger.error(LOG_SCOPE, 'Failed to parse JSON', error);
      return null;
    }
  }
}
