import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ConditionData {
  condition: string;
  sections: {
    overview: string;
    etiology: string;
    clinicalPresentation: string;
    diagnostics: string;
    treatment: string;
  };
}

export interface GeneratedQuestion {
  type: string;
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: {
    rationale: string;
    incorrect?: Record<string, string>;
  };
  difficulty: number;
  sourceSections?: string[];
  system?: string;
  generatedAt?: string;
  metadata?: any;
  id?: string;
  text?: string; // Fallback for some interfaces
}

export async function generateSingleQuestion(
  apiKey: string,
  condition: ConditionData,
  type: string
): Promise<GeneratedQuestion | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
    CONTEXT:
    Condition: ${condition.condition}
    Data: ${JSON.stringify(condition.sections)}

    TASK:
    Generate one high-quality '${type}' question strictly based on the data above.
    
    OUTPUT FORMAT (JSON only):
    {
      "type": "${type}",
      "question": "...",
      "options": ["A", "B", "C", "D"], // include only for mcq/vignette
      "correctAnswer": "Matches one option exactly",
      "explanation": {
          "rationale": "Why the correct answer is correct based on the text.",
          "incorrect": {"A": "...", "B": "...", "C": "...", "D": "..."}
      },
      "difficulty": 0.5,
      "sourceSections": ["sectionKey1"]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean up markdown code blocks if present
    const jsonStr = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const question = JSON.parse(jsonStr);
    return question;
  } catch (error) {
    console.error('Error generating question:', error);
    return null;
  }
}
