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
  type: string,
  textbookContext?: { title: string; excerpts: string[] } | null
): Promise<GeneratedQuestion | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const textbookBlock =
    textbookContext && textbookContext.excerpts.length > 0
      ? `
    TEXTBOOK CONTEXT (use ONLY as supporting evidence):
    Source: ${textbookContext.title}
    Excerpts:
    ${textbookContext.excerpts.map((excerpt, idx) => `${idx + 1}. ${excerpt}`).join('\n')}
    `
      : '';

  const prompt = `
    CONTEXT:
    Condition: ${condition.condition}
    Data: ${JSON.stringify(condition.sections)}
    ${textbookBlock}

    KAPLAN-LEVEL RULES:
    - Third-order / "Double Jump": Prefer stems that require a chain (Vignette → Diagnosis → Complication/next step → Answer). Example: circular rash → Lyme → first-line for complication → mechanism of doxycycline (30S). Avoid first-order "What is the diagnosis?" when a third-order stem is feasible.
    - Kaplan-level distractors: Every wrong answer must be correct for a slightly different patient (e.g. otitis: viral vs bacterial vs recurrent vs penicillin-allergic). No obviously wrong options.

    TASK:
    Generate one high-quality '${type}' question strictly based on the data above.
    If textbook context is present, ensure the question aligns with those excerpts.
    
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
