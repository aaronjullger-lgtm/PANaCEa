/**
 * Contrastive Drill Generator
 *
 * Generates clinical vignettes for contrastive learning drills
 * where students must distinguish between similar conditions.
 */

export interface ContrastiveQuestionRequest {
  symptom: string;
  targetCondition: string;
  otherConditions: string[];
  distinguishers: Record<string, string[]>;
}

export interface ContrastiveQuestion {
  vignette: string;
  question: string;
  options: string[];
  correctAnswer: string;
  keyDistinguishers: string[];
  whyNotOthers: Record<string, string>;
}

export interface GeneratedContrastiveQuestion {
  vignette: string;
  keyDistinguishers: string[];
  whyNotOthers: Record<string, string>;
}

/**
 * Build Gemini prompt for contrastive question generation (used by API endpoint)
 */
export function buildContrastivePrompt(
  set: any,
  targetCondition: string,
  otherConditions: string[]
): string {
  const distinguishers = (set.distinguishers || {}) as Record<string, string[]>;

  return `You are a medical education expert. Generate a clinical vignette for a CONTRASTIVE LEARNING drill.

**Symptom:** ${set.symptom}
**Target Condition (Correct Answer):** ${targetCondition}
**Other Conditions in Set:** ${otherConditions.join(', ')}

**Requirements:**
1. The vignette MUST include 2-3 KEY DISTINGUISHING FEATURES that make ${targetCondition} the clear answer
2. These features should be UNIQUE to ${targetCondition} and NOT present in the other conditions
3. Include subtle "red herrings" that might initially suggest other conditions
4. The question should test the learner's ability to DISCRIMINATE between similar presentations
5. Be clinically realistic and high-yield for exam preparation

**Distinguishing Features for ${targetCondition}:**
${distinguishers[targetCondition]?.join('\n') || 'Not specified'}

**Distinguishing Features for Other Conditions:**
${otherConditions
  .map(
    (condition) =>
      `${condition}:\n${distinguishers[condition]?.map((d) => `  - ${d}`).join('\n') || '  Not specified'}`
  )
  .join('\n\n')}

Generate a JSON response with the following structure:

{
  "vignette": "Complete clinical vignette with patient demographics, presentation, and distinguishing features",
  "keyDistinguishers": ["Top 3 features in the vignette that point to the correct answer"],
  "whyNotOthers": {
    "${otherConditions[0]}": "Brief explanation of why this is not the answer",
    "${otherConditions[1]}": "Brief explanation of why this is not the answer"
  }
}

Return ONLY valid JSON, no additional text.`;
}

/**
 * Build Gemini prompt for contrastive question generation (standalone version)
 */
export function buildContrastivePromptStandalone(request: ContrastiveQuestionRequest): string {
  const { symptom, targetCondition, otherConditions, distinguishers } = request;

  return `You are a medical education expert. Generate a clinical vignette for a CONTRASTIVE LEARNING drill.

**Symptom:** ${symptom}
**Target Condition (Correct Answer):** ${targetCondition}
**Other Conditions in Set:** ${otherConditions.join(', ')}

**Requirements:**
1. The vignette MUST include 2-3 KEY DISTINGUISHING FEATURES that make ${targetCondition} the clear answer
2. These features should be UNIQUE to ${targetCondition} and NOT present in the other conditions
3. Include subtle "red herrings" that might initially suggest other conditions
4. The question should test the learner's ability to DISCRIMINATE between similar presentations
5. Be clinically realistic and high-yield for exam preparation

**Distinguishing Features for ${targetCondition}:**
${distinguishers[targetCondition]?.join('\n') || 'Not specified'}

**Distinguishing Features for Other Conditions:**
${otherConditions
  .map(
    (condition) =>
      `${condition}:\n${distinguishers[condition]?.map((d) => `  - ${d}`).join('\n') || '  Not specified'}`
  )
  .join('\n\n')}

Generate a JSON response with the following structure:

{
  "vignette": "Complete clinical vignette with patient demographics, presentation, and distinguishing features",
  "question": "What is the most likely diagnosis?",
  "options": ["${targetCondition}", "${otherConditions[0]}", "${otherConditions[1]}", "${otherConditions[2] || otherConditions[0]}"],
  "correctAnswer": "${targetCondition}",
  "keyDistinguishers": ["Top 3 features in the vignette that point to the correct answer"],
  "whyNotOthers": {
    "${otherConditions[0]}": "Brief explanation of why this is not the answer",
    "${otherConditions[1]}": "Brief explanation of why this is not the answer"
  }
}

Return ONLY valid JSON, no additional text.`;
}

/**
 * Generate a contrastive question using Gemini (standalone version)
 */
export async function generateContrastiveQuestion(
  request: ContrastiveQuestionRequest,
  apiKey: string
): Promise<ContrastiveQuestion | null> {
  const prompt = buildContrastivePromptStandalone(request);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', await response.text());
      return null;
    }

    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('No text in Gemini response');
      return null;
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to generate contrastive question:', error);
    return null;
  }
}

/**
 * Generate multiple questions for a contrastive set
 * (one question per condition in the set)
 */
export async function generateContrastiveSetQuestions(
  symptom: string,
  conditions: string[],
  distinguishers: Record<string, string[]>,
  apiKey: string
): Promise<ContrastiveQuestion[]> {
  const questions: ContrastiveQuestion[] = [];

  for (const targetCondition of conditions) {
    const otherConditions = conditions.filter((c) => c !== targetCondition);

    const question = await generateContrastiveQuestion(
      {
        symptom,
        targetCondition,
        otherConditions,
        distinguishers,
      },
      apiKey
    );

    if (question) {
      questions.push(question);
    }

    // Rate limiting delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return questions;
}
