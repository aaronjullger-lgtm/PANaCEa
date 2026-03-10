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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const textbookBlock =
    textbookContext && textbookContext.excerpts.length > 0
      ? `
    TEXTBOOK CONTEXT (use ONLY as supporting evidence):
    Source: ${textbookContext.title}
    Excerpts:
    ${textbookContext.excerpts.map((excerpt, idx) => `${idx + 1}. ${excerpt}`).join('\n')}
    `
      : '';

  // Pass findings-only for vignette-building; withhold condition/overview from vignette text
  const sections = condition.sections || {};
  const findingsContext = [
    sections.clinicalPresentation
      ? `Clinical Presentation: ${String(sections.clinicalPresentation).slice(0, 500)}`
      : '',
    sections.diagnostics
      ? `Lab/Imaging Patterns: ${String(sections.diagnostics).slice(0, 400)}`
      : '',
    sections.treatment ? `Treatment (for answer accuracy only): ${String(sections.treatment).slice(0, 300)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `
    CONTEXT - Use these clinical findings to build the vignette. Do NOT include condition name or diagnosis in the vignette.
    ${findingsContext}
    ${textbookBlock}

    CRITICAL - RAW PATIENT DATA: NEVER state the diagnosis or condition name in the vignette. Provide raw patient data only (demographics, symptoms, labs, vitals).

    KAPLAN-LEVEL RULES:
    - Third-order / "Double Jump" (STRICT): Prefer stems that require a chain (Vignette → Diagnosis → Complication/next step → Answer). Example: circular rash → Lyme → first-line for complication → mechanism of doxycycline (30S). Avoid first-order "What is the diagnosis?" when a third-order stem is feasible.
    - Kaplan-level distractors: Every wrong answer must be correct for a slightly different patient. No obviously wrong options.
    - Gold standard vs. initial: For "best initial step" or "next test" questions, include the gold standard as a distractor; rationale must clarify why it is wrong for this step.
    - Next best step: For "next step in management," state what has already been done first, then ask for the immediate next action.
    - Pertinent negatives: Include at least 2 pertinent negatives that rule out top differentials. Pharmacological contraindications: For therapeutics, include comorbidity that contraindicates first-line (e.g. HTN + gout; otitis + penicillin allergy).

    TASK:
    Generate one high-quality '${type}' question strictly based on the data above.
    If textbook context is present, ensure the question aligns with those excerpts.
    
    OUTPUT FORMAT (JSON only): Include structured rationale with whyIncorrectA/B/C/D for each distractor.
    {
      "type": "${type}",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "Matches one option exactly",
      "explanation": {
          "rationale": "Why the correct answer is correct.",
          "incorrect": {"A": "Why A is wrong for this patient; when it would be correct for another scenario", "B": "...", "C": "...", "D": "..."}
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
