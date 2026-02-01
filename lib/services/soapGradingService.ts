// lib/services/soapGradingService.ts
// SOAP Note grading via Gemini proxy (Cloudflare /api/gemini)

import { API_ENDPOINTS } from '@/lib/utils/apiConfig';

export interface GradingResult {
  totalScore: number; // 0-100
  breakdown: {
    subjective: number; // 0-25
    objective: number; // 0-25
    assessment: number; // 0-25
    plan: number; // 0-25
  };
  feedback: {
    strengths: string[];
    missedConcepts: string[]; // Critical findings they forgot
    suggestions: string[]; // Style/Medical phrasing improvements
  };
}

const isTestEnv =
  typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');

const isDevEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * Call Gemini via the Cloudflare Pages proxy at /geminiProxy
 * and return a structured SOAP grading result.
 */
export async function gradeSoapNote(userNote: string, caseContext: string): Promise<GradingResult> {
  const trimmedNote = userNote.trim();
  if (!trimmedNote) {
    throw new Error('SOAP note is empty');
  }

  const trimmedContext = caseContext.trim();

  const prompt = `You are a strict PANCE/USMLE Board Examiner.

Task: Evaluate the Student's SOAP Note against the Answer Key (Correct Case Findings).

Input:
Student Note:
"""
${trimmedNote}
"""

Correct Case Findings (Answer Key):
"""
${trimmedContext}
"""

Rubric:
- Award points for identifying key pathologies, correct vitals, appropriate differentials, and SAFE management plans.
- Penalize heavily for missing "do not miss" diagnoses, unsafe plans, or major misunderstandings.
- Weight each SOAP component equally (Subjective, Objective, Assessment, Plan).
- Focus feedback on what a PA student can realistically improve on their very next attempt.

Scoring Rules (STRICT):
- Each section (subjective, objective, assessment, plan) MUST be scored from 0 to 25.
- The totalScore MUST equal the EXACT sum of these four section scores.
- Do NOT invent any additional scoring dimensions.

Feedback Formatting Rules:
- feedback.strengths: maximum of 5 concise bullets.
- feedback.missedConcepts: maximum of 5 concise bullets focusing on truly important missed findings.
- feedback.suggestions: maximum of 5 concise bullets focusing on style/phrasing/organization.
- Each bullet should be a single, coaching-oriented sentence and stay under ~25 words.

Output format:
Respond PURELY in JSON matching this TypeScript interface. No markdown, no commentary, no code fences. Do not include explanation outside the JSON object.

interface GradingResult {
  totalScore: number; // 0-100
  breakdown: {
    subjective: number; // 0-25
    objective: number; // 0-25
    assessment: number; // 0-25
    plan: number; // 0-25
  };
  feedback: {
    strengths: string[];
    missedConcepts: string[]; // Critical findings they forgot
    suggestions: string[]; // Style/Medical phrasing improvements
  };
}
`;

  if (isTestEnv) {
    // Deterministic mock for tests
    return {
      totalScore: 80,
      breakdown: {
        subjective: 18,
        objective: 20,
        assessment: 22,
        plan: 20,
      },
      feedback: {
        strengths: ['Clear HPI structure', 'Appropriate vital sign interpretation'],
        missedConcepts: ['Did not mention red-flag symptom X'],
        suggestions: ['Tighten assessment wording', 'Add follow-up safety net instructions'],
      },
    };
  }

  const response = await fetch('/geminiProxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelName: 'gemini-1.5-pro',
      prompt,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    console.error('Gemini proxy returned error status', response.status);
    throw new Error('Gemini proxy error');
  }

  const data: any = await response.json();
  const rawText = typeof data === 'string' ? data : (data.data?.text ?? data.text);

  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response from Gemini');
  }

  if (isDevEnv) {
    // Log raw AI output in development to help tune prompts
    // eslint-disable-next-line no-console
    console.debug('[SOAP Grading] Raw Gemini response:', rawText);
  }

  // Gemini proxy already strips code fences, but we defensively clean again
  const jsonString = rawText
    .replace(/```json\n?/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonString) as GradingResult;

    // Safety guard: ensure totalScore matches sum of section scores
    if (parsed && parsed.breakdown) {
      const sectionTotal =
        parsed.breakdown.subjective +
        parsed.breakdown.objective +
        parsed.breakdown.assessment +
        parsed.breakdown.plan;

      if (typeof parsed.totalScore !== 'number' || parsed.totalScore !== sectionTotal) {
        return {
          ...parsed,
          totalScore: sectionTotal,
        };
      }
    }

    // Safety guard: enforce max lengths on feedback arrays
    if (parsed && parsed.feedback) {
      const { feedback } = parsed;
      feedback.strengths = Array.isArray(feedback.strengths) ? feedback.strengths.slice(0, 5) : [];
      feedback.missedConcepts = Array.isArray(feedback.missedConcepts)
        ? feedback.missedConcepts.slice(0, 5)
        : [];
      feedback.suggestions = Array.isArray(feedback.suggestions)
        ? feedback.suggestions.slice(0, 5)
        : [];
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse SOAP grading JSON:', error, jsonString);
    throw new Error('Failed to parse grading result from AI');
  }
}
