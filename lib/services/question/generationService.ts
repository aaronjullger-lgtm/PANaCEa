import { GoogleGenerativeAI } from '@google/generative-ai';
import { type MedicalContentData } from '../content/types';

export class QuestionGenerationService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      return this.parseResponse(text);
    } catch (error) {
      console.error('[QuestionGenerationService] Generation failed:', error);
      return null;
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
      console.error('[QuestionGenerationService] Failed to parse JSON:', error);
      return null;
    }
  }
}
