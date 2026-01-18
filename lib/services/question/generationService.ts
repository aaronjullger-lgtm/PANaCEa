import { GoogleGenerativeAI } from '@google/generative-ai';
import { type MedicalContentData } from '../content/types';

export class QuestionGenerationService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Generate a review question based on medical content
   */
  async generateReviewQuestion(
    content: MedicalContentData,
    difficulty: string = 'medium'
  ): Promise<any> {
    const prompt = `Generate a PANCE-style follow-up review question about ${content.condition}.

This is a spaced repetition review. Create a DIFFERENT clinical vignette than typical questions for this condition, but test the SAME core concepts:
- Vary the patient demographics (age, sex)
- Use different presenting symptoms but same underlying condition
- Test the same diagnostic/treatment knowledge from a new angle

Condition Context:
- Overview: ${content.overview || 'N/A'}
- Classic Patient: ${content.classic_patient || 'N/A'}
- Symptoms: ${content.symptoms || 'N/A'}
- Diagnostics: ${content.diagnostics || 'N/A'}
- Gold Standard Dx: ${content.gold_standard_dx || 'N/A'}
- Treatment: ${content.treatment || 'N/A'}
- First Line Rx: ${content.first_line_rx || 'N/A'}
- Clinical Pearls: ${JSON.stringify(content.clinical_pearls || [])}

Requirements:
1. Clinical vignette: 2-4 sentences with realistic patient scenario
2. Question stem: Clear, PANCE-appropriate
3. 4 answer options (A, B, C, D) with one correct and three plausible distractors
4. Educational explanation for the correct answer

Return ONLY valid JSON (no markdown):
{
  "vignette": "Clinical scenario...",
  "question": "What is the most appropriate next step?",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
  "correctAnswer": "A",
  "explanation": "Detailed explanation...",
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
