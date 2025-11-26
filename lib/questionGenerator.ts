import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';
import { ConditionData, GeneratedQuestion, QuestionType } from "../types/question";
import { validateQuestion } from "./questionValidator";

// Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
    const parsed = JSON.parse(jsonString);

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

  } catch (error) {
    console.error("Error generating question:", error);
    return null;
  }
}

export async function generateQuestionsFromCondition(
  condition: ConditionData, 
  count: number = 3
): Promise<GeneratedQuestion[]> {
  const types: QuestionType[] = ['mcq', 'vignette', 'recall'];
  const questions: GeneratedQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const question = await generateSingleQuestion(condition, type);
    if (question) {
      questions.push(question);
    }
  }

  return questions;
}
