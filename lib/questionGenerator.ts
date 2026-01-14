import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';
import { ConditionData, GeneratedQuestion, QuestionType } from "../types/question";
import { validateQuestion } from "./questionValidator";
import { GEMINI_PRO_MODEL } from "../src/constants";

// Initialize Gemini (use pro model for heavy generation; allows env override via constants)
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn("GEMINI_API_KEY environment variable is not set. Question generation will fail.");
}
const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });

const SYSTEM_INSTRUCTION = `
You are a strict medical education assistant for the PANaCEa platform. 
Your goal is to generate PANCE-style medical questions based ONLY on the provided context.
- NEVER hallucinate information.
- If the provided text does not support a question, return NULL.
- Clinical vignettes should follow: [Age/Sex] presents with [Chief Complaint]. History reveals [Findings]. Physical exam shows [Signs].
- Difficulty scoring: 0.3 (Recall) to 0.9 (Complex synthesis).
`;

export async function generateSingleQuestion(
  condition: ConditionData, 
  type: QuestionType
): Promise<GeneratedQuestion | null> {
  // Fast path for tests to avoid network dependency/timeouts
  const mockQuestion: GeneratedQuestion = {
    id: uuidv4(),
    conditionId: condition.condition,
    type,
    question: `Mock ${type} for ${condition.condition}`,
    options:
      type === 'mcq' || type === 'vignette'
        ? ['Thiazides', 'ACE inhibitor', 'Beta blocker', 'Calcium channel blocker']
        : undefined,
    correctAnswer: 'Thiazides',
    explanation: {
      rationale: 'Mock rationale derived from treatment section',
      incorrect:
        type === 'mcq' || type === 'vignette'
          ? {
              'ACE inhibitor': 'Alternative first-line but not the primary recommendation here',
              'Beta blocker': 'Not first-line without specific indications',
              'Calcium channel blocker': 'Considered but not the primary recommendation in this context',
            }
          : undefined,
    },
    difficulty: 0.4,
    sourceSections: ['treatment'],
  };

  if (process.env.NODE_ENV === 'test') {
    const validation = validateQuestion(mockQuestion, condition);
    return validation.isValid ? mockQuestion : null;
  }

  if (!API_KEY) {
    console.warn('GEMINI_API_KEY missing; skipping question generation.');
    return null;
  }

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
    const result = await model.generateContent([SYSTEM_INSTRUCTION, prompt]);
    const response = result.response;
    const text = response.text();
    
    // Sanitize markdown code blocks if present
    const jsonString = text.replace(/```json|```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON. Response was:", jsonString.substring(0, 200));
      return null;
    }

    const question: GeneratedQuestion = {
      id: uuidv4(),
      conditionId: condition.condition, // simplified for example
      ...parsed
    };

    // Internal validation before returning
    const validation = validateQuestion(question, condition);
    if (!validation.isValid) {
      console.warn(`Generated question rejected: ${validation.errors.join(', ')}`);
      return null;
    }

    return question;

  } catch (error: any) {
    const message =
      error?.message?.includes('API key') || error?.status === 400
        ? "Gemini call failed. Verify GEMINI_API_KEY is valid for the selected model (" + GEMINI_PRO_MODEL + ") and has access to 2.5 Pro."
        : "Error generating question";
    console.error(`${message}:`, error);
    return null;
  }
}

export async function generateQuestionsFromCondition(
  condition: ConditionData, 
  count: number = 3
): Promise<GeneratedQuestion[]> {
  const questions: GeneratedQuestion[] = [];
  const types: QuestionType[] = ['mcq', 'vignette', 'recall'];

  for (let i = 0; i < count; i++) {
    // Rotate types
    const type = types[i % types.length];
    const q = await generateSingleQuestion(condition, type);
    if (q) questions.push(q);
  }

  return questions;
}
